/**
 * Universal Website Performance Optimizer
 * Universal Browser API Abstraction Layer
 * Supports Chromium (Chrome, Edge, Brave, Opera), Firefox (Gecko), and Safari (WebKit).
 */

export class BrowserApiAdapter {
  constructor() {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    this.isFirefox = userAgent.includes('firefox');
    this.isSafari = userAgent.includes('safari') && !userAgent.includes('chrome') && !userAgent.includes('chromium');
    this.isChrome = !this.isFirefox && !this.isSafari;
  }

  static getInstance() {
    if (!BrowserApiAdapter.instance) {
      BrowserApiAdapter.instance = new BrowserApiAdapter();
    }
    return BrowserApiAdapter.instance;
  }

  getApi() {
    if (typeof chrome !== 'undefined' && chrome?.runtime) {
      return chrome;
    }
    if (typeof browser !== 'undefined' && browser?.runtime) {
      return browser;
    }
    return {};
  }

  hasDeclarativeNetRequest() {
    const api = this.getApi();
    return typeof api.declarativeNetRequest !== 'undefined';
  }

  hasSessionStorage() {
    const api = this.getApi();
    return typeof api.storage !== 'undefined' && typeof api.storage.session !== 'undefined';
  }

  async sendMessage(message) {
    const api = this.getApi();
    if (!api.runtime?.sendMessage) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        api.runtime.sendMessage(message, (response) => {
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

  async sendTabMessage(tabId, message) {
    const api = this.getApi();
    if (!api.tabs?.sendMessage || !tabId) {
      return null;
    }

    return new Promise((resolve) => {
      try {
        api.tabs.sendMessage(tabId, message, (response) => {
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

  async broadcastMessage(message) {
    const api = this.getApi();
    if (!api.tabs?.query) return;

    return new Promise((resolve) => {
      api.tabs.query({}, (tabs) => {
        if (!tabs || tabs.length === 0) {
          resolve();
          return;
        }
        let completed = 0;
        for (const tab of tabs) {
          if (tab.id && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
            api.tabs.sendMessage(tab.id, message, () => {
              // Ignore tabs without content script
              if (api.runtime.lastError) { /* ignore */ }
              completed++;
              if (completed >= tabs.length) resolve();
            });
          } else {
            completed++;
            if (completed >= tabs.length) resolve();
          }
        }
      });
    });
  }
}

export const browserApi = BrowserApiAdapter.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.browserApi = browserApi;
  globalThis.UWPO.BrowserApiAdapter = BrowserApiAdapter;
}

