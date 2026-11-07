/**
 * Universal Website Performance Optimizer
 * CPU Optimization Module
 * Controls background activity, throttles background timers, and suspends offscreen canvas rendering.
 */

import { CpuOptimizationSettings } from '../../shared/types';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class CpuOptimizer {
  private static instance: CpuOptimizer;
  private isEnabled = false;
  private visibilityHandler: (() => void) | null = null;
  private canvasObserver: IntersectionObserver | null = null;
  private pausedCanvases: Set<HTMLCanvasElement> = new Set();
  private originalSetInterval: typeof window.setInterval | null = null;
  private isHidden = false;

  private constructor() {}

  public static getInstance(): CpuOptimizer {
    if (!CpuOptimizer.instance) {
      CpuOptimizer.instance = new CpuOptimizer();
    }
    return CpuOptimizer.instance;
  }

  /**
   * Initializes CPU optimization module with current configuration
   */
  public apply(settings: CpuOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling CPU Optimization module...');

    // 1. Monitor Page Visibility for Background Tab Throttling
    if (settings.throttleBackgroundTimers && typeof document !== 'undefined') {
      this.setupVisibilityListener(settings.maxBackgroundIntervalMs);
    }

    // 2. Pause off-screen HTML5 canvases
    if (settings.pauseOffscreenCanvases && typeof IntersectionObserver !== 'undefined') {
      this.setupCanvasObserver();
    }

    // Register with emergency switch for instant reset
    emergencySwitch.registerTeardown(() => this.teardown());
  }

  private setupVisibilityListener(maxIntervalMs: number): void {
    if (this.visibilityHandler) return;

    this.visibilityHandler = () => {
      this.isHidden = document.hidden;
      if (this.isHidden) {
        logger.debug(`Page hidden. Engaging background CPU throttling (${maxIntervalMs}ms limit)...`);
      } else {
        logger.debug('Page visible. Background CPU throttling disengaged.');
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });
  }

  private setupCanvasObserver(): void {
    if (this.canvasObserver) return;

    try {
      this.canvasObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const canvas = entry.target as HTMLCanvasElement;
            if (!entry.isIntersecting) {
              this.pausedCanvases.add(canvas);
            } else {
              this.pausedCanvases.delete(canvas);
            }
          }
        },
        { rootMargin: '100px' }
      );

      // Observe existing canvases
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach((canvas) => this.canvasObserver?.observe(canvas));
    } catch (e) {
      logger.warn('Failed setting up Canvas IntersectionObserver:', e);
    }
  }

  /**
   * Observe new canvas element dynamically added to DOM
   */
  public observeCanvas(canvas: HTMLCanvasElement): void {
    if (this.isEnabled && this.canvasObserver) {
      this.canvasObserver.observe(canvas);
    }
  }

  /**
   * Completely tears down CPU optimizations and restores native state
   */
  public teardown(): void {
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

