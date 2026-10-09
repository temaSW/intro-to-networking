// Mid-rise quantizers: equal bins in the selected amplitude coordinate.
export function quantize(value, bits = 4, law = 'uniform') {
  if (!Number.isFinite(value) || !Number.isInteger(bits) || bits < 1 || bits > 12)
    throw new RangeError('Finite input and 1–12 bits required');
  if (!['uniform', 'log'].includes(law)) throw new RangeError('Unknown law');
  const levels = 2 ** bits, step = 2 / levels, mu = 255;
  const compress = x => Math.sign(x) * Math.log1p(mu * Math.abs(x)) / Math.log1p(mu);
  const expand = y => Math.sign(y) * Math.expm1(Math.abs(y) * Math.log1p(mu)) / mu;
  const limited = Math.max(-1, Math.min(1, value));
  const coordinate = law === 'log' ? compress(limited) : limited;
  const index = Math.min(levels - 1, Math.floor((coordinate + 1) / step));
  const center = -1 + (index + .5) * step;
  const reconstructed = law === 'log' ? expand(center) : center;
  return { value, bits, levels, index, word: index.toString(2).padStart(bits, '0'),
    reconstructed, error: reconstructed - value, overloaded: Math.abs(value) > 1,
    lower: law === 'log' ? expand(-1 + index * step) : -1 + index * step,
    upper: law === 'log' ? expand(-1 + (index + 1) * step) : -1 + (index + 1) * step };
}

// Synthetic waveform: several bursts with a strictly bounded peak amplitude.
const baseWave = t => {
  const gaussian = (center, width) => Math.exp(-(((t - center) / width) ** 2));
  const envelope = .07 + .27 * gaussian(.65, .22)
    + .55 * gaussian(1.65, .33) + .85 * gaussian(2.7, .27)
    + .4 * gaussian(3.5, .2);
  const carrier = .55 * Math.sin(2 * Math.PI * 1.1 * t + .3)
    + .3 * Math.sin(2 * Math.PI * 2.35 * t + 1.1)
    + .15 * Math.cos(2 * Math.PI * 3.1 * t - .4);
  return envelope * carrier;
};
// Piecewise linear interpolation fixes the shape at the sampling grid; its
// maximum is attained at a grid point, so the amplitude control is exact.
const waveKnots = Array.from({length: 33}, (_, k) => baseWave(k / 8));
const wavePeak = Math.max(...waveKnots.map(Math.abs));
export function quantizedWave(amplitude = .7, bits = 4, law = 'uniform') {
  if (!Number.isFinite(amplitude) || amplitude < 0 || amplitude > 2)
    throw new RangeError('Amplitude must be between 0 and 2');
  const original = t => {
    const position = Math.max(0, Math.min(32, t * 8));
    const left = Math.min(31, Math.floor(position)), fraction = position - left;
    return amplitude * (waveKnots[left] * (1 - fraction) + waveKnots[left + 1] * fraction) / wavePeak;
  };
  const samples = Array.from({ length: 33 }, (_, k) => {
    const timeMs = k / 8;
    return { timeMs, ...quantize(original(timeMs), bits, law) };
  });
  return { original, samples, rmsError: Math.sqrt(samples.reduce((s, p) => s + p.error ** 2, 0) / samples.length),
    maxError: Math.max(...samples.map(p => Math.abs(p.error))),
    overloads: samples.filter(p => p.overloaded).length };
}
