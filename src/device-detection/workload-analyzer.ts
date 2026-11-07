/**
 * Universal Website Performance Optimizer
 * Live Page Workload Analyzer
 * Safely inspects page complexity and long-task occurrences using native PerformanceObserver.
 */

import { PageWorkloadMetrics } from '../shared/types';
import { logger } from '../shared/logger';

export class WorkloadAnalyzer {
  private static instance: WorkloadAnalyzer;
  private longTaskObserver: PerformanceObserver | null = null;
  private longTasksCount = 0;
  private totalLongTaskDurationMs = 0;

  private constructor() {
    this.initLongTaskObserver();
  }

  public static getInstance(): WorkloadAnalyzer {
    if (!WorkloadAnalyzer.instance) {
      WorkloadAnalyzer.instance = new WorkloadAnalyzer();
    }
    return WorkloadAnalyzer.instance;
  }

  private initLongTaskObserver(): void {
    if (typeof PerformanceObserver === 'undefined') {
      return;
    }

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

  /**
   * Samples current page workload metrics safely
   */
  public analyzeCurrentWorkload(): PageWorkloadMetrics {
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
      domNodeCount: domNodes.length,
      scriptCount: scripts.length,
      stylesheetCount: stylesheets.length,
      imageCount: images.length,
      videoCount: videos.length,
      iframeCount: iframes.length,
      longTasksCount: this.longTasksCount,
      totalLongTaskDurationMs: this.totalLongTaskDurationMs
    };
  }

  /**
   * Resets long task counters (e.g. for SPA navigation or manual reset)
   */
  public resetMetrics(): void {
    this.longTasksCount = 0;
    this.totalLongTaskDurationMs = 0;
  }

  /**
   * Teardown observer on page unload to prevent memory retention
   */
  public disconnect(): void {
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
      this.longTaskObserver = null;
    }
    this.resetMetrics();
  }
}

export const workloadAnalyzer = WorkloadAnalyzer.getInstance();

