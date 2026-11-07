/** Content script entry. Runs in the top frame of http(s) pages only. */
import { Ext } from '../adapters/ext';
import { Controller } from './controller';
import type { Plan } from '../shared/types';
import type { ContentCommand } from '../shared/messages';

const ext = Ext.detect();

if (ext && window.top === window) {
  const controller = new Controller({
    doc: document,
    win: window as typeof window & typeof globalThis,
    reportSample: (sample, runId) => void ext.sendMessage({ type: 'REPORT_SAMPLE', sample, runId }),
    reportTrip: (reason) => void ext.sendMessage({ type: 'SAFETY_TRIP', reason })
  });

  const load = async () => {
    const plan = await ext.sendMessage<Plan | { ok: false }>({ type: 'GET_PLAN' });
    if (plan && 'settings' in plan) controller.apply(plan);
  };

  ext.raw.runtime.onMessage.addListener(
    (msg: ContentCommand, sender: { id?: string }, sendResponse: (r: unknown) => void) => {
      if (sender?.id !== ext.runtimeId || !msg || typeof msg.type !== 'string') return false;
      switch (msg.type) {
        case 'PLAN_CHANGED':
          void load().then(() => sendResponse({ ok: true }));
          return true;
        case 'RESTORE_NOW':
          controller.restore();
          sendResponse({ ok: true });
          return false;
        case 'SAMPLE_NOW':
          void controller.sample().then((sample) => sendResponse({ sample }));
          return true;
        default:
          return false;
      }
    }
  );

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) controller.restore();
  });

  void load();
}
