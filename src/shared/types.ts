/**
 * Universal Website Performance Optimizer
 * Core Type Definitions
 */

export type OptimizationMode = 'balanced' | 'performance' | 'extreme' | 'adaptive_custom';

export type NetworkConditionType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

export interface DeviceCapabilities {
  hardwareConcurrency: number;
  deviceMemoryGB: number | null;
  isLowEndDevice: boolean;
  isMobile: boolean;
  networkType: NetworkConditionType;
  saveDataEnabled: boolean;
  batteryLevel: number | null;
  isBatteryCharging: boolean | null;
}

export interface PageWorkloadMetrics {
  domNodeCount: number;
  scriptCount: number;
  stylesheetCount: number;
  imageCount: number;
  videoCount: number;
  iframeCount: number;
  longTasksCount: number;
  totalLongTaskDurationMs: number;
}

export interface LivePerformanceStats {
  navigationStart: number;
  domContentLoadedMs: number;
  loadEventMs: number;
  jsHeapUsedMB: number | null;
  jsHeapTotalMB: number | null;
  jsHeapLimitMB: number | null;
  totalRequests: number;
  blockedRequests: number;
  transferredBytes: number;
  estimatedSavedBytes: number;
  fpsEstimate: number;
  activeModulesCount: number;
  isOptimized: boolean;
  mode: OptimizationMode;
}

export interface CpuOptimizationSettings {
  enabled: boolean;
  throttleBackgroundTimers: boolean;
  throttleScrollEvents: boolean;
  pauseOffscreenCanvases: boolean;
  maxBackgroundIntervalMs: number;
}

export interface MemoryOptimizationSettings {
  enabled: boolean;
  enableWeakRefTracking: boolean;
  cleanDetachedDomNodes: boolean;
  teardownOnUnload: boolean;
  periodicCleanupIntervalSec: number;
}

export interface ScriptOptimizationSettings {
  enabled: boolean;
  blockHeavyTrackers: boolean;
  blockSessionReplay: boolean;
  blockTelemetryBeacons: boolean;
  protectEssentialScripts: boolean;
}

export interface ImageOptimizationSettings {
  enabled: boolean;
  enforceLazyLoading: boolean;
  enforceAsyncDecoding: boolean;
  deferOffscreenImages: boolean;
  pauseAnimatedGifsOffscreen: boolean;
}

export interface VideoOptimizationSettings {
  enabled: boolean;
  blockAutoplay: boolean;
  pauseOffscreenVideos: boolean;
  pauseBackgroundTabVideos: boolean;
  suppressVideoPreviews: boolean;
}

export interface RenderingOptimizationSettings {
  enabled: boolean;
  reduceCssAnimations: boolean;
  disableExpensiveFilters: boolean;
  disableBackdropBlur: boolean;
  disableHeavyBoxShadows: boolean;
  enforceReducedMotion: boolean;
}

export interface NetworkOptimizationSettings {
  enabled: boolean;
  blockKnownAdNetworks: boolean;
  blockTrackingPixels: boolean;
  blockThirdPartyFontsOnSlowNetwork: boolean;
  customBlockPatterns: string[];
}

export interface DomOptimizationSettings {
  enabled: boolean;
  enableContentVisibilityAuto: boolean;
  batchMutationObservers: boolean;
  throttleSubtreeScans: boolean;
}

export interface OptimizerConfiguration {
  masterEnabled: boolean;
  mode: OptimizationMode;
  autoAdaptive: boolean;
  cpu: CpuOptimizationSettings;
  memory: MemoryOptimizationSettings;
  scripts: ScriptOptimizationSettings;
  images: ImageOptimizationSettings;
  videos: VideoOptimizationSettings;
  rendering: RenderingOptimizationSettings;
  network: NetworkOptimizationSettings;
  dom: DomOptimizationSettings;
  safety: {
    allowlist: string[];
    emergencyDisabled: boolean;
    protectPaymentAndAuth: boolean;
  };
}

export interface TabSessionState {
  tabId: number;
  url: string;
  hostname: string;
  isAllowlisted: boolean;
  isProtectedAuthSite: boolean;
  activeMode: OptimizationMode;
  stats: LivePerformanceStats;
  workload: PageWorkloadMetrics;
  device: DeviceCapabilities;
  appliedOptimizations: string[];
  lastUpdated: number;
}

export type MessageAction =
  | 'GET_TAB_STATE'
  | 'TAB_STATE_RESPONSE'
  | 'SET_MASTER_ENABLED'
  | 'SET_MODE'
  | 'SET_MODULE_ENABLED'
  | 'UPDATE_CONFIG'
  | 'TOGGLE_ALLOWLIST'
  | 'EMERGENCY_RESET'
  | 'REPORT_PAGE_METRICS'
  | 'GET_DEVICE_DIAGNOSTICS'
  | 'CLEAR_SESSION_STATE';

export interface ExtensionMessage<T = unknown> {
  action: MessageAction;
  tabId?: number;
  payload?: T;
}

