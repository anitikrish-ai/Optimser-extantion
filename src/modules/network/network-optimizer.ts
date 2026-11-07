/**
 * Universal Website Performance Optimizer
 * Network Optimization & Data Savings Module
 * Measures genuine network metrics and calculates estimated bandwidth savings.
 */

import { NetworkOptimizationSettings } from '../../shared/types';
import { BLOATWARE_SCRIPT_PATTERNS } from '../../shared/constants';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class NetworkOptimizer {
  private static instance: NetworkOptimizer;
  private isEnabled = false;
  private blockedRequestsCount = 0;
  private estimatedSavedBytes = 0;
  private customPatterns: RegExp[] = [];

  // Average size baseline for blocked trackers when content-length is unavailable
  private readonly DEFAULT_ESTIMATED_SCRIPT_BYTES = 45000; // ~45 KB average tracker bundle

  private constructor() {}

  public static getInstance(): NetworkOptimizer {
    if (!NetworkOptimizer.instance) {
      NetworkOptimizer.instance = new NetworkOptimizer();
    }
    return NetworkOptimizer.instance;
  }

  /**
   * Applies network settings
   */
  public apply(settings: NetworkOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    this.customPatterns = (settings.customBlockPatterns || []).map((pattern) => new RegExp(pattern, 'i'));
    logger.info('Enabling Network Optimization module...');

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  /**
   * Records a blocked network request and updates estimated bandwidth saved
   */
  public recordBlockedRequest(url: string, approximateSize?: number): void {
    this.blockedRequestsCount++;
    const saved = approximateSize || this.DEFAULT_ESTIMATED_SCRIPT_BYTES;
    this.estimatedSavedBytes += saved;
    logger.debug(`Recorded blocked network request: ${url} (est. ${Math.round(saved / 1024)} KB saved)`);
  }

  /**
   * Calculates live request metrics from native PerformanceResourceTiming
   */
  public getLiveNetworkMetrics(): {
    totalRequests: number;
    transferredBytes: number;
    blockedRequests: number;
    estimatedSavedBytes: number;
  } {
    let totalRequests = 0;
    let transferredBytes = 0;

    if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      totalRequests = resources.length;

      for (const res of resources) {
        // transferSize represents actual wire bytes transferred including headers
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

  public teardown(): void {
    this.isEnabled = false;
    this.customPatterns = [];
    logger.info('Network Optimization module disengaged.');
  }
}

export const networkOptimizer = NetworkOptimizer.getInstance();

