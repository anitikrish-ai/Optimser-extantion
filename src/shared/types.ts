/**
 * Shared type definitions. Everything that crosses a module or process boundary
 * (background, content script, popup, options) is described here.
 */

/** What the user picks. "adaptive" lets the adaptive engine choose a Level. */
export type ModeSetting = 'adaptive' | 'balanced' | 'performance' | 'extreme';
/** The concrete intensity that is actually applied to a page. */
export type Level = 'balanced' | 'performance' | 'extreme';

export const MODE_SETTINGS: readonly ModeSetting[] = ['adaptive', 'balanced', 'performance', 'extreme'];
export const LEVELS: readonly Level[] = ['balanced', 'performance', 'extreme'];

export interface ModuleFlags {
  network: boolean;
  images: boolean;
  videos: boolean;
  rendering: boolean;
  dom: boolean;
}
export type ModuleName = keyof ModuleFlags;
export const MODULE_NAMES: readonly ModuleName[] = ['network', 'images', 'videos', 'rendering', 'dom'];

export interface NetworkOptions {
  blockSessionReplay: boolean;
  blockAnalytics: boolean;
  blockAds: boolean;
  useCustomRules: boolean;
}
export interface ImageOptions {
  lazyLoading: boolean;
  asyncDecoding: boolean;
}
export interface VideoOptions {
  blockAutoplay: boolean;
  pauseOffscreen: boolean;
  pauseInBackground: boolean;
}
export interface RenderingOptions {
  pauseOffscreenAnimations: boolean;
  /** Takes effect only at the "extreme" level. */
  reduceEffects: boolean;
}
export interface DomOptions {
  contentVisibility: boolean;
}

export interface SiteOverride {
  mode?: ModeSetting;
  modules?: Partial<ModuleFlags>;
}

export interface Config {
  schema: 2;
  /** Master switch. Off means nothing runs and all bundled rulesets are disabled. */
  enabled: boolean;
  mode: ModeSetting;
  modules: ModuleFlags;
  network: NetworkOptions;
  images: ImageOptions;
  videos: VideoOptions;
  rendering: RenderingOptions;
  dom: DomOptions;
  /** User-managed hostnames that are never optimized (subdomains included). */
  allowlist: string[];
  /** Validated custom block patterns (see custom-rules.ts). */
  customRules: string[];
  /** Per-site overrides keyed by normalized hostname. */
  sites: Record<string, SiteOverride>;
}

/** Why optimization is not running on a page. */
export type OffReason =
  | 'master-off'
  | 'unsupported-page'
  | 'builtin-protected'
  | 'allowlisted'
  | 'essential-path'
  | 'tab-paused'
  | 'compare-baseline'
  | 'sensitive-input';

export interface ContentSettings {
  images: { enabled: boolean } & ImageOptions;
  videos: { enabled: boolean } & VideoOptions;
  rendering: { enabled: boolean } & RenderingOptions;
  dom: { enabled: boolean } & DomOptions;
}

/** What the background hands to a content script for one page load. */
export interface Plan {
  active: boolean;
  reason: OffReason | null;
  mode: ModeSetting;
  settings: ContentSettings;
  /** Whether the content script should take a one-shot sample automatically. */
  autoSample: 'none' | 'adaptive' | 'compare';
  runId: string | null;
}
