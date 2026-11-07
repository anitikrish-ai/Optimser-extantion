/**
 * Universal Website Performance Optimizer
 * Zero-overhead local console logger (no external transmission)
 */

class Logger {
  private isDebug = false;
  private readonly prefix = '[UWPO Optimizer]';

  public setDebug(enabled: boolean): void {
    this.isDebug = enabled;
  }

  public debug(message: string, ...args: unknown[]): void {
    if (this.isDebug) {
      console.debug(`${this.prefix} [DEBUG] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: unknown[]): void {
    if (this.isDebug) {
      console.info(`${this.prefix} [INFO] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: unknown[]): void {
    console.warn(`${this.prefix} [WARN] ${message}`, ...args);
  }

  public error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} [ERROR] ${message}`, ...args);
  }
}

export const logger = new Logger();

