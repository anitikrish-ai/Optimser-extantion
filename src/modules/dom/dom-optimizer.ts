/**
 * Universal Website Performance Optimizer
 * DOM & Visibility Optimization Module
 * Applies conservative content-visibility: auto to below-the-fold sections and batches mutations.
 */

import { DomOptimizationSettings } from '../../shared/types';
import { memoryOptimizer } from '../memory/memory-optimizer';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class DomOptimizer {
  private static instance: DomOptimizer;
  private isEnabled = false;
  private modifiedElements: Set<HTMLElement> = new Set();
  private mutationBatchQueue: MutationRecord[] = [];
  private rafBatchId: number | null = null;

  private constructor() {}

  public static getInstance(): DomOptimizer {
    if (!DomOptimizer.instance) {
      DomOptimizer.instance = new DomOptimizer();
    }
    return DomOptimizer.instance;
  }

  /**
   * Applies conservative DOM visibility optimizations
   */
  public apply(settings: DomOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling DOM Optimization module...');

    // 1. Apply content-visibility: auto on heavy offscreen structural containers
    if (settings.enableContentVisibilityAuto && typeof document !== 'undefined') {
      this.applyConservativeContentVisibility();
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  private applyConservativeContentVisibility(): void {
    try {
      // Target non-interactive, heavy containers: below-the-fold articles, sections, footers
      const candidateElements = document.querySelectorAll<HTMLElement>(
        'article, main > section:not(:first-child), footer, aside'
      );

      const viewportHeight = window.innerHeight || 800;

      candidateElements.forEach((el) => {
        if (memoryOptimizer.isProcessed(el)) return;

        // Ensure we never touch elements containing forms, inputs, headers or nav
        if (el.querySelector('form, input, select, textarea, nav, header')) {
          return;
        }

        const rect = el.getBoundingClientRect();
        // Only apply to elements strictly below the first fold
        if (rect.top > viewportHeight) {
          el.style.contentVisibility = 'auto';
          el.style.containIntrinsicSize = '1px 500px';
          this.modifiedElements.add(el);
          memoryOptimizer.markProcessed(el);
        }
      });

      logger.debug(`Applied content-visibility to ${this.modifiedElements.size} below-fold sections.`);
    } catch (e) {
      logger.warn('Failed applying content-visibility optimizations:', e);
    }
  }

  /**
   * Batches mutation records via requestAnimationFrame to prevent layout thrash
   */
  public queueMutationBatch(mutations: MutationRecord[], callback: (batch: MutationRecord[]) => void): void {
    this.mutationBatchQueue.push(...mutations);

    if (this.rafBatchId !== null) return;

    this.rafBatchId = requestAnimationFrame(() => {
      const batch = [...this.mutationBatchQueue];
      this.mutationBatchQueue = [];
      this.rafBatchId = null;
      callback(batch);
    });
  }

  /**
   * Teardown and restore native DOM styles
   */
  public teardown(): void {
    if (!this.isEnabled) return;

    if (this.rafBatchId !== null) {
      cancelAnimationFrame(this.rafBatchId);
      this.rafBatchId = null;
    }
    this.mutationBatchQueue = [];

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

