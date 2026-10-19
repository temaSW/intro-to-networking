// E1 source counters over a common observation interval; not a PDH frame simulator.
export const E1_RATE = 2_048_000;
export function clockDrift(ppm, milliseconds) {
  if (!Number.isInteger(ppm) || ppm < 0 || ppm > 50 || !Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 1000) throw new RangeError('Invalid clock experiment parameters');
  const seconds = milliseconds / 1000;
  const rateB = E1_RATE * (1 + ppm * 1e-6);
  const countA = Math.floor(E1_RATE * seconds + 1e-7);
  const countB = Math.floor(rateB * seconds + 1e-7);
  return {rateA:E1_RATE,rateB,countA,countB,excess:countB-countA};
}
