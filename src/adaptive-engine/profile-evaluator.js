/**
 * Universal Website Performance Optimizer
 * Profile Evaluator
 * Translates optimization modes and real-time conditions into actionable module configs.
 */

export class ProfileEvaluator {
  /**
   * Generates a concrete module execution plan based on mode, device capabilities, and page workload
   */
  static evaluatePlan(userConfig, device, workload) {
    let effectiveMode = userConfig.mode || 'balanced';

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

    // Default Balanced profile (Conservative: preserve usability and layout styling)
    const plan = {
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
      shouldDisableExpensiveFilters: false, // Never in Balanced
      shouldDisableBackdropBlur: false,     // Never in Balanced
      shouldDisableHeavyBoxShadows: false, // Never in Balanced
      shouldEnableContentVisibility: userConfig.dom.enabled && userConfig.dom.enableContentVisibilityAuto,
      shouldBlockHeavyTrackers: userConfig.scripts.enabled && userConfig.scripts.blockHeavyTrackers
    };

    if (effectiveMode === 'performance') {
      plan.backgroundTimerDelayMs = 2000;
      plan.shouldDisableHeavyBoxShadows = userConfig.rendering.enabled && userConfig.rendering.disableHeavyBoxShadows;
      plan.shouldDisableExpensiveFilters = userConfig.rendering.enabled && userConfig.rendering.disableExpensiveFilters;
    } else if (effectiveMode === 'extreme') {
      plan.backgroundTimerDelayMs = 5000;
      plan.shouldDisableHeavyBoxShadows = userConfig.rendering.enabled;
      plan.shouldDisableBackdropBlur = userConfig.rendering.enabled;
      plan.shouldDisableExpensiveFilters = userConfig.rendering.enabled;
      plan.shouldReduceCssAnimations = userConfig.rendering.enabled;
    }

    return plan;
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.ProfileEvaluator = ProfileEvaluator;
}

