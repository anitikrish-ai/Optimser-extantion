/**
 * Universal Website Performance Optimizer
 * DOM & Visibility Optimization Module
 * Conservative rendering optimization: applies content-visibility: auto to below-the-fold content sections.
 */

import { memoryOptimizer } from '../memory/memory-optimizer.js';
import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class DomOptimizer {
  constructor() {
    this.isEnabled = false;
    this.modifiedElements = new Set();
  }

  static getInstance() {
    if (!DomOptimizer.instance) {
      DomOptimizer.instance = new DomOptimizer();
    }
    return DomOptimizer.instance;
  }

  apply(settings) {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling DOM Optimization module...');

    if (settings.enableContentVisibilityAuto && typeof document !== 'undefined') {
      this.applyConservativeContentVisibility();
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  applyConservativeContentVisibility() {
    try {
      const candidateElements = document.querySelectorAll(
        'article, main > section:not(:first-child), footer, aside'
      );

      const viewportHeight = window.innerHeight || 800;

      candidateElements.forEach((el) => {
        if (memoryOptimizer.isProcessed(el)) return;

        // Ensure we never touch elements containing forms, inputs, headers, or navigation
        if (el.querySelector('form, input, select, textarea, nav, header, [role="navigation"]')) {
          return;
        }

        const rect = el.getBoundingClientRect();
        // Only apply to elements strictly below the initial viewport fold
        if (rect.top > viewportHeight) {
          el.style.contentVisibility = 'auto';
          el.style.containIntrinsicSize = '1px 500px';
          this.modifiedElements.add(el);
          memoryOptimizer.markProcessed(el);
        }
      });

      logger.debug(`Applied content-visibility to ${this.modifiedElements.size} below-fold sections.`);
    } catch (e) {
      logger.warn('content-visibility not supported in this browser engine:', e);
    }
  }

  teardown() {
    if (!this.isEnabled) return;

    this.modifiedElements.forEach((el) => {
      el.style.contentVisibility = '';
      el.style.containIntrinsicSize = '';
    });
    this.modifiedElements.clear();

    this.isEnabled = false;
    logger.info('DOM Optimization module disengaged.');
  }
}

export const domOptimizer = DomOptimizer.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.domOptimizer = domOptimizer;
  globalThis.UWPO.DomOptimizer = DomOptimizer;
}

