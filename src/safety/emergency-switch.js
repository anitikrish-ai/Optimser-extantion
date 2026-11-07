/**
 * Universal Website Performance Optimizer
 * Emergency Kill Switch & Instant Page Reset
 * Completely tears down all active optimizations and restores native browser behavior immediately.
 */

import { INJECTION_STYLE_ID } from '../shared/constants.js';
import { logger } from '../shared/logger.js';

export class EmergencySwitch {
  constructor() {
    this.isDisarmed = false;
    this.teardownCallbacks = new Set();
  }

  static getInstance() {
    if (!EmergencySwitch.instance) {
      EmergencySwitch.instance = new EmergencySwitch();
    }
    return EmergencySwitch.instance;
  }

  registerTeardown(callback) {
    if (typeof callback === 'function') {
      this.teardownCallbacks.add(callback);
    }
  }

  unregisterTeardown(callback) {
    this.teardownCallbacks.delete(callback);
  }

  triggerEmergencyReset() {
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

  isEmergencyDisarmed() {
    return this.isDisarmed;
  }

  resetDisarmState() {
    this.isDisarmed = false;
  }
}

export const emergencySwitch = EmergencySwitch.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.emergencySwitch = emergencySwitch;
  globalThis.UWPO.EmergencySwitch = EmergencySwitch;
}

