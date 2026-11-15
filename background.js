// Chromium MV3 runs a service worker (importScripts); Firefox MV3 loads defaults.js via background.scripts
if (typeof importScripts === 'function') {
  importScripts('defaults.js');
}

const extApi = globalThis.browser ?? globalThis.chrome;

async function getActiveSites() {
  const res = await extApi.storage.local.get(['searchSites']);
  return resolveSites(res.searchSites).filter(site => site.enabled);
}

async function syncCustomContentScripts() {
  try {
    const res = await extApi.storage.local.get(['searchSites']);
    const dynamicSites = resolveSites(res.searchSites).filter(
      site => !isStaticManifestHost(site.urlTemplate)
    );

    const desired = new Map();
    const seenOrigins = new Set();
    for (const site of dynamicSites) {
      const originPattern = normalizeOriginPattern(site.urlTemplate);
      if (!originPattern || seenOrigins.has(originPattern)) continue;
      const hasPerm = await extApi.permissions.contains({ origins: [originPattern] });
      if (!hasPerm) continue;
      seenOrigins.add(originPattern);
      desired.set(getCustomScriptId(site.id), {
        id: getCustomScriptId(site.id),
        matches: [originPattern],
        js: ['defaults.js', 'content.js'],
        runAt: 'document_end',
        persistAcrossSessions: true
      });
    }

    const existing = await extApi.scripting.getRegisteredContentScripts();
    const existingManaged = existing.filter(s => s.id.startsWith(CUSTOM_SCRIPT_PREFIX));
    const existingById = new Map(existingManaged.map(s => [s.id, s]));

    const toUnregister = [];
    for (const script of existingManaged) {
      const target = desired.get(script.id);
      if (!target || (script.matches && script.matches[0] !== target.matches[0])) {
        toUnregister.push(script.id);
      }
    }

    if (toUnregister.length > 0) {
      await extApi.scripting.unregisterContentScripts({ ids: toUnregister });
      toUnregister.forEach(id => existingById.delete(id));
    }

    const toRegister = [];
    for (const [id, spec] of desired.entries()) {
      if (!existingById.has(id)) {
        toRegister.push(spec);
      }
    }

    if (toRegister.length > 0) {
      await extApi.scripting.registerContentScripts(toRegister);
    }
  } catch {}
}

extApi.runtime.onInstalled.addListener(() => {
  syncCustomContentScripts();
});

extApi.runtime.onStartup.addListener(() => {
  syncCustomContentScripts();
});

function isSafeHttpUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function openSubtitleTabs(urls, senderTab) {
  const validUrls = urls.filter(isSafeHttpUrl);
  if (validUrls.length === 0) return 0;

  const hasIndex = senderTab && typeof senderTab.index === 'number';
  const hasOpener = senderTab && typeof senderTab.id === 'number';
  const windowId = senderTab && typeof senderTab.windowId === 'number'
    ? senderTab.windowId
    : undefined;

  for (let i = 0; i < validUrls.length; i++) {
    const createProps = {
      url: validUrls[i],
      active: i === 0
    };
    if (windowId !== undefined) createProps.windowId = windowId;
    if (hasOpener) createProps.openerTabId = senderTab.id;
    if (hasIndex) createProps.index = senderTab.index + 1 + i;
    await extApi.tabs.create(createProps);
  }
  return validUrls.length;
}

extApi.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender && sender.id && sender.id !== extApi.runtime.id) return;
  if (message && message.type === 'syncContentScripts') {
    syncCustomContentScripts()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  if (message && message.type === 'openSubtitleTabs' && Array.isArray(message.urls)) {
    openSubtitleTabs(message.urls, sender ? sender.tab : null)
      .then(count => sendResponse({ ok: count > 0, count }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
});

extApi.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const query = normalizeSearchQuery(text);
  if (!query) return;

  const activeSites = await getActiveSites();
  const urls = activeSites
    .map(site => buildSearchUrl(site.urlTemplate, query))
    .filter(Boolean);

  const openInCurrent = !disposition || disposition === 'currentTab';
  const activateFirst = disposition !== 'newBackgroundTab';

  urls.forEach((url, index) => {
    if (index === 0 && openInCurrent) {
      extApi.tabs.update({ url });
    } else {
      extApi.tabs.create({ url, active: index === 0 && activateFirst });
    }
  });
});
