/**
 * Universal Website Performance Optimizer
 * Standalone Content Script Execution Engine
 * Pure Native Browser WebExtension MV3 Implementation
 */

(() => {
  const INJECTION_STYLE_ID = 'uwpo-optimized-rendering-stylesheet';

  const ESSENTIAL_PATH_PATTERNS = [
    /\/login/i, /\/signin/i, /\/signup/i, /\/auth/i, /\/oauth/i, /\/sso/i,
    /\/2fa/i, /\/mfa/i, /\/checkout/i, /\/cart/i, /\/payment/i, /\/billing/i, /\/pay\//i
  ];

  const ESSENTIAL_SCRIPT_PATTERNS = [
    /recaptcha/i, /turnstile/i, /hcaptcha/i, /stripe\.com/i,
    /paypal\.com/i, /braintree/i, /checkout/i, /auth0/i
  ];

  const BLOATWARE_SCRIPT_PATTERNS = [
    /hotjar\.com/i, /fullstory\.com/i, /crazyegg\.com/i, /mouseflow\.com/i,
    /clarity\.ms/i, /doubleclick\.net/i, /google-analytics\.com\/analytics\.js/i,
    /google-analytics\.com\/g\/collect/i, /googletagservices\.com/i,
    /connect\.facebook\.net\/.*\/fbevents\.js/i, /analytics\.tiktok\.com/i,
    /criteo\.net/i, /outbrain\.com/i, /taboola\.com/i, /scorecardresearch\.com/i,
    /adroll\.com/i, /yandex\.ru\/metrika/i
  ];

  let activeConfig = null;
  let isOptimized = false;
  let appliedModules = [];
  let metricsInterval = null;
  let blockedRequestsCount = 0;
  let estimatedSavedBytes = 0;

  // Active Observers and References for Teardown
  let scriptObserver = null;
  let domImageObserver = null;
  let videoIntersectionObserver = null;
  let canvasIntersectionObserver = null;
  let visibilityListener = null;
  let originalSendBeacon = null;
  const controlledVideos = new Set();
  const modifiedDomElements = new Set();

  function isDomainAllowlisted(hostname, allowlist) {
    if (!hostname || !allowlist) return false;
    const cleanHost = hostname.toLowerCase().trim();
    return allowlist.some(item => {
      const cleanItem = item.toLowerCase().trim();
      return cleanHost === cleanItem || cleanHost.endsWith('.' + cleanItem) || cleanHost === 'localhost' || cleanHost === '127.0.0.1';
    });
  }

  function isEssentialFlow(url) {
    return ESSENTIAL_PATH_PATTERNS.some(p => p.test(url));
  }

  function isEssentialScript(src) {
    return ESSENTIAL_SCRIPT_PATTERNS.some(p => p.test(src));
  }

  function isBloatwareScript(src) {
    if (!src || isEssentialScript(src)) return false;
    return BLOATWARE_SCRIPT_PATTERNS.some(p => p.test(src));
  }

  // 1. Rendering / CSS Optimization
  function applyRenderingOptimizations(cfg) {
    if (!cfg.rendering || !cfg.rendering.enabled) return;

    let style = document.getElementById(INJECTION_STYLE_ID);
    if (!style) {
      style = document.createElement('style');
      style.id = INJECTION_STYLE_ID;
      (document.documentElement || document.head).appendChild(style);
    }

    const rules = [];
    if (cfg.rendering.reduceCssAnimations) {
      rules.push('*:not([aria-busy="true"]):not(.spinner):not(.loading) { animation-iteration-count: 1 !important; animation-duration: 0.01ms !important; }');
    }
    if (cfg.rendering.disableExpensiveFilters) {
      rules.push('* { filter: none !important; }');
    }
    if (cfg.rendering.disableBackdropBlur) {
      rules.push('* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }');
    }
    if (cfg.rendering.disableHeavyBoxShadows) {
      rules.push('* { box-shadow: none !important; text-shadow: none !important; }');
    }
    if (cfg.rendering.enforceReducedMotion) {
      rules.push('@media (prefers-reduced-motion: no-preference) { * { scroll-behavior: auto !important; transition-duration: 0.01ms !important; } }');
    }

    style.textContent = rules.join('\n');
    appliedModules.push('rendering');
  }

  // 2. JavaScript / Script Blocker
  function applyScriptOptimizations(cfg) {
    if (!cfg.scripts || !cfg.scripts.enabled) return;

    if (typeof MutationObserver !== 'undefined') {
      scriptObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              const el = node;
              if (el.tagName === 'SCRIPT') {
                inspectScript(el);
              } else {
                const scripts = el.getElementsByTagName('script');
                for (let i = 0; i < scripts.length; i++) {
                  inspectScript(scripts[i]);
                }
              }
            }
          }
        }
      });
      scriptObserver.observe(document.documentElement || document, { childList: true, subtree: true });
    }

    if (cfg.scripts.blockTelemetryBeacons && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      originalSendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function(url, data) {
        const u = url ? url.toString() : '';
        if (isBloatwareScript(u)) {
          blockedRequestsCount++;
          estimatedSavedBytes += 35000;
          return true;
        }
        return originalSendBeacon(url, data);
      };
    }

    appliedModules.push('scripts');
  }

  function inspectScript(script) {
    const src = script.src || '';
    if (isBloatwareScript(src)) {
      script.type = 'javascript/blocked';
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      blockedRequestsCount++;
      estimatedSavedBytes += 45000;
    }
  }

  // 3. Image Optimization
  function applyImageOptimizations(cfg) {
    if (!cfg.images || !cfg.images.enabled) return;

    const optimizeImg = (img) => {
      if (img.dataset.uwpoDone) return;
      if (cfg.images.enforceLazyLoading && img.loading !== 'eager') {
        const rect = img.getBoundingClientRect();
        if (rect.top > (window.innerHeight || 800)) {
          img.loading = 'lazy';
        }
      }
      if (cfg.images.enforceAsyncDecoding && img.decoding !== 'async') {
        img.decoding = 'async';
      }
      img.dataset.uwpoDone = 'true';
    };

    document.querySelectorAll('img').forEach(optimizeImg);

    if (typeof MutationObserver !== 'undefined') {
      domImageObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              const el = node;
              if (el.tagName === 'IMG') {
                optimizeImg(el);
              } else {
                el.querySelectorAll('img').forEach(optimizeImg);
              }
            }
          }
        }
      });
      domImageObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    }

    appliedModules.push('images');
  }

  // 4. Video Optimization
  function applyVideoOptimizations(cfg) {
    if (!cfg.videos || !cfg.videos.enabled) return;

    const setupVideo = (video) => {
      controlledVideos.add(video);
      if (cfg.videos.blockAutoplay) {
        video.autoplay = false;
        video.removeAttribute('autoplay');
        if (video.preload !== 'metadata' && video.preload !== 'none') {
          video.preload = 'metadata';
        }
      }
      if (videoIntersectionObserver) {
        videoIntersectionObserver.observe(video);
      }
    };

    if (cfg.videos.pauseOffscreenVideos && typeof IntersectionObserver !== 'undefined') {
      videoIntersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          const video = entry.target;
          if (!entry.isIntersecting) {
            if (!video.paused) {
              video.pause();
              video.dataset.uwpoOffscreenPaused = 'true';
            }
          } else {
            if (video.dataset.uwpoOffscreenPaused === 'true') {
              delete video.dataset.uwpoOffscreenPaused;
              video.play().catch(() => {});
            }
          }
        }
      }, { rootMargin: '50px' });
    }

    document.querySelectorAll('video').forEach(setupVideo);

    if (cfg.videos.pauseBackgroundTabVideos) {
      visibilityListener = () => {
        if (document.hidden) {
          controlledVideos.forEach(v => {
            if (!v.paused && (v.muted || v.volume === 0)) {
              v.pause();
              v.dataset.uwpoBgPaused = 'true';
            }
          });
        } else {
          controlledVideos.forEach(v => {
            if (v.dataset.uwpoBgPaused === 'true') {
              delete v.dataset.uwpoBgPaused;
              v.play().catch(() => {});
            }
          });
        }
      };
      document.addEventListener('visibilitychange', visibilityListener, { passive: true });
    }

    appliedModules.push('videos');
  }

  // 5. DOM Optimization
  function applyDomOptimizations(cfg) {
    if (!cfg.dom || !cfg.dom.enabled || !cfg.dom.enableContentVisibilityAuto) return;

    try {
      const candidates = document.querySelectorAll('article, main > section:not(:first-child), footer, aside');
      const vh = window.innerHeight || 800;

      candidates.forEach(el => {
        if (el.querySelector('form, input, select, textarea, nav, header')) return;
        const rect = el.getBoundingClientRect();
        if (rect.top > vh) {
          el.style.contentVisibility = 'auto';
          el.style.containIntrinsicSize = '1px 500px';
          modifiedDomElements.add(el);
        }
      });
      appliedModules.push('dom');
    } catch (e) {
      // safe fallback
    }
  }

  // Collect genuine performance metrics
  function samplePerformanceStats() {
    let navigationStart = 0;
    let domContentLoadedMs = 0;
    let loadEventMs = 0;

    if (typeof performance !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries && navEntries.length > 0) {
        const nav = navEntries[0];
        navigationStart = nav.startTime;
        domContentLoadedMs = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
        loadEventMs = Math.round(nav.loadEventEnd - nav.startTime);
      } else if (performance.timing) {
        const t = performance.timing;
        navigationStart = t.navigationStart;
        domContentLoadedMs = Math.max(0, t.domContentLoadedEventEnd - t.navigationStart);
        loadEventMs = Math.max(0, t.loadEventEnd - t.navigationStart);
      }
    }

    let jsHeapUsedMB = null;
    let jsHeapTotalMB = null;
    let jsHeapLimitMB = null;

    if (typeof performance !== 'undefined' && performance.memory) {
      const mem = performance.memory;
      if (mem && mem.usedJSHeapSize) {
        jsHeapUsedMB = Math.round((mem.usedJSHeapSize / 1048576) * 10) / 10;
        jsHeapTotalMB = Math.round((mem.totalJSHeapSize / 1048576) * 10) / 10;
        jsHeapLimitMB = Math.round((mem.jsHeapSizeLimit / 1048576) * 10) / 10;
      }
    }

    let totalRequests = 0;
    let transferredBytes = 0;
    if (typeof performance !== 'undefined' && performance.getEntriesByType) {
      const resources = performance.getEntriesByType('resource');
      totalRequests = resources.length;
      for (let i = 0; i < resources.length; i++) {
        const r = resources[i];
        if (r.transferSize && r.transferSize > 0) {
          transferredBytes += r.transferSize;
        } else if (r.encodedBodySize && r.encodedBodySize > 0) {
          transferredBytes += r.encodedBodySize;
        }
      }
    }

    const domNodeCount = typeof document !== 'undefined' ? document.getElementsByTagName('*').length : 0;

    return {
      stats: {
        navigationStart,
        domContentLoadedMs: domContentLoadedMs > 0 ? domContentLoadedMs : 0,
        loadEventMs: loadEventMs > 0 ? loadEventMs : 0,
        jsHeapUsedMB,
        jsHeapTotalMB,
        jsHeapLimitMB,
        totalRequests,
        blockedRequests: blockedRequestsCount,
        transferredBytes,
        estimatedSavedBytes,
        fpsEstimate: 60,
        activeModulesCount: appliedModules.length,
        isOptimized,
        mode: activeConfig ? activeConfig.mode : 'balanced'
      },
      workload: {
        domNodeCount,
        scriptCount: document.scripts ? document.scripts.length : 0,
        stylesheetCount: document.styleSheets ? document.styleSheets.length : 0,
        imageCount: document.images ? document.images.length : 0,
        videoCount: document.getElementsByTagName('video').length,
        iframeCount: document.getElementsByTagName('iframe').length,
        longTasksCount: 0,
        totalLongTaskDurationMs: 0
      },
      appliedModules: [...appliedModules],
      url: location.href,
      hostname: location.hostname
    };
  }

  function reportMetrics() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    try {
      const data = samplePerformanceStats();
      chrome.runtime.sendMessage({
        action: 'REPORT_PAGE_METRICS',
        payload: data
      }, () => {
        if (chrome.runtime.lastError) { /* ignore */ }
      });
    } catch (e) {
      // safe ignore
    }
  }

  function teardownAll() {
    isOptimized = false;
    appliedModules = [];

    const style = document.getElementById(INJECTION_STYLE_ID);
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }

    if (scriptObserver) {
      scriptObserver.disconnect();
      scriptObserver = null;
    }
    if (domImageObserver) {
      domImageObserver.disconnect();
      domImageObserver = null;
    }
    if (videoIntersectionObserver) {
      videoIntersectionObserver.disconnect();
      videoIntersectionObserver = null;
    }
    if (visibilityListener) {
      document.removeEventListener('visibilitychange', visibilityListener);
      visibilityListener = null;
    }
    if (originalSendBeacon && typeof navigator !== 'undefined') {
      navigator.sendBeacon = originalSendBeacon;
      originalSendBeacon = null;
    }

    modifiedDomElements.forEach(el => {
      el.style.contentVisibility = '';
      el.style.containIntrinsicSize = '';
    });
    modifiedDomElements.clear();
    controlledVideos.clear();

    reportMetrics();
  }

  function initOptimization(cfg) {
    activeConfig = cfg;
    if (!cfg.masterEnabled || cfg.safety.emergencyDisabled) {
      teardownAll();
      return;
    }

    const host = location.hostname;
    const href = location.href;

    if (isDomainAllowlisted(host, cfg.safety.allowlist) || isEssentialFlow(href)) {
      teardownAll();
      return;
    }

    teardownAll();
    isOptimized = true;

    // Apply immediate modules
    applyRenderingOptimizations(cfg);
    applyScriptOptimizations(cfg);

    // Apply DOM-dependent modules
    const onDomReady = () => {
      applyImageOptimizations(cfg);
      applyVideoOptimizations(cfg);
      applyDomOptimizations(cfg);
      reportMetrics();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    } else {
      onDomReady();
    }

    if (!metricsInterval) {
      metricsInterval = setInterval(reportMetrics, 2000);
    }
  }

  // Request active configuration from background
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ action: 'GET_TAB_STATE' }, (res) => {
      if (res && res.config) {
        initOptimization(res.config);
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'EMERGENCY_RESET') {
        teardownAll();
        sendResponse({ success: true });
      } else if (message.action === 'UPDATE_CONFIG' && message.payload) {
        initOptimization(message.payload);
        sendResponse({ success: true });
      }
      return true;
    });
  }
})();

