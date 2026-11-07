/**
 * Universal Website Performance Optimizer
 * Profile Evaluator
 * Translates optimization modes and real-time conditions into actionable module configs.
 */

import {
  OptimizationMode,
  OptimizerConfiguration,
  DeviceCapabilities,
  PageWorkloadMetrics
} from '../shared/types';
import { DEFAULT_CONFIG } from '../shared/constants';

export interface EvaluatedModulePlan {
  mode: OptimizationMode;
  shouldThrottleBackgroundTimers: boolean;
  backgroundTimerDelayMs: number;
  shouldThrottleScrollEvents: boolean;
  shouldPauseOffscreenCanvases: boolean;
  shouldEnforceLazyLoading: boolean;
  shouldEnforceAsyncDecoding: boolean;
  shouldPauseOffscreenMedia: boolean;
  shouldBlockAutoplay: boolean;
  shouldReduceCssAnimations: boolean;
  shouldDisableExpensiveFilters: boolean;
  shouldDisableBackdropBlur: boolean;
  shouldDisableHeavyBoxShadows: boolean;
  shouldEnableContentVisibility: boolean;
  shouldBlockHeavyTrackers: boolean;
}

export class ProfileEvaluator {
  /**
   * Generates a concrete module execution plan based on mode, device capabilities, and page workload
   */
  public static evaluatePlan(
    userConfig: OptimizerConfiguration,
    device: DeviceCapabilities,
    workload: PageWorkloadMetrics
  ): EvaluatedModulePlan {
    let effectiveMode = userConfig.mode;

    // Automatic mode decision if Adaptive Custom or autoAdaptive is active
    if (userConfig.autoAdaptive || userConfig.mode === 'adaptive_custom') {
      if (device.isLowEndDevice || workload.domNodeCount > 3000 || workload.longTasksCount > 8) {
        effectiveMode = 'extreme';
      } else if (device.networkType === '3g' || workload.domNodeCount > 1500) {
        effectiveMode = 'performance';
      } else {
        effectiveMode = 'balanced';
      }
    }

    // Default Balanced profile
    const plan: EvaluatedModulePlan = {
      mode: effectiveMode,
      shouldThrottleBackgroundTimers: userConfig.cpu.enabled && userConfig.cpu.throttleBackgroundTimers,
      backgroundTimerDelayMs: 1000,
      shouldThrottleScrollEvents: userConfig.cpu.enabled && userConfig.cpu.throttleScrollEvents,
      shouldPauseOffscreenCanvases: userConfig.cpu.enabled && userConfig.cpu.pauseOffscreenCanvases,
      shouldEnforceLazyLoading: userConfig.images.enabled && userConfig.images.enforceLazyLoading,
      shouldEnforceAsyncDecoding: userConfig.images.enabled && userConfig.images.enforceAsyncDecoding,
      shouldPauseOffscreenMedia: userConfig.videos.enabled && userConfig.videos.pauseOffscreenVideos,
      shouldBlockAutoplay: userConfig.videos.enabled && userConfig.videos.blockAutoplay,
      shouldReduceCssAnimations: userConfig.rendering.enabled && userConfig.rendering.reduceCssAnimations,
      shouldDisableExpensiveFilters: userConfig.rendering.enabled && userConfig.rendering.disableExpensiveFilters,
      shouldDisableBackdropBlur: userConfig.rendering.enabled && userConfig.rendering.disableBackdropBlur,
      shouldDisableHeavyBoxShadows: false,
      shouldEnableContentVisibility: userConfig.dom.enabled && userConfig.dom.enableContentVisibilityAuto,
      shouldBlockHeavyTrackers: userConfig.scripts.enabled && userConfig.scripts.blockHeavyTrackers
    };

    if (effectiveMode === 'performance') {
      plan.backgroundTimerDelayMs = 2000;
      plan.shouldDisableHeavyBoxShadows = userConfig.rendering.enabled;
    } else if (effectiveMode === 'extreme') {
      plan.backgroundTimerDelayMs = 5000;
      plan.shouldDisableHeavyBoxShadows = true;
      plan.shouldDisableBackdropBlur = true;
      plan.shouldDisableExpensiveFilters = true;
      plan.shouldReduceCssAnimations = true;
    }

    return plan;
  }
}

