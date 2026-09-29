// At least five times the Nyquist minimum for the highest modelled carrier
// plus four bit-rate offsets: 3.2 MHz >= 10 * (200 + 4 * 25) kHz.
export const SAMPLE_RATE_KHZ = 3200;
export const FFT_SIZE = 16384;
export const MAX_CARRIER_KHZ = 200;
export const MAX_BIT_RATE_KBPS = 25;
export const MAX_USERS = 2;

export function sinc(x) {
  return Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
}

// tauMs and frequencyKhz have reciprocal units.
export function pulseSpectrum(frequencyKhz, tauMs, amplitude = 1) {
  return amplitude * tauMs * Math.abs(sinc(frequencyKhz * tauMs));
}

export function rectangularPulse(amplitude, tauMs, count = FFT_SIZE) {
  const startMs = .25;
  return Float64Array.from({length: count}, (_, i) =>
    i / SAMPLE_RATE_KHZ >= startMs && i / SAMPLE_RATE_KHZ < startMs + tauMs ? amplitude : 0);
}

export function validateSampling(carrierKhz = MAX_CARRIER_KHZ, bitRateKbps = MAX_BIT_RATE_KBPS) {
  // Keep at least ten samples per period at the highest represented frequency.
  return carrierKhz > 0 && bitRateKbps > 0 &&
    carrierKhz + 4 * bitRateKbps <= SAMPLE_RATE_KHZ / 10;
}

export function bitWaveform(bits, bitRateKbps, duty = 1, count = FFT_SIZE) {
  if (!/^[01]{1,16}$/.test(bits)) throw new Error("Use 1–16 binary digits");
  if (!(bitRateKbps > 0 && duty > 0 && duty <= 1)) throw new Error("Invalid bit timing");
  return Float64Array.from({length: count}, (_, i) => {
    const bitPosition = i * bitRateKbps / SAMPLE_RATE_KHZ;
    const index = Math.floor(bitPosition);
    return index < bits.length && bits[index] === "1" && bitPosition - index < duty ? 1 : 0;
  });
}

export function periodicPulse(tauMs, periodMs, amplitude = 1, count = FFT_SIZE) {
  if (!(tauMs > 0 && periodMs > tauMs)) throw new Error("Period must exceed pulse duration");
  return Float64Array.from({length: count}, (_, i) =>
    (i / SAMPLE_RATE_KHZ) % periodMs < tauMs ? amplitude : 0);
}

export function carrier(fcKhz, count = FFT_SIZE) {
  if (!validateSampling(fcKhz, MAX_BIT_RATE_KBPS)) throw new Error("Carrier exceeds safe sampling range");
  return Float64Array.from({length: count}, (_, i) => Math.cos(2 * Math.PI * fcKhz * i / SAMPLE_RATE_KHZ));
}

export function ook(baseband, fcKhz, amplitude = 1) {
  const tone = carrier(fcKhz, baseband.length);
  return Float64Array.from(baseband, (value, i) => value === 0 ? 0 : amplitude * value * tone[i]);
}

export function addSignals(first, second) {
  if (first.length !== second.length) throw new Error("Signals must have equal length");
  return Float64Array.from(first, (value, i) => value + second[i]);
}

// In-place radix-two FFT. inverse=true applies 1/N normalization.
export function fft(real, imag = new Float64Array(real.length), inverse = false) {
  const n = real.length;
  if (n < 2 || (n & (n - 1))) throw new Error("FFT length must be a power of two");
  const re = Float64Array.from(real), im = Float64Array.from(imag);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const stepRe = Math.cos(angle), stepIm = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let twRe = 1, twIm = 0;
      for (let j = 0; j < length / 2; j++) {
        const a = start + j, b = a + length / 2;
        const br = re[b] * twRe - im[b] * twIm;
        const bi = re[b] * twIm + im[b] * twRe;
        re[b] = re[a] - br; im[b] = im[a] - bi;
        re[a] += br; im[a] += bi;
        const nextRe = twRe * stepRe - twIm * stepIm;
        twIm = twRe * stepIm + twIm * stepRe;
        twRe = nextRe;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  return {real: re, imag: im};
}

export function spectrum(signal) {
  const transformed = fft(signal);
  const magnitude = Float64Array.from({length: signal.length / 2 + 1}, (_, i) =>
    Math.hypot(transformed.real[i], transformed.imag[i]) / signal.length * (i === 0 || i === signal.length / 2 ? 1 : 2));
  return {magnitude, stepKhz: SAMPLE_RATE_KHZ / signal.length};
}

export function bandpass(signal, centerKhz, widthKhz) {
  if (!(widthKhz > 0 && centerKhz > widthKhz / 2)) throw new Error("Invalid channel");
  const transformed = fft(signal);
  const n = signal.length;
  for (let i = 0; i < n; i++) {
    const frequency = (i <= n / 2 ? i : i - n) * SAMPLE_RATE_KHZ / n;
    if (Math.abs(Math.abs(frequency) - centerKhz) > widthKhz / 2) {
      transformed.real[i] = 0;
      transformed.imag[i] = 0;
    }
  }
  return fft(transformed.real, transformed.imag, true).real;
}

export function mainLobeOverlap(fc1, fc2, bitRateKbps, duty = 1) {
  // First-null estimate for a rectangular bit pulse, only a visual guide.
  return Math.abs(fc1 - fc2) < 2 * bitRateKbps / duty;
}

// A repeatable, long bit stream makes the three modulation spectra comparable.
export const PRACTICE_FFT_SIZE = 32768;
export const PRACTICE_SAMPLE_COUNT = 262144;
export const PRACTICE_CARRIER_KHZ = 100;
export const PRACTICE_FSK_SHIFT_KHZ = 18;

export function practiceSignals(bitRateKbps) {
  if (!(bitRateKbps >= 5 && bitRateKbps <= 25)) throw new Error("Bit rate out of range");
  let seed = 0x71ac37;
  const bits = Array.from({length: Math.ceil(PRACTICE_SAMPLE_COUNT * bitRateKbps / SAMPLE_RATE_KHZ) + 1}, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 31;
  });
  bits.splice(0, 5, 1, 0, 1, 1, 0); // A readable 10110 fragment in every time-domain example.
  const ask = new Float64Array(PRACTICE_SAMPLE_COUNT);
  const fsk = new Float64Array(PRACTICE_SAMPLE_COUNT);
  const psk = new Float64Array(PRACTICE_SAMPLE_COUNT);
  let phase = 0;
  for (let i = 0; i < PRACTICE_SAMPLE_COUNT; i++) {
    const bit = bits[Math.floor(i * bitRateKbps / SAMPLE_RATE_KHZ)];
    const carrierPhase = 2 * Math.PI * PRACTICE_CARRIER_KHZ * i / SAMPLE_RATE_KHZ;
    ask[i] = bit * Math.cos(carrierPhase);
    psk[i] = (bit ? 1 : -1) * Math.cos(carrierPhase);
    phase += 2 * Math.PI * (PRACTICE_CARRIER_KHZ + (bit ? 1 : -1) * PRACTICE_FSK_SHIFT_KHZ) / SAMPLE_RATE_KHZ;
    fsk[i] = Math.cos(phase);
  }
  return {bits, ask, fsk, psk};
}

// Welch power estimate: Hann windows, 50% overlap, then arithmetic power average.
export function averagedPowerSpectrum(signal, windowSize = PRACTICE_FFT_SIZE) {
  if (windowSize < 2 || (windowSize & (windowSize - 1)) || signal.length < windowSize)
    throw new Error("Invalid FFT window");
  const power = new Float64Array(windowSize / 2 + 1);
  const window = Float64Array.from({length: windowSize}, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (windowSize - 1)));
  let windows = 0;
  for (let start = 0; start + windowSize <= signal.length; start += windowSize / 2) {
    const segment = Float64Array.from(window, (weight, i) => weight * signal[start + i]);
    const transformed = fft(segment);
    for (let i = 0; i < power.length; i++)
      power[i] += transformed.real[i] ** 2 + transformed.imag[i] ** 2;
    windows++;
  }
  for (let i = 0; i < power.length; i++) power[i] /= windows;
  return {power, stepKhz: SAMPLE_RATE_KHZ / windowSize, windows};
}

export function periodicPulseFourier(harmonics, low = -1, duty = .5, frequencyKhz = 2) {
  if (!(Number.isInteger(harmonics) && harmonics >= 1 && harmonics <= 19 &&
    (low === -1 || low === 0) && duty > 0 && duty < 1 && frequencyKhz > 0))
    throw new Error("Invalid periodic pulse parameters");
  // 800 kHz display sampling > 10 * 38 kHz at the maximum 19th harmonic.
  const time = Array.from({length: 801}, (_, i) => i / 800);
  const dc = low + (1 - low) * duty;
  const lines = [{frequencyKhz: 0, amplitude: Math.abs(dc), signed: dc}];
  for (let n = 1; n <= harmonics; n++) {
    const coefficient = 2 * (1 - low) * Math.sin(Math.PI * n * duty) / (Math.PI * n);
    lines.push({frequencyKhz: n * frequencyKhz, amplitude: Math.abs(coefficient), coefficient, harmonic: n});
  }
  const values = time.map(t => dc + lines.slice(1).reduce((sum, line) =>
    sum + line.coefficient * Math.cos(2 * Math.PI * line.frequencyKhz * t - Math.PI * line.harmonic * duty), 0));
  const ideal = time.map(t => (t * frequencyKhz) % 1 < duty ? 1 : low);
  return {time, values, ideal, lines, dc, low, duty, frequencyKhz};
}

export function squareFourier(harmonics, frequencyKhz = 2) {
  const result = periodicPulseFourier(harmonics, -1, .5, frequencyKhz);
  return {...result, lines: result.lines.slice(1).filter(line => line.amplitude > 1e-10)};
}

// Multiplication by cos(2πfct) creates a pair at fc ± f for each baseband tone.
export function translatedToneSpectrum(carrierKhz, cutoffKhz) {
  if (!(carrierKhz >= 40 && carrierKhz <= 100 && cutoffKhz >= 40 && cutoffKhz <= 125))
    throw new Error("Translation parameters out of range");
  const baseband = [
    {frequencyKhz: 5, amplitude: 1},
    {frequencyKhz: 12, amplitude: .7},
    {frequencyKhz: 20, amplitude: .45},
  ];
  const translated = baseband.flatMap(({frequencyKhz, amplitude}) => [
    {frequencyKhz: carrierKhz - frequencyKhz, amplitude: amplitude / 2},
    {frequencyKhz: carrierKhz + frequencyKhz, amplitude: amplitude / 2},
  ]).sort((a, b) => a.frequencyKhz - b.frequencyKhz);
  const passed = translated.filter(line => line.frequencyKhz <= cutoffKhz);
  // Coherent mixing with 2cos(2πfct) moves each surviving sideband to |f-fc|.
  // A 25 kHz receiver low-pass removes the simultaneous components near 2fc.
  const recovered = baseband.map(tone => ({
    frequencyKhz: tone.frequencyKhz,
    amplitude: passed.filter(line => Math.abs(line.frequencyKhz - carrierKhz) === tone.frequencyKhz)
      .reduce((sum, line) => sum + line.amplitude, 0),
  }));
  const timeMs = Array.from({length: 641}, (_, i) => i / SAMPLE_RATE_KHZ);
  const synthesize = lines => timeMs.map(t => lines.reduce((sum, line) =>
    sum + line.amplitude * Math.cos(2 * Math.PI * line.frequencyKhz * t), 0));
  return {
    baseband, translated,
    passed,
    rejected: translated.filter(line => line.frequencyKhz > cutoffKhz),
    recovered,
    timeMs,
    basebandTime: synthesize(baseband),
    translatedTime: synthesize(translated),
    passedTime: synthesize(passed),
    recoveredTime: synthesize(recovered),
  };
}
