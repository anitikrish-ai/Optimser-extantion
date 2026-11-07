/**
 * Universal Website Performance Optimizer
 * Adaptive Controller
 * Monitors real-time page changes and hardware signals to adapt optimizer intensity.
 */

import { OptimizerConfiguration, DeviceCapabilities, PageWorkloadMetrics } from '../shared/types';
import { deviceDetector } from '../device-detection/device-detector';
import { workloadAnalyzer } from '../device-detection/workload-analyzer';
import { ProfileEvaluator, EvaluatedModulePlan } from './profile-evaluator';
import { logger } from '../shared/logger';

export class AdaptiveController {
  private static instance: AdaptiveController;
  private currentPlan: EvaluatedModulePlan | null = null;

  private constructor() {}

  public static getInstance(): AdaptiveController {
    if (!AdaptiveController.instance) {
      AdaptiveController.instance = new AdaptiveController();
    }
    return AdaptiveController.instance;
  }

  /**
   * Evaluates and returns the latest adaptive optimization plan
   */
  public async computeActivePlan(config: OptimizerConfiguration): Promise<{
    plan: EvaluatedModulePlan;
    device: DeviceCapabilities;
    workload: PageWorkloadMetrics;
  }> {
    const device = await deviceDetector.getCapabilities();
    const workload = workloadAnalyzer.analyzeCurrentWorkload();

    const plan = ProfileEvaluator.evaluatePlan(config, device, workload);
    this.currentPlan = plan;

    logger.debug(`Computed adaptive plan for mode: ${plan.mode}`, { device, workload });

    return { plan, device, workload };
  }

  public getCurrentPlan(): EvaluatedModulePlan | null {
    return this.currentPlan;
  }
}

export const adaptiveController = AdaptiveController.getInstance();

