/**
 * Universal Website Performance Optimizer
 * JavaScript Optimization & Bloatware Script Blocker
 * Safely blocks heavy third-party trackers while strictly protecting essential functionality.
 */

import { BLOATWARE_SCRIPT_PATTERNS } from '../../shared/constants.js';
import { safetyManager } from '../../safety/safety-manager.js';
import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class ScriptBlocker {
  constructor() {
    this.isEnabled = false;
    this.scriptObserver = null;
    this.originalSendBeacon = null;
    this.blockedScriptsCount = 0;
  }

  static getInstance() {
    if (!ScriptBlocker.instance) {
      ScriptBlocker.instance = new ScriptBlocker();
    }
    return ScriptBlocker.instance;
  }

  apply(settings) {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Script Optimization module...');

    // 1. Intercept newly injected script elements in the DOM
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      this.setupScriptObserver();
    }

    // 2. Intercept telemetry beacons
    if (settings.blockTelemetryBeacons && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      this.setupBeaconInterceptor();
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  shouldBlockScript(src) {
    if (!src || typeof src !== 'string') return false;

    // Safety First: never block essential services (Turnstile, reCAPTCHA, Stripe, PayPal, Auth0)
    if (safetyManager.isEssentialScript(src)) {
      return false;
    }

    return BLOATWARE_SCRIPT_PATTERNS.some((pattern) => pattern.test(src));
  }

  setupScriptObserver() {
    if (this.scriptObserver) return;

    try {
      this.scriptObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              const el = node;
              if (el.tagName === 'SCRIPT') {
                this.inspectScriptElement(el);
              } else if (el.getElementsByTagName) {
                const nestedScripts = el.getElementsByTagName('script');
                for (let i = 0; i < nestedScripts.length; i++) {
                  this.inspectScriptElement(nestedScripts[i]);
                }
              }
            }
          }
        }
      });

      this.scriptObserver.observe(document.documentElement || document, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      logger.warn('Failed setting up script MutationObserver:', e);
    }
  }

  inspectScriptElement(scriptEl) {
    const src = scriptEl.src || '';
    if (this.shouldBlockScript(src)) {
      logger.info(`Blocked heavy bloatware script: ${src}`);
      scriptEl.type = 'javascript/blocked';
      if (scriptEl.parentNode) {
        scriptEl.parentNode.removeChild(scriptEl);
      }
      this.blockedScriptsCount++;
    }
  }

  setupBeaconInterceptor() {
    if (this.originalSendBeacon) return;

    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);

    navigator.sendBeacon = (url, data) => {
      const urlStr = url ? url.toString() : '';
      if (this.shouldBlockScript(urlStr)) {
        logger.debug(`Suppressed telemetry sendBeacon call to: ${urlStr}`);
        this.blockedScriptsCount++;
        return true; // Return true to avoid application retry loops
      }
      return this.originalSendBeacon ? this.originalSendBeacon(url, data) : true;
    };
  }

  getBlockedScriptsCount() {
    return this.blockedScriptsCount;
  }

  teardown() {
    if (!this.isEnabled) return;

    if (this.scriptObserver) {
      this.scriptObserver.disconnect();
      this.scriptObserver = null;
    }

    if (this.originalSendBeacon && typeof navigator !== 'undefined') {
      navigator.sendBeacon = this.originalSendBeacon;
      this.originalSendBeacon = null;
    }

    this.isEnabled = false;
    logger.info('Script Optimization module disengaged.');
  }
}

export const scriptBlocker = ScriptBlocker.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.scriptBlocker = scriptBlocker;
  globalThis.UWPO.ScriptBlocker = ScriptBlocker;
}

