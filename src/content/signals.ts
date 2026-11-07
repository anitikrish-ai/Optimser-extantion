import type { Signals } from '../adaptive/decide';
import type { PageSample } from '../shared/measure';

type Conn = { effectiveType?: string; saveData?: boolean };
type Nav = Navigator & { deviceMemory?: number; connection?: Conn };

/** Reads only what the browser exposes. Missing values stay null; nothing is defaulted. */
export function readDeviceSignals(nav: Navigator): Signals {
  const n = nav as Nav;
  return {
    cores: typeof n.hardwareConcurrency === 'number' && n.hardwareConcurrency > 0 ? n.hardwareConcurrency : null,
    memoryGB: typeof n.deviceMemory === 'number' ? n.deviceMemory : null,
    effectiveType: typeof n.connection?.effectiveType === 'string' ? n.connection.effectiveType : null,
    saveData: typeof n.connection?.saveData === 'boolean' ? n.connection.saveData : null,
    domNodes: null,
    resourceCount: null,
    longTaskMs: null
  };
}

/** Adds page evidence from a sample; unavailable measurements stay null. */
export function withPageEvidence(base: Signals, s: PageSample): Signals {
  return {
    ...base,
    domNodes: s.domNodes.state === 'measured' ? s.domNodes.value : null,
    resourceCount: s.requestCount.state === 'measured' ? s.requestCount.value : null,
    longTaskMs: s.longTaskTotalMs.state === 'measured' ? s.longTaskTotalMs.value : null
  };
}
