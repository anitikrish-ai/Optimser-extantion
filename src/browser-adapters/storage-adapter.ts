/**
 * Universal Website Performance Optimizer
 * Session-Bound Storage Adapter
 * Strictly guarantees temporary in-memory/session-only storage with ZERO persistent tracking.
 */

import { browserApi } from './browser-api';
import { logger } from '../shared/logger';

export class SessionStorageAdapter {
  private static instance: SessionStorageAdapter;
  // In-memory fallback if chrome.storage.session is unavailable
  private memoryCache: Map<string, unknown> = new Map();

  private constructor() {}

  public static getInstance(): SessionStorageAdapter {
    if (!SessionStorageAdapter.instance) {
      SessionStorageAdapter.instance = new SessionStorageAdapter();
    }
    return SessionStorageAdapter.instance;
  }

  /**
   * Retrieves a value from temporary session storage
   */
  public async get<T>(key: string, defaultValue: T): Promise<T> {
    const api = browserApi.getApi();

    if (browserApi.hasSessionStorage()) {
      return new Promise((resolve) => {
        try {
          api.storage.session.get([key], (result) => {
            if (api.runtime?.lastError || !result || !(key in result)) {
              resolve(this.memoryCache.has(key) ? (this.memoryCache.get(key) as T) : defaultValue);
            } else {
              resolve(result[key] as T);
            }
          });
        } catch (e) {
          logger.warn(`Failed reading session storage for ${key}:`, e);
          resolve(this.memoryCache.has(key) ? (this.memoryCache.get(key) as T) : defaultValue);
        }
      });
    }

    return this.memoryCache.has(key) ? (this.memoryCache.get(key) as T) : defaultValue;
  }

  /**
   * Sets a value in temporary session storage (cleared when browser closes)
   */
  public async set<T>(key: string, value: T): Promise<void> {
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

  /**
   * Removes a specific key from session storage
   */
  public async remove(key: string): Promise<void> {
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

  /**
   * Clears all session data completely (called on reset or session termination)
   */
  public async clear(): Promise<void> {
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

