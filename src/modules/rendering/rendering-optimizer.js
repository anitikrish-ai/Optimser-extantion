/**
 * Universal Website Performance Optimizer
 * CSS & Rendering Optimization Module
 * Conservative rendering optimization: caps non-essential infinite animations
 * and respects system reduced motion without breaking site usability.
 */

import { INJECTION_STYLE_ID } from '../../shared/constants.js';
import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class RenderingOptimizer {
  constructor() {
    this.isEnabled = false;
  }

  static getInstance() {
    if (!RenderingOptimizer.instance) {
      RenderingOptimizer.instance = new RenderingOptimizer();
    }
    return RenderingOptimizer.instance;
  }

  apply(settings) {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Rendering Optimization module...');

    if (typeof document === 'undefined') return;

    const cssRules = [];

    // 1. Conservative animation capping: only targets heavy infinite background loops
    if (settings.reduceCssAnimations) {
      cssRules.push(`
        [class*="marquee"], [class*="ticker"], [class*="particles"], [class*="sparkle"], [class*="bg-anim"] {
          animation-iteration-count: 3 !important;
        }
      `);
    }

    // 2. Disable expensive graphical filters (ONLY when explicitly enabled in Performance/Extreme modes)
    if (settings.disableExpensiveFilters) {
      cssRules.push(`
        img, video, canvas {
          filter: none !important;
        }
      `);
    }

    // 3. Disable backdrop-filter blur (ONLY when explicitly enabled in Extreme mode)
    if (settings.disableBackdropBlur) {
      cssRules.push(`
        * {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
      `);
    }

    // 4. Disable heavy multi-layer box shadows (ONLY when explicitly enabled in Extreme mode)
    if (settings.disableHeavyBoxShadows) {
      cssRules.push(`
        *:not(button):not(input):not(select):not([role="button"]) {
          box-shadow: none !important;
          text-shadow: none !important;
        }
      `);
    }

    // 5. Enforce system reduced motion preference
    if (settings.enforceReducedMotion) {
      cssRules.push(`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `);
    }

    this.injectStylesheet(cssRules.join('\n'));
    emergencySwitch.registerTeardown(() => this.teardown());
  }

  injectStylesheet(css) {
    if (!document.documentElement) return;

    let styleEl = document.getElementById(INJECTION_STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = INJECTION_STYLE_ID;
      document.documentElement.appendChild(styleEl);
    }

    styleEl.textContent = css;
    logger.debug('Injected optimized rendering stylesheet.');
  }

  teardown() {
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

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.renderingOptimizer = renderingOptimizer;
  globalThis.UWPO.RenderingOptimizer = RenderingOptimizer;
}

