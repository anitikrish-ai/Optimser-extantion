/**
 * Universal Website Performance Optimizer
 * Image Optimization Module
 * Enforces native lazy loading, async decoding, and off-screen loading controls without downloading replacements.
 */

import { memoryOptimizer } from '../memory/memory-optimizer.js';
import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class ImageOptimizer {
  constructor() {
    this.isEnabled = false;
    this.domObserver = null;
    this.optimizedImagesCount = 0;
  }

  static getInstance() {
    if (!ImageOptimizer.instance) {
      ImageOptimizer.instance = new ImageOptimizer();
    }
    return ImageOptimizer.instance;
  }

  apply(settings) {
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

  optimizeImageElement(img, settings) {
    if (!img || memoryOptimizer.isProcessed(img)) return;

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

  setupDomImageObserver(settings) {
    if (this.domObserver) return;

    try {
      this.domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              const el = node;
              if (el.tagName === 'IMG') {
                this.optimizeImageElement(el, settings);
              } else if (el.getElementsByTagName) {
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

  getOptimizedImagesCount() {
    return this.optimizedImagesCount;
  }

  teardown() {
    if (!this.isEnabled) return;

    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    this.isEnabled = false;
    logger.info('Image Optimization module disengaged.');
  }
}

export const imageOptimizer = ImageOptimizer.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.imageOptimizer = imageOptimizer;
  globalThis.UWPO.ImageOptimizer = ImageOptimizer;
}

