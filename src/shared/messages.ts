/**
 * Message protocol between content scripts, background and extension pages.
 *
 * Security model:
 *  - Only extension contexts can message the background (no externally_connectable).
 *  - Every message is parsed by parseRequest(); anything malformed is rejected.
 *  - Privileged requests (anything that changes configuration or tab state) are accepted only from
 *    extension pages, never from content scripts. A compromised renderer therefore cannot change settings.
 */
import type { Config, Plan } from './types';
import type { Measurement, PageSample, ActionCounts } from './measure';
import type { MessageSenderLite } from '../adapters/ext';

export type SenderKind = 'content' | 'extension-page' | 'unknown';

export type Request =
  | { type: 'GET_PLAN' }
  | { type: 'REPORT_SAMPLE'; sample: PageSample; runId: string | null }
  | { type: 'SAFETY_TRIP'; reason: 'sensitive-input' | 'essential-path' }
  | { type: 'GET_STATE'; tabId: number | null; skipBlocked: boolean }
  | { type: 'SET_CONFIG'; config: unknown }
  | { type: 'TAB_PAUSE'; tabId: number }
  | { type: 'TAB_RESUME'; tabId: number }
  | { type: 'COMPARE_START'; tabId: number }
  | { type: 'COMPARE_CANCEL'; tabId: number }
  | { type: 'REQUEST_SAMPLE'; tabId: number }
  | { type: 'CLEAR_SESSION' }
  | { type: 'RESET_ALL' };

export type RequestType = Request['type'];

/** Messages the background sends to content scripts. */
export type ContentCommand = { type: 'PLAN_CHANGED' } | { type: 'RESTORE_NOW' } | { type: 'SAMPLE_NOW' };

export const CONTENT_ALLOWED: ReadonlySet<RequestType> = new Set<RequestType>(['GET_PLAN', 'REPORT_SAMPLE', 'SAFETY_TRIP']);

export function classifySender(sender: MessageSenderLite | undefined, extId: string | undefined, extBaseUrl: string): SenderKind {
  if (!sender || !extId || sender.id !== extId) return 'unknown';
  if (typeof sender.url === 'string' && sender.url.startsWith(extBaseUrl)) return 'extension-page';
  if (sender.tab && typeof sender.tab.id === 'number' && sender.frameId === 0) return 'content';
  return 'unknown';
}

export function isAuthorized(type: RequestType, kind: SenderKind): boolean {
  if (kind === 'extension-page') return true;
  if (kind === 'content') return CONTENT_ALLOWED.has(type);
  return false;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isTabId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;

export function parseRequest(raw: unknown): Request | null {
  if (!isObj(raw) || typeof raw.type !== 'string') return null;
  switch (raw.type) {
    case 'GET_PLAN':
    case 'CLEAR_SESSION':
    case 'RESET_ALL':
      return { type: raw.type };
    case 'REPORT_SAMPLE': {
      const sample = sanitizeSample(raw.sample);
      if (!sample) return null;
      const runId = typeof raw.runId === 'string' && raw.runId.length <= 64 ? raw.runId : null;
      return { type: 'REPORT_SAMPLE', sample, runId };
    }
    case 'SAFETY_TRIP':
      return raw.reason === 'sensitive-input' || raw.reason === 'essential-path'
        ? { type: 'SAFETY_TRIP', reason: raw.reason }
        : null;
    case 'GET_STATE':
      return { type: 'GET_STATE', tabId: isTabId(raw.tabId) ? raw.tabId : null, skipBlocked: raw.skipBlocked === true };
    case 'SET_CONFIG':
      return { type: 'SET_CONFIG', config: raw.config };
    case 'TAB_PAUSE':
    case 'TAB_RESUME':
    case 'COMPARE_START':
    case 'COMPARE_CANCEL':
    case 'REQUEST_SAMPLE':
      return isTabId(raw.tabId) ? { type: raw.type, tabId: raw.tabId } : null;
    default:
      return null;
  }
}

// ---------- sample validation ----------

const MAX_TEXT = 200;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12;

function sanitizeMeasurement(raw: unknown): Measurement<number> | null {
  if (!isObj(raw)) return null;
  if (raw.state === 'measured' && finite(raw.value)) {
    return typeof raw.note === 'string'
      ? { state: 'measured', value: raw.value, note: raw.note.slice(0, MAX_TEXT) }
      : { state: 'measured', value: raw.value };
  }
  if (raw.state === 'estimated' && finite(raw.value) && typeof raw.method === 'string' && raw.method.trim()) {
    return { state: 'estimated', value: raw.value, method: raw.method.slice(0, MAX_TEXT) };
  }
  if (raw.state === 'unavailable' && typeof raw.reason === 'string') {
    return { state: 'unavailable', reason: raw.reason.slice(0, MAX_TEXT) };
  }
  return null;
}

const MEASUREMENT_KEYS = [
  'ttfbMs', 'domContentLoadedMs', 'loadMs', 'fcpMs', 'lcpMs', 'requestCount', 'transferredBytes',
  'sizeHiddenResources', 'domNodes', 'longTaskCount', 'longTaskTotalMs', 'jsHeapUsedMB', 'selfTimeMs'
] as const;

const ACTION_NUMBER_KEYS = [
  'imagesLazy', 'imagesAsyncDecode', 'videosAutoplayPaused', 'videosOffscreenPaused',
  'videosBackgroundPaused', 'animationsPausedOffscreen', 'sectionsDeferred'
] as const;

export function sanitizeSample(raw: unknown): PageSample | null {
  if (!isObj(raw)) return null;
  if (!finite(raw.takenAtEpochMs) || !finite(raw.timeOriginEpochMs)) return null;
  if (typeof raw.optimizerActive !== 'boolean' || typeof raw.selfLimited !== 'boolean') return null;
  const level = raw.level === 'balanced' || raw.level === 'performance' || raw.level === 'extreme' ? raw.level : null;
  if (!isObj(raw.actions)) return null;

  const out: Record<string, unknown> = {};
  for (const key of MEASUREMENT_KEYS) {
    const m = sanitizeMeasurement(raw[key]);
    if (!m) return null;
    out[key] = m;
  }
  const actions = {} as Record<string, unknown>;
  for (const k of ACTION_NUMBER_KEYS) {
    const v = raw.actions[k];
    if (!finite(v) || v < 0) return null;
    actions[k] = v;
  }
  if (typeof raw.actions.effectsReduced !== 'boolean') return null;
  actions.effectsReduced = raw.actions.effectsReduced;

  return {
    takenAtEpochMs: raw.takenAtEpochMs,
    timeOriginEpochMs: raw.timeOriginEpochMs,
    optimizerActive: raw.optimizerActive,
    level,
    selfLimited: raw.selfLimited,
    actions: actions as unknown as ActionCounts,
    ...(out as Pick<PageSample, (typeof MEASUREMENT_KEYS)[number]>)
  };
}

// ---------- responses ----------

export interface TabView {
  tabId: number;
  host: string | null;
  plan: { active: boolean; reason: Plan['reason']; mode: Plan['mode'] } | null;
  bypass: 'user' | 'compare' | 'safety' | null;
  sample: PageSample | null;
  compare: CompareView | null;
  blockedRequests: Measurement<number>;
}

export interface CompareView {
  runId: string;
  phase: 'baseline' | 'optimized' | 'done' | 'failed';
  baseline: PageSample | null;
  optimized: PageSample | null;
  error: string | null;
  startedAt: number;
}

export interface StateView {
  config: Config;
  caps: import('../adapters/ext').Capabilities;
  warnings: string[];
  tab: TabView | null;
}

export interface Ack {
  ok: boolean;
  error?: string;
  issues?: string[];
  warnings?: string[];
}
