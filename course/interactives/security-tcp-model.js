export const CAPACITY = 120;
export const TICK = 0.25;

export function tcpConfig(values = {}) {
  const bounded = (key, fallback, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(values[key] ?? fallback) || 0)));
  return { rate: bounded('rate', 15, 0, 60), complete: bounded('complete', 100, 0, 100),
    timeout: bounded('timeout', 10, 2, 20), protected: Boolean(values.protected), probe: values.probe !== false };
}

export function createTCP(values = {}) {
  return { config: tcpConfig(values), time: 0, pending: [], arrivalCredit: 0, completionCredit: 0,
    total: { syn: 0, synAck: 0, ack: 0, expired: 0, rejected: 0, established: 0 },
    probe: 'Ещё не обращался', probeOK: 0, probeFailed: 0,
    recent: { syn: 0, synAck: 0, ack: 0, expired: 0, rejected: 0, established: 0 } };
}

export function occupancy(state) { return state.pending.filter(item => item.slot).length; }

// Four deterministic substeps per second. No real packets or random sources.
export function advanceTCP(previous) {
  const state = { ...previous, pending: previous.pending.map(item => ({ ...item })), total: { ...previous.total } };
  const before = { ...state.total };
  const count = key => { state.total[key]++; };
  function arrive(completes, probe = false) {
    count('syn');
    if (!state.config.protected && occupancy(state) >= CAPACITY) {
      count('rejected');
      if (probe) { state.probe = 'Не принят: таблица заполнена'; state.probeFailed++; }
      return;
    }
    count('synAck');
    if (completes || !state.config.protected) {
      state.pending.push({ slot: !state.config.protected, probe,
        completeAt: completes ? state.time + 1 : null, expiresAt: state.time + state.config.timeout });
    }
    if (probe) state.probe = 'Принят, ждёт завершения';
  }
  for (let tick = 0; tick < 4; tick++) {
    state.time += TICK;
    state.pending = state.pending.filter(item => {
      if (item.completeAt !== null && item.completeAt <= state.time) {
        count('ack'); count('established');
        if (item.probe) { state.probe = 'Соединение установлено'; state.probeOK++; }
        return false;
      }
      if (item.expiresAt <= state.time) { count('expired'); return false; }
      return true;
    });
    state.arrivalCredit += state.config.rate * TICK;
    const arrivals = Math.floor(state.arrivalCredit);
    state.arrivalCredit -= arrivals;
    for (let i = 0; i < arrivals; i++) {
      state.completionCredit += state.config.complete;
      const completes = state.completionCredit >= 100;
      if (completes) state.completionCredit -= 100;
      arrive(completes);
    }
  }
  if (state.config.probe) arrive(true, true);
  state.recent = Object.fromEntries(Object.keys(before).map(key => [key, state.total[key] - before[key]]));
  return state;
}

export function tcpMetrics(state) {
  const used = occupancy(state);
  return { used, capacity: CAPACITY, fill: used / CAPACITY,
    // 80 bytes per service packet, one direction at a time; an illustrative aggregate, not a link emulator.
    kbps: (state.recent.syn + state.recent.synAck + state.recent.ack) * 80 * 8 / 1000 };
}
