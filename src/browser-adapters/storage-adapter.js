/**
 * Universal Website Performance Optimizer
 * Session-Bound Storage Adapter
 * Strictly guarantees temporary in-memory/session-only storage with ZERO persistent tracking.
 */

import { browserApi } from './browser-api.js';
import { logger } from '../shared/logger.js';

export class SessionStorageAdapter {
  constructor() {
    this.memoryCache = new Map();
  }

  static getInstance() {
    if (!SessionStorageAdapter.instance) {
      SessionStorageAdapter.instance = new SessionStorageAdapter();
    }
    return SessionStorageAdapter.instance;
  }

  async get(key, defaultValue) {
    const api = browserApi.getApi();

    if (browserApi.hasSessionStorage()) {
      return new Promise((resolve) => {
        try {
          api.storage.session.get([key], (result) => {
            if (api.runtime?.lastError || !result || !(key in result)) {
              resolve(this.memoryCache.has(key) ? this.memoryCache.get(key) : defaultValue);
            } else {
              resolve(result[key]);
            }
          });
        } catch (e) {
          logger.warn(`Failed reading session storage for ${key}:`, e);
          resolve(this.memoryCache.has(key) ? this.memoryCache.get(key) : defaultValue);
        }
      });
    }

    return this.memoryCache.has(key) ? this.memoryCache.get(key) : defaultValue;
  }

  async set(key, value) {
    this.memoryCache.set(key, value);
    const api = browserApi.getApi();

    if (browserApi.hasSessionStorage()) {
      return new Promise((resolve) => {
        try {
          api.storage.session.set({ [key]: value }, () => {
            resolve();
          });
        } catch (e) {
          logger.warn(`Failed writing session storage for ${key}:`, e);
          resolve();
        }
      });
    }
  }

  async remove(key) {
    this.memoryCache.delete(key);
    const api = browserApi.getApi();

    if (browserApi.hasSessionStorage()) {
      return new Promise((resolve) => {
        try {
          api.storage.session.remove([key], () => {
            resolve();
          });
        } catch {
          resolve();
        }
      });
    }
  }

  async clear() {
    this.memoryCache.clear();
    const api = browserApi.getApi();

    if (browserApi.hasSessionStorage()) {
      return new Promise((resolve) => {
        try {
          api.storage.session.clear(() => {
            logger.info('Session storage completely purged.');
            resolve();
          });
        } catch {
          resolve();
        }
      });
    }
  }
}

export const sessionStorage = SessionStorageAdapter.getInstance();

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.sessionStorage = sessionStorage;
  globalThis.UWPO.SessionStorageAdapter = SessionStorageAdapter;
}

