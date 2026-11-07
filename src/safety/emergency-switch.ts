/**
 * Universal Website Performance Optimizer
 * Emergency Kill Switch & Instant Page Reset
 * Completely tears down all active optimizations and restores native browser behavior immediately.
 */

import { INJECTION_STYLE_ID } from '../shared/constants';
import { logger } from '../shared/logger';

export class EmergencySwitch {
  private static instance: EmergencySwitch;
  private isDisarmed = false;
  private teardownCallbacks: Set<() => void> = new Set();

  private constructor() {}

  public static getInstance(): EmergencySwitch {
    if (!EmergencySwitch.instance) {
      EmergencySwitch.instance = new EmergencySwitch();
    }
    return EmergencySwitch.instance;
  }

  /**
   * Registers a cleanup callback to be executed during emergency reset
   */
  public registerTeardown(callback: () => void): void {
    this.teardownCallbacks.add(callback);
  }

  /**
   * Unregisters a cleanup callback
   */
  public unregisterTeardown(callback: () => void): void {
    this.teardownCallbacks.delete(callback);
  }

  /**
   * Executes emergency reset across the current page
   */
  public triggerEmergencyReset(): void {
    this.isDisarmed = true;
    logger.warn('EMERGENCY KILL SWITCH TRIGGERED: Disarming all active optimizations.');

    // 1. Remove all injected optimization CSS
    if (typeof document !== 'undefined') {
      const injectedStyle = document.getElementById(INJECTION_STYLE_ID);
      if (injectedStyle?.parentNode) {
        injectedStyle.parentNode.removeChild(injectedStyle);
        logger.info('Removed injected performance stylesheet.');
      }
    }

    // 2. Execute all registered module teardowns
    for (const teardown of this.teardownCallbacks) {
      try {
        teardown();
      } catch (err) {
        logger.error('Error during module teardown:', err);
      }
    }

    this.teardownCallbacks.clear();
    logger.info('Emergency reset complete. Page restored to default browser behavior.');
  }

  public isEmergencyDisarmed(): boolean {
    return this.isDisarmed;
  }

  public resetDisarmState(): void {
    this.isDisarmed = false;
  }
}

export const emergencySwitch = EmergencySwitch.getInstance();

