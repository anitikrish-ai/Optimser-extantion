import type { Config, ModuleName } from '../../shared/types';

export type Path = [keyof Config, string];
export interface Opt { path: Path; label: string; note?: string; needs?: 'dnr' }
export interface Group { module: ModuleName; title: string; desc: string; opts: Opt[] }

/** Every control is declared here and bound to a config key that runtime code reads. */
export const GROUPS: Group[] = [
  { module: 'network', title: 'Network', desc: 'Blocks requests to bundled lists of trackers and ad networks through the browser, before they download.', opts: [
    { path: ['network', 'blockSessionReplay'], label: 'Block session-replay recorders', note: 'Hotjar, FullStory, Crazy Egg, Mouseflow, Clarity', needs: 'dnr' },
    { path: ['network', 'blockAnalytics'], label: 'Block analytics and marketing tags', note: 'Google Analytics, Meta Pixel, TikTok, Quantcast and similar', needs: 'dnr' },
    { path: ['network', 'blockAds'], label: 'Block ad and recommendation networks', note: 'DoubleClick, Criteo, Outbrain, Taboola and similar', needs: 'dnr' },
    { path: ['network', 'useCustomRules'], label: 'Apply my custom rules', needs: 'dnr' }
  ] },
  { module: 'images', title: 'Images', desc: 'Best effort. A request that already started cannot be cancelled, so the effect varies by page. No images are replaced or re-downloaded.', opts: [
    { path: ['images', 'lazyLoading'], label: 'Lazy-load images below the first screen that have not started loading' },
    { path: ['images', 'asyncDecoding'], label: 'Decode images off the main thread' }
  ] },
  { module: 'videos', title: 'Videos', desc: 'Only muted videos are paused automatically. Audible playback and Picture-in-Picture are never interrupted.', opts: [
    { path: ['videos', 'blockAutoplay'], label: 'Pause videos that start before you interact with the page', note: 'Click a paused video to start it.' },
    { path: ['videos', 'pauseOffscreen'], label: 'Pause muted videos that scroll out of view' },
    { path: ['videos', 'pauseInBackground'], label: 'Pause muted videos in background tabs' }
  ] },
  { module: 'rendering', title: 'Rendering', desc: 'Conservative reduction of animation and effect work.', opts: [
    { path: ['rendering', 'pauseOffscreenAnimations'], label: 'Pause endless CSS animations while they are off-screen', note: 'On-screen animations and spinners are not touched.' },
    { path: ['rendering', 'reduceEffects'], label: 'Remove backdrop blur (Extreme level only)', note: 'Can make translucent overlays harder to read.' }
  ] },
  { module: 'dom', title: 'DOM', desc: 'Lets the browser skip rendering large sections far below the fold.', opts: [
    { path: ['dom', 'contentVisibility'], label: 'Apply content-visibility: auto to large sections below the fold', note: 'Sections containing forms, navigation, dialogs or frames are skipped.' }
  ] }
];

