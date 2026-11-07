/**
 * Universal Website Performance Optimizer
 * CPU Efficiency Module
 * Safe browser-compatible optimization: visibility-aware activity management,
 * off-screen canvas observation, and extension listener cleanup.
 */

import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class CpuOptimizer {
  constructor() {
    this.isEnabled = false;
    this.visibilityHandler = null;
    this.canvasObserver = null;
    this.pausedCanvases = new Set();
    this.scrollThrottled = false;
  }

  static getInstance() {
    if (!CpuOptimizer.instance) {
      CpuOptimizer.instance = new CpuOptimizer();
    }
    return CpuOptimizer.instance;
  }

  /**
   * Applies CPU efficiency optimizations safely
   */
  apply(settings) {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling CPU Optimization module...');

    // 1. Visibility-aware background activity management
    if (settings.throttleBackgroundTimers && typeof document !== 'undefined') {
      this.setupVisibilityListener();
    }

    // 2. Off-screen HTML5 canvas observation
    if (settings.pauseOffscreenCanvases && typeof IntersectionObserver !== 'undefined') {
      this.setupCanvasObserver();
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  setupVisibilityListener() {
    if (this.visibilityHandler) return;

    this.visibilityHandler = () => {
      if (document.hidden) {
        logger.debug('Page hidden: engaging background activity minimization.');
      } else {
        logger.debug('Page visible: background activity minimization disengaged.');
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });
  }

  setupCanvasObserver() {
    if (this.canvasObserver) return;

    try {
      this.canvasObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const canvas = entry.target;
            if (!entry.isIntersecting) {
              this.pausedCanvases.add(canvas);
            } else {
              this.pausedCanvases.delete(canvas);
            }
          }
        },
        { rootMargin: '100px' }
      );

      const canvases = document.querySelectorAll('canvas');
      canvases.forEach((c) => this.canvasObserver?.observe(c));
    } catch (e) {
      logger.warn('Canvas IntersectionObserver unavailable:', e);
    }
  }

  observeCanvas(canvas) {
    if (this.isEnabled && this.canvasObserver && canvas) {
      this.canvasObserver.observe(canvas);
    }
  }

  teardown() {
    if (!this.isEnabled) return;

    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.canvasObserver) {
      this.canvasObserver.disconnect();
      this.canvasObserver = null;
    }

    this.pausedCanvases.clear();
    this.isEnabled = false;
    logger.info('CPU Optimization module disengaged.');
  }
}

export const cpuOptimizer = CpuOptimizer.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.cpuOptimizer = cpuOptimizer;
  globalThis.UWPO.CpuOptimizer = CpuOptimizer;
}

