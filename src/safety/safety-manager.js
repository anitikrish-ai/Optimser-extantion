/**
 * Universal Website Performance Optimizer
 * Safety & Compatibility Manager
 * Protects critical authentication, checkout, banking, and interactive user flows from interference.
 */

import { ESSENTIAL_PATH_PATTERNS, ESSENTIAL_SCRIPT_PATTERNS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

export class SafetyManager {
  static getInstance() {
    if (!SafetyManager.instance) {
      SafetyManager.instance = new SafetyManager();
    }
    return SafetyManager.instance;
  }

  /**
   * Normalizes an input string to a clean domain/hostname.
   * Strips protocols, paths, ports, and trailing slashes.
   */
  normalizeDomain(input) {
    if (!input || typeof input !== 'string') return '';
    return input
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0]
      .trim();
  }

  /**
   * Checks if a given hostname is present in the allowlist.
   * Supports exact domains, subdomains (e.g. app.example.com matches example.com),
   * localhost, and 127.0.0.1.
   */
  isDomainAllowlisted(hostname, allowlist) {
    if (!hostname || !allowlist || !Array.isArray(allowlist) || allowlist.length === 0) {
      return false;
    }

    const cleanHost = this.normalizeDomain(hostname);
    if (!cleanHost) return false;

    return allowlist.some((item) => {
      const cleanItem = this.normalizeDomain(item);
      if (!cleanItem) return false;
      return cleanHost === cleanItem || cleanHost.endsWith('.' + cleanItem);
    });
  }

  /**
   * Checks if the current page URL represents an essential authentication or payment flow
   */
  isEssentialFlow(url) {
    if (!url || typeof url !== 'string') return false;
    return ESSENTIAL_PATH_PATTERNS.some((pattern) => pattern.test(url));
  }

  /**
   * Checks if a script URL or identifier is an essential service script
   */
  isEssentialScript(src) {
    if (!src || typeof src !== 'string') return false;
    return ESSENTIAL_SCRIPT_PATTERNS.some((pattern) => pattern.test(src));
  }

  /**
   * Evaluates if the current live DOM contains sensitive authentication or checkout forms
   */
  hasSensitiveInputs() {
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
  isSafeToOptimize(hostname, url, allowlist) {
    if (this.isDomainAllowlisted(hostname, allowlist)) {
      logger.info(`Domain [${hostname}] is on the allowlist. Optimization suppressed.`);
      return false;
    }

    if (this.isEssentialFlow(url)) {
      logger.info(`URL path [${url}] matches essential flow. Optimization suppressed.`);
      return false;
    }

    if (this.hasSensitiveInputs()) {
      logger.info('Sensitive authentication/checkout input detected. Optimization suppressed.');
      return false;
    }

    return true;
  }
}

export const safetyManager = SafetyManager.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.safetyManager = safetyManager;
  globalThis.UWPO.SafetyManager = SafetyManager;
}

