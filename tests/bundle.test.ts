/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Executes the real built bundles (not the TypeScript modules) the way a browser would:
 * content.js as a classic script in a page, background.js in an isolated VM.
 * This guards against the class of bug where code is fine in tests but cannot load as an extension script.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { fakeApi, sample } from './helpers';
import { sleep, waitFor } from './dom-env';
import { defaultConfig } from '../src/shared/config';
import { buildContentSettings } from '../src/policy/resolve';

const root = new URL('..', import.meta.url).pathname;
async function bundle(entry: string): Promise<string> {
  const r = await build({ entryPoints: [`${root}${entry}`], bundle: true, format: 'iife', platform: 'browser', target: ['chrome102', 'firefox115'], write: false, minify: true, logLevel: 'silent' });
  return r.outputFiles[0]?.text ?? '';
}

test('built content.js loads as a classic script, asks for a plan, and obeys only its own extension', async () => {
  const code = await bundle('src/content/main.ts');
  assert.ok(!/^\s*(import|export)\s/m.test(code));
  const dom = new JSDOM('<!doctype html><body><img id="i"></body>', { url: 'https://site.example.com/', runScripts: 'outside-only', pretendToBeVisual: true });
  const win = dom.window as any;
  const sent: any[] = [];
  let listener: any;
  win.chrome = {
    runtime: {
      id: 'ext-id',
      sendMessage: async (m: any) => {
        sent.push(m);
        if (m.type !== 'GET_PLAN') return { ok: true };
        return { active: true, reason: null, mode: 'balanced', settings: buildContentSettings(defaultConfig(), defaultConfig().modules), autoSample: 'none', runId: null };
      },
      onMessage: { addListener: (fn: any) => { listener = fn; } }
    }
  };
  win.IntersectionObserver = class { observe() {} disconnect() {} };
  win.CSS = { supports: () => true };
  win.eval(code);
  await waitFor(() => sent.some((m) => m.type === 'GET_PLAN'));
  assert.equal(typeof listener, 'function');
  await sleep(150);

  const box: { v: any } = { v: null };
  const read = (): any => box.v;
  assert.equal(listener({ type: 'RESTORE_NOW' }, { id: 'someone-else' }, (r: any) => { box.v = r; }), false);
  assert.equal(read(), null, 'messages from other senders are ignored');
  listener({ type: 'RESTORE_NOW' }, { id: 'ext-id' }, (r: any) => { box.v = r; });
  assert.equal(read()?.ok, true);
  assert.equal(win.document.querySelectorAll('[data-uwpo-img]').length, 0);
});

test('built background.js runs in isolation, registers its listeners, and enforces sender authorization', async () => {
  const code = await bundle('src/background/main.ts');
  const f = fakeApi({ matched: [] });
  let handler: any; const listeners: string[] = [];
  f.api.runtime.onMessage = { addListener: (fn: any) => { handler = fn; listeners.push('message'); } };
  f.api.runtime.onStartup = { addListener: () => listeners.push('startup') };
  f.api.runtime.onInstalled = { addListener: () => listeners.push('installed') };
  f.api.tabs.onRemoved = { addListener: () => listeners.push('removed') };
  vm.runInNewContext(code, { chrome: f.api, URL, console, structuredClone, Promise, Date, setTimeout, clearTimeout });
  assert.deepEqual(listeners.sort(), ['installed', 'message', 'removed', 'startup']);

  const call = (msg: unknown, sender: any) => new Promise<any>((resolve) => { const keep = handler(msg, sender, resolve); if (keep === false) return; });
  const content = { id: 'ext-id', url: 'https://news.example.com/story', tab: { id: 7 }, frameId: 0 };
  const page = { id: 'ext-id', url: 'chrome-extension://ext-id/popup/index.html' };

  const plan = await call({ type: 'GET_PLAN' }, content);
  assert.equal(plan.active, true);
  assert.equal((await call({ type: 'SET_CONFIG', config: { enabled: false } }, content)).ok, false, 'content script cannot change settings');
  assert.equal((await call({ type: 'GET_PLAN' }, { ...content, id: 'other' })).ok, false);
  assert.equal((await call({ type: 'TAB_PAUSE', tabId: 'x' }, page)).ok, false, 'malformed message');
  const set = await call({ type: 'SET_CONFIG', config: { enabled: false } }, page);
  assert.equal(set.ok, true);
  assert.equal(f.log.enabled.size, 0, 'master off disables bundled rulesets through the real bundle');
  assert.equal((await call({ type: 'GET_PLAN' }, content)).reason, 'master-off');
  const rep = await call({ type: 'REPORT_SAMPLE', sample: sample(), runId: null }, content);
  assert.equal(rep.ok, true);
  const st = await call({ type: 'GET_STATE', tabId: 7 }, page);
  assert.equal(st.tab.host, 'news.example.com');
});
