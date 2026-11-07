/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSDOM } from 'jsdom';
import type { Win } from '../src/content/lifecycle';

export class FakeIO {
  static instances: FakeIO[] = [];
  observed = new Set<Element>();
  disconnected = false;
  constructor(public cb: (entries: any[]) => void) { FakeIO.instances.push(this); }
  observe(e: Element) { this.observed.add(e); }
  unobserve(e: Element) { this.observed.delete(e); }
  disconnect() { this.disconnected = true; this.observed.clear(); }
  fire(target: Element, isIntersecting: boolean) { this.cb([{ target, isIntersecting }]); }
}

export interface Env { win: Win; doc: Document; counts: { mutationObservers: number; liveMutationObservers: number } }

export function makeEnv(body = '<main></main>'): Env {
  FakeIO.instances = [];
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url: 'https://site.example.com/page', pretendToBeVisual: true });
  const win = dom.window as any;
  win.IntersectionObserver = FakeIO;
  win.CSS = { supports: () => true };
  win.performance.getEntriesByType = () => [];
  const counts = { mutationObservers: 0, liveMutationObservers: 0 };
  const RealMO = win.MutationObserver;
  win.MutationObserver = class extends RealMO {
    constructor(cb: any) { super(cb); counts.mutationObservers++; counts.liveMutationObservers++; }
    disconnect() { counts.liveMutationObservers--; super.disconnect(); }
  };
  return { win, doc: win.document, counts };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('waitFor timed out');
    await sleep(10);
  }
}

export function setRect(el: Element, top: number, height: number): void {
  (el as any).getBoundingClientRect = () => ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top });
}

export function stubVideo(v: HTMLVideoElement, opts: { playing: boolean; muted: boolean }): void {
  let paused = !opts.playing;
  Object.defineProperty(v, 'paused', { get: () => paused, configurable: true });
  v.muted = opts.muted;
  (v as any).pause = () => { if (!paused) { paused = true; v.dispatchEvent(new (v.ownerDocument.defaultView as any).Event('pause')); } };
  (v as any).play = () => { paused = false; v.dispatchEvent(new (v.ownerDocument.defaultView as any).Event('play')); return Promise.resolve(); };
}

export const asWin = (w: unknown) => w as Win;
