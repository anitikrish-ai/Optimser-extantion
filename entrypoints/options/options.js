/**
 * Universal Website Performance Optimizer
 * Options & Advanced Dashboard Controller (Native JS)
 */

(() => {
  const DEFAULT_CONFIG = {
    masterEnabled: true,
    mode: 'balanced',
    autoAdaptive: true,
    cpu: {
      enabled: true,
      throttleBackgroundTimers: true,
      throttleScrollEvents: true,
      pauseOffscreenCanvases: true,
      maxBackgroundIntervalMs: 1000
    },
    memory: {
      enabled: true,
      enableWeakRefTracking: true,
      cleanDetachedDomNodes: true,
      teardownOnUnload: true,
      periodicCleanupIntervalSec: 60
    },
    scripts: {
      enabled: true,
      blockHeavyTrackers: true,
      blockSessionReplay: true,
      blockTelemetryBeacons: true,
      protectEssentialScripts: true
    },
    images: {
      enabled: true,
      enforceLazyLoading: true,
      enforceAsyncDecoding: true,
      deferOffscreenImages: true,
      pauseAnimatedGifsOffscreen: true
    },
    videos: {
      enabled: true,
      blockAutoplay: true,
      pauseOffscreenVideos: true,
      pauseBackgroundTabVideos: true,
      suppressVideoPreviews: true
    },
    rendering: {
      enabled: true,
      reduceCssAnimations: true,
      disableExpensiveFilters: true,
      disableBackdropBlur: true,
      disableHeavyBoxShadows: false,
      enforceReducedMotion: true
    },
    network: {
      enabled: true,
      blockKnownAdNetworks: true,
      blockTrackingPixels: true,
      blockThirdPartyFontsOnSlowNetwork: false,
      customBlockPatterns: []
    },
    dom: {
      enabled: true,
      enableContentVisibilityAuto: true,
      batchMutationObservers: true,
      throttleSubtreeScans: true
    },
    safety: {
      allowlist: [
        'localhost',
        '127.0.0.1',
        'accounts.google.com',
        'login.microsoftonline.com',
        'appleid.apple.com',
        'github.com/login',
        'gitlab.com/users/sign_in',
        'auth0.com',
        'checkout.stripe.com',
        'paypal.com',
        'pay.google.com'
      ],
      emergencyDisabled: false,
      protectPaymentAndAuth: true
    }
  };

  let activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const contentTabs = document.querySelectorAll('.content-tab');

  // Diagnostics
  const diagDeviceType = document.getElementById('diag-device-type');
  const diagCpuCores = document.getElementById('diag-cpu-cores');
  const diagMemory = document.getElementById('diag-memory');
  const diagPlatform = document.getElementById('diag-platform');
  const diagNetwork = document.getElementById('diag-network');
  const diagBattery = document.getElementById('diag-battery');
  const overviewModeBadge = document.getElementById('overview-mode-badge');
  const selectGlobalMode = document.getElementById('select-global-mode');
  const checkAutoAdaptive = document.getElementById('check-auto-adaptive');

  // Modules
  const cfgCpuEnabled = document.getElementById('cfg-cpu-enabled');
  const cfgCpuTimers = document.getElementById('cfg-cpu-timers');
  const cfgCpuCanvas = document.getElementById('cfg-cpu-canvas');
  const cfgCpuScroll = document.getElementById('cfg-cpu-scroll');

  const cfgScriptsEnabled = document.getElementById('cfg-scripts-enabled');
  const cfgScriptsTrackers = document.getElementById('cfg-scripts-trackers');
  const cfgScriptsReplay = document.getElementById('cfg-scripts-replay');

  const cfgImagesEnabled = document.getElementById('cfg-images-enabled');
  const cfgImagesLazy = document.getElementById('cfg-images-lazy');
  const cfgImagesAsync = document.getElementById('cfg-images-async');

  const cfgVideosEnabled = document.getElementById('cfg-videos-enabled');
  const cfgVideosAutoplay = document.getElementById('cfg-videos-autoplay');
  const cfgVideosOffscreen = document.getElementById('cfg-videos-offscreen');
  const cfgVideosBg = document.getElementById('cfg-videos-bg');

  const cfgRenderingEnabled = document.getElementById('cfg-rendering-enabled');
  const cfgRenderingAnim = document.getElementById('cfg-rendering-anim');
  const cfgRenderingFilters = document.getElementById('cfg-rendering-filters');
  const cfgRenderingBlur = document.getElementById('cfg-rendering-blur');
  const cfgRenderingMotion = document.getElementById('cfg-rendering-motion');

  const cfgDomEnabled = document.getElementById('cfg-dom-enabled');
  const cfgDomVisibility = document.getElementById('cfg-dom-visibility');
  const cfgDomBatch = document.getElementById('cfg-dom-batch');

  // Allowlist
  const inputNewDomain = document.getElementById('input-new-domain');
  const btnAddDomain = document.getElementById('btn-add-domain');
  const allowlistTbody = document.getElementById('allowlist-tbody');

  // Custom Rules
  const inputNewRule = document.getElementById('input-new-rule');
  const btnAddRule = document.getElementById('btn-add-rule');
  const customRulesUl = document.getElementById('custom-rules-ul');

  // Reset
  const btnPurgeSession = document.getElementById('btn-purge-session');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');

  function initOptions() {
    setupTabNavigation();
    loadDiagnostics();
    loadConfig();
    setupEventListeners();
  }

  function setupTabNavigation() {
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.dataset.tab;
        navItems.forEach((n) => n.classList.remove('active'));
        contentTabs.forEach((t) => t.classList.remove('active'));

        item.classList.add('active');
        const content = document.getElementById('tab-' + target);
        if (content) content.classList.add('active');
      });
    });
  }

  function loadDiagnostics() {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory;
    const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);

    diagCpuCores.textContent = cores + ' Cores';
    diagMemory.textContent = mem ? mem + ' GB RAM' : 'Unexposed by browser';
    diagPlatform.textContent = isMobile ? 'Mobile Device' : 'Desktop Environment';

    if (navigator.connection && navigator.connection.effectiveType) {
      diagNetwork.textContent = navigator.connection.effectiveType.toUpperCase();
    } else {
      diagNetwork.textContent = 'Standard';
    }

    if (navigator.getBattery) {
      navigator.getBattery().then((battery) => {
        diagBattery.textContent = Math.round(battery.level * 100) + '% (' + (battery.charging ? 'Charging' : 'Battery') + ')';
      }).catch(() => {
        diagBattery.textContent = 'AC Power';
      });
    } else {
      diagBattery.textContent = 'AC Power';
    }

    const isLowEnd = cores <= 4 || (mem && mem <= 4);
    diagDeviceType.textContent = isLowEnd ? 'RESOURCE CONSTRAINED' : 'HIGH CAPABILITY';
    if (isLowEnd) {
      diagDeviceType.className = 'badge active';
    }
  }

  function loadConfig() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ action: 'GET_TAB_STATE' }, (res) => {
        if (res && res.config) {
          activeConfig = res.config;
          populateUI();
        }
      });
    }
  }

  function populateUI() {
    overviewModeBadge.textContent = (activeConfig.mode || 'balanced').replace('_', ' ').toUpperCase();
    selectGlobalMode.value = activeConfig.mode || 'balanced';
    checkAutoAdaptive.checked = !!activeConfig.autoAdaptive;

    if (activeConfig.cpu) {
      cfgCpuEnabled.checked = activeConfig.cpu.enabled;
      cfgCpuTimers.checked = activeConfig.cpu.throttleBackgroundTimers;
      cfgCpuCanvas.checked = activeConfig.cpu.pauseOffscreenCanvases;
      cfgCpuScroll.checked = activeConfig.cpu.throttleScrollEvents;
    }

    if (activeConfig.scripts) {
      cfgScriptsEnabled.checked = activeConfig.scripts.enabled;
      cfgScriptsTrackers.checked = activeConfig.scripts.blockHeavyTrackers;
      cfgScriptsReplay.checked = activeConfig.scripts.blockSessionReplay;
    }

    if (activeConfig.images) {
      cfgImagesEnabled.checked = activeConfig.images.enabled;
      cfgImagesLazy.checked = activeConfig.images.enforceLazyLoading;
      cfgImagesAsync.checked = activeConfig.images.enforceAsyncDecoding;
    }

    if (activeConfig.videos) {
      cfgVideosEnabled.checked = activeConfig.videos.enabled;
      cfgVideosAutoplay.checked = activeConfig.videos.blockAutoplay;
      cfgVideosOffscreen.checked = activeConfig.videos.pauseOffscreenVideos;
      cfgVideosBg.checked = activeConfig.videos.pauseBackgroundTabVideos;
    }

    if (activeConfig.rendering) {
      cfgRenderingEnabled.checked = activeConfig.rendering.enabled;
      cfgRenderingAnim.checked = activeConfig.rendering.reduceCssAnimations;
      cfgRenderingFilters.checked = activeConfig.rendering.disableExpensiveFilters;
      cfgRenderingBlur.checked = activeConfig.rendering.disableBackdropBlur;
      cfgRenderingMotion.checked = activeConfig.rendering.enforceReducedMotion;
    }

    if (activeConfig.dom) {
      cfgDomEnabled.checked = activeConfig.dom.enabled;
      cfgDomVisibility.checked = activeConfig.dom.enableContentVisibilityAuto;
      cfgDomBatch.checked = activeConfig.dom.batchMutationObservers;
    }

    renderAllowlist();
    renderCustomRules();
  }

  function renderAllowlist() {
    allowlistTbody.innerHTML = '';
    const list = (activeConfig.safety && activeConfig.safety.allowlist) || [];
    list.forEach((domain, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(domain)}</strong></td>
        <td><span class="badge">Bypassed</span></td>
        <td><button class="btn btn-secondary btn-sm delete-domain-btn" data-index="${index}">Remove</button></td>
      `;
      allowlistTbody.appendChild(tr);
    });

    document.querySelectorAll('.delete-domain-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        if (idx > -1) {
          activeConfig.safety.allowlist.splice(idx, 1);
          saveConfig();
          renderAllowlist();
        }
      });
    });
  }

  function renderCustomRules() {
    customRulesUl.innerHTML = '';
    const rules = (activeConfig.network && activeConfig.network.customBlockPatterns) || [];
    if (rules.length === 0) {
      customRulesUl.innerHTML = '<li class="custom-rule-item"><span style="color:var(--text-muted)">No custom block rules configured.</span></li>';
      return;
    }

    rules.forEach((rule, index) => {
      const li = document.createElement('li');
      li.className = 'custom-rule-item';
      li.innerHTML = `
        <span><code>${escapeHtml(rule)}</code></span>
        <button class="btn btn-secondary btn-sm delete-rule-btn" data-index="${index}">Remove</button>
      `;
      customRulesUl.appendChild(li);
    });

    document.querySelectorAll('.delete-rule-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.index, 10);
        if (idx > -1) {
          activeConfig.network.customBlockPatterns.splice(idx, 1);
          saveConfig();
          renderCustomRules();
        }
      });
    });
  }

  function saveConfig() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'UPDATE_CONFIG',
        payload: activeConfig
      });
    }
  }

  function setupEventListeners() {
    selectGlobalMode.addEventListener('change', () => {
      activeConfig.mode = selectGlobalMode.value;
      overviewModeBadge.textContent = activeConfig.mode.replace('_', ' ').toUpperCase();
      saveConfig();
    });

    checkAutoAdaptive.addEventListener('change', () => {
      activeConfig.autoAdaptive = checkAutoAdaptive.checked;
      saveConfig();
    });

    const bindToggle = (input, obj, prop) => {
      input.addEventListener('change', () => {
        if (!activeConfig[obj]) activeConfig[obj] = {};
        activeConfig[obj][prop] = input.checked;
        saveConfig();
      });
    };

    bindToggle(cfgCpuEnabled, 'cpu', 'enabled');
    bindToggle(cfgCpuTimers, 'cpu', 'throttleBackgroundTimers');
    bindToggle(cfgCpuCanvas, 'cpu', 'pauseOffscreenCanvases');
    bindToggle(cfgCpuScroll, 'cpu', 'throttleScrollEvents');

    bindToggle(cfgScriptsEnabled, 'scripts', 'enabled');
    bindToggle(cfgScriptsTrackers, 'scripts', 'blockHeavyTrackers');
    bindToggle(cfgScriptsReplay, 'scripts', 'blockSessionReplay');

    bindToggle(cfgImagesEnabled, 'images', 'enabled');
    bindToggle(cfgImagesLazy, 'images', 'enforceLazyLoading');
    bindToggle(cfgImagesAsync, 'images', 'enforceAsyncDecoding');

    bindToggle(cfgVideosEnabled, 'videos', 'enabled');
    bindToggle(cfgVideosAutoplay, 'videos', 'blockAutoplay');
    bindToggle(cfgVideosOffscreen, 'videos', 'pauseOffscreenVideos');
    bindToggle(cfgVideosBg, 'videos', 'pauseBackgroundTabVideos');

    bindToggle(cfgRenderingEnabled, 'rendering', 'enabled');
    bindToggle(cfgRenderingAnim, 'rendering', 'reduceCssAnimations');
    bindToggle(cfgRenderingFilters, 'rendering', 'disableExpensiveFilters');
    bindToggle(cfgRenderingBlur, 'rendering', 'disableBackdropBlur');
    bindToggle(cfgRenderingMotion, 'rendering', 'enforceReducedMotion');

    bindToggle(cfgDomEnabled, 'dom', 'enabled');
    bindToggle(cfgDomVisibility, 'dom', 'enableContentVisibilityAuto');
    bindToggle(cfgDomBatch, 'dom', 'batchMutationObservers');

    btnAddDomain.addEventListener('click', () => {
      const val = inputNewDomain.value.trim().toLowerCase();
      if (val) {
        if (!activeConfig.safety) activeConfig.safety = { allowlist: [] };
        if (!activeConfig.safety.allowlist.includes(val)) {
          activeConfig.safety.allowlist.push(val);
          inputNewDomain.value = '';
          saveConfig();
          renderAllowlist();
        }
      }
    });

    btnAddRule.addEventListener('click', () => {
      const val = inputNewRule.value.trim();
      if (val) {
        if (!activeConfig.network) activeConfig.network = { customBlockPatterns: [] };
        if (!activeConfig.network.customBlockPatterns) activeConfig.network.customBlockPatterns = [];
        activeConfig.network.customBlockPatterns.push(val);
        inputNewRule.value = '';
        saveConfig();
        renderCustomRules();
      }
    });

    btnPurgeSession.addEventListener('click', () => {
      if (confirm('Purge all temporary session states immediately?')) {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ action: 'CLEAR_SESSION_STATE' }, () => {
            alert('All temporary session states purged successfully.');
          });
        }
      }
    });

    btnResetDefaults.addEventListener('click', () => {
      if (confirm('Restore factory configuration defaults?')) {
        activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        saveConfig();
        populateUI();
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', initOptions);
})();

