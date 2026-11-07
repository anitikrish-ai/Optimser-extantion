/**
 * Single source of truth for the bundled network rules.
 * scripts/build.mjs compiles this into static declarativeNetRequest rulesets.
 * Nothing here is fetched at runtime.
 *
 * Each entry is a DNR urlFilter plus the resource types it applies to.
 * Resource types are deliberately limited so that top-level navigations are never blocked.
 */
export type BlockListId = 'replay' | 'analytics' | 'ads';
export type RulesetId = BlockListId | 'essential';

export interface BlockEntry {
  /** DNR urlFilter, anchored to a hostname with || . */
  filter: string;
  types: string[];
}

export const BLOCK_LISTS: Record<BlockListId, BlockEntry[]> = {
  // Session replay and heatmap recorders: large scripts that continuously serialize the DOM.
  replay: [
    { filter: '||hotjar.com^', types: ['script', 'xmlhttprequest', 'ping'] },
    { filter: '||fullstory.com^', types: ['script', 'xmlhttprequest', 'ping'] },
    { filter: '||crazyegg.com^', types: ['script', 'xmlhttprequest'] },
    { filter: '||mouseflow.com^', types: ['script', 'xmlhttprequest'] },
    { filter: '||clarity.ms^', types: ['script', 'xmlhttprequest', 'ping'] }
  ],
  // Analytics and marketing tags.
  analytics: [
    { filter: '||google-analytics.com/analytics.js', types: ['script'] },
    { filter: '||google-analytics.com/g/collect', types: ['ping', 'xmlhttprequest', 'image'] },
    { filter: '||connect.facebook.net/*/fbevents.js', types: ['script'] },
    { filter: '||analytics.tiktok.com^', types: ['script', 'xmlhttprequest', 'ping'] },
    { filter: '||scorecardresearch.com^', types: ['script', 'xmlhttprequest', 'image'] },
    { filter: '||quantserve.com^', types: ['script', 'xmlhttprequest', 'image'] },
    { filter: '||mc.yandex.ru/metrika/', types: ['script', 'xmlhttprequest'] }
  ],
  // Ad and content-recommendation networks.
  ads: [
    { filter: '||doubleclick.net^', types: ['script', 'sub_frame', 'xmlhttprequest', 'ping'] },
    { filter: '||googletagservices.com^', types: ['script', 'sub_frame'] },
    { filter: '||criteo.net^', types: ['script', 'xmlhttprequest', 'image', 'sub_frame'] },
    { filter: '||outbrain.com^', types: ['script', 'xmlhttprequest', 'sub_frame'] },
    { filter: '||taboola.com^', types: ['script', 'xmlhttprequest', 'sub_frame'] },
    { filter: '||adroll.com^', types: ['script', 'xmlhttprequest'] }
  ]
};

/**
 * Hosts that provide authentication, payment and CAPTCHA functionality.
 * - Requests to them are always allowed (priority above every block rule).
 * - Pages hosted on them are never optimized.
 * - Custom block rules may not target them.
 * Entries are hostnames, optionally followed by a path prefix.
 */
export const ESSENTIAL_HOSTS: readonly string[] = [
  'accounts.google.com',
  'login.microsoftonline.com',
  'login.live.com',
  'appleid.apple.com',
  'idmsa.apple.com',
  'auth0.com',
  'okta.com',
  'stripe.com',
  'stripe.network',
  'paypal.com',
  'paypalobjects.com',
  'braintreegateway.com',
  'pay.google.com',
  'hcaptcha.com',
  'challenges.cloudflare.com',
  'recaptcha.net',
  'google.com/recaptcha',
  'gstatic.com/recaptcha'
];

/** Hosts that are never optimized when the page itself is served from them (developer convenience). */
export const LOCAL_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '[::1]'];

/** Rule id bases. Ids are globally unique across rulesets to keep rule-match attribution unambiguous. */
export const RULE_ID_BASE = {
  replay: 1000,
  analytics: 2000,
  ads: 3000,
  essential: 9000,
  sessionAllowSites: 1,
  sessionAllowTabs: 2,
  sessionCustomBase: 100
} as const;

/** Priorities: safety allow rules beat user custom rules, which beat bundled blocks. */
export const RULE_PRIORITY = {
  bundledBlock: 1,
  customBlock: 5,
  essentialAllow: 10,
  userAllow: 100
} as const;
