/**
 * Universal Website Performance Optimizer
 * Universal Browser API Abstraction Layer
 * Supports Chromium (Chrome, Edge, Brave, Opera), Firefox (Gecko), and Safari (WebKit).
 */

declare const browser: typeof chrome | undefined;

export class BrowserApiAdapter {
  private static instance: BrowserApiAdapter;
  public readonly isChrome: boolean;
  public readonly isFirefox: boolean;
  public readonly isSafari: boolean;

  private constructor() {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    this.isFirefox = userAgent.includes('firefox');
    this.isSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('chromium');
    this.isChrome = !this.isFirefox && !this.isSafari;
  }

  public static getInstance(): BrowserApiAdapter {
    if (!BrowserApiAdapter.instance) {
      BrowserApiAdapter.instance = new BrowserApiAdapter();
    }
    return BrowserApiAdapter.instance;
  }

  /**
   * Safely gets the active browser namespace (chrome or browser)
   */
  public getApi(): typeof chrome {
    if (typeof chrome !== 'undefined' && chrome?.runtime) {
      return chrome;
    }
    if (typeof browser !== 'undefined' && browser?.runtime) {
      return browser as typeof chrome;
    }
    // Fallback stub for unit test environments
    return {} as typeof chrome;
  }

  /**
   * Checks if declarativeNetRequest API is available
   */
  public hasDeclarativeNetRequest(): boolean {
    const api = this.getApi();
    return typeof api.declarativeNetRequest !== 'undefined';
  }

  /**
   * Checks if session storage API is available
   */
  public hasSessionStorage(): boolean {
    const api = this.getApi();
    return typeof api.storage !== 'undefined' && typeof api.storage.session !== 'undefined';
  }

  /**
   * Safely sends a runtime message with fallback
   */
  public async sendMessage<T = unknown, R = unknown>(message: T): Promise<R | null> {
    const api = this.getApi();
    if (!api.runtime?.sendMessage) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        api.runtime.sendMessage(message, (response: R) => {
          if (api.runtime.lastError) {
            // Silently resolve null if port is closed or background inactive
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Safely sends a message to a specific tab
   */
  public async sendTabMessage<T = unknown, R = unknown>(tabId: number, message: T): Promise<R | null> {
    const api = this.getApi();
    if (!api.tabs?.sendMessage) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        api.tabs.sendMessage(tabId, message, (response: R) => {
          if (api.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }
}

export const browserApi = BrowserApiAdapter.getInstance();

