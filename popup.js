const extApi = globalThis.browser ?? globalThis.chrome;

document.addEventListener('DOMContentLoaded', async () => {
  const searchForm = document.getElementById('searchForm');
  const searchInputWrap = document.getElementById('searchInputWrap');
  const searchInput = document.getElementById('searchInput');
  const kbdHint = document.getElementById('kbdHint');
  const goBtn = document.getElementById('goBtn');
  const fxLayer = document.getElementById('fxLayer');
  const sourcesListEl = document.getElementById('sourcesList');
  const sourcesActiveOdoEl = document.getElementById('sourcesActiveOdo');
  const sourcesTotalCountEl = document.getElementById('sourcesTotalCount');
  const siteNameInput = document.getElementById('siteNameInput');
  const siteUrlInput = document.getElementById('siteUrlInput');
  const addSiteBtn = document.getElementById('addSiteBtn');
  const cancelEditSiteBtn = document.getElementById('cancelEditSiteBtn');
  const siteFeedbackEl = document.getElementById('siteFeedback');

  const subtitlesActiveOdoEl = document.getElementById('subtitlesActiveOdo');
  const subtitlesTotalCountEl = document.getElementById('subtitlesTotalCount');
  const subtitleLangGroup = document.getElementById('subtitleLangGroup');
  const subtitleProviderListEl = document.getElementById('subtitleProviderList');
  const subProviderNameInput = document.getElementById('subProviderNameInput');
  const subProviderUrlInput = document.getElementById('subProviderUrlInput');
  const addSubProviderBtn = document.getElementById('addSubProviderBtn');
  const cancelEditSubProviderBtn = document.getElementById('cancelEditSubProviderBtn');
  const subProviderFeedbackEl = document.getElementById('subProviderFeedback');

  const coldTagsEl = document.getElementById('coldTags');
  const warmTagsEl = document.getElementById('warmTags');
  const coldCountEl = document.getElementById('coldCount');
  const warmCountEl = document.getElementById('warmCount');
  const coldInput = document.getElementById('coldInput');
  const warmInput = document.getElementById('warmInput');
  const addColdBtn = document.getElementById('addColdBtn');
  const addWarmBtn = document.getElementById('addWarmBtn');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');
  const resetDefaultsLabel = document.getElementById('resetDefaultsLabel');

  const sourcesDrawer = document.getElementById('sourcesDrawer');
  const subtitlesDrawer = document.getElementById('subtitlesDrawer');
  const coldDrawer = document.getElementById('coldDrawer');
  const warmDrawer = document.getElementById('warmDrawer');
  const sourcesDrawerBtn = document.getElementById('sourcesDrawerBtn');
  const subtitlesDrawerBtn = document.getElementById('subtitlesDrawerBtn');
  const coldDrawerBtn = document.getElementById('coldDrawerBtn');
  const warmDrawerBtn = document.getElementById('warmDrawerBtn');

  let sites = resolveSites(null);
  let subtitleProviders = resolveSubtitleProviders(null);
  let subtitleSettings = resolveSubtitleSettings(null);
  let editingSiteId = null;
  let editingSubProviderId = null;
  let isAddingSubLang = false;
  let isSubmittingSite = false;
  let isLaunchingSearch = false;
  let isResettingDefaults = false;
  let feedbackTimer = null;
  let subFeedbackTimer = null;
  let resetTimer = null;

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefersReducedMotion = () => reducedMotionQuery.matches;

  const DUST_PALETTES = {
    cold: ['#38bdf8', '#7dd3fc', '#0ea5e9', '#bae6fd', '#e0f2fe'],
    warm: ['#f87171', '#fca5a5', '#ef4444', '#fb7185', '#fecaca'],
    purple: ['#a78bfa', '#c4b5fd', '#8b5cf6', '#ddd6fe', '#ede9fe']
  };

  function triggerAnimClass(el, className, fallbackMs = 800, targetSelector = null) {
    if (!el || prefersReducedMotion()) return;
    if (el._animTimers && el._animTimers[className]) {
      clearTimeout(el._animTimers[className]);
    }
    el.classList.remove(className);
    void el.getBoundingClientRect();
    el.classList.add(className);

    let done = false;
    const clear = () => {
      if (done) return;
      done = true;
      el.classList.remove(className);
    };
    const listenTarget = (targetSelector && el.querySelector(targetSelector)) || el;
    listenTarget.addEventListener('animationend', clear, { once: true });
    el._animTimers = el._animTimers || {};
    el._animTimers[className] = setTimeout(clear, fallbackMs);
  }

  function setOdometerValue(wrapEl, nextVal, animate = false) {
    if (!wrapEl) return;
    const nextStr = String(nextVal);
    const hasInitial = wrapEl.dataset.odoVal !== undefined;
    const prevVal = hasInitial ? parseInt(wrapEl.dataset.odoVal, 10) : nextVal;
    wrapEl.style.minWidth = `${Math.max(1, nextStr.length)}ch`;

    if (!hasInitial || !animate || prefersReducedMotion() || prevVal === nextVal) {
      wrapEl.dataset.odoVal = nextStr;
      wrapEl.textContent = '';
      const digit = document.createElement('span');
      digit.className = 'odo-digit';
      digit.textContent = nextStr;
      wrapEl.appendChild(digit);
      return;
    }

    wrapEl.dataset.odoVal = nextStr;
    wrapEl.querySelectorAll('.odo-digit.is-leaving').forEach(el => el.remove());

    const isIncrease = nextVal > prevVal;
    const currentDigit = wrapEl.querySelector('.odo-digit');
    if (currentDigit) {
      currentDigit.classList.remove('odo-in-from-top', 'odo-in-from-bottom');
      currentDigit.classList.add('is-leaving', isIncrease ? 'odo-out-down' : 'odo-out-up');
      let removed = false;
      const cleanupOld = () => {
        if (removed) return;
        removed = true;
        currentDigit.remove();
      };
      currentDigit.addEventListener('animationend', cleanupOld, { once: true });
      setTimeout(cleanupOld, 360);
    }

    const incoming = document.createElement('span');
    const inClass = isIncrease ? 'odo-in-from-top' : 'odo-in-from-bottom';
    incoming.className = `odo-digit ${inClass}`;
    incoming.textContent = nextStr;
    wrapEl.appendChild(incoming);

    let settled = false;
    const cleanupNew = () => {
      if (settled) return;
      settled = true;
      incoming.classList.remove(inClass);
    };
    incoming.addEventListener('animationend', cleanupNew, { once: true });
    setTimeout(cleanupNew, 360);
  }

  function applyCascadeIn(el, idx, stepMs = 32, maxDelayMs = 820) {
    if (!el || prefersReducedMotion()) return;
    const delay = Math.min(idx * stepMs, maxDelayMs);
    el.classList.add('is-cascade-in');
    el.style.animationDelay = `${delay}ms`;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      el.classList.remove('is-cascade-in');
      el.style.animationDelay = '';
    };
    el.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, delay + 440);
  }

  function triggerSwitchSnap(sliderEl, isChecked) {
    if (!sliderEl || prefersReducedMotion()) return;
    sliderEl.classList.remove('is-snapping-on', 'is-snapping-off');
    triggerAnimClass(sliderEl, isChecked ? 'is-snapping-on' : 'is-snapping-off', 580);
  }

  function spawnThanosDust(rect, paletteKey) {
    if (!fxLayer || !rect || prefersReducedMotion()) return;
    const colors = DUST_PALETTES[paletteKey] || DUST_PALETTES.cold;
    const count = 40 + Math.floor(Math.random() * 11);

    for (let i = 0; i < count; i++) {
      const grain = document.createElement('span');
      grain.className = 'dust-particle';

      // Stagger horizontal origin and delay so the pill disintegrates progressively from left to right
      const fracX = Math.min(0.98, Math.max(0.02, (i + Math.random() * 0.9) / count));
      const fracY = 0.08 + Math.random() * 0.84;
      const startX = rect.left + fracX * rect.width;
      const startY = rect.top + fracY * rect.height;

      const isFineDust = Math.random() < 0.55;
      const sizeW = isFineDust ? 1.5 + Math.random() * 1.0 : 3.0 + Math.random() * 1.5;
      const sizeH = sizeW * (isFineDust ? 0.8 + Math.random() * 0.4 : 0.65 + Math.random() * 0.55);
      const radius = isFineDust || i % 3 === 0 ? '50%' : `${(0.7 + Math.random() * 1.3).toFixed(1)}px`;
      const peakOpacity = (0.55 + Math.random() * 0.45).toFixed(2);

      const delay = Math.round(fracX * 285 + Math.random() * 55);
      const duration = 680 + Math.round(Math.random() * 400);

      const dx2 = 28 + Math.random() * 48;
      const dy2 = -(12 + Math.random() * 32);
      const dx1 = dx2 * (0.4 + Math.random() * 0.18);
      const dy1 = dy2 * (0.32 + Math.random() * 0.28) + (Math.random() - 0.5) * 12;
      const rot1 = (Math.random() - 0.5) * 100;
      const rot2 = rot1 + (Math.random() - 0.5) * 160;

      grain.style.left = `${startX.toFixed(1)}px`;
      grain.style.top = `${startY.toFixed(1)}px`;
      grain.style.width = `${sizeW.toFixed(1)}px`;
      grain.style.height = `${sizeH.toFixed(1)}px`;
      grain.style.borderRadius = radius;
      grain.style.backgroundColor = colors[i % colors.length];
      grain.style.setProperty('--dust-op', peakOpacity);
      grain.style.setProperty('--dx1', `${dx1.toFixed(1)}px`);
      grain.style.setProperty('--dy1', `${dy1.toFixed(1)}px`);
      grain.style.setProperty('--dx2', `${dx2.toFixed(1)}px`);
      grain.style.setProperty('--dy2', `${dy2.toFixed(1)}px`);
      grain.style.setProperty('--drot1', `${rot1.toFixed(0)}deg`);
      grain.style.setProperty('--drot2', `${rot2.toFixed(0)}deg`);
      grain.style.setProperty('--dust-dur', `${duration}ms`);
      grain.style.setProperty('--dust-delay', `${delay}ms`);
      fxLayer.appendChild(grain);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        grain.remove();
      };
      grain.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, duration + delay + 180);
    }
  }

  function spawnCardDeleteParticles(rect) {
    if (!fxLayer || !rect || prefersReducedMotion()) return;
    const colors = ['#f87171', '#fca5a5', '#ef4444', '#fb7185'];
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const count = 8 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'dust-particle';

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const dist = 14 + Math.random() * 20;
      const size = 2.2 + Math.random() * 2.2;
      const delay = Math.round(Math.random() * 55);
      const duration = 340 + Math.round(Math.random() * 170);

      const dx2 = Math.cos(angle) * dist + 4;
      const dy2 = Math.sin(angle) * dist - 6;
      const dx1 = dx2 * 0.55;
      const dy1 = dy2 * 0.55 - 2;
      const rot1 = (Math.random() - 0.5) * 90;
      const rot2 = rot1 + (Math.random() - 0.5) * 140;

      p.style.left = `${cx.toFixed(1)}px`;
      p.style.top = `${cy.toFixed(1)}px`;
      p.style.width = `${size.toFixed(1)}px`;
      p.style.height = `${size.toFixed(1)}px`;
      p.style.borderRadius = i % 2 === 0 ? '50%' : '1px';
      p.style.backgroundColor = colors[i % colors.length];
      p.style.setProperty('--dust-op', (0.72 + Math.random() * 0.28).toFixed(2));
      p.style.setProperty('--dx1', `${dx1.toFixed(1)}px`);
      p.style.setProperty('--dy1', `${dy1.toFixed(1)}px`);
      p.style.setProperty('--dx2', `${dx2.toFixed(1)}px`);
      p.style.setProperty('--dy2', `${dy2.toFixed(1)}px`);
      p.style.setProperty('--drot1', `${rot1.toFixed(0)}deg`);
      p.style.setProperty('--drot2', `${rot2.toFixed(0)}deg`);
      p.style.setProperty('--dust-dur', `${duration}ms`);
      p.style.setProperty('--dust-delay', `${delay}ms`);
      fxLayer.appendChild(p);

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        p.remove();
      };
      p.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, duration + delay + 150);
    }
  }

  function setPlusButtonGlyph(btn, size = 14) {
    btn.textContent = '';
    btn.appendChild(createSvgPlusIcon(size));
  }

  function markOnceAnim(el, className, fallbackMs) {
    if (!el || prefersReducedMotion()) return;
    el.classList.add(className);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      el.classList.remove(className);
    };
    el.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, fallbackMs);
  }

  const drawers = [sourcesDrawer, subtitlesDrawer, coldDrawer, warmDrawer];

  function createSvgElement(tag, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
    return el;
  }

  function createSvgCloseIcon(size = 11) {
    const svg = createSvgElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    svg.append(
      createSvgElement('line', { x1: 18, y1: 6, x2: 6, y2: 18 }),
      createSvgElement('line', { x1: 6, y1: 6, x2: 18, y2: 18 })
    );
    return svg;
  }

  function createSvgPlusIcon(size = 14) {
    const svg = createSvgElement('svg', {
      class: 'plus-glyph',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.5',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    svg.append(
      createSvgElement('line', { x1: 12, y1: 5, x2: 12, y2: 19 }),
      createSvgElement('line', { x1: 5, y1: 12, x2: 19, y2: 12 })
    );
    return svg;
  }

  function createSvgEditIcon(size = 12) {
    const svg = createSvgElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    svg.append(
      createSvgElement('path', { d: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z' }),
      createSvgElement('path', { d: 'm15 5 4 4' })
    );
    return svg;
  }

  function createSvgTrashIcon(size = 12) {
    const svg = createSvgElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    const lid = createSvgElement('g', { class: 'trash-lid' });
    lid.append(
      createSvgElement('path', { d: 'M3 6h18' }),
      createSvgElement('path', { d: 'M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2' })
    );
    svg.append(
      lid,
      createSvgElement('path', { d: 'M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6' }),
      createSvgElement('path', { d: 'M10 11v6' }),
      createSvgElement('path', { d: 'M14 11v6' })
    );
    return svg;
  }

  function createSvgCheckIcon(size = 14) {
    const svg = createSvgElement('svg', {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.6',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true'
    });
    svg.append(createSvgElement('polyline', { points: '20 6 9 17 4 12' }));
    return svg;
  }

  function syncSiteFormMode() {
    if (editingSiteId !== null) {
      addSiteBtn.classList.add('is-editing');
      addSiteBtn.title = 'Save changes';
      addSiteBtn.textContent = '';
      addSiteBtn.appendChild(createSvgCheckIcon(14));
      cancelEditSiteBtn.hidden = false;
    } else {
      addSiteBtn.classList.remove('is-editing');
      addSiteBtn.title = 'Add source';
      setPlusButtonGlyph(addSiteBtn);
      cancelEditSiteBtn.hidden = true;
    }
  }

  function syncSubProviderFormMode() {
    if (editingSubProviderId !== null) {
      addSubProviderBtn.classList.add('is-editing');
      addSubProviderBtn.title = 'Save changes';
      addSubProviderBtn.textContent = '';
      addSubProviderBtn.appendChild(createSvgCheckIcon(14));
      cancelEditSubProviderBtn.hidden = false;
    } else {
      addSubProviderBtn.classList.remove('is-editing');
      addSubProviderBtn.title = 'Add provider';
      setPlusButtonGlyph(addSubProviderBtn);
      cancelEditSubProviderBtn.hidden = true;
    }
  }

  function showSiteFeedback(message, type = 'error') {
    if (feedbackTimer) {
      clearTimeout(feedbackTimer);
      feedbackTimer = null;
    }
    if (!message) {
      siteFeedbackEl.hidden = true;
      siteFeedbackEl.textContent = '';
      siteFeedbackEl.className = 'site-feedback';
      return;
    }
    siteFeedbackEl.textContent = message;
    siteFeedbackEl.className = `site-feedback is-${type}`;
    siteFeedbackEl.hidden = false;

    if (type === 'success') {
      feedbackTimer = setTimeout(() => {
        siteFeedbackEl.hidden = true;
      }, 3200);
    }
  }

  function showSubProviderFeedback(message, type = 'error') {
    if (subFeedbackTimer) {
      clearTimeout(subFeedbackTimer);
      subFeedbackTimer = null;
    }
    if (!message) {
      subProviderFeedbackEl.hidden = true;
      subProviderFeedbackEl.textContent = '';
      subProviderFeedbackEl.className = 'site-feedback';
      return;
    }
    subProviderFeedbackEl.textContent = message;
    subProviderFeedbackEl.className = `site-feedback is-${type}`;
    subProviderFeedbackEl.hidden = false;

    if (type === 'success') {
      subFeedbackTimer = setTimeout(() => {
        subProviderFeedbackEl.hidden = true;
      }, 3200);
    }
  }

  function startEditSite(site) {
    editingSiteId = site.id;
    siteNameInput.value = site.name;
    siteUrlInput.value = site.urlTemplate;
    showSiteFeedback('');
    syncSiteFormMode();
    renderSources();
    siteUrlInput.focus();
    siteUrlInput.select();
  }

  function cancelEditSite(clearFeedback = false) {
    editingSiteId = null;
    siteNameInput.value = '';
    siteUrlInput.value = '';
    if (clearFeedback) showSiteFeedback('');
    syncSiteFormMode();
    renderSources();
  }

  function startEditSubProvider(provider) {
    editingSubProviderId = provider.id;
    subProviderNameInput.value = provider.name;
    subProviderUrlInput.value = provider.urlTemplate;
    showSubProviderFeedback('');
    syncSubProviderFormMode();
    renderSubtitles();
    subProviderUrlInput.focus();
    subProviderUrlInput.select();
  }

  function cancelEditSubProvider(clearFeedback = false) {
    editingSubProviderId = null;
    subProviderNameInput.value = '';
    subProviderUrlInput.value = '';
    if (clearFeedback) showSubProviderFeedback('');
    syncSubProviderFormMode();
    renderSubtitles();
  }

  function closeSubLangInput(clearFeedback = false) {
    isAddingSubLang = false;
    const inputWrap = subtitleLangGroup.querySelector('.sub-lang-input-wrap');
    const input = subtitleLangGroup.querySelector('.sub-lang-input');
    const addBtn = subtitleLangGroup.querySelector('.sub-lang-add-btn');
    if (input) {
      input.value = '';
      input.classList.remove('is-invalid');
    }
    if (inputWrap) {
      inputWrap.hidden = true;
    }
    if (addBtn) {
      addBtn.hidden = false;
    }
    if (clearFeedback) showSubProviderFeedback('');
  }

  function openOnlyDrawer(target) {
    drawers.forEach(d => d.classList.toggle('open', d === target));
    if (target !== sourcesDrawer && editingSiteId !== null) {
      cancelEditSite(true);
    }
    if (target !== subtitlesDrawer) {
      if (editingSubProviderId !== null) cancelEditSubProvider(true);
      if (isAddingSubLang) closeSubLangInput(true);
    }
  }

  function toggleDrawer(target) {
    const shouldOpen = !target.classList.contains('open');
    drawers.forEach(d => d.classList.remove('open'));
    if (shouldOpen) target.classList.add('open');
    if (!sourcesDrawer.classList.contains('open') && editingSiteId !== null) {
      cancelEditSite(true);
    }
    if (!subtitlesDrawer.classList.contains('open')) {
      if (editingSubProviderId !== null) cancelEditSubProvider(true);
      if (isAddingSubLang) closeSubLangInput(true);
    }
  }

  searchInput.focus();
  searchInput.addEventListener('focus', () => {
    triggerAnimClass(searchInputWrap, 'is-scanning', 850, '.search-scan-beam');
  });
  if (kbdHint) {
    kbdHint.addEventListener('click', () => {
      searchInput.focus();
      searchInput.select();
    });
  }

  document.querySelectorAll('.input-beam-wrap > .add-input').forEach(input => {
    const wrap = input.closest('.input-beam-wrap');
    if (!wrap) return;
    input.addEventListener('focus', () => {
      triggerAnimClass(wrap, 'is-scanning', 780, '.input-scan-beam');
    });
  });

  sourcesDrawerBtn.addEventListener('click', () => toggleDrawer(sourcesDrawer));
  subtitlesDrawerBtn.addEventListener('click', () => toggleDrawer(subtitlesDrawer));
  coldDrawerBtn.addEventListener('click', () => toggleDrawer(coldDrawer));
  warmDrawerBtn.addEventListener('click', () => toggleDrawer(warmDrawer));
  cancelEditSiteBtn.addEventListener('click', () => cancelEditSite(true));
  cancelEditSubProviderBtn.addEventListener('click', () => cancelEditSubProvider(true));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isAddingSubLang) {
        e.preventDefault();
        closeSubLangInput(true);
      } else if (editingSiteId !== null) {
        e.preventDefault();
        cancelEditSite(true);
      } else if (editingSubProviderId !== null) {
        e.preventDefault();
        cancelEditSubProvider(true);
      }
    }
  });

  async function saveSites() {
    await extApi.storage.local.set({ searchSites: sites });
  }

  async function saveSubtitleSettings() {
    await extApi.storage.local.set({ subtitleSettings });
  }

  async function saveSubtitleProviders() {
    await extApi.storage.local.set({ subtitleProviders });
  }

  async function syncScriptsWithBackground() {
    try {
      await extApi.runtime.sendMessage({ type: 'syncContentScripts' });
    } catch {}
  }

  function updateSubtitlesCount(animate = false) {
    const activeCount = subtitleProviders.filter(p => p.enabled).length;
    setOdometerValue(subtitlesActiveOdoEl, activeCount, animate);
    subtitlesTotalCountEl.textContent = `/${subtitleProviders.length}`;
  }

  function renderSubtitleLanguages(newlyAddedCode = null, cascadeIn = false) {
    subtitleSettings = resolveSubtitleSettings(subtitleSettings);
    const activeSet = new Set(subtitleSettings.activeLangs);
    const presetSet = new Set(SUBTITLE_PRESET_LANGUAGES);
    const allLangs = [...SUBTITLE_PRESET_LANGUAGES, ...subtitleSettings.customLangs];

    subtitleLangGroup.textContent = '';

    const toggleLang = async (code) => {
      const nextActive = new Set(subtitleSettings.activeLangs);
      if (nextActive.has(code)) {
        nextActive.delete(code);
      } else {
        nextActive.add(code);
      }
      subtitleSettings = resolveSubtitleSettings({
        activeLangs: Array.from(nextActive),
        customLangs: subtitleSettings.customLangs
      });
      await saveSubtitleSettings();
      renderSubtitleLanguages();
    };

    const removeCustomLang = async (code, chipEl) => {
      if (chipEl && chipEl.dataset.removing === '1') return;
      if (chipEl) chipEl.dataset.removing = '1';

      subtitleSettings = resolveSubtitleSettings({
        activeLangs: subtitleSettings.activeLangs.filter(c => c !== code),
        customLangs: subtitleSettings.customLangs.filter(c => c !== code)
      });

      if (chipEl && !prefersReducedMotion()) {
        spawnThanosDust(chipEl.getBoundingClientRect(), 'purple');
        chipEl.classList.add('is-snapping');
        let removed = false;
        const removeNode = () => {
          if (removed) return;
          removed = true;
          chipEl.remove();
        };
        chipEl.addEventListener('animationend', removeNode, { once: true });
        setTimeout(removeNode, 540);
        await saveSubtitleSettings();
      } else {
        await saveSubtitleSettings();
        renderSubtitleLanguages();
      }
    };

    allLangs.forEach((code, idx) => {
      const isActive = activeSet.has(code);
      const label = code.toUpperCase();

      if (presetSet.has(code)) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `sub-lang-chip${isActive ? ' active' : ''}`;
        btn.setAttribute('aria-pressed', String(isActive));
        btn.title = `${isActive ? 'Disable' : 'Enable'} ${label}`;
        btn.textContent = label;
        btn.addEventListener('click', () => toggleLang(code));
        if (cascadeIn) applyCascadeIn(btn, idx);
        subtitleLangGroup.appendChild(btn);
        return;
      }

      const chip = document.createElement('div');
      chip.className = `sub-lang-chip is-custom${isActive ? ' active' : ''}`;
      if (newlyAddedCode === code) markOnceAnim(chip, 'is-pop-in', 640);

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'sub-lang-toggle';
      toggleBtn.setAttribute('aria-pressed', String(isActive));
      toggleBtn.title = `${isActive ? 'Disable' : 'Enable'} ${label}`;
      toggleBtn.textContent = label;
      toggleBtn.addEventListener('click', () => toggleLang(code));

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sub-lang-remove';
      removeBtn.title = `Remove ${label}`;
      removeBtn.setAttribute('aria-label', `Remove ${label}`);
      removeBtn.appendChild(createSvgCloseIcon(9));
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCustomLang(code, chip);
      });

      chip.append(toggleBtn, removeBtn);
      if (cascadeIn) applyCascadeIn(chip, idx);
      subtitleLangGroup.appendChild(chip);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sub-lang-add-btn';
    addBtn.title = 'Add ISO 639-1 language code (e.g. es, de, ja)';
    addBtn.setAttribute('aria-label', 'Add language code');
    setPlusButtonGlyph(addBtn, 12);
    addBtn.hidden = isAddingSubLang;

    const inputWrap = document.createElement('span');
    inputWrap.className = 'sub-lang-input-wrap input-beam-wrap input-beam-violet';
    inputWrap.hidden = !isAddingSubLang;

    const beamClip = document.createElement('span');
    beamClip.className = 'input-beam-clip';
    beamClip.setAttribute('aria-hidden', 'true');
    const beam = document.createElement('span');
    beam.className = 'input-scan-beam';
    beamClip.appendChild(beam);

    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.className = 'sub-lang-input';
    addInput.maxLength = 2;
    addInput.placeholder = '--';
    addInput.autocomplete = 'off';
    addInput.spellcheck = false;
    addInput.setAttribute('aria-label', '2-letter ISO language code');
    addInput.addEventListener('focus', () => {
      triggerAnimClass(inputWrap, 'is-scanning', 780, '.input-scan-beam');
    });

    inputWrap.append(beamClip, addInput);

    addBtn.addEventListener('click', () => {
      triggerAnimClass(addBtn, 'is-btn-recoil', 360);
      isAddingSubLang = true;
      addBtn.hidden = true;
      inputWrap.hidden = false;
      addInput.value = '';
      addInput.classList.remove('is-invalid');
      showSubProviderFeedback('');
      addInput.focus();
      subtitleLangGroup.scrollTop = subtitleLangGroup.scrollHeight;
    });

    addInput.addEventListener('input', () => {
      addInput.classList.remove('is-invalid');
    });

    addInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeSubLangInput(true);
        return;
      }
      if (e.key !== 'Enter') return;
      e.preventDefault();

      const raw = addInput.value.trim();
      if (!isValidIsoLangCode(raw)) {
        addInput.classList.add('is-invalid');
        showSubProviderFeedback('Enter a valid 2-letter ISO code (e.g. es, de, ja).', 'error');
        addInput.focus();
        addInput.select();
        return;
      }

      const code = normalizeIsoLangCode(raw);
      const exists =
        SUBTITLE_PRESET_LANGUAGES.includes(code) || subtitleSettings.customLangs.includes(code);
      if (exists) {
        addInput.classList.add('is-invalid');
        showSubProviderFeedback(`Language "${code.toUpperCase()}" already exists.`, 'warning');
        addInput.focus();
        addInput.select();
        return;
      }

      isAddingSubLang = false;
      subtitleSettings = resolveSubtitleSettings({
        activeLangs: [...subtitleSettings.activeLangs, code],
        customLangs: [...subtitleSettings.customLangs, code]
      });
      showSubProviderFeedback('');
      await saveSubtitleSettings();
      renderSubtitleLanguages(code);
      subtitleLangGroup.scrollTop = subtitleLangGroup.scrollHeight;
    });

    addInput.addEventListener('blur', () => {
      if (isAddingSubLang) {
        closeSubLangInput(false);
      }
    });

    subtitleLangGroup.append(addBtn, inputWrap);
  }

  function renderSubtitles(animateCount = false, cascadeLangs = false, newlyAddedId = null) {
    updateSubtitlesCount(animateCount);
    renderSubtitleLanguages(null, cascadeLangs);

    subtitleProviderListEl.textContent = '';
    const canDelete = subtitleProviders.length > 1;

    subtitleProviders.forEach((provider, idx) => {
      const isActive = Boolean(provider.enabled);
      const isEditing = provider.id === editingSubProviderId;
      const item = document.createElement('div');
      item.className = `sub-provider-item${isActive ? ' is-active' : ' is-disabled'}${isEditing ? ' is-editing' : ''}`;
      if (provider.id === newlyAddedId) markOnceAnim(item, 'is-card-enter', 660);

      const main = document.createElement('label');
      main.className = 'source-main';

      const switchWrap = document.createElement('span');
      switchWrap.className = 'source-switch sub-switch';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isActive;

      const slider = document.createElement('span');
      slider.className = 'source-slider';

      checkbox.addEventListener('change', async () => {
        provider.enabled = checkbox.checked;
        item.classList.toggle('is-active', provider.enabled);
        item.classList.toggle('is-disabled', !provider.enabled);
        triggerSwitchSnap(slider, provider.enabled);
        if (provider.enabled) {
          triggerAnimClass(item, 'is-just-activated', 500);
        }
        updateSubtitlesCount(true);
        await saveSubtitleProviders();
      });

      switchWrap.append(checkbox, slider);

      const info = document.createElement('span');
      info.className = 'source-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'source-name';
      nameEl.textContent = provider.name;
      nameEl.title = provider.name;

      const hostEl = document.createElement('span');
      hostEl.className = 'source-host';
      hostEl.textContent = extractDisplayHost(provider.urlTemplate) || provider.urlTemplate;
      hostEl.title = provider.urlTemplate;

      info.append(nameEl, hostEl);
      main.append(switchWrap, info);

      item.addEventListener('click', (e) => {
        if (e.target.closest('label') || e.target.closest('.source-actions')) return;
        checkbox.click();
      });

      const actions = document.createElement('div');
      actions.className = 'source-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'source-action-btn source-edit';
      editBtn.title = `Edit ${provider.name}`;
      editBtn.appendChild(createSvgEditIcon(12));
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (editingSubProviderId === provider.id) {
          cancelEditSubProvider(true);
        } else {
          startEditSubProvider(provider);
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'source-action-btn source-delete';
      deleteBtn.disabled = !canDelete;
      deleteBtn.title = canDelete
        ? `Delete ${provider.name}`
        : 'At least one provider is required';
      deleteBtn.appendChild(createSvgTrashIcon(12));
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (item.dataset.deleting === '1') return;
        if (subtitleProviders.length <= 1) {
          showSubProviderFeedback('At least one subtitle provider is required.', 'warning');
          return;
        }
        const curIdx = subtitleProviders.indexOf(provider);
        if (curIdx === -1) return;
        item.dataset.deleting = '1';

        const wasEnabled = Boolean(provider.enabled);
        subtitleProviders.splice(curIdx, 1);
        if (editingSubProviderId === provider.id) {
          editingSubProviderId = null;
          subProviderNameInput.value = '';
          subProviderUrlInput.value = '';
          syncSubProviderFormMode();
        }
        if (wasEnabled && !subtitleProviders.some(p => p.enabled) && subtitleProviders.length > 0) {
          subtitleProviders[0].enabled = true;
        }

        if (!prefersReducedMotion()) {
          deleteBtn.classList.add('is-trashing');
          item.classList.add('is-deleting-card');
          spawnCardDeleteParticles(deleteBtn.getBoundingClientRect());
          await Promise.all([
            saveSubtitleProviders(),
            new Promise(resolve => setTimeout(resolve, 380))
          ]);
        } else {
          await saveSubtitleProviders();
        }

        renderSubtitles(true);
        showSubProviderFeedback(`Provider "${provider.name}" removed.`, 'success');
      });

      actions.append(editBtn, deleteBtn);
      item.append(main, actions);
      if (cascadeLangs) applyCascadeIn(item, idx, 36, 400);
      subtitleProviderListEl.appendChild(item);
    });
  }

  async function handleSubmitSubProvider() {
    triggerAnimClass(addSubProviderBtn, 'is-btn-recoil', 360);
    const name = subProviderNameInput.value.trim();
    const urlTemplate = subProviderUrlInput.value.trim();

    if (!name) {
      showSubProviderFeedback('Enter a name for this provider.', 'error');
      subProviderNameInput.focus();
      return;
    }

    if (!/^https?:\/\//i.test(urlTemplate)) {
      showSubProviderFeedback('URL must start with http:// or https://.', 'error');
      subProviderUrlInput.focus();
      return;
    }

    if (!hasSubtitleQueryPlaceholder(urlTemplate)) {
      showSubProviderFeedback('URL must include {q} or {q_plus}.', 'error');
      subProviderUrlInput.focus();
      return;
    }

    if (!isValidSubtitleUrlTemplate(urlTemplate)) {
      showSubProviderFeedback('Invalid URL. Check the domain format.', 'error');
      subProviderUrlInput.focus();
      return;
    }

    if (
      subtitleProviders.some(
        p => p.id !== editingSubProviderId && p.urlTemplate.toLowerCase() === urlTemplate.toLowerCase()
      )
    ) {
      showSubProviderFeedback('This provider URL already exists.', 'error');
      return;
    }

    if (editingSubProviderId !== null) {
      const target = subtitleProviders.find(p => p.id === editingSubProviderId);
      if (!target) {
        cancelEditSubProvider(true);
        return;
      }

      target.name = name;
      target.urlTemplate = urlTemplate;

      await saveSubtitleProviders();

      editingSubProviderId = null;
      subProviderNameInput.value = '';
      subProviderUrlInput.value = '';
      syncSubProviderFormMode();
      renderSubtitles();
      showSubProviderFeedback(`Provider "${name}" updated.`, 'success');
      return;
    }

    const newProvider = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      urlTemplate,
      enabled: true,
      builtin: false
    };

    subtitleProviders.push(newProvider);
    await saveSubtitleProviders();

    subProviderNameInput.value = '';
    subProviderUrlInput.value = '';
    renderSubtitles(true, false, newProvider.id);
    subtitleProviderListEl.scrollTop = subtitleProviderListEl.scrollHeight;
    showSubProviderFeedback(`Provider "${name}" added.`, 'success');
  }

  addSubProviderBtn.addEventListener('click', handleSubmitSubProvider);
  subProviderNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      subProviderUrlInput.focus();
    }
  });
  subProviderUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitSubProvider();
    }
  });

  function updateSourcesCount(animate = false) {
    const activeCount = sites.filter(s => s.enabled).length;
    setOdometerValue(sourcesActiveOdoEl, activeCount, animate);
    sourcesTotalCountEl.textContent = `/${sites.length}`;
  }

  function renderSources(animateCount = false, newlyAddedId = null, cascadeIn = false) {
    sourcesListEl.textContent = '';
    updateSourcesCount(animateCount);

    if (sites.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'sources-empty';
      emptyEl.textContent = 'No sources configured. Add one below or click Default.';
      sourcesListEl.appendChild(emptyEl);
      return;
    }

    sites.forEach((site, idx) => {
      const isEditing = site.id === editingSiteId;
      const isActive = Boolean(site.enabled);
      const item = document.createElement('div');
      item.className = `source-item${isActive ? ' is-active' : ' is-disabled'}${isEditing ? ' is-editing' : ''}`;
      if (site.id === newlyAddedId) markOnceAnim(item, 'is-card-enter', 660);

      const main = document.createElement('label');
      main.className = 'source-main';

      const switchWrap = document.createElement('span');
      switchWrap.className = 'source-switch';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isActive;

      const slider = document.createElement('span');
      slider.className = 'source-slider';

      checkbox.addEventListener('change', async () => {
        site.enabled = checkbox.checked;
        item.classList.toggle('is-active', site.enabled);
        item.classList.toggle('is-disabled', !site.enabled);
        triggerSwitchSnap(slider, site.enabled);
        if (site.enabled) {
          triggerAnimClass(item, 'is-just-activated', 500);
        }
        updateSourcesCount(true);
        await saveSites();
        if (site.enabled) showSiteFeedback('');
      });

      switchWrap.append(checkbox, slider);

      const info = document.createElement('span');
      info.className = 'source-info';

      const nameEl = document.createElement('span');
      nameEl.className = 'source-name';
      nameEl.textContent = site.name;
      nameEl.title = site.name;

      const hostEl = document.createElement('span');
      hostEl.className = 'source-host';
      hostEl.textContent = extractDisplayHost(site.urlTemplate) || site.urlTemplate;
      hostEl.title = site.urlTemplate;

      info.append(nameEl, hostEl);
      main.append(switchWrap, info);

      item.addEventListener('click', (e) => {
        if (e.target.closest('label') || e.target.closest('.source-actions')) return;
        checkbox.click();
      });

      const actions = document.createElement('div');
      actions.className = 'source-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'source-action-btn source-edit';
      editBtn.title = `Edit ${site.name}`;
      editBtn.appendChild(createSvgEditIcon(12));
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (editingSiteId === site.id) {
          cancelEditSite(true);
        } else {
          startEditSite(site);
        }
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'source-action-btn source-delete';
      deleteBtn.title = `Delete ${site.name}`;
      deleteBtn.appendChild(createSvgTrashIcon(12));
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (item.dataset.deleting === '1') return;
        const curIdx = sites.indexOf(site);
        if (curIdx === -1) return;
        item.dataset.deleting = '1';

        sites.splice(curIdx, 1);
        if (editingSiteId === site.id) {
          editingSiteId = null;
          siteNameInput.value = '';
          siteUrlInput.value = '';
          syncSiteFormMode();
        }

        const persistPromise = saveSites().then(() => syncScriptsWithBackground());
        if (!prefersReducedMotion()) {
          deleteBtn.classList.add('is-trashing');
          item.classList.add('is-deleting-card');
          spawnCardDeleteParticles(deleteBtn.getBoundingClientRect());
          await Promise.all([
            persistPromise,
            new Promise(resolve => setTimeout(resolve, 380))
          ]);
        } else {
          await persistPromise;
        }

        renderSources(true);
        showSiteFeedback(`Source "${site.name}" removed.`, 'success');
      });

      actions.append(editBtn, deleteBtn);
      item.append(main, actions);
      if (cascadeIn) applyCascadeIn(item, idx, 42, 420);
      sourcesListEl.appendChild(item);
    });
  }

  async function handleSubmitSite() {
    if (isSubmittingSite) return;
    triggerAnimClass(addSiteBtn, 'is-btn-recoil', 360);
    const name = siteNameInput.value.trim();
    const urlTemplate = siteUrlInput.value.trim();

    if (!name) {
      showSiteFeedback('Enter a name for this source.', 'error');
      siteNameInput.focus();
      return;
    }

    if (!/^https?:\/\//i.test(urlTemplate)) {
      showSiteFeedback('URL must start with http:// or https://.', 'error');
      siteUrlInput.focus();
      return;
    }

    if (!urlTemplate.includes('{q}')) {
      showSiteFeedback('URL must include {q} (e.g. https://example.org/search?q={q}).', 'error');
      siteUrlInput.focus();
      return;
    }

    const originPattern = normalizeOriginPattern(urlTemplate);
    if (!originPattern) {
      showSiteFeedback('Invalid URL. Check the domain format.', 'error');
      siteUrlInput.focus();
      return;
    }

    if (
      sites.some(
        s => s.id !== editingSiteId && s.urlTemplate.toLowerCase() === urlTemplate.toLowerCase()
      )
    ) {
      showSiteFeedback('This search URL already exists.', 'error');
      return;
    }

    isSubmittingSite = true;
    try {
      const isStaticHost = isStaticManifestHost(urlTemplate);
      let granted = isStaticHost;

      // Request host permission before awaiting storage to preserve Firefox user gesture
      if (!isStaticHost) {
        try {
          granted = await extApi.permissions.request({ origins: [originPattern] });
        } catch {
          granted = false;
        }
      }

      if (editingSiteId !== null) {
        const target = sites.find(s => s.id === editingSiteId);
        if (!target) {
          cancelEditSite(true);
          return;
        }

        target.name = name;
        target.urlTemplate = urlTemplate;

        await saveSites();
        await syncScriptsWithBackground();

        editingSiteId = null;
        siteNameInput.value = '';
        siteUrlInput.value = '';
        syncSiteFormMode();
        renderSources();

        if (isStaticHost) {
          showSiteFeedback(`Source "${name}" updated.`, 'success');
        } else if (granted) {
          showSiteFeedback(`Source "${name}" updated with highlighting enabled.`, 'success');
        } else {
          showSiteFeedback(`Source "${name}" updated without injection permission on ${originPattern}.`, 'warning');
        }
        return;
      }

      const newSite = {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        urlTemplate,
        enabled: true,
        builtin: false
      };

      sites.push(newSite);
      await saveSites();
      await syncScriptsWithBackground();

      siteNameInput.value = '';
      siteUrlInput.value = '';
      renderSources(true, newSite.id);
      sourcesListEl.scrollTop = sourcesListEl.scrollHeight;

      if (isStaticHost || granted) {
        showSiteFeedback(`Source "${name}" added with automatic highlighting.`, 'success');
      } else {
        showSiteFeedback(`Source "${name}" added without injection permission on ${originPattern}.`, 'warning');
      }
    } finally {
      isSubmittingSite = false;
    }
  }

  addSiteBtn.addEventListener('click', handleSubmitSite);
  siteNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      siteUrlInput.focus();
    }
  });
  siteUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitSite();
    }
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (isLaunchingSearch) return;
    const query = normalizeSearchQuery(searchInput.value);
    if (!query) return;

    const urls = sites
      .filter(site => site.enabled)
      .map(site => buildSearchUrl(site.urlTemplate, query))
      .filter(Boolean);

    if (urls.length === 0) {
      openOnlyDrawer(sourcesDrawer);
      showSiteFeedback('Enable at least one source to start searching.', 'warning');
      return;
    }

    const openTabs = () => {
      isLaunchingSearch = false;
      urls.forEach((url, index) => {
        extApi.tabs.create({ url, active: index === 0 });
      });
    };

    if (prefersReducedMotion()) {
      openTabs();
      return;
    }

    isLaunchingSearch = true;
    triggerAnimClass(searchInputWrap, 'is-pulsing', 650, '.search-radar-ring');
    triggerAnimClass(goBtn, 'is-launching', 420);
    setTimeout(openTabs, 140);
  });

  function renderTags(list, container, countEl, cssClass, storageKey, newlyAddedSet = null, cascadeIn = false) {
    container.textContent = '';
    countEl.textContent = list.length;
    const paletteKey = cssClass === 'tag-warm' ? 'warm' : 'cold';
    const cascadeStep = cssClass === 'tag-warm' ? 18 : 32;
    const cascadeCap = cssClass === 'tag-warm' ? 820 : 800;

    list.forEach((tag, idx) => {
      const pill = document.createElement('div');
      const isNew = newlyAddedSet && newlyAddedSet.has(tag.toLowerCase());
      pill.className = `tag ${cssClass}`;
      if (isNew) markOnceAnim(pill, 'is-pop-in', 640);

      const label = document.createElement('span');
      label.textContent = tag;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tag-remove';
      removeBtn.title = `Remove ${tag}`;
      removeBtn.appendChild(createSvgCloseIcon(10));
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (pill.dataset.removing === '1') return;
        const curIdx = list.indexOf(tag);
        if (curIdx === -1) return;
        pill.dataset.removing = '1';
        list.splice(curIdx, 1);
        countEl.textContent = list.length;
        triggerAnimClass(countEl, 'is-popping', 320);

        if (!prefersReducedMotion()) {
          spawnThanosDust(pill.getBoundingClientRect(), paletteKey);
          pill.classList.add('is-snapping');
          let removed = false;
          const removeNode = () => {
            if (removed) return;
            removed = true;
            pill.remove();
          };
          pill.addEventListener('animationend', removeNode, { once: true });
          setTimeout(removeNode, 540);
          await extApi.storage.local.set({ [storageKey]: list });
        } else {
          await extApi.storage.local.set({ [storageKey]: list });
          renderTags(list, container, countEl, cssClass, storageKey);
        }
      });

      pill.append(label, removeBtn);
      if (cascadeIn) applyCascadeIn(pill, idx, cascadeStep, cascadeCap);
      container.appendChild(pill);
    });
  }

  const res = await extApi.storage.local.get([
    'customColdTags',
    'customWarmTags',
    'defaultsInitialized',
    'prefHideTrash',
    'searchSites',
    'subtitleProviders',
    'subtitleSettings'
  ]);

  let coldList = res.defaultsInitialized && res.customColdTags ? res.customColdTags : [...DEFAULT_COLD];
  let warmList = res.defaultsInitialized && res.customWarmTags ? res.customWarmTags : [...DEFAULT_WARM];
  sites = resolveSites(res.searchSites);
  subtitleProviders = resolveSubtitleProviders(res.subtitleProviders, res.subtitleSettings);
  subtitleSettings = resolveSubtitleSettings(res.subtitleSettings);

  const initialPayload = {};
  if (!res.defaultsInitialized) {
    initialPayload.customColdTags = coldList;
    initialPayload.customWarmTags = warmList;
    if (typeof res.prefHideTrash !== 'boolean') {
      initialPayload.prefHideTrash = DEFAULT_HIDE_TRASH;
    }
    initialPayload.defaultsInitialized = true;
  }
  if (!Array.isArray(res.searchSites)) {
    initialPayload.searchSites = sites;
  }
  const needsSubProviderMigration =
    !Array.isArray(res.subtitleProviders) ||
    res.subtitleProviders.length === 0 ||
    res.subtitleProviders.some(
      p =>
        typeof p?.enabled !== 'boolean' ||
        (p?.id === 'subsource' && p?.builtin && p?.urlTemplate === 'https://subsource.net/subtitles/{q}')
    );
  if (needsSubProviderMigration) {
    initialPayload.subtitleProviders = subtitleProviders;
  }
  const needsSubSettingsMigration =
    !res.subtitleSettings ||
    !Array.isArray(res.subtitleSettings.activeLangs) ||
    !Array.isArray(res.subtitleSettings.customLangs) ||
    'lang' in res.subtitleSettings ||
    'provider' in res.subtitleSettings;
  if (needsSubSettingsMigration) {
    initialPayload.subtitleSettings = subtitleSettings;
  }
  if (Object.keys(initialPayload).length > 0) {
    await extApi.storage.local.set(initialPayload);
  }

  renderSources();
  renderSubtitles();
  renderTags(coldList, coldTagsEl, coldCountEl, 'tag-cold', 'customColdTags');
  renderTags(warmList, warmTagsEl, warmCountEl, 'tag-warm', 'customWarmTags');

  const addTag = async (inputEl, list, container, countEl, cssClass, key) => {
    const raw = inputEl.value.trim();
    if (!raw) return;

    const entries = raw.split(',').map(s => s.trim()).filter(Boolean);
    const addedSet = new Set();

    entries.forEach(val => {
      if (!list.some(t => t.toLowerCase() === val.toLowerCase())) {
        list.push(val);
        addedSet.add(val.toLowerCase());
      }
    });

    inputEl.value = '';
    if (addedSet.size > 0) {
      await extApi.storage.local.set({ [key]: list });
      renderTags(list, container, countEl, cssClass, key, addedSet);
      triggerAnimClass(countEl, 'is-popping', 320);
      container.scrollTop = container.scrollHeight;
    }
  };

  addColdBtn.addEventListener('click', () => {
    triggerAnimClass(addColdBtn, 'is-btn-recoil', 360);
    addTag(coldInput, coldList, coldTagsEl, coldCountEl, 'tag-cold', 'customColdTags');
  });
  coldInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addColdBtn.click();
    }
  });

  addWarmBtn.addEventListener('click', () => {
    triggerAnimClass(addWarmBtn, 'is-btn-recoil', 360);
    addTag(warmInput, warmList, warmTagsEl, warmCountEl, 'tag-warm', 'customWarmTags');
  });
  warmInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWarmBtn.click();
    }
  });

  resetDefaultsBtn.addEventListener('click', async () => {
    if (isResettingDefaults) return;
    isResettingDefaults = true;

    try {
      resetDefaultsBtn.classList.add('is-done');
      triggerAnimClass(resetDefaultsBtn, 'is-spinning', 760, 'svg');
      resetDefaultsLabel.textContent = 'Reset';
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetDefaultsBtn.classList.remove('is-done');
        resetDefaultsLabel.textContent = 'Default';
      }, 1600);

      const sourcesOpen = sourcesDrawer.classList.contains('open');
      const coldOpen = coldDrawer.classList.contains('open');
      const warmOpen = warmDrawer.classList.contains('open');
      const subOpen = subtitlesDrawer.classList.contains('open');

      let exitWait = null;
      if (!prefersReducedMotion()) {
        const exitingItems = coldOpen
          ? Array.from(coldTagsEl.querySelectorAll('.tag'))
          : warmOpen
            ? Array.from(warmTagsEl.querySelectorAll('.tag'))
            : subOpen
              ? Array.from(subtitleLangGroup.querySelectorAll('.sub-lang-chip'))
              : sourcesOpen
                ? Array.from(sourcesListEl.querySelectorAll('.source-item'))
                : [];

        if (exitingItems.length > 0) {
          exitingItems.forEach((el, idx) => {
            el.classList.remove('is-pop-in', 'is-cascade-in');
            el.style.animationDelay = `${Math.min(idx * 5, 70)}ms`;
            el.classList.add('is-cascade-out');
          });
          exitWait = new Promise(resolve => setTimeout(resolve, 175));
        }
      }

      coldList = [...DEFAULT_COLD];
      warmList = [...DEFAULT_WARM];

      const defaultUrlSet = new Set(DEFAULT_SITES.map(s => s.urlTemplate.toLowerCase()));
      const customSites = sites.filter(
        s => !s.builtin && !defaultUrlSet.has(s.urlTemplate.toLowerCase())
      );
      sites = [...DEFAULT_SITES.map(s => ({ ...s })), ...customSites];

      const defaultSubUrlSet = new Set(DEFAULT_SUBTITLE_PROVIDERS.map(p => p.urlTemplate.toLowerCase()));
      const customSubProviders = subtitleProviders.filter(
        p => !p.builtin && !defaultSubUrlSet.has(p.urlTemplate.toLowerCase())
      );
      subtitleProviders = [...DEFAULT_SUBTITLE_PROVIDERS.map(p => ({ ...p })), ...customSubProviders];
      subtitleSettings = getDefaultSubtitleSettings();
      isAddingSubLang = false;

      editingSiteId = null;
      siteNameInput.value = '';
      siteUrlInput.value = '';
      showSiteFeedback('');
      syncSiteFormMode();

      editingSubProviderId = null;
      subProviderNameInput.value = '';
      subProviderUrlInput.value = '';
      showSubProviderFeedback('');
      syncSubProviderFormMode();

      const persistPromise = extApi.storage.local
        .set({
          customColdTags: coldList,
          customWarmTags: warmList,
          searchSites: sites,
          subtitleProviders,
          subtitleSettings,
          prefHideTrash: DEFAULT_HIDE_TRASH,
          defaultsInitialized: true
        })
        .then(() => syncScriptsWithBackground());

      if (exitWait) {
        await Promise.all([persistPromise, exitWait]);
      } else {
        await persistPromise;
      }

      renderSources(true, null, sourcesOpen);
      renderSubtitles(true, subOpen);
      renderTags(coldList, coldTagsEl, coldCountEl, 'tag-cold', 'customColdTags', null, coldOpen);
      renderTags(warmList, warmTagsEl, warmCountEl, 'tag-warm', 'customWarmTags', null, warmOpen);
    } finally {
      isResettingDefaults = false;
    }
  });
});
