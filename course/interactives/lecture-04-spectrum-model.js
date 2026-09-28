// Normalized teaching envelopes for rectangular, independent binary symbols.
// Frequency is an offset from the carrier in kHz; duration is in ms.
const FSK_SHIFT_KHZ = 1;

function sincSquared(value) {
  if (Math.abs(value) < 1e-12) return 1;
  const sinc = Math.sin(Math.PI * value) / (Math.PI * value);
  return sinc * sinc;
}

export function spectrumEnvelope(mode, offsetKhz, bitDurationMs) {
  const scaled = offsetKhz * bitDurationMs;
  if (mode === "ask" || mode === "psk") return sincSquared(scaled);
  if (mode === "fsk") {
    return (sincSquared((offsetKhz - FSK_SHIFT_KHZ) * bitDurationMs)
      + sincSquared((offsetKhz + FSK_SHIFT_KHZ) * bitDurationMs)) / 2;
  }
  throw new Error(`Unknown modulation: ${mode}`);
}

export function sampleSpectrum(mode, bitDurationMs) {
  if (!(bitDurationMs > 0)) throw new Error("Bit duration must be positive");
  const samples = Array.from({length: 501}, (_, index) => {
    const offsetKhz = -5 + index / 50;
    return {offsetKhz, power: spectrumEnvelope(mode, offsetKhz, bitDurationMs)};
  });
  const maximum = Math.max(...samples.map(sample => sample.power));
  return {
    samples: samples.map(({offsetKhz, power}) => ({offsetKhz, db: Math.max(-45, 10 * Math.log10(Math.max(power / maximum, 1e-8)))})),
    bitRate: 1000 / bitDurationMs,
    lobeScaleKhz: 1 / bitDurationMs,
    toneShiftKhz: FSK_SHIFT_KHZ,
    carrierLine: mode === "ask",
  };
}
