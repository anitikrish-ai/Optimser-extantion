/**
 * Universal Website Performance Optimizer
 * Device & Hardware Capability Detector
 * Detects real device specifications using standard Web APIs without fingerprinting or external calls.
 */

import { DeviceCapabilities, NetworkConditionType } from '../shared/types';
import { logger } from '../shared/logger';

interface NetworkInformation extends EventTarget {
  effectiveType?: NetworkConditionType;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
}

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
}

export class DeviceDetector {
  private static instance: DeviceDetector;
  private cachedCapabilities: DeviceCapabilities | null = null;

  private constructor() {}

  public static getInstance(): DeviceDetector {
    if (!DeviceDetector.instance) {
      DeviceDetector.instance = new DeviceDetector();
    }
    return DeviceDetector.instance;
  }

  /**
   * Evaluates the current hardware and platform environment
   */
  public async getCapabilities(): Promise<DeviceCapabilities> {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    const concurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;

    // deviceMemory is an experimental standard API in Chromium (returns GiB: 0.25, 0.5, 1, 2, 4, 8)
    const memory =
      typeof navigator !== 'undefined' && 'deviceMemory' in navigator
        ? (navigator as unknown as { deviceMemory: number }).deviceMemory
        : null;

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isMobile =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent) ||
      (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

    // Network Information API
    let networkType: NetworkConditionType = 'unknown';
    let saveData = false;

    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as unknown as { connection: NetworkInformation }).connection;
      if (conn?.effectiveType) {
        networkType = conn.effectiveType;
      }
      if (typeof conn?.saveData === 'boolean') {
        saveData = conn.saveData;
      }
    }

    // Battery Status API (where supported)
    let batteryLevel: number | null = null;
    let isCharging: boolean | null = null;

    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const getBattery = (navigator as unknown as { getBattery: () => Promise<BatteryManager> }).getBattery;
        const battery = await getBattery();
        batteryLevel = Math.round(battery.level * 100);
        isCharging = battery.charging;
      } catch {
        // Ignored if battery API is rejected by permissions or unsupported
      }
    }

    // Comprehensive low-end device classification based on W3C & WebPerf standards
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

  /**
   * Resets the cached detection state (e.g. if network or battery changes)
   */
  public resetCache(): void {
    this.cachedCapabilities = null;
  }
}

export const deviceDetector = DeviceDetector.getInstance();

