/**
 * Videos: autoplay guard, off-screen pause, background-tab pause.
 *
 * Safety rules:
 *  - Only MUTED videos (or volume 0) are paused for being off-screen or in a background tab. Audible
 *    playback is never interrupted.
 *  - Picture-in-Picture videos are never paused.
 *  - A video is resumed only if WE paused it and the page/user has not paused it since.
 *  - "Autoplay" means a video that starts playing before any user interaction on the page.
 *  - stop() resumes everything we paused, restoring native behaviour.
 */
import type { ContentSettings } from '../../shared/types';
import type { ModuleCtx, OptModule } from './types';
import { Disposer } from '../lifecycle';

const ATTR = 'data-uwpo-paused';
type Why = 'autoplay' | 'offscreen' | 'background';

export function createVideos(ctx: ModuleCtx, s: ContentSettings['videos']): OptModule {
  const d = new Disposer();
  const { doc, win } = ctx;
  const expectPause = new WeakSet<HTMLVideoElement>();
  let userActive = !!(win.navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;

  const isMutedPlaying = (v: HTMLVideoElement) =>
    !v.paused && !v.ended && (v.muted || v.volume === 0) && (doc as Document & { pictureInPictureElement?: Element | null }).pictureInPictureElement !== v;

  const pauseOurs = (v: HTMLVideoElement, why: Why) => {
    if (v.paused) return;
    expectPause.add(v);
    v.setAttribute(ATTR, why);
    v.pause();
    if (why === 'autoplay') ctx.counts.videosAutoplayPaused++;
    else if (why === 'offscreen') ctx.counts.videosOffscreenPaused++;
    else ctx.counts.videosBackgroundPaused++;
  };

  const resume = (v: HTMLVideoElement) => {
    v.removeAttribute(ATTR);
    void v.play().catch(() => undefined);
  };

  return {
    start() {
      if (!userActive) {
        const mark = () => {
          userActive = true;
          for (const t of ['pointerdown', 'keydown', 'touchstart']) doc.removeEventListener(t, mark, true);
        };
        for (const t of ['pointerdown', 'keydown', 'touchstart']) {
          d.listen(doc, t, mark, { capture: true, passive: true });
        }
      }

      // Distinguish our pauses from the user's or the page's own pauses.
      d.listen(
        doc,
        'pause',
        (e) => {
          const v = e.target;
          if (!(v instanceof win.HTMLVideoElement)) return;
          if (expectPause.has(v)) expectPause.delete(v);
          else v.removeAttribute(ATTR);
        },
        true
      );

      if (s.blockAutoplay) {
        d.listen(
          doc,
          'play',
          (e) => {
            const v = e.target;
            if (!(v instanceof win.HTMLVideoElement) || userActive) return;
            pauseOurs(v, 'autoplay');
            if (!v.controls) {
              // Without controls there is no other way to start it: let a click do so.
              v.addEventListener('click', () => resume(v), { once: true });
            }
          },
          true
        );
      }

      if (s.pauseOffscreen && typeof win.IntersectionObserver === 'function') {
        const io = new win.IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              const v = en.target as HTMLVideoElement;
              if (!en.isIntersecting) {
                if (isMutedPlaying(v)) pauseOurs(v, 'offscreen');
              } else if (v.getAttribute(ATTR) === 'offscreen') {
                resume(v);
              }
            }
          },
          { rootMargin: '100px' }
        );
        d.observer(io);
        ctx.watcher.subscribe('video', (els) => els.forEach((v) => io.observe(v)));
      }

      if (s.pauseInBackground) {
        d.listen(doc, 'visibilitychange', () => {
          if (doc.hidden) {
            for (const v of Array.from(doc.querySelectorAll('video'))) if (isMutedPlaying(v)) pauseOurs(v, 'background');
          } else {
            for (const v of Array.from(doc.querySelectorAll(`video[${ATTR}="background"]`))) resume(v as HTMLVideoElement);
          }
        });
      }
    },
    stop() {
      d.dispose();
      for (const v of Array.from(doc.querySelectorAll(`video[${ATTR}]`))) resume(v as HTMLVideoElement);
    }
  };
}
