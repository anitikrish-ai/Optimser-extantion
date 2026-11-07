/**
 * Universal Website Performance Optimizer
 * Options & Advanced Dashboard Controller (TypeScript)
 */

import { OptimizerConfiguration, OptimizationMode, DeviceCapabilities } from '../../src/shared/types';
import { browserApi } from '../../src/browser-adapters/browser-api';
import { DEFAULT_CONFIG } from '../../src/shared/constants';

let activeConfig: OptimizerConfiguration = DEFAULT_CONFIG;

// Tab Navigation
const navItems = document.querySelectorAll<HTMLAnchorElement>('.nav-item');
const contentTabs = document.querySelectorAll<HTMLElement>('.content-tab');

// Overview Elements
const diagDeviceType = document.getElementById('diag-device-type') as HTMLElement;
const diagCpuCores = document.getElementById('diag-cpu-cores') as HTMLElement;
const diagMemory = document.getElementById('diag-memory') as HTMLElement;
const diagPlatform = document.getElementById('diag-platform') as HTMLElement;
const diagNetwork = document.getElementById('diag-network') as HTMLElement;
const diagBattery = document.getElementById('diag-battery') as HTMLElement;
const overviewModeBadge = document.getElementById('overview-mode-badge') as HTMLElement;
const selectGlobalMode = document.getElementById('select-global-mode') as HTMLSelectElement;
const checkAutoAdaptive = document.getElementById('check-auto-adaptive') as HTMLInputElement;

// Module Elements
const cfgCpuEnabled = document.getElementById('cfg-cpu-enabled') as HTMLInputElement;
const cfgCpuTimers = document.getElementById('cfg-cpu-timers') as HTMLInputElement;
const cfgCpuCanvas = document.getElementById('cfg-cpu-canvas') as HTMLInputElement;
const cfgCpuScroll = document.getElementById('cfg-cpu-scroll') as HTMLInputElement;

const cfgScriptsEnabled = document.getElementById('cfg-scripts-enabled') as HTMLInputElement;
const cfgScriptsTrackers = document.getElementById('cfg-scripts-trackers') as HTMLInputElement;
const cfgScriptsReplay = document.getElementById('cfg-scripts-replay') as HTMLInputElement;

const cfgImagesEnabled = document.getElementById('cfg-images-enabled') as HTMLInputElement;
const cfgImagesLazy = document.getElementById('cfg-images-lazy') as HTMLInputElement;
const cfgImagesAsync = document.getElementById('cfg-images-async') as HTMLInputElement;

const cfgVideosEnabled = document.getElementById('cfg-videos-enabled') as HTMLInputElement;
const cfgVideosAutoplay = document.getElementById('cfg-videos-autoplay') as HTMLInputElement;
const cfgVideosOffscreen = document.getElementById('cfg-videos-offscreen') as HTMLInputElement;
const cfgVideosBg = document.getElementById('cfg-videos-bg') as HTMLInputElement;

const cfgRenderingEnabled = document.getElementById('cfg-rendering-enabled') as HTMLInputElement;
const cfgRenderingAnim = document.getElementById('cfg-rendering-anim') as HTMLInputElement;
const cfgRenderingFilters = document.getElementById('cfg-rendering-filters') as HTMLInputElement;
const cfgRenderingBlur = document.getElementById('cfg-rendering-blur') as HTMLInputElement;
const cfgRenderingMotion = document.getElementById('cfg-rendering-motion') as HTMLInputElement;

const cfgDomEnabled = document.getElementById('cfg-dom-enabled') as HTMLInputElement;
const cfgDomVisibility = document.getElementById('cfg-dom-visibility') as HTMLInputElement;
const cfgDomBatch = document.getElementById('cfg-dom-batch') as HTMLInputElement;

// Allowlist Elements
const inputNewDomain = document.getElementById('input-new-domain') as HTMLInputElement;
const btnAddDomain = document.getElementById('btn-add-domain') as HTMLButtonElement;
const allowlistTbody = document.getElementById('allowlist-tbody') as HTMLElement;

// Custom Rules Elements
const inputNewRule = document.getElementById('input-new-rule') as HTMLInputElement;
const btnAddRule = document.getElementById('btn-add-rule') as HTMLButtonElement;
const customRulesUl = document.getElementById('custom-rules-ul') as HTMLElement;

// Session Reset Actions
const btnPurgeSession = document.getElementById('btn-purge-session') as HTMLButtonElement;
const btnResetDefaults = document.getElementById('btn-reset-defaults') as HTMLButtonElement;

async function initOptions(): Promise<void> {
  setupTabNavigation();
  await loadDeviceDiagnostics();
  await loadSessionConfig();
  setupEventListeners();
}

function setupTabNavigation(): void {
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

async function loadDeviceDiagnostics(): Promise<void> {
  const concurrency = navigator.hardwareConcurrency || 4;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const isMobile = /mobile|android|iphone/i.test(navigator.userAgent);

  diagCpuCores.textContent = `${concurrency} Cores`;
  diagMemory.textContent = memory ? `${memory} GB RAM` : 'Unexposed by browser';
  diagPlatform.textContent = isMobile ? 'Mobile Device' : 'Desktop Environment';

  // Network
  if ('connection' in navigator) {
    const conn = (navigator as unknown as { connection?: { effectiveType?: string } }).connection;
    diagNetwork.textContent = conn?.effectiveType ? conn.effectiveType.toUpperCase() : 'Unknown';
  } else {
    diagNetwork.textContent = 'Standard';
  }

  // Battery
  if ('getBattery' in navigator) {
    try {
      const getBattery = (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean }> }).getBattery;
      const battery = await getBattery();
      diagBattery.textContent = `${Math.round(battery.level * 100)}% (${battery.charging ? 'Charging' : 'Battery'})`;
    } catch {
      diagBattery.textContent = 'AC Power / Unexposed';
    }
  } else {
    diagBattery.textContent = 'AC Power / Unexposed';
  }

  const isLowEnd = concurrency <= 4 || (memory && memory <= 4);
  diagDeviceType.textContent = isLowEnd ? 'RESOURCE CONSTRAINED' : 'HIGH CAPABILITY';
  if (isLowEnd) {
    diagDeviceType.className = 'badge active';
  }
}

async function loadSessionConfig(): Promise<void> {
  const response = await browserApi.sendMessage<
    { action: string },
    { success: boolean; config?: OptimizerConfiguration }
  >({
    action: 'GET_TAB_STATE'
  });

  if (response?.config) {
    activeConfig = response.config;
    populateUIFromConfig();
  }
}

function populateUIFromConfig(): void {
  overviewModeBadge.textContent = activeConfig.mode.replace('_', ' ').toUpperCase();
  selectGlobalMode.value = activeConfig.mode;
  checkAutoAdaptive.checked = activeConfig.autoAdaptive;

  // CPU
  cfgCpuEnabled.checked = activeConfig.cpu.enabled;
  cfgCpuTimers.checked = activeConfig.cpu.throttleBackgroundTimers;
  cfgCpuCanvas.checked = activeConfig.cpu.pauseOffscreenCanvases;
  cfgCpuScroll.checked = activeConfig.cpu.throttleScrollEvents;

  // Scripts
  cfgScriptsEnabled.checked = activeConfig.scripts.enabled;
  cfgScriptsTrackers.checked = activeConfig.scripts.blockHeavyTrackers;
  cfgScriptsReplay.checked = activeConfig.scripts.blockSessionReplay;

  // Images
  cfgImagesEnabled.checked = activeConfig.images.enabled;
  cfgImagesLazy.checked = activeConfig.images.enforceLazyLoading;
  cfgImagesAsync.checked = activeConfig.images.enforceAsyncDecoding;

  // Videos
  cfgVideosEnabled.checked = activeConfig.videos.enabled;
  cfgVideosAutoplay.checked = activeConfig.videos.blockAutoplay;
  cfgVideosOffscreen.checked = activeConfig.videos.pauseOffscreenVideos;
  cfgVideosBg.checked = activeConfig.videos.pauseBackgroundTabVideos;

  // Rendering
  cfgRenderingEnabled.checked = activeConfig.rendering.enabled;
  cfgRenderingAnim.checked = activeConfig.rendering.reduceCssAnimations;
  cfgRenderingFilters.checked = activeConfig.rendering.disableExpensiveFilters;
  cfgRenderingBlur.checked = activeConfig.rendering.disableBackdropBlur;
  cfgRenderingMotion.checked = activeConfig.rendering.enforceReducedMotion;

  // DOM
  cfgDomEnabled.checked = activeConfig.dom.enabled;
  cfgDomVisibility.checked = activeConfig.dom.enableContentVisibilityAuto;
  cfgDomBatch.checked = activeConfig.dom.batchMutationObservers;

  renderAllowlist();
  renderCustomRules();
}

function renderAllowlist(): void {
  allowlistTbody.innerHTML = '';
  activeConfig.safety.allowlist.forEach((domain, index) => {
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
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '-1', 10);
      if (idx > -1) {
        activeConfig.safety.allowlist.splice(idx, 1);
        saveConfiguration();
        renderAllowlist();
      }
    });
  });
}

function renderCustomRules(): void {
  customRulesUl.innerHTML = '';
  const rules = activeConfig.network.customBlockPatterns || [];
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
      const idx = parseInt((e.currentTarget as HTMLElement).dataset.index || '-1', 10);
      if (idx > -1) {
        activeConfig.network.customBlockPatterns.splice(idx, 1);
        saveConfiguration();
        renderCustomRules();
      }
    });
  });
}

function setupEventListeners(): void {
  selectGlobalMode.addEventListener('change', () => {
    activeConfig.mode = selectGlobalMode.value as OptimizationMode;
    overviewModeBadge.textContent = activeConfig.mode.replace('_', ' ').toUpperCase();
    saveConfiguration();
  });

  checkAutoAdaptive.addEventListener('change', () => {
    activeConfig.autoAdaptive = checkAutoAdaptive.checked;
    saveConfiguration();
  });

  // Module switches
  const bindCheck = (input: HTMLInputElement, setter: (val: boolean) => void) => {
    input.addEventListener('change', () => {
      setter(input.checked);
      saveConfiguration();
    });
  };

  bindCheck(cfgCpuEnabled, (v) => (activeConfig.cpu.enabled = v));
  bindCheck(cfgCpuTimers, (v) => (activeConfig.cpu.throttleBackgroundTimers = v));
  bindCheck(cfgCpuCanvas, (v) => (activeConfig.cpu.pauseOffscreenCanvases = v));
  bindCheck(cfgCpuScroll, (v) => (activeConfig.cpu.throttleScrollEvents = v));

  bindCheck(cfgScriptsEnabled, (v) => (activeConfig.scripts.enabled = v));
  bindCheck(cfgScriptsTrackers, (v) => (activeConfig.scripts.blockHeavyTrackers = v));
  bindCheck(cfgScriptsReplay, (v) => (activeConfig.scripts.blockSessionReplay = v));

  bindCheck(cfgImagesEnabled, (v) => (activeConfig.images.enabled = v));
  bindCheck(cfgImagesLazy, (v) => (activeConfig.images.enforceLazyLoading = v));
  bindCheck(cfgImagesAsync, (v) => (activeConfig.images.enforceAsyncDecoding = v));

  bindCheck(cfgVideosEnabled, (v) => (activeConfig.videos.enabled = v));
  bindCheck(cfgVideosAutoplay, (v) => (activeConfig.videos.blockAutoplay = v));
  bindCheck(cfgVideosOffscreen, (v) => (activeConfig.videos.pauseOffscreenVideos = v));
  bindCheck(cfgVideosBg, (v) => (activeConfig.videos.pauseBackgroundTabVideos = v));

  bindCheck(cfgRenderingEnabled, (v) => (activeConfig.rendering.enabled = v));
  bindCheck(cfgRenderingAnim, (v) => (activeConfig.rendering.reduceCssAnimations = v));
  bindCheck(cfgRenderingFilters, (v) => (activeConfig.rendering.disableExpensiveFilters = v));
  bindCheck(cfgRenderingBlur, (v) => (activeConfig.rendering.disableBackdropBlur = v));
  bindCheck(cfgRenderingMotion, (v) => (activeConfig.rendering.enforceReducedMotion = v));

  bindCheck(cfgDomEnabled, (v) => (activeConfig.dom.enabled = v));
  bindCheck(cfgDomVisibility, (v) => (activeConfig.dom.enableContentVisibilityAuto = v));
  bindCheck(cfgDomBatch, (v) => (activeConfig.dom.batchMutationObservers = v));

  // Add Domain
  btnAddDomain.addEventListener('click', () => {
    const val = inputNewDomain.value.trim().toLowerCase();
    if (val && !activeConfig.safety.allowlist.includes(val)) {
      activeConfig.safety.allowlist.push(val);
      inputNewDomain.value = '';
      saveConfiguration();
      renderAllowlist();
    }
  });

  // Add Custom Rule
  btnAddRule.addEventListener('click', () => {
    const val = inputNewRule.value.trim();
    if (val) {
      if (!activeConfig.network.customBlockPatterns) {
        activeConfig.network.customBlockPatterns = [];
      }
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

async function saveConfiguration(): Promise<void> {
  await browserApi.sendMessage({
    action: 'UPDATE_CONFIG',
    payload: activeConfig
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', initOptions);

