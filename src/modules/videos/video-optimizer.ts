/**
 * Universal Website Performance Optimizer
 * Video Optimization & Playback Control Module
 * Prevents unwanted autoplay, pauses off-screen videos, and halts background playback.
 */

import { VideoOptimizationSettings } from '../../shared/types';
import { memoryOptimizer } from '../memory/memory-optimizer';
import { emergencySwitch } from '../../safety/emergency-switch';
import { logger } from '../../shared/logger';

export class VideoOptimizer {
  private static instance: VideoOptimizer;
  private isEnabled = false;
  private videoObserver: IntersectionObserver | null = null;
  private domObserver: MutationObserver | null = null;
  private visibilityHandler: (() => void) | null = null;
  private controlledVideos: Set<HTMLVideoElement> = new Set();
  private pausedForBackground: Set<HTMLVideoElement> = new Set();

  private constructor() {}

  public static getInstance(): VideoOptimizer {
    if (!VideoOptimizer.instance) {
      VideoOptimizer.instance = new VideoOptimizer();
    }
    return VideoOptimizer.instance;
  }

  /**
   * Applies video controls and listeners
   */
  public apply(settings: VideoOptimizationSettings): void {
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

  private handleVideoElement(video: HTMLVideoElement, settings: VideoOptimizationSettings): void {
    this.controlledVideos.add(video);

    // Block autoplay if configured
    if (settings.blockAutoplay) {
      video.autoplay = false;
      if (video.getAttribute('autoplay') !== null) {
        video.removeAttribute('autoplay');
      }
      // Set preload to metadata to avoid pre-buffering heavy gigabyte video streams
      if (video.preload !== 'metadata' && video.preload !== 'none') {
        video.preload = 'metadata';
      }
    }

    // Register with intersection observer
    if (this.videoObserver) {
      this.videoObserver.observe(video);
    }
  }

  private setupVideoIntersectionObserver(): void {
    if (this.videoObserver) return;

    try {
      this.videoObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const video = entry.target as HTMLVideoElement;
            if (!entry.isIntersecting) {
              if (!video.paused) {
                video.pause();
                video.dataset.uwpoPausedOffscreen = 'true';
                logger.debug('Paused off-screen video stream to save decoding CPU cycles.');
              }
            } else {
              if (video.dataset.uwpoPausedOffscreen === 'true') {
                delete video.dataset.uwpoPausedOffscreen;
                // Resume if it was previously playing
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

  private setupBackgroundVisibilityHandler(): void {
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

  private setupDomVideoObserver(settings: VideoOptimizationSettings): void {
    if (this.domObserver) return;

    try {
      this.domObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.tagName === 'VIDEO') {
                this.handleVideoElement(el as HTMLVideoElement, settings);
              } else {
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

  /**
   * Teardown and restore native video states
   */
  public teardown(): void {
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

    this.controlledVideos.clear();
    this.pausedForBackground.clear();
    this.isEnabled = false;
    logger.info('Video Optimization module disengaged.');
  }
}

export const videoOptimizer = VideoOptimizer.getInstance();

