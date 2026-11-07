/**
 * Universal Website Performance Optimizer
 * Optimizer Core Orchestrator
 * Central orchestrator connecting device detection, adaptive engine, safety guards, and all 8 optimization modules.
 */

import {
  OptimizerConfiguration,
  OptimizationMode,
  TabSessionState,
  LivePerformanceStats
} from '../shared/types';
import { DEFAULT_CONFIG } from '../shared/constants';
import { safetyManager } from '../safety/safety-manager';
import { emergencySwitch } from '../safety/emergency-switch';
import { deviceDetector } from '../device-detection/device-detector';
import { workloadAnalyzer } from '../device-detection/workload-analyzer';
import { adaptiveController } from '../adaptive-engine/adaptive-controller';
import { cpuOptimizer } from '../modules/cpu/cpu-optimizer';
import { memoryOptimizer } from '../modules/memory/memory-optimizer';
import { scriptBlocker } from '../modules/scripts/script-blocker';
import { imageOptimizer } from '../modules/images/image-optimizer';
import { videoOptimizer } from '../modules/videos/video-optimizer';
import { renderingOptimizer } from '../modules/rendering/rendering-optimizer';
import { networkOptimizer } from '../modules/network/network-optimizer';
import { domOptimizer } from '../modules/dom/dom-optimizer';
import { metricsCollector } from '../performance-monitor/metrics-collector';
import { browserApi } from '../browser-adapters/browser-api';
import { logger } from '../shared/logger';

export class OptimizerCore {
  private static instance: OptimizerCore;
  private isInitialized = false;
  private activeConfig: OptimizerConfiguration = DEFAULT_CONFIG;
  private isOptimizing = false;
  private appliedModules: string[] = [];
  private metricsIntervalId: number | null = null;

  private constructor() {}

  public static getInstance(): OptimizerCore {
    if (!OptimizerCore.instance) {
      OptimizerCore.instance = new OptimizerCore();
    }
    return OptimizerCore.instance;
  }

  /**
   * Initializes and executes the full optimization sequence for the active page
   */
  public async init(config: OptimizerConfiguration = DEFAULT_CONFIG): Promise<void> {
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
      this.activeConfig.safety.allowlist
    );

    if (!isSafe) {
      logger.info('Safety verification failed or domain allowlisted. Running in bypass mode.');
      this.startMetricsReporting(false);
      return;
    }

    // 2. Compute dynamic plan based on device and page complexity
    const { plan, device, workload } = await adaptiveController.computeActivePlan(this.activeConfig);

    // 3. Apply active optimization modules
    this.appliedModules = [];

    // Script Blocker (early defense)
    if (this.activeConfig.scripts.enabled) {
      scriptBlocker.apply(this.activeConfig.scripts);
      this.appliedModules.push('scripts');
    }

    // Network Optimizer
    if (this.activeConfig.network.enabled) {
      networkOptimizer.apply(this.activeConfig.network);
      this.appliedModules.push('network');
    }

    // Rendering / CSS Optimizer
    if (this.activeConfig.rendering.enabled) {
      renderingOptimizer.apply(this.activeConfig.rendering);
      this.appliedModules.push('rendering');
    }

    // CPU Optimizer
    if (this.activeConfig.cpu.enabled) {
      cpuOptimizer.apply(this.activeConfig.cpu);
      this.appliedModules.push('cpu');
    }

    // Memory Optimizer
    if (this.activeConfig.memory.enabled) {
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

  private applyDomAndMediaModules(): void {
    if (emergencySwitch.isEmergencyDisarmed() || !this.isOptimizing) return;

    // Image Optimizer
    if (this.activeConfig.images.enabled) {
      imageOptimizer.apply(this.activeConfig.images);
      if (!this.appliedModules.includes('images')) this.appliedModules.push('images');
    }

    // Video Optimizer
    if (this.activeConfig.videos.enabled) {
      videoOptimizer.apply(this.activeConfig.videos);
      if (!this.appliedModules.includes('videos')) this.appliedModules.push('videos');
    }

    // DOM Optimizer
    if (this.activeConfig.dom.enabled) {
      domOptimizer.apply(this.activeConfig.dom);
      if (!this.appliedModules.includes('dom')) this.appliedModules.push('dom');
    }
  }

  /**
   * Periodically gathers real metrics and dispatches updates to background/popup
   */
  private startMetricsReporting(isOptimized: boolean): void {
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

  /**
   * Updates configuration dynamically
   */
  public updateConfig(newConfig: OptimizerConfiguration): void {
    this.activeConfig = newConfig;
    if (!newConfig.masterEnabled) {
      this.teardown();
    } else {
      this.reapply();
    }
  }

  /**
   * Instant Emergency Reset
   */
  public emergencyReset(): void {
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

  public reapply(): void {
    emergencySwitch.resetDisarmState();
    this.isInitialized = false;
    this.init(this.activeConfig);
  }

  public teardown(): void {
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

