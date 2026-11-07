/**
 * Universal Website Performance Optimizer
 * JavaScript Optimization & Bloatware Script Blocker
 * Safely blocks heavy third-party trackers while strictly protecting essential functionality.
 */

import { ScriptOptimizationSettings } from '../../shared/types';
import { BLOATWARE_SCRIPT_PATTERNS, ESSENTIAL_SCRIPT_PATTERNS } from '../../shared/constants';
import { safetyManager } from '../../safety/safety-manager';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class ScriptBlocker {
  private static instance: ScriptBlocker;
  private isEnabled = false;
  private scriptObserver: MutationObserver | null = null;
  private originalSendBeacon: typeof navigator.sendBeacon | null = null;
  private blockedScriptsCount = 0;

  private constructor() {}

  public static getInstance(): ScriptBlocker {
    if (!ScriptBlocker.instance) {
      ScriptBlocker.instance = new ScriptBlocker();
    }
    return ScriptBlocker.instance;
  }

  /**
   * Applies script optimization rules
   */
  public apply(settings: ScriptOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Script Optimization module...');

    // 1. Intercept newly injected script elements in the DOM
    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
      this.setupScriptObserver(settings);
    }

    // 2. Intercept telemetry beacons
    if (settings.blockTelemetryBeacons && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      this.setupBeaconInterceptor();
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  /**
   * Determines if a script source matches known bloatware and is safe to block
   */
  public shouldBlockScript(src: string): boolean {
    if (!src) return false;

    // Safety First: never block essential services (Turnstile, reCAPTCHA, Stripe, Auth0)
    if (safetyManager.isEssentialScript(src)) {
      return false;
    }

    return BLOATWARE_SCRIPT_PATTERNS.some((pattern) => pattern.test(src));
  }

  private setupScriptObserver(settings: ScriptOptimizationSettings): void {
    if (this.scriptObserver) return;

    try {
      this.scriptObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.tagName === 'SCRIPT') {
                this.inspectScriptElement(el as HTMLScriptElement);
              } else {
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

  private inspectScriptElement(scriptEl: HTMLScriptElement): void {
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

  private setupBeaconInterceptor(): void {
    if (this.originalSendBeacon) return;

    this.originalSendBeacon = navigator.sendBeacon.bind(navigator);

    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      const urlStr = url.toString();
      if (this.shouldBlockScript(urlStr)) {
        logger.debug(`Suppressed telemetry sendBeacon call to: ${urlStr}`);
        this.blockedScriptsCount++;
        return true; // Return true as if succeeded to avoid retry loops
      }
      return this.originalSendBeacon ? this.originalSendBeacon(url, data) : true;
    };
  }

  public getBlockedScriptsCount(): number {
    return this.blockedScriptsCount;
  }

  /**
   * Restores original script and beacon behavior
   */
  public teardown(): void {
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

