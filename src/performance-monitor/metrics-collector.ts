/**
 * Universal Website Performance Optimizer
 * Performance Metrics Collector
 * Collects real, verifiable browser performance metrics using native W3C Performance APIs.
 */

import { LivePerformanceStats, OptimizationMode } from '../shared/types';
import { networkOptimizer } from '../modules/network/network-optimizer';
import { workloadAnalyzer } from '../device-detection/workload-analyzer';
import { logger } from '../shared/logger';

interface ChromePerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private fpsEstimate = 60;
  private rafHandle: number | null = null;
  private lastRafTimestamp = 0;
  private frameCount = 0;

  private constructor() {
    this.startFpsMonitoring();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private startFpsMonitoring(): void {
    if (typeof requestAnimationFrame === 'undefined') return;

    const measureFrame = (timestamp: number) => {
      if (!this.lastRafTimestamp) {
        this.lastRafTimestamp = timestamp;
      }

      this.frameCount++;
      const elapsed = timestamp - this.lastRafTimestamp;

      if (elapsed >= 1000) {
        this.fpsEstimate = Math.min(60, Math.round((this.frameCount * 1000) / elapsed));
        this.frameCount = 0;
        this.lastRafTimestamp = timestamp;
      }

      this.rafHandle = requestAnimationFrame(measureFrame);
    };

    this.rafHandle = requestAnimationFrame(measureFrame);
  }

  /**
   * Samples live genuine performance metrics from browser APIs
   */
  public collectCurrentStats(mode: OptimizationMode, isOptimized: boolean, activeModulesCount: number): LivePerformanceStats {
    let navigationStart = 0;
    let domContentLoadedMs = 0;
    let loadEventMs = 0;

    // 1. Navigation Timing
    if (typeof performance !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navEntries.length > 0) {
        const nav = navEntries[0];
        navigationStart = nav.startTime;
        domContentLoadedMs = Math.round(nav.domContentLoadedEventEnd - nav.startTime);
        loadEventMs = Math.round(nav.loadEventEnd - nav.startTime);
      } else if (performance.timing) {
        const t = performance.timing;
        navigationStart = t.navigationStart;
        domContentLoadedMs = Math.max(0, t.domContentLoadedEventEnd - t.navigationStart);
        loadEventMs = Math.max(0, t.loadEventEnd - t.navigationStart);
      }
    }

    // 2. Memory (Chrome proprietary extension to window.performance)
    let jsHeapUsedMB: number | null = null;
    let jsHeapTotalMB: number | null = null;
    let jsHeapLimitMB: number | null = null;

    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as unknown as { memory: ChromePerformanceMemory }).memory;
      if (mem && mem.usedJSHeapSize) {
        jsHeapUsedMB = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
        jsHeapTotalMB = Math.round((mem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
        jsHeapLimitMB = Math.round((mem.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
      }
    }

    // 3. Network Metrics
    const netMetrics = networkOptimizer.getLiveNetworkMetrics();

    return {
      navigationStart,
      domContentLoadedMs: domContentLoadedMs > 0 ? domContentLoadedMs : 0,
      loadEventMs: loadEventMs > 0 ? loadEventMs : 0,
      jsHeapUsedMB,
      jsHeapTotalMB,
      jsHeapLimitMB,
      totalRequests: netMetrics.totalRequests,
      blockedRequests: netMetrics.blockedRequests,
      transferredBytes: netMetrics.transferredBytes,
      estimatedSavedBytes: netMetrics.estimatedSavedBytes,
      fpsEstimate: this.fpsEstimate,
      activeModulesCount,
      isOptimized,
      mode
    };
  }

  public teardown(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }
}

export const metricsCollector = MetricsCollector.getInstance();

