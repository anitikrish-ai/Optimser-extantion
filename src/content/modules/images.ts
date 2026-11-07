/**
 * Images: native lazy loading and async decoding, best effort.
 *
 * Honest limitation: setting loading="lazy" cannot cancel a request the browser has already started.
 * It helps for images that have not started loading yet (for example images inserted without a src
 * and given one later, or images the browser deferred itself). No replacement images are downloaded
 * and no image data is modified.
 *
 * Reversibility: every attribute we add is tagged with data-uwpo-img and removed again in stop(),
 * but only if the page has not changed it since.
 */
import type { ContentSettings } from '../../shared/types';
import type { ModuleCtx, OptModule } from './types';

const ATTR = 'data-uwpo-img';

export function createImages(ctx: ModuleCtx, s: ContentSettings['images']): OptModule {
  const seen = new WeakSet<Element>();
  const vh = () => ctx.win.innerHeight || 800;

  const handle = (els: Element[]) => {
    const fresh = els.filter((e): e is HTMLImageElement => e.tagName === 'IMG' && !seen.has(e));
    // Read phase (layout reads), then write phase, to avoid layout thrashing.
    const plan = fresh.map((img) => {
      seen.add(img);
      const wantsLazy =
        s.lazyLoading &&
        !img.hasAttribute('loading') &&
        img.getAttribute('fetchpriority') !== 'high' &&
        !img.complete &&
        img.getBoundingClientRect().top > vh();
      const wantsAsync = s.asyncDecoding && !img.hasAttribute('decoding');
      return { img, wantsLazy, wantsAsync };
    });
    for (const { img, wantsLazy, wantsAsync } of plan) {
      const tokens: string[] = [];
      if (wantsLazy) {
        img.setAttribute('loading', 'lazy');
        tokens.push('lazy');
        ctx.counts.imagesLazy++;
      }
      if (wantsAsync) {
        img.setAttribute('decoding', 'async');
        tokens.push('async');
        ctx.counts.imagesAsyncDecode++;
      }
      if (tokens.length > 0) img.setAttribute(ATTR, tokens.join(' '));
    }
  };

  return {
    start() {
      ctx.watcher.subscribe('img', handle);
    },
    stop() {
      for (const img of Array.from(ctx.doc.querySelectorAll(`[${ATTR}]`))) {
        const tokens = (img.getAttribute(ATTR) ?? '').split(' ');
        if (tokens.includes('lazy') && img.getAttribute('loading') === 'lazy') img.removeAttribute('loading');
        if (tokens.includes('async') && img.getAttribute('decoding') === 'async') img.removeAttribute('decoding');
        img.removeAttribute(ATTR);
      }
    }
  };
}
