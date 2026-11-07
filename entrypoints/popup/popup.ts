/**
 * Universal Website Performance Optimizer
 * Popup Interactive Controller (TypeScript)
 */

import { OptimizerConfiguration, OptimizationMode, TabSessionState } from '../../src/shared/types';
import { browserApi } from '../../src/browser-adapters/browser-api';
import { DEFAULT_CONFIG } from '../../src/shared/constants';

let currentTabId: number | null = null;
let currentHostname = '';
let activeConfig: OptimizerConfiguration = DEFAULT_CONFIG;

// DOM Elements
const masterToggle = document.getElementById('master-toggle') as HTMLInputElement;
const domainHostnameEl = document.getElementById('domain-hostname') as HTMLElement;
const domainStatusBadge = document.getElementById('domain-status-badge') as HTMLElement;
const allowlistBtn = document.getElementById('btn-toggle-allowlist') as HTMLButtonElement;
const allowlistBtnText = document.getElementById('allowlist-btn-text') as HTMLElement;
const instantResetBtn = document.getElementById('btn-instant-reset') as HTMLButtonElement;
const activeModeIndicator = document.getElementById('active-mode-indicator') as HTMLElement;
const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn');
const openOptionsBtn = document.getElementById('btn-open-options') as HTMLButtonElement;

// Metric Elements
const valBlockedRequests = document.getElementById('val-blocked-requests') as HTMLElement;
const valSavedData = document.getElementById('val-saved-data') as HTMLElement;
const valDomReady = document.getElementById('val-dom-ready') as HTMLElement;
const valJsHeap = document.getElementById('val-js-heap') as HTMLElement;

// Module Checkboxes
const modScripts = document.getElementById('mod-scripts') as HTMLInputElement;
const modImages = document.getElementById('mod-images') as HTMLInputElement;
const modVideos = document.getElementById('mod-videos') as HTMLInputElement;
const modRendering = document.getElementById('mod-rendering') as HTMLInputElement;
const modCpu = document.getElementById('mod-cpu') as HTMLInputElement;
const modDom = document.getElementById('mod-dom') as HTMLInputElement;

async function initPopup(): Promise<void> {
  const api = browserApi.getApi();

  // Get active tab
  if (api.tabs?.query) {
    api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id && activeTab?.url) {
        currentTabId = activeTab.id;
        try {
          const urlObj = new URL(activeTab.url);
          currentHostname = urlObj.hostname;
          domainHostnameEl.textContent = currentHostname || 'Internal Browser Page';
        } catch {
          currentHostname = '';
          domainHostnameEl.textContent = 'Special Page';
        }

        await fetchState();
      }
    });
  }

  setupEventListeners();

  // Refresh live metrics periodically while popup is open
  setInterval(fetchState, 1200);
}

async function fetchState(): Promise<void> {
  if (!currentTabId) return;

  const response = await browserApi.sendMessage<
    { action: string; tabId: number },
    { success: boolean; state?: TabSessionState; config?: OptimizerConfiguration }
  >({
    action: 'GET_TAB_STATE',
    tabId: currentTabId
  });

  if (response?.config) {
    activeConfig = response.config;
    updateConfigUI();
  }

  if (response?.state?.stats) {
    updateMetricsUI(response.state);
  }
}

function updateConfigUI(): void {
  masterToggle.checked = activeConfig.masterEnabled;

  const isAllowlisted = activeConfig.safety.allowlist.includes(currentHostname);
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

  activeModeIndicator.textContent = activeConfig.mode.replace('_', ' ').toUpperCase();

  modeButtons.forEach((btn) => {
    const mode = btn.dataset.mode;
    if (mode === activeConfig.mode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  modScripts.checked = activeConfig.scripts.enabled;
  modImages.checked = activeConfig.images.enabled;
  modVideos.checked = activeConfig.videos.enabled;
  modRendering.checked = activeConfig.rendering.enabled;
  modCpu.checked = activeConfig.cpu.enabled;
  modDom.checked = activeConfig.dom.enabled;
}

function updateMetricsUI(state: TabSessionState): void {
  const stats = state.stats;
  valBlockedRequests.textContent = stats.blockedRequests.toString();

  const savedKB = Math.round(stats.estimatedSavedBytes / 1024);
  const savedMB = (stats.estimatedSavedBytes / (1024 * 1024)).toFixed(1);
  valSavedData.textContent = stats.estimatedSavedBytes > 1024 * 1024 ? `${savedMB} MB` : `${savedKB} KB`;

  valDomReady.textContent = stats.domContentLoadedMs > 0 ? `${stats.domContentLoadedMs} ms` : '-- ms';

  if (stats.jsHeapUsedMB !== null) {
    valJsHeap.textContent = `${stats.jsHeapUsedMB} MB`;
  } else {
    valJsHeap.textContent = 'N/A';
  }
}

function setupEventListeners(): void {
  masterToggle.addEventListener('change', () => {
    activeConfig.masterEnabled = masterToggle.checked;
    saveConfig();
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode as OptimizationMode;
      if (mode) {
        activeConfig.mode = mode;
        saveConfig();
      }
    });
  });

  allowlistBtn.addEventListener('click', () => {
    if (!currentHostname) return;
    const index = activeConfig.safety.allowlist.indexOf(currentHostname);
    if (index > -1) {
      activeConfig.safety.allowlist.splice(index, 1);
    } else {
      activeConfig.safety.allowlist.push(currentHostname);
    }
    saveConfig();
  });

  instantResetBtn.addEventListener('click', () => {
    if (currentTabId) {
      browserApi.sendMessage({ action: 'EMERGENCY_RESET', tabId: currentTabId });
      domainStatusBadge.textContent = 'RESET';
      domainStatusBadge.className = 'status-badge bypassed';
    }
  });

  const setupModuleToggle = (input: HTMLInputElement, updateFn: (enabled: boolean) => void) => {
    input.addEventListener('change', () => {
      updateFn(input.checked);
      saveConfig();
    });
  };

  setupModuleToggle(modScripts, (v) => (activeConfig.scripts.enabled = v));
  setupModuleToggle(modImages, (v) => (activeConfig.images.enabled = v));
  setupModuleToggle(modVideos, (v) => (activeConfig.videos.enabled = v));
  setupModuleToggle(modRendering, (v) => (activeConfig.rendering.enabled = v));
  setupModuleToggle(modCpu, (v) => (activeConfig.cpu.enabled = v));
  setupModuleToggle(modDom, (v) => (activeConfig.dom.enabled = v));

  openOptionsBtn.addEventListener('click', () => {
    const api = browserApi.getApi();
    if (api.runtime?.openOptionsPage) {
      api.runtime.openOptionsPage();
    }
  });
}

async function saveConfig(): Promise<void> {
  updateConfigUI();
  await browserApi.sendMessage({
    action: 'UPDATE_CONFIG',
    tabId: currentTabId,
    payload: activeConfig
  });
}

document.addEventListener('DOMContentLoaded', initPopup);

