/**
 * Universal Website Performance Optimizer
 * Popup Interactive Controller (Single Source of Truth)
 */

import { browserApi } from '../../src/browser-adapters/browser-api.js';
import { safetyManager } from '../../src/safety/safety-manager.js';
import { DEFAULT_CONFIG } from '../../src/shared/constants.js';

let currentTabId = null;
let currentHostname = '';
let activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// DOM Elements
const masterToggle = document.getElementById('master-toggle');
const domainHostnameEl = document.getElementById('domain-hostname');
const domainStatusBadge = document.getElementById('domain-status-badge');
const allowlistBtn = document.getElementById('btn-toggle-allowlist');
const allowlistBtnText = document.getElementById('allowlist-btn-text');
const instantResetBtn = document.getElementById('btn-instant-reset');
const activeModeIndicator = document.getElementById('active-mode-indicator');
const modeButtons = document.querySelectorAll('.mode-btn');
const openOptionsBtn = document.getElementById('btn-open-options');

// Metric Elements
const valBlockedRequests = document.getElementById('val-blocked-requests');
const valSavedData = document.getElementById('val-saved-data');
const valDomReady = document.getElementById('val-dom-ready');
const valJsHeap = document.getElementById('val-js-heap');

// Module Checkboxes
const modScripts = document.getElementById('mod-scripts');
const modImages = document.getElementById('mod-images');
const modVideos = document.getElementById('mod-videos');
const modRendering = document.getElementById('mod-rendering');
const modCpu = document.getElementById('mod-cpu');
const modDom = document.getElementById('mod-dom');

async function initPopup() {
  const api = browserApi.getApi();

  if (api.tabs?.query) {
    api.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id && activeTab?.url) {
        currentTabId = activeTab.id;
        try {
          const urlObj = new URL(activeTab.url);
          currentHostname = safetyManager.normalizeDomain(urlObj.hostname);
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
  setInterval(fetchState, 1200);
}

async function fetchState() {
  if (!currentTabId) return;

  const response = await browserApi.sendMessage({
    action: 'GET_TAB_STATE',
    tabId: currentTabId
  });

  if (response?.config) {
    activeConfig = response.config;
    updateConfigUI();
  }

  if (response?.state?.stats) {
    updateMetricsUI(response.state.stats);
  }
}

function updateConfigUI() {
  if (!activeConfig) return;

  masterToggle.checked = !!activeConfig.masterEnabled;

  const isAllowlisted = safetyManager.isDomainAllowlisted(
    currentHostname,
    activeConfig.safety?.allowlist || []
  );

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

  valDomReady.textContent = stats.domContentLoadedMs > 0 ? `${stats.domContentLoadedMs} ms` : 'Measuring...';

  if (stats.jsHeapUsedMB !== null && stats.jsHeapUsedMB !== undefined) {
    valJsHeap.textContent = `${stats.jsHeapUsedMB} MB`;
  } else {
    valJsHeap.textContent = 'Unavailable';
  }
}

async function saveConfig() {
  updateConfigUI();
  await browserApi.sendMessage({
    action: 'UPDATE_CONFIG',
    tabId: currentTabId,
    payload: activeConfig
  });
}

function setupEventListeners() {
  masterToggle.addEventListener('change', () => {
    activeConfig.masterEnabled = masterToggle.checked;
    saveConfig();
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      if (mode) {
        activeConfig.mode = mode;
        saveConfig();
      }
    });
  });

  allowlistBtn.addEventListener('click', () => {
    if (!currentHostname) return;
    if (!activeConfig.safety) activeConfig.safety = { allowlist: [] };
    const list = activeConfig.safety.allowlist;

    const isAllowlisted = safetyManager.isDomainAllowlisted(currentHostname, list);
    if (isAllowlisted) {
      // Remove normalized domain
      const normHost = safetyManager.normalizeDomain(currentHostname);
      activeConfig.safety.allowlist = list.filter(
        (d) => safetyManager.normalizeDomain(d) !== normHost
      );
    } else {
      activeConfig.safety.allowlist.push(safetyManager.normalizeDomain(currentHostname));
    }
    saveConfig();
  });

  instantResetBtn.addEventListener('click', async () => {
    if (currentTabId) {
      await browserApi.sendMessage({
        action: 'EMERGENCY_RESET',
        tabId: currentTabId
      });
      domainStatusBadge.textContent = 'RESET';
      domainStatusBadge.className = 'status-badge bypassed';
    }
  });

  const bindToggle = (input, moduleKey) => {
    input.addEventListener('change', () => {
      if (!activeConfig[moduleKey]) activeConfig[moduleKey] = {};
      activeConfig[moduleKey].enabled = input.checked;
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
    const api = browserApi.getApi();
    if (api.runtime?.openOptionsPage) {
      api.runtime.openOptionsPage();
    }
  });
}

document.addEventListener('DOMContentLoaded', initPopup);
