// Frequencies are in kHz and times in ms, so their product is dimensionless.
const PHASE = 0.4;

export function sampledTone(frequencyKhz, sampleRateKhz, durationMs = 5) {
  const nearestCopy = Math.round(frequencyKhz / sampleRateKhz);
  const apparentSignedKhz = frequencyKhz - nearestCopy * sampleRateKhz;
  const value = (frequency, timeMs) => Math.cos(2 * Math.PI * frequency * timeMs + PHASE);
  const samples = [];
  for (let index = 0; index / sampleRateKhz <= durationMs + 1e-9; index += 1) {
    const timeMs = index / sampleRateKhz;
    samples.push({ timeMs, amplitude: value(frequencyKhz, timeMs) });
  }
  return {
    frequencyKhz,
    sampleRateKhz,
    apparentSignedKhz,
    apparentKhz: Math.abs(apparentSignedKhz),
    nyquistKhz: sampleRateKhz / 2,
    aliases: Math.abs(apparentSignedKhz - frequencyKhz) > 1e-9,
    samples,
    original: timeMs => value(frequencyKhz, timeMs),
    apparent: timeMs => value(apparentSignedKhz, timeMs),
  };
}

export function spectralCopies(maxFrequencyKhz, sampleRateKhz) {
  return {
    maxFrequencyKhz,
    sampleRateKhz,
    nyquistKhz: sampleRateKhz / 2,
    gapKhz: sampleRateKhz - 2 * maxFrequencyKhz,
    copies: [-1, 0, 1].map(index => ({
      index,
      leftKhz: index * sampleRateKhz - maxFrequencyKhz,
      rightKhz: index * sampleRateKhz + maxFrequencyKhz,
    })),
  };
}
