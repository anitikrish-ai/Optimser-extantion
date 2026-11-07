/**
 * Universal Website Performance Optimizer
 * Optimizer Core Orchestrator
 * Central orchestrator connecting device detection, adaptive engine, safety guards, and all 8 optimization modules.
 */

import { DEFAULT_CONFIG } from '../shared/constants.js';
import { safetyManager } from '../safety/safety-manager.js';
import { emergencySwitch } from '../safety/emergency-switch.js';
import { adaptiveController } from '../adaptive-engine/adaptive-controller.js';
import { cpuOptimizer } from '../modules/cpu/cpu-optimizer.js';
import { memoryOptimizer } from '../modules/memory/memory-optimizer.js';
import { scriptBlocker } from '../modules/scripts/script-blocker.js';
import { imageOptimizer } from '../modules/images/image-optimizer.js';
import { videoOptimizer } from '../modules/videos/video-optimizer.js';
import { renderingOptimizer } from '../modules/rendering/rendering-optimizer.js';
import { networkOptimizer } from '../modules/network/network-optimizer.js';
import { domOptimizer } from '../modules/dom/dom-optimizer.js';
import { metricsCollector } from '../performance-monitor/metrics-collector.js';
import { workloadAnalyzer } from '../device-detection/workload-analyzer.js';
import { browserApi } from '../browser-adapters/browser-api.js';
import { logger } from '../shared/logger.js';

export class OptimizerCore {
  constructor() {
    this.isInitialized = false;
    this.activeConfig = { ...DEFAULT_CONFIG };
    this.isOptimizing = false;
    this.appliedModules = [];
    this.metricsIntervalId = null;
  }

  static getInstance() {
    if (!OptimizerCore.instance) {
      OptimizerCore.instance = new OptimizerCore();
    }
    return OptimizerCore.instance;
  }

  /**
   * Initializes and executes the full optimization sequence for the active page
   */
  async init(config = DEFAULT_CONFIG) {
    if (this.isInitialized) return;
    this.isInitialized = true;
    this.activeConfig = config;

    const hostname = typeof location !== 'undefined' ? location.hostname : '';
    const href = typeof location !== 'undefined' ? location.href : '';

    logger.info(`Initializing Universal Optimizer Core on ${hostname}...`);

    // 1. Safety Check: Verify if domain or flow is exempt
    if (!this.activeConfig.masterEnabled) {
      logger.info('Optimizer master switch is OFF. Suppressing all optimizations.');
      this.startMetricsReporting(false);
      return;
    }

    const isSafe = safetyManager.isSafeToOptimize(
      hostname,
      href,
      this.activeConfig.safety?.allowlist || []
    );

    if (!isSafe) {
      logger.info('Safety verification triggered (allowlist, essential flow, or sensitive input). Running in bypass mode.');
      this.startMetricsReporting(false);
      return;
    }

    // 2. Compute dynamic plan based on device and page complexity
    const { plan } = await adaptiveController.computeActivePlan(this.activeConfig);

    // 3. Apply active optimization modules
    this.appliedModules = [];

    // Script Blocker (early defense)
    if (this.activeConfig.scripts?.enabled) {
      scriptBlocker.apply(this.activeConfig.scripts);
      this.appliedModules.push('scripts');
    }

    // Network Optimizer
    if (this.activeConfig.network?.enabled) {
      networkOptimizer.apply(this.activeConfig.network);
      this.appliedModules.push('network');
    }

    // Rendering / CSS Optimizer
    if (this.activeConfig.rendering?.enabled) {
      renderingOptimizer.apply({
        ...this.activeConfig.rendering,
        disableExpensiveFilters: plan.shouldDisableExpensiveFilters,
        disableBackdropBlur: plan.shouldDisableBackdropBlur,
        disableHeavyBoxShadows: plan.shouldDisableHeavyBoxShadows
      });
      this.appliedModules.push('rendering');
    }

    // CPU Optimizer
    if (this.activeConfig.cpu?.enabled) {
      cpuOptimizer.apply(this.activeConfig.cpu);
      this.appliedModules.push('cpu');
    }

    // Memory Optimizer
    if (this.activeConfig.memory?.enabled) {
      memoryOptimizer.apply(this.activeConfig.memory);
      this.appliedModules.push('memory');
    }

    // Wait for DOM ready or execute immediately if already loaded
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.applyDomAndMediaModules(), { once: true });
      } else {
        this.applyDomAndMediaModules();
      }
    }

    this.isOptimizing = true;
    this.startMetricsReporting(true);
    logger.info(`Optimizer Core active. [${this.appliedModules.length}] modules engaged.`);
  }

  applyDomAndMediaModules() {
    if (emergencySwitch.isEmergencyDisarmed() || !this.isOptimizing) return;

    // Image Optimizer
    if (this.activeConfig.images?.enabled) {
      imageOptimizer.apply(this.activeConfig.images);
      if (!this.appliedModules.includes('images')) this.appliedModules.push('images');
    }

    // Video Optimizer
    if (this.activeConfig.videos?.enabled) {
      videoOptimizer.apply(this.activeConfig.videos);
      if (!this.appliedModules.includes('videos')) this.appliedModules.push('videos');
    }

    // DOM Optimizer
    if (this.activeConfig.dom?.enabled) {
      domOptimizer.apply(this.activeConfig.dom);
      if (!this.appliedModules.includes('dom')) this.appliedModules.push('dom');
    }
  }

  startMetricsReporting(isOptimized) {
    if (this.metricsIntervalId !== null) return;

    const report = () => {
      const stats = metricsCollector.collectCurrentStats(
        this.activeConfig.mode,
        isOptimized,
        this.appliedModules.length
      );

      const workload = workloadAnalyzer.analyzeCurrentWorkload();

      browserApi.sendMessage({
        action: 'REPORT_PAGE_METRICS',
        payload: {
          stats,
          workload,
          appliedModules: this.appliedModules,
          url: typeof location !== 'undefined' ? location.href : '',
          hostname: typeof location !== 'undefined' ? location.hostname : ''
        }
      });
    };

    // Immediate initial report
    report();

    // Sample every 2 seconds
    this.metricsIntervalId = window.setInterval(report, 2000);
  }

  updateConfig(newConfig) {
    this.activeConfig = newConfig;
    if (!newConfig.masterEnabled) {
      this.teardown();
      this.startMetricsReporting(false);
    } else {
      this.reapply();
    }
  }

  emergencyReset() {
    logger.warn('Triggering Core Emergency Reset...');
    this.isOptimizing = false;
    this.appliedModules = [];
    emergencySwitch.triggerEmergencyReset();
    if (this.metricsIntervalId !== null) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }
    this.startMetricsReporting(false);
  }

  reapply() {
    emergencySwitch.resetDisarmState();
    this.isInitialized = false;
    this.init(this.activeConfig);
  }

  teardown() {
    this.isOptimizing = false;
    this.appliedModules = [];
    cpuOptimizer.teardown();
    memoryOptimizer.teardown();
    scriptBlocker.teardown();
    imageOptimizer.teardown();
    videoOptimizer.teardown();
    renderingOptimizer.teardown();
    networkOptimizer.teardown();
    domOptimizer.teardown();
    if (this.metricsIntervalId !== null) {
      clearInterval(this.metricsIntervalId);
      this.metricsIntervalId = null;
    }
    this.isInitialized = false;
  }
}

export const optimizerCore = OptimizerCore.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.optimizerCore = optimizerCore;
  globalThis.UWPO.OptimizerCore = OptimizerCore;
}

