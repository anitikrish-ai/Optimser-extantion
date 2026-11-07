/**
 * Universal Website Performance Optimizer
 * Device & Hardware Capability Detector
 * Detects real device specifications using standard Web APIs without fingerprinting or external calls.
 */

import { logger } from '../shared/logger.js';

export class DeviceDetector {
  constructor() {
    this.cachedCapabilities = null;
  }

  static getInstance() {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector();
    }
    return DeviceDetector.instance;
  }

  /**
   * Evaluates the current hardware and platform environment
   */
  async getCapabilities() {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const concurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;

    // deviceMemory is an experimental standard API in Chromium (returns GiB: 0.25, 0.5, 1, 2, 4, 8)
    const memory = typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? navigator.deviceMemory : null;

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
      (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

    // Network Information API
    let networkType = 'unknown';
    let saveData = false;

    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = navigator.connection;
      if (conn?.effectiveType) {
        networkType = conn.effectiveType;
      }
      if (typeof conn?.saveData === 'boolean') {
        saveData = conn.saveData;
      }
    }

    // Battery Status API (where supported)
    let batteryLevel = null;
    let isCharging = null;

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        batteryLevel = Math.round(battery.level * 100);
        isCharging = battery.charging;
      } catch {
        // Ignored if battery API is rejected by permissions or unsupported
      }
    }

    // W3C Low-end device classification
    const isLowCpu = concurrency <= 4;
    const isLowMemory = memory !== null ? memory <= 4 : isMobile;
    const isConstrainedNetwork = networkType === '2g' || networkType === 'slow-2g' || networkType === '3g' || saveData;
    const isLowBattery = batteryLevel !== null && batteryLevel < 20 && isCharging === false;

    const isLowEndDevice = isLowCpu || isLowMemory || isConstrainedNetwork || isLowBattery;

    this.cachedCapabilities = {
      hardwareConcurrency: concurrency,
      deviceMemoryGB: memory,
      isLowEndDevice,
      isMobile,
      networkType,
      saveDataEnabled: saveData,
      batteryLevel,
      isBatteryCharging: isCharging
    };

    logger.debug('Device capabilities evaluated:', this.cachedCapabilities);
    return this.cachedCapabilities;
  }

  resetCache() {
    this.cachedCapabilities = null;
  }
}

export const deviceDetector = DeviceDetector.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.deviceDetector = deviceDetector;
  globalThis.UWPO.DeviceDetector = DeviceDetector;
}

