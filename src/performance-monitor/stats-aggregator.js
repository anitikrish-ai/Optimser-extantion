/**
 * Universal Website Performance Optimizer
 * Performance Statistics Aggregator
 * Formats metrics for UI presentation, explicitly labeling estimated vs measured values.
 */

export class StatsAggregator {
  /**
   * Formats raw stats into human-readable, honest UI representation
   */
  static formatStats(stats) {
    if (!stats) {
      return {
        loadTimeLabel: 'Measuring...',
        domReadyLabel: 'Measuring...',
        memoryUsageLabel: 'Unavailable',
        memoryStatus: 'unavailable',
        networkRequestsLabel: '0 requests',
        blockedRequestsLabel: '0 blocked',
        dataTransferredLabel: '0 KB',
        estimatedSavingsLabel: '0 KB (est.)',
        modeLabel: 'BALANCED',
        statusBadge: 'PAUSED'
      };
    }

    // 1. Load Times
    const loadTimeLabel = stats.loadEventMs > 0 ? `${stats.loadEventMs} ms` : 'Measuring...';
    const domReadyLabel = stats.domContentLoadedMs > 0 ? `${stats.domContentLoadedMs} ms` : 'Measuring...';

    // 2. Memory
    let memoryUsageLabel = 'Restricted by browser API';
    let memoryStatus = 'unavailable';

    if (stats.jsHeapUsedMB !== null && stats.jsHeapUsedMB !== undefined) {
      memoryUsageLabel = `${stats.jsHeapUsedMB} MB (${stats.jsHeapTotalMB} MB total)`;
      memoryStatus = 'measured';
    }

    // 3. Network & Bandwidth
    const networkRequestsLabel = `${stats.totalRequests || 0} requests`;
    const blockedRequestsLabel = `${stats.blockedRequests || 0} blocked`;

    const transferredBytes = stats.transferredBytes || 0;
    const transferredKB = Math.round(transferredBytes / 1024);
    const transferredMB = (transferredBytes / (1024 * 1024)).toFixed(2);
    const dataTransferredLabel =
      transferredBytes > 1024 * 1024 ? `${transferredMB} MB` : `${transferredKB} KB`;

    const savedBytes = stats.estimatedSavedBytes || 0;
    const savedKB = Math.round(savedBytes / 1024);
    const savedMB = (savedBytes / (1024 * 1024)).toFixed(2);
    const estimatedSavingsLabel =
      savedBytes > 1024 * 1024 ? `${savedMB} MB (est.)` : `${savedKB} KB (est.)`;

    // 4. Mode & Status
    const modeLabel = (stats.mode || 'balanced').replace('_', ' ').toUpperCase();
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
      modeLabel,
      statusBadge
    };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.StatsAggregator = StatsAggregator;
}

