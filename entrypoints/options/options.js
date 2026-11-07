/**
 * Universal Website Performance Optimizer
 * Options & Advanced Dashboard Controller (Single Source of Truth)
 */

import { browserApi } from '../../src/browser-adapters/browser-api.js';
import { deviceDetector } from '../../src/device-detection/device-detector.js';
import { safetyManager } from '../../src/safety/safety-manager.js';
import { DEFAULT_CONFIG } from '../../src/shared/constants.js';

let activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// Tab Navigation
const navItems = document.querySelectorAll('.nav-item');
const contentTabs = document.querySelectorAll('.content-tab');

// Overview Elements
const diagDeviceType = document.getElementById('diag-device-type');
const diagCpuCores = document.getElementById('diag-cpu-cores');
const diagMemory = document.getElementById('diag-memory');
const diagPlatform = document.getElementById('diag-platform');
const diagNetwork = document.getElementById('diag-network');
const diagBattery = document.getElementById('diag-battery');
const overviewModeBadge = document.getElementById('overview-mode-badge');
const selectGlobalMode = document.getElementById('select-global-mode');
const checkAutoAdaptive = document.getElementById('check-auto-adaptive');

// Module Elements
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

// Allowlist Elements
const inputNewDomain = document.getElementById('input-new-domain');
const btnAddDomain = document.getElementById('btn-add-domain');
const allowlistTbody = document.getElementById('allowlist-tbody');

// Custom Rules Elements
const inputNewRule = document.getElementById('input-new-rule');
const btnAddRule = document.getElementById('btn-add-rule');
const customRulesUl = document.getElementById('custom-rules-ul');

// Session Reset Actions
const btnPurgeSession = document.getElementById('btn-purge-session');
const btnResetDefaults = document.getElementById('btn-reset-defaults');

async function initOptions() {
  setupTabNavigation();
  await loadDeviceDiagnostics();
  await loadSessionConfig();
  setupEventListeners();
}

function setupTabNavigation() {
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = item.dataset.tab;

      navItems.forEach((nav) => nav.classList.remove('active'));
      contentTabs.forEach((tab) => tab.classList.remove('active'));

      item.classList.add('active');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) {
        activeContent.classList.add('active');
      }
    });
  });
}

async function loadDeviceDiagnostics() {
  const caps = await deviceDetector.getCapabilities();

  diagCpuCores.textContent = `${caps.hardwareConcurrency} Cores`;
  diagMemory.textContent = caps.deviceMemoryGB !== null
    ? `${caps.deviceMemoryGB} GB RAM`
    : 'Unexposed by browser';
  diagPlatform.textContent = caps.isMobile ? 'Mobile Device' : 'Desktop Environment';
  diagNetwork.textContent = caps.networkType ? caps.networkType.toUpperCase() : 'Standard';

  if (caps.batteryLevel !== null) {
    diagBattery.textContent = `${caps.batteryLevel}% (${caps.isBatteryCharging ? 'Charging' : 'Battery'})`;
  } else {
    diagBattery.textContent = 'AC Power / Unexposed';
  }

  diagDeviceType.textContent = caps.isLowEndDevice ? 'RESOURCE CONSTRAINED' : 'HIGH CAPABILITY';
  if (caps.isLowEndDevice) {
    diagDeviceType.className = 'badge active';
  } else {
    diagDeviceType.className = 'badge';
  }
}

async function loadSessionConfig() {
  const response = await browserApi.sendMessage({ action: 'GET_TAB_STATE' });
  if (response?.config) {
    activeConfig = response.config;
    populateUIFromConfig();
  }
}

function populateUIFromConfig() {
  overviewModeBadge.textContent = (activeConfig.mode || 'balanced').replace('_', ' ').toUpperCase();
  selectGlobalMode.value = activeConfig.mode || 'balanced';
  checkAutoAdaptive.checked = !!activeConfig.autoAdaptive;

  // CPU
  if (activeConfig.cpu) {
    cfgCpuEnabled.checked = !!activeConfig.cpu.enabled;
    cfgCpuTimers.checked = !!activeConfig.cpu.throttleBackgroundTimers;
    cfgCpuCanvas.checked = !!activeConfig.cpu.pauseOffscreenCanvases;
    cfgCpuScroll.checked = !!activeConfig.cpu.throttleScrollEvents;
  }

  // Scripts
  if (activeConfig.scripts) {
    cfgScriptsEnabled.checked = !!activeConfig.scripts.enabled;
    cfgScriptsTrackers.checked = !!activeConfig.scripts.blockHeavyTrackers;
    cfgScriptsReplay.checked = !!activeConfig.scripts.blockSessionReplay;
  }

  // Images
  if (activeConfig.images) {
    cfgImagesEnabled.checked = !!activeConfig.images.enabled;
    cfgImagesLazy.checked = !!activeConfig.images.enforceLazyLoading;
    cfgImagesAsync.checked = !!activeConfig.images.enforceAsyncDecoding;
  }

  // Videos
  if (activeConfig.videos) {
    cfgVideosEnabled.checked = !!activeConfig.videos.enabled;
    cfgVideosAutoplay.checked = !!activeConfig.videos.blockAutoplay;
    cfgVideosOffscreen.checked = !!activeConfig.videos.pauseOffscreenVideos;
    cfgVideosBg.checked = !!activeConfig.videos.pauseBackgroundTabVideos;
  }

  // Rendering
  if (activeConfig.rendering) {
    cfgRenderingEnabled.checked = !!activeConfig.rendering.enabled;
    cfgRenderingAnim.checked = !!activeConfig.rendering.reduceCssAnimations;
    cfgRenderingFilters.checked = !!activeConfig.rendering.disableExpensiveFilters;
    cfgRenderingBlur.checked = !!activeConfig.rendering.disableBackdropBlur;
    cfgRenderingMotion.checked = !!activeConfig.rendering.enforceReducedMotion;
  }

  // DOM
  if (activeConfig.dom) {
    cfgDomEnabled.checked = !!activeConfig.dom.enabled;
    cfgDomVisibility.checked = !!activeConfig.dom.enableContentVisibilityAuto;
    cfgDomBatch.checked = !!activeConfig.dom.batchMutationObservers;
  }

  renderAllowlist();
  renderCustomRules();
}

function renderAllowlist() {
  allowlistTbody.innerHTML = '';
  const list = activeConfig.safety?.allowlist || [];

  list.forEach((domain, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(domain)}</strong></td>
      <td><span class="badge">Bypassed</span></td>
      <td>
        <button class="btn btn-secondary btn-sm delete-domain-btn" data-index="${index}">
          Remove
        </button>
      </td>
    `;
    allowlistTbody.appendChild(tr);
  });

  document.querySelectorAll('.delete-domain-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (idx > -1) {
        activeConfig.safety.allowlist.splice(idx, 1);
        saveConfiguration();
        renderAllowlist();
      }
    });
  });
}

function renderCustomRules() {
  customRulesUl.innerHTML = '';
  const rules = activeConfig.network?.customBlockPatterns || [];
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
        saveConfiguration();
        renderCustomRules();
      }
    });
  });
}

function setupEventListeners() {
  selectGlobalMode.addEventListener('change', () => {
    activeConfig.mode = selectGlobalMode.value;
    overviewModeBadge.textContent = activeConfig.mode.replace('_', ' ').toUpperCase();
    saveConfiguration();
  });

  checkAutoAdaptive.addEventListener('change', () => {
    activeConfig.autoAdaptive = checkAutoAdaptive.checked;
    saveConfiguration();
  });

  const bindCheck = (input, obj, prop) => {
    input.addEventListener('change', () => {
      if (!activeConfig[obj]) activeConfig[obj] = {};
      activeConfig[obj][prop] = input.checked;
      saveConfiguration();
    });
  };

  bindCheck(cfgCpuEnabled, 'cpu', 'enabled');
  bindCheck(cfgCpuTimers, 'cpu', 'throttleBackgroundTimers');
  bindCheck(cfgCpuCanvas, 'cpu', 'pauseOffscreenCanvases');
  bindCheck(cfgCpuScroll, 'cpu', 'throttleScrollEvents');

  bindCheck(cfgScriptsEnabled, 'scripts', 'enabled');
  bindCheck(cfgScriptsTrackers, 'scripts', 'blockHeavyTrackers');
  bindCheck(cfgScriptsReplay, 'scripts', 'blockSessionReplay');

  bindCheck(cfgImagesEnabled, 'images', 'enabled');
  bindCheck(cfgImagesLazy, 'images', 'enforceLazyLoading');
  bindCheck(cfgImagesAsync, 'images', 'enforceAsyncDecoding');

  bindCheck(cfgVideosEnabled, 'videos', 'enabled');
  bindCheck(cfgVideosAutoplay, 'videos', 'blockAutoplay');
  bindCheck(cfgVideosOffscreen, 'videos', 'pauseOffscreenVideos');
  bindCheck(cfgVideosBg, 'videos', 'pauseBackgroundTabVideos');

  bindCheck(cfgRenderingEnabled, 'rendering', 'enabled');
  bindCheck(cfgRenderingAnim, 'rendering', 'reduceCssAnimations');
  bindCheck(cfgRenderingFilters, 'rendering', 'disableExpensiveFilters');
  bindCheck(cfgRenderingBlur, 'rendering', 'disableBackdropBlur');
  bindCheck(cfgRenderingMotion, 'rendering', 'enforceReducedMotion');

  bindCheck(cfgDomEnabled, 'dom', 'enabled');
  bindCheck(cfgDomVisibility, 'dom', 'enableContentVisibilityAuto');
  bindCheck(cfgDomBatch, 'dom', 'batchMutationObservers');

  // Add Domain
  btnAddDomain.addEventListener('click', () => {
    const rawVal = inputNewDomain.value.trim();
    const cleanDomain = safetyManager.normalizeDomain(rawVal);
    if (cleanDomain) {
      if (!activeConfig.safety) activeConfig.safety = { allowlist: [] };
      if (!activeConfig.safety.allowlist.some((d) => safetyManager.normalizeDomain(d) === cleanDomain)) {
        activeConfig.safety.allowlist.push(cleanDomain);
        inputNewDomain.value = '';
        saveConfiguration();
        renderAllowlist();
      }
    }
  });

  // Add Custom Rule
  btnAddRule.addEventListener('click', () => {
    const val = inputNewRule.value.trim();
    if (val) {
      if (!activeConfig.network) activeConfig.network = { customBlockPatterns: [] };
      if (!activeConfig.network.customBlockPatterns) activeConfig.network.customBlockPatterns = [];
      activeConfig.network.customBlockPatterns.push(val);
      inputNewRule.value = '';
      saveConfiguration();
      renderCustomRules();
    }
  });

  // Session Actions
  btnPurgeSession.addEventListener('click', async () => {
    if (confirm('Purge all temporary session states immediately?')) {
      await browserApi.sendMessage({ action: 'CLEAR_SESSION_STATE' });
      alert('All temporary session states purged successfully.');
      await loadSessionConfig();
    }
  });

  btnResetDefaults.addEventListener('click', () => {
    if (confirm('Restore factory configuration defaults?')) {
      activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      saveConfiguration();
      populateUIFromConfig();
    }
  });
}

async function saveConfiguration() {
  await browserApi.sendMessage({
    action: 'UPDATE_CONFIG',
    payload: activeConfig
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initOptions);
