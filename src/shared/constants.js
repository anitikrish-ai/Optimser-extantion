/**
 * Universal Website Performance Optimizer
 * Shared Constants and Safe Defaults (Single Source of Truth)
 */

export const INJECTION_STYLE_ID = 'uwpo-optimized-rendering-stylesheet';

export const DEFAULT_CONFIG = {
  masterEnabled: true,
  mode: 'balanced',
  autoAdaptive: true,
  cpu: {
    enabled: true,
    throttleBackgroundTimers: true,
    throttleScrollEvents: true,
    pauseOffscreenCanvases: true,
    maxBackgroundIntervalMs: 1000
  },
  memory: {
    enabled: true,
    enableWeakRefTracking: true,
    cleanDetachedDomNodes: true,
    teardownOnUnload: true,
    periodicCleanupIntervalSec: 60
  },
  scripts: {
    enabled: true,
    blockHeavyTrackers: true,
    blockSessionReplay: true,
    blockTelemetryBeacons: true,
    protectEssentialScripts: true
  },
  images: {
    enabled: true,
    enforceLazyLoading: true,
    enforceAsyncDecoding: true,
    deferOffscreenImages: true,
    pauseAnimatedGifsOffscreen: false
  },
  videos: {
    enabled: true,
    blockAutoplay: true,
    pauseOffscreenVideos: true,
    pauseBackgroundTabVideos: true,
    suppressVideoPreviews: true
  },
  rendering: {
    enabled: true,
    reduceCssAnimations: true,
    disableExpensiveFilters: false, // Conservative in Balanced mode
    disableBackdropBlur: false,     // Conservative in Balanced mode
    disableHeavyBoxShadows: false, // Conservative in Balanced mode
    enforceReducedMotion: true
  },
  network: {
    enabled: true,
    blockKnownAdNetworks: true,
    blockTrackingPixels: true,
    blockThirdPartyFontsOnSlowNetwork: false,
    customBlockPatterns: []
  },
  dom: {
    enabled: true,
    enableContentVisibilityAuto: true,
    batchMutationObservers: true,
    throttleSubtreeScans: true
  },
  safety: {
    allowlist: [
      'localhost',
      '127.0.0.1',
      'accounts.google.com',
      'login.microsoftonline.com',
      'appleid.apple.com',
      'github.com',
      'gitlab.com',
      'auth0.com',
      'checkout.stripe.com',
      'paypal.com',
      'pay.google.com',
      'apple.com'
    ],
    emergencyDisabled: false,
    protectPaymentAndAuth: true
  }
};

/**
 * High-risk authentication and payment URL path patterns
 * Optimizations must strictly avoid interfering with these paths
 */
export const ESSENTIAL_PATH_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/signup/i,
  /\/auth/i,
  /\/oauth/i,
  /\/sso/i,
  /\/2fa/i,
  /\/mfa/i,
  /\/checkout/i,
  /\/cart/i,
  /\/payment/i,
  /\/billing/i,
  /\/pay\//i,
  /\/verify/i
];

/**
 * Essential script signatures that must never be blocked
 */
export const ESSENTIAL_SCRIPT_PATTERNS = [
  /recaptcha/i,
  /turnstile/i,
  /hcaptcha/i,
  /stripe\.com/i,
  /paypal\.com/i,
  /braintree/i,
  /checkout/i,
  /auth0/i,
  /firebase-auth/i,
  /appleid\.cdn-apple\.com/i,
  /apis\.google\.com\/js\/api\.js/i
];

/**
 * Heavy tracking, bloatware, and session recording signatures targeted for blocking
 */
export const BLOATWARE_SCRIPT_PATTERNS = [
  /hotjar\.com/i,
  /fullstory\.com/i,
  /crazyegg\.com/i,
  /mouseflow\.com/i,
  /clarity\.ms/i,
  /doubleclick\.net/i,
  /google-analytics\.com\/analytics\.js/i,
  /google-analytics\.com\/g\/collect/i,
  /googletagservices\.com/i,
  /connect\.facebook\.net\/.*\/fbevents\.js/i,
  /analytics\.tiktok\.com/i,
  /criteo\.net/i,
  /outbrain\.com/i,
  /taboola\.com/i,
  /scorecardresearch\.com/i,
  /adroll\.com/i,
  /yandex\.ru\/metrika/i
];

export const STORAGE_KEYS = {
  CONFIG: 'uwpo_config_session',
  ALLOWLIST: 'uwpo_allowlist_session',
  STATS: 'uwpo_stats_session',
  EMERGENCY_STATUS: 'uwpo_emergency_status'
};

if (typeof globalThis !== 'undefined') {
  globalThis.UWPO = globalThis.UWPO || {};
  globalThis.UWPO.INJECTION_STYLE_ID = INJECTION_STYLE_ID;
  globalThis.UWPO.DEFAULT_CONFIG = DEFAULT_CONFIG;
  globalThis.UWPO.ESSENTIAL_PATH_PATTERNS = ESSENTIAL_PATH_PATTERNS;
  globalThis.UWPO.ESSENTIAL_SCRIPT_PATTERNS = ESSENTIAL_SCRIPT_PATTERNS;
  globalThis.UWPO.BLOATWARE_SCRIPT_PATTERNS = BLOATWARE_SCRIPT_PATTERNS;
  globalThis.UWPO.STORAGE_KEYS = STORAGE_KEYS;
}

