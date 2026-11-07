/**
 * Universal Website Performance Optimizer
 * Video Playback & Media Optimization Module
 * Prevents unwanted autoplay, pauses off-screen videos, and halts background playback.
 */

import { memoryOptimizer } from '../memory/memory-optimizer.js';
import { emergencySwitch } from '../../safety/emergency-switch.js';
import { logger } from '../../shared/logger.js';

export class VideoOptimizer {
  constructor() {
    this.isEnabled = false;
    this.videoObserver = null;
    this.domObserver = null;
    this.visibilityHandler = null;
    this.controlledVideos = new Set();
    this.pausedForBackground = new Set();
  }

  static getInstance() {
    if (!VideoOptimizer.instance) {
      VideoOptimizer.instance = new VideoOptimizer();
    }
    return VideoOptimizer.instance;
  }

  apply(settings) {
    if (!settings.enabled || emergencySwitch.isEmergencyDisarmed()) {
      this.teardown();
      return;
    }

    this.isEnabled = true;
    logger.info('Enabling Video Optimization module...');

    // 1. Optimize existing video elements
    if (typeof document !== 'undefined') {
      const existingVideos = document.querySelectorAll('video');
      existingVideos.forEach((video) => this.handleVideoElement(video, settings));

      // 2. Setup IntersectionObserver for off-screen pausing
      if (settings.pauseOffscreenVideos && typeof IntersectionObserver !== 'undefined') {
        this.setupVideoIntersectionObserver();
      }

      // 3. Setup background tab video pausing
      if (settings.pauseBackgroundTabVideos) {
        this.setupBackgroundVisibilityHandler();
      }

      // 4. Watch for newly inserted videos
      this.setupDomVideoObserver(settings);
    }

    emergencySwitch.registerTeardown(() => this.teardown());
  }

  handleVideoElement(video, settings) {
    if (!video) return;
    this.controlledVideos.add(video);

    // Block autoplay if configured
    if (settings.blockAutoplay) {
      video.autoplay = false;
      if (video.getAttribute('autoplay') !== null) {
        video.removeAttribute('autoplay');
      }
      if (video.preload !== 'metadata' && video.preload !== 'none') {
        video.preload = 'metadata';
      }
    }

    // Register with intersection observer
    if (this.videoObserver) {
      this.videoObserver.observe(video);
    }
  }

  setupVideoIntersectionObserver() {
    if (this.videoObserver) return;

    try {
      this.videoObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const video = entry.target;
            if (!entry.isIntersecting) {
              if (!video.paused) {
                video.pause();
                video.dataset.uwpoPausedOffscreen = 'true';
                logger.debug('Paused off-screen video stream to save decoding CPU cycles.');
              }
            } else {
              if (video.dataset.uwpoPausedOffscreen === 'true') {
                delete video.dataset.uwpoPausedOffscreen;
                video.play().catch(() => {});
              }
            }
          }
        },
        { rootMargin: '50px' }
      );

      this.controlledVideos.forEach((v) => this.videoObserver?.observe(v));
      memoryOptimizer.registerObserver(this.videoObserver);
    } catch (e) {
      logger.warn('Failed setting up video IntersectionObserver:', e);
    }
  }

  setupBackgroundVisibilityHandler() {
    if (this.visibilityHandler) return;

    this.visibilityHandler = () => {
      if (document.hidden) {
        this.controlledVideos.forEach((video) => {
          // Only pause muted or background video loops (preserve user-intentional audio playback)
          if (!video.paused && (video.muted || video.volume === 0)) {
            video.pause();
            this.pausedForBackground.add(video);
            logger.debug('Paused muted video while tab is in background.');
          }
        });
      } else {
        this.pausedForBackground.forEach((video) => {
          video.play().catch(() => {});
        });
        this.pausedForBackground.clear();
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler, { passive: true });
  }

  setupDomVideoObserver(settings) {
    if (this.domObserver) return;

    try {
      this.domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              const el = node;
              if (el.tagName === 'VIDEO') {
                this.handleVideoElement(el, settings);
              } else if (el.getElementsByTagName) {
                const nestedVideos = el.getElementsByTagName('video');
                for (let i = 0; i < nestedVideos.length; i++) {
                  this.handleVideoElement(nestedVideos[i], settings);
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
      logger.warn('Failed setting up video DOM observer:', e);
    }
  }

  teardown() {
    if (!this.isEnabled) return;

    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    if (this.videoObserver) {
      this.videoObserver.disconnect();
      this.videoObserver = null;
    }

    if (this.domObserver) {
      this.domObserver.disconnect();
      this.domObserver = null;
    }

    // Restore any paused videos
    this.controlledVideos.forEach((video) => {
      if (video.dataset?.uwpoPausedOffscreen === 'true') {
        delete video.dataset.uwpoPausedOffscreen;
        video.play().catch(() => {});
      }
    });

    this.pausedForBackground.forEach((video) => {
      video.play().catch(() => {});
    });

    this.controlledVideos.clear();
    this.pausedForBackground.clear();
    this.isEnabled = false;
    logger.info('Video Optimization module disengaged.');
  }
}

export const videoOptimizer = VideoOptimizer.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.videoOptimizer = videoOptimizer;
  globalThis.UWPO.VideoOptimizer = VideoOptimizer;
}

