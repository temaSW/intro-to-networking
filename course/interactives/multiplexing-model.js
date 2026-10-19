// Units: milliseconds, packets of 1000 bits, Mbit/s. No DOM or randomness.
export const PACKET_BITS = 1000;
export const DURATION = 1000;

export function arrivals({flows, activity, pattern}) {
  const trace = [];
  const sequence = Array(flows).fill(0);
  for (let t = 0; t < DURATION; t++) {
    // Rotate simultaneous arrivals so one source has no permanent priority.
    for (let j = 0; j < flows; j++) {
      const source = (j + t) % flows;
      const phase = pattern === 'synchronous' ? 0 : Math.floor(source * 100 / flows);
      if ((t + phase) % 100 < activity) trace.push({t, source, sequence: ++sequence[source]});
    }
  }
  return trace;
}

export function simulate(config, mode, trace = arrivals(config)) {
  const {flows, capacity, buffer} = config;
  const dedicated = mode === 'dedicated';
  const count = dedicated ? flows : 1;
  const rate = capacity / count;
  const resources = Array.from({length: count}, (_, i) => ({
    jobs: [], free: 0,
    limit: dedicated ? Math.floor(buffer / flows) + (i < buffer % flows ? 1 : 0) : buffer,
  }));
  const accepted = [];
  const rejected = [];
  let lost = 0;
  for (const packet of trace) {
    const resource = resources[dedicated ? packet.source : 0];
    resource.jobs = resource.jobs.filter(job => job.finish > packet.t + 1e-9);
    const busy = resource.jobs.length > 0;
    const waiting = Math.max(0, resource.jobs.length - 1);
    if (busy && waiting >= resource.limit) { lost++; rejected.push(packet); continue; }
    const start = Math.max(packet.t, resource.free);
    const finish = start + 1 / rate;
    const job = {...packet, start, finish};
    resource.free = finish;
    resource.jobs.push(job);
    accepted.push(job);
  }
  const completed = accepted.filter(job => job.finish <= DURATION + 1e-9);
  const busyTime = accepted.reduce((sum, job) => sum + Math.max(0, Math.min(job.finish, DURATION) - job.start), 0);
  const samples = Array.from({length: 101}, (_, i) => {
    const t = i * 10;
    return {t, queue: accepted.filter(job => job.t <= t && job.start > t + 1e-9).length};
  });
  return {
    offered: trace.length, sent: completed.length, lost,
    pending: accepted.length - completed.length,
    utilization: busyTime / (DURATION * count),
    wait: completed.length ? completed.reduce((sum, job) => sum + job.start - job.t, 0) / completed.length : null,
    delay: completed.length ? completed.reduce((sum, job) => sum + job.finish - job.t, 0) / completed.length : null,
    maxQueue: samples.reduce((max, sample) => Math.max(max, sample.queue), 0),
    samples,
    accepted, rejected,
  };
}

// A snapshot immediately after arrivals and completions at t, from the same schedule as the totals.
export function stateAt(result, t) {
  if (!Number.isFinite(t) || t < 0 || t > DURATION) throw new RangeError('Invalid snapshot time');
  const arrived = result.accepted.filter(job => job.t <= t);
  const sent = arrived.filter(job => job.finish <= t + 1e-9);
  const transmitting = arrived.filter(job => job.start <= t + 1e-9 && job.finish > t + 1e-9);
  const waiting = arrived.filter(job => job.start > t + 1e-9);
  const rejected = result.rejected.filter(job => job.t <= t);
  return {sent: sent.length, transmitting, waiting, rejected,
    offered: arrived.length + rejected.length};
}

export function compare(config) {
  if (!Number.isInteger(config.flows) || config.flows < 1 || config.flows > 24 ||
      !Number.isInteger(config.activity) || config.activity < 0 || config.activity > 100 ||
      !Number.isFinite(config.capacity) || config.capacity <= 0 ||
      !Number.isInteger(config.buffer) || config.buffer < 0 || config.buffer > 240 ||
      !['staggered', 'synchronous'].includes(config.pattern)) throw new RangeError('Invalid experiment parameters');
  const trace = arrivals(config);
  return {dedicated: simulate(config, 'dedicated', trace), shared: simulate(config, 'shared', trace)};
}
