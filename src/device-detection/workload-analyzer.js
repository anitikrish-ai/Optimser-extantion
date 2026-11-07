/**
 * Universal Website Performance Optimizer
 * Live Page Workload Analyzer
 * Inspects page complexity and long-task occurrences using native PerformanceObserver.
 */

import { logger } from '../shared/logger.js';

export class WorkloadAnalyzer {
  constructor() {
    this.longTaskObserver = null;
    this.longTasksCount = 0;
    this.totalLongTaskDurationMs = 0;
    this.initLongTaskObserver();
  }

  static getInstance() {
    if (!WorkloadAnalyzer.instance) {
      WorkloadAnalyzer.instance = new WorkloadAnalyzer();
    }
    return WorkloadAnalyzer.instance;
  }

  initLongTaskObserver() {
    if (typeof PerformanceObserver === 'undefined') return;

    try {
      if (PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        this.longTaskObserver = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            this.longTasksCount++;
            this.totalLongTaskDurationMs += Math.round(entry.duration);
          }
        });

        this.longTaskObserver.observe({ entryTypes: ['longtask'] });
      }
    } catch (e) {
      logger.debug('PerformanceObserver longtask observation not supported or permitted on this page', e);
    }
  }

  analyzeCurrentWorkload() {
    if (typeof document === 'undefined') {
      return {
        domNodeCount: 0,
        scriptCount: 0,
        stylesheetCount: 0,
        imageCount: 0,
        videoCount: 0,
        iframeCount: 0,
        longTasksCount: 0,
        totalLongTaskDurationMs: 0
      };
    }

    const domNodes = document.getElementsByTagName('*');
    const scripts = document.scripts;
    const stylesheets = document.styleSheets;
    const images = document.images;
    const videos = document.getElementsByTagName('video');
    const iframes = document.getElementsByTagName('iframe');

    return {
      domNodeCount: domNodes ? domNodes.length : 0,
      scriptCount: scripts ? scripts.length : 0,
      stylesheetCount: stylesheets ? stylesheets.length : 0,
      imageCount: images ? images.length : 0,
      videoCount: videos ? videos.length : 0,
      iframeCount: iframes ? iframes.length : 0,
      longTasksCount: this.longTasksCount,
      totalLongTaskDurationMs: this.totalLongTaskDurationMs
    };
  }

  resetMetrics() {
    this.longTasksCount = 0;
    this.totalLongTaskDurationMs = 0;
  }

  disconnect() {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }
    this.resetMetrics();
  }
}

export const workloadAnalyzer = WorkloadAnalyzer.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.workloadAnalyzer = workloadAnalyzer;
  globalThis.UWPO.WorkloadAnalyzer = WorkloadAnalyzer;
}

