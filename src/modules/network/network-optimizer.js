/**
 * Universal Website Performance Optimizer
 * Network Optimization & Data Savings Module
 * Measures genuine network metrics and calculates estimated bandwidth savings.
 */

import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class NetworkOptimizer {
  constructor() {
    this.isEnabled = false;
    this.blockedRequestsCount = 0;
    this.estimatedSavedBytes = 0;
    this.DEFAULT_ESTIMATED_SCRIPT_BYTES = 45000; // ~45 KB average tracker bundle
  }

  static getInstance() {
    if (!NetworkOptimizer.instance) {
      NetworkOptimizer.instance = new NetworkOptimizer();
    }
    return NetworkOptimizer.instance;
  }

  apply(settings) {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Network Optimization module...');
    emergencySwitch.registerTeardown(() => this.teardown());
  }

  recordBlockedRequest(url, approximateSize) {
    this.blockedRequestsCount++;
    const saved = approximateSize || this.DEFAULT_ESTIMATED_SCRIPT_BYTES;
    this.estimatedSavedBytes += saved;
    logger.debug(`Recorded blocked network request: ${url} (est. ${Math.round(saved / 1024)} KB saved)`);
  }

  getLiveNetworkMetrics() {
    let totalRequests = 0;
    let transferredBytes = 0;

    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const resources = performance.getEntriesByType('resource');
      totalRequests = resources ? resources.length : 0;

      for (let i = 0; i < totalRequests; i++) {
        const res = resources[i];
        if (typeof res.transferSize === 'number' && res.transferSize > 0) {
          transferredBytes += res.transferSize;
        } else if (typeof res.encodedBodySize === 'number' && res.encodedBodySize > 0) {
          transferredBytes += res.encodedBodySize;
        }
      }
    }

    return {
      totalRequests,
      transferredBytes,
      blockedRequests: this.blockedRequestsCount,
      estimatedSavedBytes: this.estimatedSavedBytes
    };
  }

  teardown() {
    this.isEnabled = false;
    logger.info('Network Optimization module disengaged.');
  }
}

export const networkOptimizer = NetworkOptimizer.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.networkOptimizer = networkOptimizer;
  globalThis.UWPO.NetworkOptimizer = NetworkOptimizer;
}

