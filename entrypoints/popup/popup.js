/**
 * Universal Website Performance Optimizer
 * Popup Interactive Controller (Native JS)
 */

(() => {
  let currentTabId = null;
  let currentHostname = '';
  let activeConfig = null;

  const masterToggle = document.getElementById('master-toggle');
  const domainHostnameEl = document.getElementById('domain-hostname');
  const domainStatusBadge = document.getElementById('domain-status-badge');
  const allowlistBtn = document.getElementById('btn-toggle-allowlist');
  const allowlistBtnText = document.getElementById('allowlist-btn-text');
  const instantResetBtn = document.getElementById('btn-instant-reset');
  const activeModeIndicator = document.getElementById('active-mode-indicator');
  const modeButtons = document.querySelectorAll('.mode-btn');
  const openOptionsBtn = document.getElementById('btn-open-options');

  const valBlockedRequests = document.getElementById('val-blocked-requests');
  const valSavedData = document.getElementById('val-saved-data');
  const valDomReady = document.getElementById('val-dom-ready');
  const valJsHeap = document.getElementById('val-js-heap');

  const modScripts = document.getElementById('mod-scripts');
  const modImages = document.getElementById('mod-images');
  const modVideos = document.getElementById('mod-videos');
  const modRendering = document.getElementById('mod-rendering');
  const modCpu = document.getElementById('mod-cpu');
  const modDom = document.getElementById('mod-dom');

  function initPopup() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          currentTabId = activeTab.id;
          try {
            const url = new URL(activeTab.url);
            currentHostname = url.hostname;
            domainHostnameEl.textContent = currentHostname || 'Internal Page';
          } catch (e) {
            currentHostname = '';
            domainHostnameEl.textContent = 'Special Page';
          }
          fetchState();
        }
      });
    }

    setupEventListeners();
    setInterval(fetchState, 1200);
  }

  function fetchState() {
    if (!currentTabId || typeof chrome === 'undefined' || !chrome.runtime) return;

    chrome.runtime.sendMessage({ action: 'GET_TAB_STATE', tabId: currentTabId }, (res) => {
      if (chrome.runtime.lastError || !res) return;

      if (res.config) {
        activeConfig = res.config;
        updateConfigUI();
      }

      if (res.state && res.state.stats) {
        updateMetricsUI(res.state.stats);
      }
    });
  }

  function updateConfigUI() {
    if (!activeConfig) return;

    masterToggle.checked = activeConfig.masterEnabled;

    const isAllowlisted = activeConfig.safety && activeConfig.safety.allowlist && activeConfig.safety.allowlist.includes(currentHostname);
    if (isAllowlisted) {
      domainStatusBadge.textContent = 'ALLOWLISTED';
      domainStatusBadge.className = 'status-badge bypassed';
      allowlistBtnText.textContent = 'Remove Allowlist';
    } else if (!activeConfig.masterEnabled) {
      domainStatusBadge.textContent = 'PAUSED';
      domainStatusBadge.className = 'status-badge bypassed';
      allowlistBtnText.textContent = 'Allowlist Site';
    } else {
      domainStatusBadge.textContent = 'OPTIMIZED';
      domainStatusBadge.className = 'status-badge active';
      allowlistBtnText.textContent = 'Allowlist Site';
    }

    activeModeIndicator.textContent = (activeConfig.mode || 'balanced').replace('_', ' ').toUpperCase();

    modeButtons.forEach((btn) => {
      if (btn.dataset.mode === activeConfig.mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (activeConfig.scripts) modScripts.checked = activeConfig.scripts.enabled;
    if (activeConfig.images) modImages.checked = activeConfig.images.enabled;
    if (activeConfig.videos) modVideos.checked = activeConfig.videos.enabled;
    if (activeConfig.rendering) modRendering.checked = activeConfig.rendering.enabled;
    if (activeConfig.cpu) modCpu.checked = activeConfig.cpu.enabled;
    if (activeConfig.dom) modDom.checked = activeConfig.dom.enabled;
  }

  function updateMetricsUI(stats) {
    if (!stats) return;

    valBlockedRequests.textContent = stats.blockedRequests || 0;

    const savedBytes = stats.estimatedSavedBytes || 0;
    const savedKB = Math.round(savedBytes / 1024);
    const savedMB = (savedBytes / 1048576).toFixed(1);
    valSavedData.textContent = savedBytes > 1048576 ? `${savedMB} MB` : `${savedKB} KB`;

    valDomReady.textContent = stats.domContentLoadedMs > 0 ? `${stats.domContentLoadedMs} ms` : '-- ms';

    if (stats.jsHeapUsedMB !== null && stats.jsHeapUsedMB !== undefined) {
      valJsHeap.textContent = `${stats.jsHeapUsedMB} MB`;
    } else {
      valJsHeap.textContent = 'N/A';
    }
  }

  function saveConfig() {
    if (!activeConfig || typeof chrome === 'undefined' || !chrome.runtime) return;
    updateConfigUI();
    chrome.runtime.sendMessage({
      action: 'UPDATE_CONFIG',
      tabId: currentTabId,
      payload: activeConfig
    });
  }

  function setupEventListeners() {
    masterToggle.addEventListener('change', () => {
      if (!activeConfig) return;
      activeConfig.masterEnabled = masterToggle.checked;
      saveConfig();
    });

    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!activeConfig) return;
        activeConfig.mode = btn.dataset.mode;
        saveConfig();
      });
    });

    allowlistBtn.addEventListener('click', () => {
      if (!activeConfig || !currentHostname) return;
      if (!activeConfig.safety) activeConfig.safety = { allowlist: [] };
      const idx = activeConfig.safety.allowlist.indexOf(currentHostname);
      if (idx > -1) {
        activeConfig.safety.allowlist.splice(idx, 1);
      } else {
        activeConfig.safety.allowlist.push(currentHostname);
      }
      saveConfig();
    });

    instantResetBtn.addEventListener('click', () => {
      if (currentTabId && typeof chrome !== 'undefined') {
        chrome.runtime.sendMessage({ action: 'EMERGENCY_RESET', tabId: currentTabId });
        domainStatusBadge.textContent = 'RESET';
        domainStatusBadge.className = 'status-badge bypassed';
      }
    });

    const bindToggle = (el, path) => {
      el.addEventListener('change', () => {
        if (!activeConfig || !activeConfig[path]) return;
        activeConfig[path].enabled = el.checked;
        saveConfig();
      });
    };

    bindToggle(modScripts, 'scripts');
    bindToggle(modImages, 'images');
    bindToggle(modVideos, 'videos');
    bindToggle(modRendering, 'rendering');
    bindToggle(modCpu, 'cpu');
    bindToggle(modDom, 'dom');

    openOptionsBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', initPopup);
})();

