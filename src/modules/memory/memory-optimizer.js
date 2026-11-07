/**
 * Universal Website Performance Optimizer
 * Memory Optimization & Cleanup Module
 * Ensures zero extension-introduced memory retention, manages WeakRefs,
 * clears resource timing buffers, and cleans up references on page unload.
 */

import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class MemoryOptimizer {
  constructor() {
    this.isEnabled = false;
    this.cleanupIntervalId = null;
    this.unloadListener = null;
    this.trackedObservers = new Set();
    this.elementWeakSet = new WeakSet();
  }

  static getInstance() {
    if (!MemoryOptimizer.instance) {
      MemoryOptimizer.instance = new MemoryOptimizer();
    }
    return MemoryOptimizer.instance;
  }

  apply(settings) {
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

  registerObserver(observer) {
    if (observer && typeof observer.disconnect === 'function') {
      this.trackedObservers.add(observer);
    }
  }

  markProcessed(element) {
    if (element && typeof element === 'object') {
      this.elementWeakSet.add(element);
    }
  }

  isProcessed(element) {
    if (!element || typeof element !== 'object') return false;
    return this.elementWeakSet.has(element);
  }

  setupUnloadTeardown() {
    if (this.unloadListener) return;

    this.unloadListener = () => {
      logger.info('Page unloading. Triggering comprehensive memory cleanup...');
      this.teardown();
    };

    window.addEventListener('pagehide', this.unloadListener, { capture: true, once: true });
    window.addEventListener('beforeunload', this.unloadListener, { capture: true, once: true });
  }

  setupPeriodicCleanup(intervalSec) {
    if (this.cleanupIntervalId !== null) return;

    this.cleanupIntervalId = window.setInterval(() => {
      // Clear Performance Resource Timing buffer to prevent unbounded memory growth on long-lived SPAs
      if (typeof performance !== 'undefined' && typeof performance.clearResourceTimings === 'function') {
        performance.clearResourceTimings();
      }
      logger.debug('Periodic memory buffer cleanup executed.');
    }, intervalSec * 1000);
  }

  teardown() {
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

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.memoryOptimizer = memoryOptimizer;
  globalThis.UWPO.MemoryOptimizer = MemoryOptimizer;
}

