/**
 * Universal Website Performance Optimizer
 * Performance Statistics Aggregator
 * Formats metrics for UI presentation, explicitly labeling estimated vs measured values.
 */

import { LivePerformanceStats } from '../shared/types';

export interface FormattedPerformanceReport {
  loadTimeLabel: string;
  domReadyLabel: string;
  memoryUsageLabel: string;
  memoryStatus: 'measured' | 'unavailable';
  networkRequestsLabel: string;
  blockedRequestsLabel: string;
  dataTransferredLabel: string;
  estimatedSavingsLabel: string;
  estimatedSavingsPercentage: string;
  fpsLabel: string;
  modeLabel: string;
  statusBadge: string;
}

export class StatsAggregator {
  /**
   * Formats raw stats into human-readable, honest UI representation
   */
  public static formatStats(stats: LivePerformanceStats): FormattedPerformanceReport {
    // 1. Load Times
    const loadTimeLabel = stats.loadEventMs > 0 ? `${stats.loadEventMs} ms` : 'Measuring...';
    const domReadyLabel = stats.domContentLoadedMs > 0 ? `${stats.domContentLoadedMs} ms` : 'Measuring...';

    // 2. Memory
    let memoryUsageLabel = 'Restricted by browser API';
    let memoryStatus: 'measured' | 'unavailable' = 'unavailable';

    if (stats.jsHeapUsedMB !== null) {
      memoryUsageLabel = `${stats.jsHeapUsedMB} MB (${stats.jsHeapTotalMB} MB total)`;
      memoryStatus = 'measured';
    }

    // 3. Network & Bandwidth
    const networkRequestsLabel = `${stats.totalRequests} requests`;
    const blockedRequestsLabel = `${stats.blockedRequests} blocked`;

    const transferredKB = Math.round(stats.transferredBytes / 1024);
    const transferredMB = (stats.transferredBytes / (1024 * 1024)).toFixed(2);
    const dataTransferredLabel =
      stats.transferredBytes > 1024 * 1024 ? `${transferredMB} MB` : `${transferredKB} KB`;

    const savedKB = Math.round(stats.estimatedSavedBytes / 1024);
    const savedMB = (stats.estimatedSavedBytes / (1024 * 1024)).toFixed(2);
    const estimatedSavingsLabel =
      stats.estimatedSavedBytes > 1024 * 1024 ? `${savedMB} MB (est.)` : `${savedKB} KB (est.)`;

    const totalPotential = stats.transferredBytes + stats.estimatedSavedBytes;
    const savingsPercent =
      totalPotential > 0 ? Math.min(75, Math.round((stats.estimatedSavedBytes / totalPotential) * 100)) : 0;
    const estimatedSavingsPercentage = `${savingsPercent}%`;

    // 4. FPS & Mode
    const fpsLabel = `${stats.fpsEstimate} FPS`;
    const modeLabel = stats.mode.replace('_', ' ').toUpperCase();
    const statusBadge = stats.isOptimized ? 'OPTIMIZED' : 'BYPASSED';

    return {
      loadTimeLabel,
      domReadyLabel,
      memoryUsageLabel,
      memoryStatus,
      networkRequestsLabel,
      blockedRequestsLabel,
      dataTransferredLabel,
      estimatedSavingsLabel,
      estimatedSavingsPercentage,
      fpsLabel,
      modeLabel,
      statusBadge
    };
  }
}

