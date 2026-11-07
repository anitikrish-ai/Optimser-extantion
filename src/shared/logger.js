/**
 * Universal Website Performance Optimizer
 * Zero-overhead local console logger
 */

export class Logger {
  constructor() {
    this.isDebug = false;
    this.prefix = '[UWPO Optimizer]';
  }

  setDebug(enabled) {
    this.isDebug = !!enabled;
  }

  debug(message, ...args) {
    if (this.isDebug) {
      console.debug(`${this.prefix} [DEBUG] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.isDebug) {
      console.info(`${this.prefix} [INFO] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    console.warn(`${this.prefix} [WARN] ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`${this.prefix} [ERROR] ${message}`, ...args);
  }
}

export const logger = new Logger();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.logger = logger;
  globalThis.UWPO.Logger = Logger;
}

