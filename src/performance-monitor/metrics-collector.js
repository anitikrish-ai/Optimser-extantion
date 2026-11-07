/**
 * Universal Website Performance Optimizer
 * Performance Metrics Collector
 * Collects real, verifiable browser performance metrics using native W3C Performance APIs.
 * Zero fabricated metrics, zero artificial loops.
 */

import { networkOptimizer } from '../modules/network/network-optimizer.js';
import { workloadAnalyzer } from '../device-detection/workload-analyzer.js';

export class MetricsCollector {
  static getInstance() {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Samples live genuine performance metrics from browser APIs
   */
  collectCurrentStats(mode, isOptimized, activeModulesCount) {
    let navigationStart = 0;
    let domContentLoadedMs = 0;
    let loadEventMs = 0;

    // 1. Navigation Timing
    if (typeof performance !== 'undefined') {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries && navEntries.length > 0) {
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
    let jsHeapUsedMB = null;
    let jsHeapTotalMB = null;
    let jsHeapLimitMB = null;

    if (typeof performance !== 'undefined' && 'memory' in performance && performance.memory) {
      const mem = performance.memory;
      if (mem && mem.usedJSHeapSize) {
        jsHeapUsedMB = Math.round((mem.usedJSHeapSize / (1024 * 1024)) * 10) / 10;
        jsHeapTotalMB = Math.round((mem.totalJSHeapSize / (1024 * 1024)) * 10) / 10;
        jsHeapLimitMB = Math.round((mem.jsHeapSizeLimit / (1024 * 1024)) * 10) / 10;
      }
    }

    // 3. Network Metrics
    const netMetrics = networkOptimizer.getLiveNetworkMetrics();

    // 4. Long Tasks count
    const workload = workloadAnalyzer.analyzeCurrentWorkload();

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
      longTasksCount: workload.longTasksCount,
      activeModulesCount,
      isOptimized,
      mode: mode || 'balanced'
    };
  }
}

export const metricsCollector = MetricsCollector.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.metricsCollector = metricsCollector;
  globalThis.UWPO.MetricsCollector = MetricsCollector;
}

