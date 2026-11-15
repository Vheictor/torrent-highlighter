// Top-level var declarations expose shared defaults to content scripts, popup, and MV3 importScripts()

var DEFAULT_COLD = [
  'REMUX', 'Hybrid', 'IMAX', 'Open Matte',
  'UHD', 'Dolby Vision', 'DoVi', 'DV', 'HDR10+',
  'TrueHD', 'Atmos', 'DTS-HD MA', 'DTS:X', 'LPCM', 'FLAC',
  'FraMeSToR', 'EPSiLON'
];

var DEFAULT_WARM = [
  'CAM', 'CAMRIP', 'HDCAM', 'NEWCAM',
  'TS', 'TELESYNC', 'HD-TS',
  'TC', 'TELECINE', 'HD-TC',
  'WORKPRINT', 'PREDVD', 'SCREENER', 'DVDSCR', 'BDSCR',
  'CAM AUDIO', 'HQ MIC', 'MD', 'LINE AUDIO', 'LD',
  'WATERMARK', 'HARDSUB', 'HC', 'KORSUB', 'CHNSUB',
  '1XBET', '1XBIT', 'MELBET', 'MOSTBET', 'MEGAPARI', '888STARZ',
  'BET365', 'BETWINNER', 'LINEBET', 'PARIMATCH', 'PINUP', '1WIN', '22BET',
  'AI UPSCALE', 'AI UPSCALED', 'AI ENHANCED', 'TOPAZ',
  '240p', '360p', '480p', '576p',
  'VHSRIP', 'TVRIP', 'SDTV', 'PDTV', 'WEBCAP',
  'RMVB', 'FLV', 'WMV', 'DIVX', 'XVID', 'AVI', 'MP3'
];

var DEFAULT_HIDE_TRASH = true;

var DEFAULT_SITES = [
  {
    id: 'builtin-1337x',
    name: '1337x',
    urlTemplate: 'https://1337x.tube/search/?order=length&catname=&q={q}',
    enabled: true,
    builtin: true
  },
  {
    id: 'builtin-limetorrents',
    name: 'LimeTorrents',
    urlTemplate: 'https://limetorrents.torrentsbay.org/search/all/{q}/',
    enabled: false,
    builtin: true
  },
  {
    id: 'builtin-nyaa',
    name: 'Nyaa.si',
    urlTemplate: 'https://nyaa.si/?f=0&c=0_0&q={q}',
    enabled: false,
    builtin: true
  }
];

var SUBTITLE_PRESET_LANGUAGES = ['en', 'fr'];
var ISO_LANG_CODE_REGEX = /^[a-z]{2}$/i;

var DEFAULT_SUBTITLE_SETTINGS = {
  activeLangs: ['en'],
  customLangs: []
};

var DEFAULT_SUBTITLE_PROVIDERS = [
  {
    id: 'opensubtitles',
    name: 'OpenSubtitles',
    urlTemplate: 'https://www.opensubtitles.com/en/{lang}/search-all/q-{q_plus}/hearing_impaired-include/machine_translated-/trusted_sources-',
    enabled: true,
    builtin: true
  },
  {
    id: 'subdl',
    name: 'SubDL',
    urlTemplate: 'https://subdl.com/search/{q}',
    enabled: false,
    builtin: true
  },
  {
    id: 'subsource',
    name: 'Subsource',
    urlTemplate: 'https://subsource.net/search?q={q}',
    enabled: false,
    builtin: true
  },
  {
    id: 'subtitlecat',
    name: 'SubtitleCat',
    urlTemplate: 'https://www.subtitlecat.com/index.php?search={q_plus}',
    enabled: false,
    builtin: true
  }
];

var CUSTOM_SCRIPT_PREFIX = 'tor-site-';

var STATIC_MANIFEST_DOMAINS = [
  'torrentsbay.org',
  '1337x.tube',
  '1337x.to',
  'nyaa.si'
];

function getCustomScriptId(siteId) {
  return `${CUSTOM_SCRIPT_PREFIX}${String(siteId).replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function isStaticManifestHost(urlTemplate) {
  const host = extractDisplayHost(urlTemplate).toLowerCase();
  if (!host) return false;
  return STATIC_MANIFEST_DOMAINS.some(domain => host === domain || host.endsWith(`.${domain}`));
}

function normalizeOriginPattern(urlTemplate) {
  if (typeof urlTemplate !== 'string') return null;
  const trimmed = urlTemplate.trim();
  if (!trimmed) return null;
  const hostPart = trimmed.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  if (!hostPart || hostPart.includes('{q}')) return null;
  try {
    const parsed = new URL(trimmed.replace(/\{q\}/g, 'query'));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname) return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  } catch {
    return null;
  }
}

function normalizeSearchQuery(raw) {
  if (typeof raw !== 'string') return '';
  const trimmedRaw = raw.trim();
  if (!trimmedRaw) return '';

  // Strip diacritics on Latin characters only (preserving CJK/Cyrillic) and keep decimal audio tokens like 5.1
  let s = trimmedRaw.replace(/\p{Script=Latin}[\p{Script=Latin}\u0300-\u036f]*/gu, part =>
    part.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  s = s.replace(/['\u2018\u2019]/g, '');
  s = s.replace(/[:;\-\u2013\u2014/\\|&?!,#"`()[\]{}*~]/g, ' ');
  s = s.replace(/(?<!\d)\.|\.(?!\d)/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  return s || trimmedRaw;
}

function buildSearchUrl(urlTemplate, query) {
  if (typeof urlTemplate !== 'string' || !urlTemplate.includes('{q}')) return null;
  const cleanQuery = normalizeSearchQuery(query);
  if (!cleanQuery) return null;
  if (!normalizeOriginPattern(urlTemplate)) return null;
  return urlTemplate.trim().replace(/\{q\}/g, () => encodeURIComponent(cleanQuery));
}

function replaceUrlPlaceholdersForParse(urlTemplate) {
  return urlTemplate
    .replace(/\{q_plus\}/g, 'query')
    .replace(/\{q\}/g, 'query')
    .replace(/\{lang\}/g, 'en');
}

function hasSubtitleQueryPlaceholder(urlTemplate) {
  return typeof urlTemplate === 'string' && (urlTemplate.includes('{q}') || urlTemplate.includes('{q_plus}'));
}

function isValidSubtitleUrlTemplate(urlTemplate) {
  if (!hasSubtitleQueryPlaceholder(urlTemplate)) return false;
  const trimmed = urlTemplate.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  const hostPart = trimmed.replace(/^https?:\/\//i, '').split(/[/?#]/)[0];
  if (!hostPart || /[{}]/.test(hostPart)) return false;
  try {
    const parsed = new URL(replaceUrlPlaceholdersForParse(trimmed));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function extractDisplayHost(urlTemplate) {
  if (typeof urlTemplate !== 'string') return '';
  try {
    const parsed = new URL(replaceUrlPlaceholdersForParse(urlTemplate.trim()));
    return parsed.hostname;
  } catch {
    return '';
  }
}

function resolveSites(storedSites) {
  if (!Array.isArray(storedSites)) {
    return DEFAULT_SITES.map(site => ({ ...site }));
  }

  return storedSites
    .filter(s => s && s.id && s.name && s.urlTemplate && normalizeOriginPattern(s.urlTemplate))
    .map(s => ({
      id: String(s.id),
      name: String(s.name),
      urlTemplate: String(s.urlTemplate),
      enabled: Boolean(s.enabled),
      builtin: Boolean(s.builtin)
    }));
}

function resolveSubtitleProviders(storedProviders, legacySettings = null) {
  if (!Array.isArray(storedProviders)) {
    return DEFAULT_SUBTITLE_PROVIDERS.map(provider => ({ ...provider }));
  }

  const legacySelectedId =
    legacySettings && typeof legacySettings.provider === 'string'
      ? legacySettings.provider
      : DEFAULT_SUBTITLE_PROVIDERS[0].id;

  const valid = storedProviders
    .filter(p => p && p.id && p.name && p.urlTemplate && isValidSubtitleUrlTemplate(p.urlTemplate))
    .map(p => {
      const id = String(p.id);
      const builtin = Boolean(p.builtin);
      let urlTemplate = String(p.urlTemplate);
      if (id === 'subsource' && builtin && urlTemplate === 'https://subsource.net/subtitles/{q}') {
        urlTemplate = 'https://subsource.net/search?q={q}';
      }
      return {
        id,
        name: String(p.name),
        urlTemplate,
        enabled: typeof p.enabled === 'boolean' ? p.enabled : id === legacySelectedId,
        builtin
      };
    });

  return valid.length > 0 ? valid : DEFAULT_SUBTITLE_PROVIDERS.map(provider => ({ ...provider }));
}

function isValidIsoLangCode(code) {
  return typeof code === 'string' && ISO_LANG_CODE_REGEX.test(code.trim());
}

function normalizeIsoLangCode(code) {
  if (!isValidIsoLangCode(code)) return '';
  return code.trim().toLowerCase();
}

function getDefaultSubtitleSettings() {
  return {
    activeLangs: [...DEFAULT_SUBTITLE_SETTINGS.activeLangs],
    customLangs: [...DEFAULT_SUBTITLE_SETTINGS.customLangs]
  };
}

function resolveSubtitleSettings(stored) {
  if (!stored || typeof stored !== 'object') {
    return getDefaultSubtitleSettings();
  }

  if (!Array.isArray(stored.activeLangs)) {
    if (stored.lang === 'fr') {
      return { activeLangs: ['fr'], customLangs: [] };
    }
    if (stored.lang === 'en') {
      return { activeLangs: ['en'], customLangs: [] };
    }
    if (stored.lang === 'fr+en') {
      return { activeLangs: ['en', 'fr'], customLangs: [] };
    }
    return getDefaultSubtitleSettings();
  }

  const presetSet = new Set(SUBTITLE_PRESET_LANGUAGES);
  const customLangs = [];
  const seenCustom = new Set();

  if (Array.isArray(stored.customLangs)) {
    stored.customLangs.forEach(item => {
      const code = normalizeIsoLangCode(item);
      if (code && !presetSet.has(code) && !seenCustom.has(code)) {
        seenCustom.add(code);
        customLangs.push(code);
      }
    });
  }

  const activeSet = new Set();
  stored.activeLangs.forEach(item => {
    const code = normalizeIsoLangCode(item);
    if (!code) return;
    if (!presetSet.has(code) && !seenCustom.has(code)) {
      seenCustom.add(code);
      customLangs.push(code);
    }
    activeSet.add(code);
  });

  const orderedAll = [...SUBTITLE_PRESET_LANGUAGES, ...customLangs];
  const activeLangs = orderedAll.filter(code => activeSet.has(code));

  return { activeLangs, customLangs };
}

function getSubtitleLangCode(settings) {
  if (Array.isArray(settings)) {
    const codes = settings.map(normalizeIsoLangCode).filter(Boolean);
    return codes.length > 0 ? codes.join(',') : 'all';
  }
  if (typeof settings === 'string') {
    const resolvedLegacy = resolveSubtitleSettings({ lang: settings });
    return resolvedLegacy.activeLangs.length > 0 ? resolvedLegacy.activeLangs.join(',') : 'all';
  }
  const resolved = resolveSubtitleSettings(settings);
  return resolved.activeLangs.length > 0 ? resolved.activeLangs.join(',') : 'all';
}

function formatSubtitleLangLabel(settings) {
  const resolved = resolveSubtitleSettings(settings);
  if (resolved.activeLangs.length === 0) return 'ALL';
  return resolved.activeLangs.map(code => code.toUpperCase()).join(', ');
}

function buildSubtitleUrlForProvider(query, settings, provider) {
  const clean = normalizeSearchQuery(query);
  if (!clean || !provider || !isValidSubtitleUrlTemplate(provider.urlTemplate)) return null;

  const encodedQ = encodeURIComponent(clean);
  const encodedQPlus = encodedQ.replace(/%20/g, '+');
  const langCode = getSubtitleLangCode(settings);

  return provider.urlTemplate
    .trim()
    .replace(/\{q_plus\}/g, () => encodedQPlus)
    .replace(/\{q\}/g, () => encodedQ)
    .replace(/\{lang\}/g, () => langCode);
}

function buildSubtitleSearchUrls(query, settings, providers = DEFAULT_SUBTITLE_PROVIDERS) {
  const clean = normalizeSearchQuery(query);
  if (!clean) return [];

  const list = resolveSubtitleProviders(providers, settings);
  const resolved = resolveSubtitleSettings(settings);
  let active = list.filter(item => item.enabled);

  if (active.length === 0) {
    const fallback =
      list.find(item => item.id === 'opensubtitles') || DEFAULT_SUBTITLE_PROVIDERS[0];
    active = [fallback];
  }

  return active
    .map(provider => ({
      provider,
      url: buildSubtitleUrlForProvider(clean, resolved, provider)
    }))
    .filter(entry => Boolean(entry.url));
}
