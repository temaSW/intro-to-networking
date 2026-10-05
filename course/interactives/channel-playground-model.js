// Educational channel models. Units: us/MHz for delay; seconds/Hz for Doppler.
export const BITS = [1, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1];
export const MODES = ['attenuation', 'bandwidth', 'noise', 'multipath', 'coherence', 'shift', 'spread', 'media'];
export function defaults() {
  return {power: 10, distance: 2, loss: 2, sensitivity: -65, receiverMaximum: -25,
    aid: 'none', gainDb: 10 * Math.log10(4), noiseFigure: 6,
    bandwidth: 4, rate: 8, regeneration: 'off', snr: 12, disturbance: 'noise',
    interference: .7, interferenceFrequency: .17, carrier: 1, f1: .8, f2: 1,
    signalBandwidth: .2, carrierGHz: 2.4, speed: 15, direction: 0, offset: 0,
    duration: 10, movingPaths: 'multiple', paths: [{amplitude: .7, delay: .5, angle: 60}]};
}
export function attenuation(p) {
  const lossDb = 40 + 20 * Math.log10(p.distance) + p.loss * p.distance;
  const received = p.power - lossDb;
  return {lossDb, received, margin: received - p.sensitivity,
    usable: received >= p.sensitivity, amplitude: 10 ** ((received - p.power) / 20)};
}
export function samplePowerDbm(samples, referenceDbm, floor = -120) {
  return samples.map(x => Math.max(floor, x === 0 ? floor : referenceDbm + 20 * Math.log10(Math.abs(x))));
}
export function attenuationSignal(p) {
  const a = attenuation(p), gain = 10 ** ((a.received - p.sensitivity) / 20);
  const time = Array.from({length: 601}, (_, i) => 12 * i / 600);
  // Six complete sine periods; sqrt(2) gives unit mean power on the periodic grid.
  const tx = time.map(t => Math.SQRT2 * Math.sin(Math.PI * t));
  const rms = Math.sqrt(tx.reduce((v,x) => v+x*x, 0) / tx.length);
  for (let i=0; i<tx.length; i++) tx[i] /= rms;
  const input = tx.map(x => x * gain); // This experiment's propagation channel is noiseless.
  const amplified = p.aid !== 'none', voltageGain = amplified ? 10 ** (p.gainDb / 20) : 1;
  const noiseFactor = p.aid === 'ideal' ? 1 : 10 ** (p.noiseFigure / 10);
  // NF is specified against a reference thermal source, not the noiseless plotted input.
  // Only the amplifier's own added noise is included: Na = G (F-1) k T0 B.
  const referenceTemperature = 290, noiseBandwidth = 100e6;
  const referenceNoiseWatts = 1.380649e-23 * referenceTemperature * noiseBandwidth;
  const addedNoiseWatts = amplified ? voltageGain ** 2 * (noiseFactor - 1) * referenceNoiseWatts : 0;
  const thresholdWatts = 1e-3 * 10 ** (p.sensitivity / 10);
  const sigma = Math.sqrt(addedNoiseWatts / thresholdWatts);
  const realization = unitNoise(time.length, 4823);
  const addedNoise = realization.map(x => x * sigma);
  const output = input.map((x, i) => voltageGain * x + addedNoise[i]);
  // The ideal amplifier remains linear. Saturation belongs to the following receiver.
  const receiverLimit = 10 ** ((p.receiverMaximum - p.sensitivity) / 20);
  const receiver = output.map(x => Math.max(-receiverLimit, Math.min(receiverLimit, x)));
  const clipped = output.filter(x => Math.abs(x) > receiverLimit).length;
  const inputPower = samplePowerDbm(input, p.sensitivity);
  const outputPower = samplePowerDbm(output, p.sensitivity);
  const receiverPower = samplePowerDbm(receiver, p.sensitivity);
  return {time, tx, input, output, receiver, receiverLimit, clipped,
    inputPower, outputPower, receiverPower,
    addedNoise, addedNoiseWatts, referenceTemperature, noiseBandwidth,
    noiseFactor, voltageGain, outputLevel: a.received + 20 * Math.log10(voltageGain),
    noiseDbm: addedNoiseWatts > 0 ? 10 * Math.log10(addedNoiseWatts / 1e-3) : -Infinity};
}
export function lowpassGain(frequency, bandwidth) {
  return 1 / Math.sqrt(1 + (frequency / bandwidth) ** 2);
}
export function bandwidth(p, samplesPerSymbol = 64) {
  const amplitude = 1;
  const dt = 1 / (p.rate * samplesPerSymbol); // ms; bandwidth is kHz
  const memory = Math.exp(-2 * Math.PI * p.bandwidth * dt);
  let y = 0;
  const tx = [], rx = [], time = [], decisions = [];
  for (let i = 0; i < BITS.length * samplesPerSymbol; i++) {
    const bit = BITS[Math.floor(i / samplesPerSymbol)];
    const x = (bit ? 1 : -1) * amplitude;
    y = memory * y + (1 - memory) * x;
    tx.push(x); rx.push(y); time.push(i * dt);
    if (i % samplesPerSymbol === samplesPerSymbol / 2) decisions.push(y >= 0 ? 1 : 0);
  }
  const regenerated = time.map((_, i) => decisions[Math.floor(i / samplesPerSymbol)] ? 1 : -1);
  // One-symbol latency: all decisions are available before their output pulses start.
  const regeneratedTime = time.map(t => t + 1 / p.rate);
  return {tx, rx, time, decisions, amplitude, regenerated, regeneratedTime,
    errors: decisions.filter((bit, i) => bit !== BITS[i]).length,
    // Fraction of previous level remaining at the decision instant.
    tail: Math.exp(-Math.PI * p.bandwidth / p.rate)};
}
function random(seed) {
  let value = seed >>> 0;
  return () => {value = (1664525 * value + 1013904223) >>> 0; return (value + .5) / 4294967296;};
}
function unitNoise(count, seed) {
  const rng = random(seed);
  const samples = Array.from({length: count}, () => Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng()));
  const mean = samples.reduce((a, b) => a + b, 0) / count;
  const rms = Math.sqrt(samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / count);
  return samples.map(x => (x - mean) / rms);
}
export function noisySymbols(p, count = 96) {
  const rng = random(7319);
  const gaussian = () => Math.sqrt(-2 * Math.log(rng())) * Math.cos(2 * Math.PI * rng());
  const sigma = Math.sqrt(1 / (2 * 10 ** (p.snr / 10)));
  const points = Array.from({length: count}, (_, i) => {
    const bit = BITS[i % BITS.length], tx = bit ? 1 : -1;
    const phase = 2 * Math.PI * p.interferenceFrequency * i;
    // Periodic triangular interference in one quadrature, not a rotating tone.
    const triangular = 2 / Math.PI * Math.asin(Math.sin(phase));
    const re = tx + (p.disturbance === 'noise' ? sigma * gaussian() : p.interference * triangular);
    const im = p.disturbance === 'noise' ? sigma * gaussian() : 0;
    return {bit, tx, re, im, decision: re >= 0 ? 1 : 0, error: (re >= 0 ? 1 : 0) !== bit};
  });
  return {points, errors: points.filter(x => x.error).length};
}
export function allPaths(p) { return [{amplitude: 1, delay: 0, angle: p.direction}, ...p.paths]; }
export function response(paths, frequencyMHz, time = 0, carrierGHz = 0, speed = 0) {
  let re = 0, im = 0;
  for (const path of paths) {
    const phase = -2 * Math.PI * frequencyMHz * path.delay + 2 * Math.PI * doppler(carrierGHz, speed, path.angle) * time;
    re += path.amplitude * Math.cos(phase); im += path.amplitude * Math.sin(phase);
  }
  return {re, im, magnitude: Math.hypot(re, im)};
}
export function multipath(p) {
  const paths = allPaths(p);
  const frequencies = Array.from({length: 401}, (_, i) => i / 100);
  const h = frequencies.map(f => response(paths, f).magnitude);
  const time = Array.from({length: 601}, (_, i) => i / 50);
  // A finite sinusoidal burst makes both the delayed fronts and carrier phase visible.
  const burst = t => t >= 0 && t <= 6 ? Math.sin(2 * Math.PI * p.carrier * t) : 0;
  const copies = paths.map(path => time.map(t => path.amplitude * burst(t - path.delay)));
  const sum = time.map((_, i) => copies.reduce((v, copy) => v + copy[i], 0));
  return {paths, frequencies, h, time, copies, sum};
}
export function coherence(p) {
  const paths = allPaths(p), power = paths.reduce((v, x) => v + x.amplitude ** 2, 0);
  const mean = paths.reduce((v, x) => v + x.amplitude ** 2 * x.delay, 0) / power;
  const rms = Math.sqrt(paths.reduce((v, x) => v + x.amplitude ** 2 * (x.delay - mean) ** 2, 0) / power);
  // Conventional illustrative estimate, not a universal correlation threshold.
  const bc = rms > 1e-12 ? 1 / (5 * rms) : Infinity;
  const h1 = response(paths, p.f1), h2 = response(paths, p.f2);
  const difference = Math.hypot(h1.re - h2.re, h1.im - h2.im) / paths.reduce((v, x) => v + x.amplitude, 0);
  return {mean, rms, bc, h1, h2, difference, ratio: p.signalBandwidth / bc};
}
export function doppler(carrierGHz, speed, angle = 0) {
  return speed / 299792458 * carrierGHz * 1e9 * Math.cos(angle * Math.PI / 180);
}
export function frequencyShift(p) {
  const motion = doppler(p.carrierGHz, p.speed, p.direction);
  return {motion, oscillator: p.offset, total: motion + p.offset};
}
// Carrier cycles at one slow-time instant. Remove the common direct-ray phase
// so the relative phase and the sum remain visible on a fixed carrier scale.
export function movingRaySnapshot(p, seconds) {
  const paths = (p.movingPaths === 'single' ? allPaths(p).slice(0,1) : allPaths(p)).filter(x=>x.amplitude>0);
  const directShift = doppler(p.carrierGHz,p.speed,p.direction);
  const cycles = Array.from({length:301},(_,i)=>2*i/300);
  const phases = paths.map(path=>-2*Math.PI*p.carrierGHz*1000*path.delay + 2*Math.PI*(doppler(p.carrierGHz,p.speed,path.angle)-directShift)*seconds);
  const copies=paths.map((path,i)=>cycles.map(x=>path.amplitude*Math.sin(2*Math.PI*x+phases[i])));
  const sum=cycles.map((_,i)=>copies.reduce((total,copy)=>total+copy[i],0));
  return {cycles,copies,sum,amplitude:response(paths,p.carrierGHz*1000,seconds,p.carrierGHz,p.speed).magnitude,
    displacement:p.speed*seconds, wavelength:299792458/(p.carrierGHz*1e9),
    pathChanges:paths.map(path=>-p.speed*seconds*Math.cos(path.angle*Math.PI/180))};
}
export function dopplerSpread(p, observationSeconds = .1) {
  const paths = (p.movingPaths === 'single' ? allPaths(p).slice(0,1) : allPaths(p)).filter(x => x.amplitude > 0);
  const shifts = paths.map(x => doppler(p.carrierGHz, p.speed, x.angle));
  const spread = Math.max(...shifts) - Math.min(...shifts);
  const tc = spread > 1e-9 ? 1 / spread : Infinity;
  // Keep the observation window fixed when T changes, for comparable experiments.
  const window = observationSeconds;
  const count = Math.max(600, Math.ceil(window * Math.max(...shifts.map(Math.abs)) * 20));
  const time = Array.from({length: count + 1}, (_, i) => window * i / count);
  const h = time.map(t => response(paths, p.carrierGHz * 1000, t, p.carrierGHz, p.speed));
  const power = h.map(x=>x.magnitude**2);
  const fragment = power.filter((_,i)=>time[i]<=p.duration/1000);
  return {paths, shifts, spread, tc, time, h, power,
    fragmentMin: Math.min(...fragment), fragmentMax: Math.max(...fragment)};
}
