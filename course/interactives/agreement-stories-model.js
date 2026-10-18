// Abstract teaching scenarios, not a simulation of a particular radio standard.
const accessModes = ['same', 'independent'];
const resourceModes = ['normal', 'request-lost', 'grant-lost', 'expired'];

function check(stage, last, mode, modes) {
  if (!Number.isInteger(stage) || stage < 0 || stage > last) throw new RangeError('Invalid stage');
  if (!modes.includes(mode)) throw new RangeError('Invalid scenario');
}

export function accessStory({ stage = 0, mode = 'same', seed = 1 } = {}) {
  check(stage, 5, mode, accessModes);
  if (!Number.isSafeInteger(seed) || seed < 1) throw new RangeError('Invalid seed');
  let state = seed >>> 0;
  const draw = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return 1 + Math.floor(((value ^ (value >>> 14)) >>> 0) / 4294967296 * 3);
  };
  const waits = mode === 'same' ? [2, 2] : [draw(), draw()];
  const collision = waits[0] === waits[1];
  return {
    stage, mode, waits: stage >= 3 ? waits : null,
    // C succeeds in the initial attempt and never retries.
    devices: ['A', 'B', 'C'].map((id, i) => ({
      id,
      firstWindow: i < 2 ? 1 : 2,
      retryWindow: stage >= 4 && i < 2 ? waits[i] : null,
      status: stage === 0 ? 'ready' : stage === 1 ? 'awaiting'
        : i === 2 ? 'accepted' : stage === 2 ? 'timeout'
        : stage === 3 ? 'backoff' : stage === 4 ? 'awaiting'
        : collision ? 'timeout' : 'accepted',
    })),
    initialResult: stage >= 2,
    retryResult: stage === 5 ? (collision ? 'collision' : 'accepted') : null,
  };
}

export function resourceStory({ stage = 0, mode = 'normal' } = {}) {
  check(stage, 6, mode, resourceModes);
  const demand = stage >= 1 ? 6 : 2;
  const reported = stage >= 2 && mode !== 'request-lost' ? demand : 2;
  const planned = stage >= 3 ? Math.min(reported, 4) : 0;
  const received = stage >= 4 && mode !== 'grant-lost' ? planned : 0;
  const transmitted = stage >= 5 && mode !== 'expired' ? received : 0;
  return {
    stage, mode, frame: stage < 5 ? 10 : stage === 5 ? 11 : 12,
    queue: demand - transmitted,
    nodeQueue: reported - transmitted,
    reported, planned, received, transmitted,
    grantFrame: received ? 11 : null,
    // The grant never authorizes a transmission in another frame.
    allowed: stage === 5 ? received : 0,
    resource: Array.from({ length: 6 }, (_, i) => i < 2 ? 'other'
      : i - 2 < planned ? (stage >= 5 ? i - 2 < transmitted ? 'sent' : 'unused' : 'reserved') : 'free'),
  };
}
