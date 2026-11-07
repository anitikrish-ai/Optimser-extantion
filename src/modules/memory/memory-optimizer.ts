/**
 * Universal Website Performance Optimizer
 * Memory Optimization & Cleanup Module
 * Ensures zero extension-introduced memory leaks, manages WeakRefs, and cleans up on unload.
 */

import { MemoryOptimizationSettings } from '../../shared/types';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class MemoryOptimizer {
  private static instance: MemoryOptimizer;
  private isEnabled = false;
  private cleanupIntervalId: number | null = null;
  private unloadListener: (() => void) | null = null;
  private trackedObservers: Set<IntersectionObserver | MutationObserver | PerformanceObserver> = new Set();
  private elementWeakSet: WeakSet<Element> = new WeakSet();

  private constructor() {}

  public static getInstance(): MemoryOptimizer {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  /**
   * Applies memory optimization and lifecycle management
   */
  public apply(settings: MemoryOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Memory Optimization module...');

    // 1. Hook into unload & pagehide for reliable teardown
    if (settings.teardownOnUnload && typeof window !== 'undefined') {
      this.setupUnloadTeardown();
    }

    // 2. Setup periodic internal cache cleanup
    if (settings.periodicCleanupIntervalSec > 0 && typeof window !== 'undefined') {
      this.setupPeriodicCleanup(settings.periodicCleanupIntervalSec);
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  /**
   * Registers an observer for centralized lifecycle tracking
   */
  public registerObserver(observer: IntersectionObserver | MutationObserver | PerformanceObserver): void {
    this.trackedObservers.add(observer);
  }

  /**
   * Marks an element as processed using WeakSet to avoid strong reference retention
   */
  public markProcessed(element: Element): void {
    this.elementWeakSet.add(element);
  }

  public isProcessed(element: Element): boolean {
    return this.elementWeakSet.has(element);
  }

  private setupUnloadTeardown(): void {
    if (this.unloadListener) return;

    this.unloadListener = () => {
      logger.info('Page unloading. Triggering comprehensive memory cleanup...');
      this.teardown();
    };

    window.addEventListener('pagehide', this.unloadListener, { capture: true, once: true });
    window.addEventListener('beforeunload', this.unloadListener, { capture: true, once: true });
  }

  private setupPeriodicCleanup(intervalSec: number): void {
    if (this.cleanupIntervalId !== null) return;

    this.cleanupIntervalId = window.setInterval(() => {
      // Clear Performance Resource Timing buffer to prevent infinite memory growth on SPAs
      if (typeof performance !== 'undefined' && typeof performance.clearResourceTimings === 'function') {
        performance.clearResourceTimings();
      }
      logger.debug('Periodic memory buffer cleanup executed.');
    }, intervalSec * 1000);
  }

  /**
   * Cleans all references and disconnects observers
   */
  public teardown(): void {
    if (!this.isEnabled) return;

    if (this.cleanupIntervalId !== null) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    for (const observer of this.trackedObservers) {
      try {
        observer.disconnect();
      } catch (err) {
        logger.debug('Error disconnecting tracked observer:', err);
      }
    }
    this.trackedObservers.clear();

    if (this.unloadListener && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.unloadListener);
      window.removeEventListener('beforeunload', this.unloadListener);
      this.unloadListener = null;
    }

    this.isEnabled = false;
    logger.info('Memory Optimization module disengaged.');
  }
}

export const memoryOptimizer = MemoryOptimizer.getInstance();

