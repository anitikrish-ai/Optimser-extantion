/**
 * Background entry (Chromium service worker / Firefox event page).
 * All listeners are registered synchronously at top level, as MV3 requires.
 */
import { Ext } from '../adapters/ext';
import { NetworkApplier } from '../adapters/network-applier';
import { BackgroundState } from './state';
import { Handlers } from './handlers';
import { classifySender, isAuthorized, parseRequest } from '../shared/messages';
import type { Request } from '../shared/messages';

const ext = Ext.detect();

if (ext) {
  const state = new BackgroundState(ext);
  const handlers = new Handlers({ ext, state, applier: new NetworkApplier(ext) });
  const base = ext.getURL('');

  const route = async (req: Request, tabId: number | undefined, senderUrl: string | undefined): Promise<unknown> => {
    switch (req.type) {
      case 'GET_PLAN':
        return tabId === undefined ? { ok: false } : handlers.getPlan(tabId, senderUrl);
      case 'REPORT_SAMPLE':
        return tabId === undefined ? { ok: false } : handlers.reportSample(tabId, req.sample, req.runId);
      case 'SAFETY_TRIP':
        return tabId === undefined ? { ok: false } : handlers.safetyTrip(tabId);
      case 'GET_STATE':
        return handlers.getState(req.tabId, req.skipBlocked);
      case 'SET_CONFIG':
        return handlers.setConfig(req.config);
      case 'TAB_PAUSE':
        return handlers.tabPause(req.tabId);
      case 'TAB_RESUME':
        return handlers.tabResume(req.tabId);
      case 'COMPARE_START':
        return handlers.compareStart(req.tabId);
      case 'COMPARE_CANCEL':
        return handlers.compareCancel(req.tabId);
      case 'REQUEST_SAMPLE':
        return handlers.requestSample(req.tabId);
      case 'CLEAR_SESSION':
        return handlers.clearSession();
      case 'RESET_ALL':
        return handlers.resetAll();
    }
  };

  ext.raw.runtime.onMessage.addListener(
    (
      message: unknown,
      sender: { id?: string; url?: string; frameId?: number; tab?: { id?: number } },
      sendResponse: (r: unknown) => void
    ) => {
      const kind = classifySender(sender, ext.runtimeId, base);
      const req = parseRequest(message);
      if (!req || !isAuthorized(req.type, kind)) {
        sendResponse({ ok: false, error: 'Rejected' });
        return false;
      }
      route(req, sender.tab?.id, sender.url).then(sendResponse, (e: unknown) =>
        sendResponse({ ok: false, error: e instanceof Error ? e.message : 'Internal error' })
      );
      return true; // asynchronous response
    }
  );

  ext.raw.tabs?.onRemoved?.addListener((tabId: number) => {
    void handlers.onTabRemoved(tabId);
  });

  // Startup and install both reconcile rules with the (fresh) session configuration, which clears
  // user rules left over from a previous session when only dynamic rules are available.
  ext.raw.runtime.onStartup?.addListener(() => void handlers.reconcileNetwork());
  ext.raw.runtime.onInstalled?.addListener(() => void handlers.reconcileNetwork());

  // Also reconcile whenever the worker starts (idempotent).
  void ext.enableBadgeCount();
  void handlers.reconcileNetwork();
}
