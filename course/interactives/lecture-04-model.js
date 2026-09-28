// Small deterministic teaching models shared by lecture 04 and its interactive page.
export function randomGenerator(seed = 42) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-12))) * Math.cos(2 * Math.PI * random());
}

function grayToBinary(gray) {
  let value = gray;
  for (let shifted = value >> 1; shifted; shifted >>= 1) value ^= shifted;
  return value;
}

function bitsToNumber(bits) { return bits.reduce((value, bit) => 2 * value + bit, 0); }
function numberToBits(value, count) { return Array.from({length: count}, (_, i) => (value >> (count - i - 1)) & 1); }

export function qamPoint(bits, order) {
  const side = Math.sqrt(order);
  const half = bits.length / 2;
  const scale = Math.sqrt(2 * (side * side - 1) / 3);
  const i = grayToBinary(bitsToNumber(bits.slice(0, half)));
  const q = grayToBinary(bitsToNumber(bits.slice(half)));
  return {x: (2 * i - side + 1) / scale, y: (2 * q - side + 1) / scale};
}

export function qamDecision(point, order) {
  const side = Math.sqrt(order);
  const half = Math.log2(side);
  const scale = Math.sqrt(2 * (side * side - 1) / 3);
  const nearest = coordinate => Math.min(side - 1, Math.max(0, Math.round((coordinate * scale + side - 1) / 2)));
  const i = nearest(point.x), q = nearest(point.y);
  return [...numberToBits(i ^ (i >> 1), half), ...numberToBits(q ^ (q >> 1), half)];
}

export function idealConstellation(order) {
  return Array.from({length: order}, (_, index) => qamPoint(numberToBits(index, Math.log2(order)), order));
}

export function transmit(bits, order, snrDb, random) {
  const ideal = qamPoint(bits, order);
  const sigma = Math.sqrt(1 / (2 * 10 ** (snrDb / 10)));
  const received = {x: ideal.x + sigma * gaussian(random), y: ideal.y + sigma * gaussian(random)};
  return {ideal, received, decided: qamDecision(received, order)};
}

export function simulateConstellation(order, snrDb, count, seed = 42) {
  const random = randomGenerator(seed);
  const bitCount = Math.log2(order);
  const points = [];
  let symbolErrors = 0, bitErrors = 0;
  for (let n = 0; n < count; n++) {
    const bits = Array.from({length: bitCount}, () => random() < .5 ? 0 : 1);
    const result = transmit(bits, order, snrDb, random);
    const errors = bits.reduce((sum, bit, i) => sum + (bit !== result.decided[i] ? 1 : 0), 0);
    symbolErrors += errors > 0 ? 1 : 0;
    bitErrors += errors;
    // Count every symbol, but keep the SVG responsive with a representative subset.
    if (n % Math.max(1, Math.ceil(count / 500)) === 0) points.push({...result, error: errors > 0});
  }
  return {points, ideal: idealConstellation(order), symbolErrors, bitErrors, transmittedBits: count * bitCount};
}
