/**
 * Universal Website Performance Optimizer
 * Tab & Browser Session Lifecycle Manager
 * Ensures zero persistent storage, clears tab states on close, and clears session on browser exit.
 */

import { TabSessionState, OptimizerConfiguration, LivePerformanceStats } from '../shared/types';
import { sessionStorage } from '../browser-adapters/storage-adapter';
import { browserApi } from '../browser-adapters/browser-api';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '../shared/constants';
import { logger } from '../shared/logger';

export class SessionManager {
  private static instance: SessionManager;
  private tabStates: Map<number, TabSessionState> = new Map();
  private activeConfig: OptimizerConfiguration = DEFAULT_CONFIG;

  private constructor() {
    this.initSessionHooks();
  }

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  private async initSessionHooks(): Promise<void> {
    const api = browserApi.getApi();

    // 1. Load active session configuration if exists in session storage
    this.activeConfig = await sessionStorage.get<OptimizerConfiguration>(
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

  /**
   * Retrieves or initializes tab state
   */
  public getTabState(tabId: number): TabSessionState | undefined {
    return this.tabStates.get(tabId);
  }

  /**
   * Updates or registers tab session state
   */
  public updateTabState(tabId: number, state: Partial<TabSessionState>): TabSessionState {
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
        fpsEstimate: 60,
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
      appliedOptimizations: [],
      lastUpdated: Date.now()
    };

    const updated: TabSessionState = {
      ...existing,
      ...state,
      lastUpdated: Date.now()
    };

    this.tabStates.set(tabId, updated);
    return updated;
  }

  /**
   * Gets the active session configuration
   */
  public getConfig(): OptimizerConfiguration {
    return this.activeConfig;
  }

  /**
   * Updates active session configuration
   */
  public async setConfig(config: OptimizerConfiguration): Promise<void> {
    this.activeConfig = config;
    await sessionStorage.set(STORAGE_KEYS.CONFIG, config);
  }

  /**
   * Completely purges all session tracking
   */
  public async purgeAllSessionData(): Promise<void> {
    this.tabStates.clear();
    await sessionStorage.clear();
    this.activeConfig = DEFAULT_CONFIG;
    logger.info('All extension session data purged.');
  }
}

export const sessionManager = SessionManager.getInstance();

