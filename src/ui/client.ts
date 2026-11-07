/** Typed client for the background, used by the popup and dashboard. */
import { Ext } from '../adapters/ext';
import type { Ack, StateView } from '../shared/messages';
import type { Config } from '../shared/types';

const ext = Ext.detect();

export async function request<T>(msg: Record<string, unknown>): Promise<T | null> {
  if (!ext) return null;
  const res = await ext.sendMessage<T>(msg);
  return res === undefined ? null : res;
}

export const getState = (tabId: number | null, skipBlocked = false) =>
  request<StateView>({ type: 'GET_STATE', tabId, skipBlocked });
export const setConfig = (config: Config) => request<Ack>({ type: 'SET_CONFIG', config });
export const activeTabId = async (): Promise<number | null> => (ext ? ext.activeTabId() : null);
export const openOptions = () => {
  void ext?.raw.runtime.openOptionsPage?.();
};
