// Deterministic sampled model shared by every stage of the practice page.
export const SAMPLE_RATE_KHZ = 1000;
export const FFT_SIZE = 4096;
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
  // The first several sidelobes remain below Nyquist at every UI setting.
  return carrierKhz > 0 && bitRateKbps > 0 &&
    carrierKhz + 4 * bitRateKbps < SAMPLE_RATE_KHZ / 2;
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
