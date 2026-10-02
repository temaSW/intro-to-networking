// Small browser utilities; numerical channel/LDPC model runs offline in Python.
export function nearestPoint(points, snr) {
  return points.reduce((best, point, index) =>
    Math.abs(point.snr_db - snr) < Math.abs(points[best].snr_db - snr) ? index : best, 0);
}

export function loopPhase(offset, startedAt, now, duration) {
  return ((offset + now - startedAt) % duration + duration) % duration;
}

export function decodePack(bytes, samples, count) {
  if (bytes.byteLength !== samples * count * 2) throw new Error('Неверный размер аудиоданных');
  const view = new DataView(bytes);
  return Array.from({length: count}, (_, frame) => {
    const result = new Float32Array(samples);
    for (let i = 0; i < samples; i++) result[i] = view.getInt16((frame * samples + i) * 2, true) / 32768;
    return result;
  });
}

export function envelope(samples, columns = 560) {
  return Array.from({length: Math.min(columns, samples.length)}, (_, i) => {
    const start = Math.floor(i * samples.length / Math.min(columns, samples.length));
    const end = Math.floor((i + 1) * samples.length / Math.min(columns, samples.length));
    let low = Infinity, high = -Infinity;
    for (let j = start; j < end; j++) { low = Math.min(low, samples[j]); high = Math.max(high, samples[j]); }
    return [low, high];
  });
}
