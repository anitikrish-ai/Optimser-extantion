/**
 * DOM: content-visibility:auto on large sections that are well below the fold, so the browser can
 * skip their rendering work until they approach the viewport.
 *
 * Known risk (documented): content-visibility applies layout and paint containment, which clips
 * overflowing descendants and makes the element a containing block for fixed-position descendants.
 * We therefore skip elements that contain forms, navigation, dialogs, iframes, or that are themselves
 * fixed/sticky, and only touch elements at least MIN_HEIGHT tall.
 *
 * Reversibility: previous inline values are saved and restored in stop().
 */
import type { ContentSettings } from '../../shared/types';
import type { ModuleCtx, OptModule } from './types';

const MIN_HEIGHT = 200;
const MAX_ELEMENTS = 400;
const UNSAFE_DESCENDANTS =
  'form,input,select,textarea,nav,header,dialog,iframe,[role="dialog"],[role="navigation"],[aria-modal="true"],[popover]';

export function createDom(ctx: ModuleCtx, s: ContentSettings['dom']): OptModule {
  const seen = new WeakSet<Element>();
  const applied = new Map<HTMLElement, { cv: string; cih: string; hadStyleAttr: boolean }>();
  const vh = () => ctx.win.innerHeight || 800;
  const selector =
    ctx.level === 'balanced'
      ? 'main > section, article, aside, footer'
      : ctx.level === 'performance'
        ? 'section, article, aside, footer'
        : 'section, article, aside, footer, main > div';
  const foldFactor = ctx.level === 'balanced' ? 2 : 1;

  const handle = (els: Element[]) => {
    const candidates: Array<{ el: HTMLElement; h: number }> = [];
    for (const el of els) {
      if (!(el instanceof ctx.win.HTMLElement) || seen.has(el) || applied.size + candidates.length >= MAX_ELEMENTS) continue;
      seen.add(el);
      if (el.querySelector(UNSAFE_DESCENDANTS)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.height < MIN_HEIGHT || rect.top <= vh() * foldFactor) continue;
      const pos = ctx.win.getComputedStyle(el).position;
      if (pos === 'fixed' || pos === 'sticky') continue;
      candidates.push({ el, h: Math.round(rect.height) });
    }
    for (const { el, h } of candidates) {
      applied.set(el, {
        cv: el.style.getPropertyValue('content-visibility'),
        cih: el.style.getPropertyValue('contain-intrinsic-height'),
        hadStyleAttr: el.hasAttribute('style')
      });
      el.style.setProperty('content-visibility', 'auto');
      el.style.setProperty('contain-intrinsic-height', `auto ${h}px`);
      ctx.counts.sectionsDeferred++;
    }
  };

  return {
    start() {
      if (!s.contentVisibility) return;
      if (!ctx.win.CSS?.supports?.('content-visibility', 'auto')) return; // unsupported engine: do nothing
      ctx.watcher.subscribe(selector, handle);
    },
    stop() {
      for (const [el, prev] of applied) {
        if (prev.cv) el.style.setProperty('content-visibility', prev.cv);
        else el.style.removeProperty('content-visibility');
        if (prev.cih) el.style.setProperty('contain-intrinsic-height', prev.cih);
        else el.style.removeProperty('contain-intrinsic-height');
        // Leave no empty style="" residue on elements that had none.
        if (!prev.hadStyleAttr && el.getAttribute('style') === '') el.removeAttribute('style');
      }
      applied.clear();
    }
  };
}
