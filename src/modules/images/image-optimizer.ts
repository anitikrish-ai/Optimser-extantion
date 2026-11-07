/**
 * Universal Website Performance Optimizer
 * Image Optimization Module
 * Enforces native lazy loading, async decoding, and off-screen loading controls without downloading replacements.
 */

import { ImageOptimizationSettings } from '../../shared/types';
import { memoryOptimizer } from '../memory/memory-optimizer';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class ImageOptimizer {
  private static instance: ImageOptimizer;
  private isEnabled = false;
  private imageObserver: IntersectionObserver | null = null;
  private domObserver: MutationObserver | null = null;
  private optimizedImagesCount = 0;

  private constructor() {}

  public static getInstance(): ImageOptimizer {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  /**
   * Applies image optimizations across current and newly loaded images
   */
  public apply(settings: ImageOptimizationSettings): void {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Image Optimization module...');

    // 1. Optimize all existing images currently in DOM
    if (typeof document !== 'undefined') {
      const existingImages = document.querySelectorAll('img');
      existingImages.forEach((img) => this.optimizeImageElement(img, settings));

      // 2. Watch for dynamically added images
      this.setupDomImageObserver(settings);
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  /**
   * Optimizes an individual image element safely
   */
  public optimizeImageElement(img: HTMLImageElement, settings: ImageOptimizationSettings): void {
    if (memoryOptimizer.isProcessed(img)) return;

    // Enforce native lazy loading if not explicitly eager
    if (settings.enforceLazyLoading && img.loading !== 'lazy' && img.loading !== 'eager') {
      // Check if image is below the initial viewport fold
      const rect = img.getBoundingClientRect();
      const isBelowFold = rect.top > (window.innerHeight || 800);

      if (isBelowFold) {
        img.loading = 'lazy';
      }
    }

    // Enforce asynchronous decoding to prevent main thread frame drops during decoding
    if (settings.enforceAsyncDecoding && img.decoding !== 'async') {
      img.decoding = 'async';
    }

    // Ensure layout stability (prevent CLS layout shift) if intrinsic dimensions exist
    if (!img.style.aspectRatio && img.width && img.height) {
      img.style.aspectRatio = `${img.width} / ${img.height}`;
    }

    memoryOptimizer.markProcessed(img);
    this.optimizedImagesCount++;
  }

  private setupDomImageObserver(settings: ImageOptimizationSettings): void {
    if (this.domObserver) return;

    try {
      this.domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.tagName === 'IMG') {
                this.optimizeImageElement(el as HTMLImageElement, settings);
              } else {
                const nestedImgs = el.getElementsByTagName('img');
                for (let i = 0; i < nestedImgs.length; i++) {
                  this.optimizeImageElement(nestedImgs[i], settings);
                }
              }
            }
          }
        }
      });

      this.domObserver.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true
      });
      memoryOptimizer.registerObserver(this.domObserver);
    } catch (e) {
      logger.warn('Failed setting up image DOM MutationObserver:', e);
    }
  }

  public getOptimizedImagesCount(): number {
    return this.optimizedImagesCount;
  }

  /**
   * Teardown image observers
   */
  public teardown(): void {
    if (!this.isEnabled) return;

    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    if (this.imageObserver) {
      this.imageObserver.disconnect();
      this.imageObserver = null;
    }

    this.isEnabled = false;
    logger.info('Image Optimization module disengaged.');
  }
}

export const imageOptimizer = ImageOptimizer.getInstance();

