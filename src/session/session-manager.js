/**
 * Universal Website Performance Optimizer
 * Tab & Browser Session Lifecycle Manager
 * Ensures zero persistent storage, clears tab states on close, and clears session on browser exit.
 */

import { sessionStorage } from '../browser-adapters/storage-adapter.js';
import { browserApi } from '../browser-adapters/browser-api.js';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

export class SessionManager {
  constructor() {
    this.tabStates = new Map();
    this.activeConfig = { ...DEFAULT_CONFIG };
    this.initSessionHooks();
  }

  static getInstance() {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  async initSessionHooks() {
    const api = browserApi.getApi();

    // 1. Load active session configuration if exists in session storage
    this.activeConfig = await sessionStorage.get(
      STORAGE_KEYS.CONFIG,
      DEFAULT_CONFIG
    );

    // 2. Automatically clear tab-specific state when a tab is closed
    if (api.tabs?.onRemoved) {
      api.tabs.onRemoved.addListener((tabId) => {
        if (this.tabStates.has(tabId)) {
          this.tabStates.delete(tabId);
          logger.debug(`Cleared session state for closed tab: ${tabId}`);
        }
      });
    }

    // 3. Clear remaining state when browser window or session closes
    if (api.runtime?.onSuspend) {
      api.runtime.onSuspend.addListener(() => {
        logger.info('Browser session suspending. Purging all temporary session state...');
        this.tabStates.clear();
      });
    }
  }

  getTabState(tabId) {
    return this.tabStates.get(tabId);
  }

  updateTabState(tabId, state) {
    const existing = this.tabStates.get(tabId) || {
      tabId,
      url: '',
      hostname: '',
      isAllowlisted: false,
      isProtectedAuthSite: false,
      activeMode: this.activeConfig.mode,
      stats: {
        navigationStart: 0,
        domContentLoadedMs: 0,
        loadEventMs: 0,
        jsHeapUsedMB: null,
        jsHeapTotalMB: null,
        jsHeapLimitMB: null,
        totalRequests: 0,
        blockedRequests: 0,
        transferredBytes: 0,
        estimatedSavedBytes: 0,
        longTasksCount: 0,
        activeModulesCount: 0,
        isOptimized: false,
        mode: this.activeConfig.mode
      },
      workload: {
        domNodeCount: 0,
        scriptCount: 0,
        stylesheetCount: 0,
        imageCount: 0,
        videoCount: 0,
        iframeCount: 0,
        longTasksCount: 0,
        totalLongTaskDurationMs: 0
      },
      device: {
        hardwareConcurrency: 4,
        deviceMemoryGB: null,
        isLowEndDevice: false,
        isMobile: false,
        networkType: 'unknown',
        saveDataEnabled: false,
        batteryLevel: null,
        isBatteryCharging: null
      },
      appliedModules: [],
      lastUpdated: Date.now()
    };

    const updated = {
      ...existing,
      ...state,
      lastUpdated: Date.now()
    };

    this.tabStates.set(tabId, updated);
    return updated;
  }

  getConfig() {
    return this.activeConfig;
  }

  async setConfig(config) {
    this.activeConfig = config;
    await sessionStorage.set(STORAGE_KEYS.CONFIG, config);
  }

  async purgeAllSessionData() {
    this.tabStates.clear();
    await sessionStorage.clear();
    this.activeConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    logger.info('All extension session data purged.');
  }
}

export const sessionManager = SessionManager.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.sessionManager = sessionManager;
  globalThis.UWPO.SessionManager = SessionManager;
}

