/**
 * Rendering:
 *  - pauseOffscreenAnimations: pauses INFINITE CSS animations whose element is outside the viewport
 *    (via the Web Animations API) and resumes them when they scroll back. Finite animations, transitions
 *    and on-screen animations (such as loading spinners) are never touched.
 *  - reduceEffects (extreme level only): removes backdrop-filter, which is expensive on weak GPUs.
 *    Note it can reduce the legibility of translucent overlays; that is why it is limited to "extreme".
 *
 * Animation scans are bounded: at most MAX_SCANS per page, each triggered by a timer or the first
 * scroll, never by polling.
 */
import type { ContentSettings } from '../../shared/types';
import type { ModuleCtx, OptModule } from './types';
import { Disposer } from '../lifecycle';

const STYLE_ID = 'uwpo-rendering-style';
const MAX_SCANS = 3;
const MAX_TARGETS = 300;

type AnimLike = Animation & { effect: (AnimationEffect & { target?: Element | null }) | null };

export function createRendering(ctx: ModuleCtx, s: ContentSettings['rendering']): OptModule {
  const d = new Disposer();
  const { doc, win } = ctx;
  const ours = new Set<Animation>();
  const targets = new Map<Element, Animation[]>();
  let scans = 0;
  let io: IntersectionObserver | null = null;

  const scan = () => {
    if (scans >= MAX_SCANS || doc.hidden || !io) return;
    scans++;
    const all = typeof doc.getAnimations === 'function' ? (doc.getAnimations() as AnimLike[]) : [];
    for (const a of all) {
      if (!('animationName' in a)) continue; // CSS animations only, not transitions
      const timing = a.effect?.getComputedTiming?.();
      const el = a.effect?.target;
      if (!timing || timing.iterations !== Infinity || !el) continue;
      if (!targets.has(el)) {
        if (targets.size >= MAX_TARGETS) continue;
        targets.set(el, []);
        io.observe(el);
      }
      const list = targets.get(el) as Animation[];
      if (!list.includes(a)) list.push(a);
    }
  };

  return {
    start() {
      if (s.reduceEffects && ctx.level === 'extreme') {
        const style = doc.createElement('style');
        style.id = STYLE_ID;
        style.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
        (doc.head ?? doc.documentElement).appendChild(style);
        d.add(() => style.remove());
        ctx.counts.effectsReduced = true;
      }

      if (s.pauseOffscreenAnimations && typeof win.IntersectionObserver === 'function' && typeof doc.getAnimations === 'function') {
        const margin = ctx.level === 'balanced' ? '200px' : '0px';
        io = new win.IntersectionObserver(
          (entries) => {
            for (const en of entries) {
              for (const a of targets.get(en.target) ?? []) {
                try {
                  if (!en.isIntersecting && a.playState === 'running') {
                    a.pause();
                    ours.add(a);
                    ctx.counts.animationsPausedOffscreen++;
                  } else if (en.isIntersecting && ours.has(a)) {
                    a.play();
                    ours.delete(a);
                  }
                } catch {
                  /* animation may have been cancelled by the page */
                }
              }
            }
          },
          { rootMargin: margin }
        );
        d.observer(io);
        d.timeout(win, scan, 1500);
        d.listen(win, 'scroll', () => { d.timeout(win, scan, 300); }, { once: true, passive: true });
      }
    },
    stop() {
      for (const a of ours) {
        try {
          a.play();
        } catch {
          /* ignore */
        }
      }
      ours.clear();
      targets.clear();
      io = null;
      d.dispose();
    }
  };
}
