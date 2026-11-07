/**
 * Universal Website Performance Optimizer
 * Adaptive Controller
 * Monitors real-time page changes and hardware signals to adapt optimizer intensity.
 */

import { deviceDetector } from '../device-detection/device-detector.js';
import { workloadAnalyzer } from '../device-detection/workload-analyzer.js';
import { ProfileEvaluator } from './profile-evaluator.js';
import { logger } from '../shared/logger.js';

export class AdaptiveController {
  constructor() {
    this.currentPlan = null;
  }

  static getInstance() {
    if (!AdaptiveController.instance) {
      AdaptiveController.instance = new AdaptiveController();
    }
    return AdaptiveController.instance;
  }

  /**
   * Evaluates and returns the latest adaptive optimization plan
   */
  async computeActivePlan(config) {
    const device = await deviceDetector.getCapabilities();
    const workload = workloadAnalyzer.analyzeCurrentWorkload();

    const plan = ProfileEvaluator.evaluatePlan(config, device, workload);
    this.currentPlan = plan;

    logger.debug(`Computed adaptive plan for mode: ${plan.mode}`, { device, workload });
    return { plan, device, workload };
  }

  getCurrentPlan() {
    return this.currentPlan;
  }
}

export const adaptiveController = AdaptiveController.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.adaptiveController = adaptiveController;
  globalThis.UWPO.AdaptiveController = AdaptiveController;
}

