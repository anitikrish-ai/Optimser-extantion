/**
 * Universal Website Performance Optimizer
 * CSS & Rendering Optimization Module
 * Eliminates GPU compositor thrash, expensive filters, blur, and unnecessary continuous animations.
 */

import { RenderingOptimizationSettings } from '../../shared/types';
import { INJECTION_STYLE_ID } from '../../shared/constants';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class RenderingOptimizer {
  private static instance: RenderingOptimizer;
  private isEnabled = false;

  private constructor() {}

  public static getInstance(): RenderingOptimizer {
    if (!RenderingOptimizer.instance) {
      RenderingOptimizer.instance = new RenderingOptimizer();
    }
    return RenderingOptimizer.instance;
  }

  /**
   * Applies CSS rendering optimizations by injecting a carefully crafted stylesheet
   */
  public apply(settings: RenderingOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Rendering Optimization module...');

    if (typeof document === 'undefined') return;

    const cssRules: string[] = [];

    // 1. Reduce non-essential animations & infinite loops
    if (settings.reduceCssAnimations) {
      cssRules.push(`
        *:not([aria-busy="true"]):not(.spinner):not(.loading) {
          animation-iteration-count: 1 !important;
          animation-duration: 0.01ms !important;
        }
      `);
    }

    // 2. Disable expensive graphical filters (blur, drop-shadow, brightness thrash)
    if (settings.disableExpensiveFilters) {
      cssRules.push(`
        * {
          filter: none !important;
        }
      `);
    }

    // 3. Disable backdrop-filter (blur effects on translucent headers/cards that cause heavy GPU repaints)
    if (settings.disableBackdropBlur) {
      cssRules.push(`
        * {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
      `);
    }

    // 4. Disable heavy box shadows on low-end devices
    if (settings.disableHeavyBoxShadows) {
      cssRules.push(`
        * {
          box-shadow: none !important;
          text-shadow: none !important;
        }
      `);
    }

    // 5. Enforce reduced motion system wide
    if (settings.enforceReducedMotion) {
      cssRules.push(`
        @media (prefers-reduced-motion: no-preference) {
          * {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `);
    }

    this.injectStylesheet(cssRules.join('\n'));
    emergencySwitch.registerTeardown(() => this.teardown());
  }

  private injectStylesheet(css: string): void {
    if (!document.documentElement) return;

    let styleEl = document.getElementById(INJECTION_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = INJECTION_STYLE_ID;
      document.documentElement.appendChild(styleEl);
    }

    styleEl.textContent = css;
    logger.debug('Injected optimized rendering stylesheet.');
  }

  /**
   * Removes injected stylesheet and restores native CSS
   */
  public teardown(): void {
    if (!this.isEnabled) return;

    if (typeof document !== 'undefined') {
      const styleEl = document.getElementById(INJECTION_STYLE_ID);
      if (styleEl?.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
        logger.debug('Removed rendering stylesheet.');
      }
    }

    this.isEnabled = false;
    logger.info('Rendering Optimization module disengaged.');
  }
}

export const renderingOptimizer = RenderingOptimizer.getInstance();

