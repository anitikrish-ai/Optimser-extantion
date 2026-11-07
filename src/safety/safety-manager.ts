/**
 * Universal Website Performance Optimizer
 * Safety & Compatibility Manager
 * Protects critical authentication, checkout, banking, and interactive user flows from interference.
 */

import { ESSENTIAL_PATH_PATTERNS, ESSENTIAL_SCRIPT_PATTERNS } from '../shared/constants';
import { logger } from '../shared/logger';

export class SafetyManager {
  private static instance: SafetyManager;

  private constructor() {}

  public static getInstance(): SafetyManager {
    if (!SafetyManager.instance) {
      SafetyManager.instance = new SafetyManager();
    }
    return SafetyManager.instance;
  }

  /**
   * Checks if a given hostname is present in the allowlist
   */
  public isDomainAllowlisted(hostname: string, allowlist: string[]): boolean {
    if (!hostname || !allowlist || allowlist.length === 0) {
      return false;
    }

    const cleanHost = hostname.toLowerCase().trim();

    return allowlist.some((item) => {
      const cleanItem = item.toLowerCase().trim();
      return (
        cleanHost === cleanItem ||
        cleanHost.endsWith(`.${cleanItem}`) ||
        cleanHost.startsWith(`${cleanItem}/`) ||
        cleanHost === 'localhost' ||
        cleanHost === '127.0.0.1'
      );
    });
  }

  /**
   * Checks if the current page URL represents an essential authentication or payment flow
   */
  public isEssentialFlow(url: string): boolean {
    if (!url) return false;

    return ESSENTIAL_PATH_PATTERNS.some((pattern) => pattern.test(url));
  }

  /**
   * Checks if a script URL or identifier is an essential service script
   */
  public isEssentialScript(src: string): boolean {
    if (!src) return false;

    return ESSENTIAL_SCRIPT_PATTERNS.some((pattern) => pattern.test(src));
  }

  /**
   * Evaluates if the current live DOM contains sensitive authentication or checkout forms
   * that require high safety margins.
   */
  public hasSensitiveInputs(): boolean {
    if (typeof document === 'undefined') return false;

    try {
      const passwordInputs = document.querySelectorAll('input[type="password"]');
      if (passwordInputs.length > 0) return true;

      const paymentInputs = document.querySelectorAll(
        'input[autocomplete*="cc-"], input[name*="card"], input[id*="stripe"], input[id*="paypal"]'
      );
      if (paymentInputs.length > 0) return true;
    } catch (e) {
      logger.warn('Failed querying sensitive inputs:', e);
    }

    return false;
  }

  /**
   * Master safety verification: returns true if optimizations are safe to apply
   */
  public isSafeToOptimize(hostname: string, url: string, allowlist: string[]): boolean {
    if (this.isDomainAllowlisted(hostname, allowlist)) {
      logger.info(`Domain [${hostname}] is on the allowlist. Optimization suppressed.`);
      return false;
    }

    if (this.isEssentialFlow(url)) {
      logger.info(`URL path [${url}] matches essential flow. Optimization suppressed.`);
      return false;
    }

    return true;
  }
}

export const safetyManager = SafetyManager.getInstance();

