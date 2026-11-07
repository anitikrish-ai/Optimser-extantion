import type { Level } from '../../shared/types';
import type { ActionCounts } from '../../shared/measure';
import type { DomWatcher } from '../dom-watcher';
import type { Win } from '../lifecycle';

export interface ModuleCtx {
  doc: Document;
  win: Win;
  watcher: DomWatcher;
  counts: ActionCounts;
  level: Level;
}

/** Every module must be fully reversible: stop() restores the page and releases all references. */
export interface OptModule {
  start(): void;
  stop(): void;
}

export const MARK = 'data-uwpo';
