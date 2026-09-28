// First seven output bits of the IEEE 802.11 x^7 + x^4 + 1 example sequence.
// Subsequent bits obey s[n + 7] = s[n + 3] XOR s[n].
const initialSequence = [0, 0, 0, 0, 1, 1, 1];

export function scramblerMask(length) {
  const sequence = initialSequence.slice();
  for (let n = 0; sequence.length < length; n++) {
    sequence.push(sequence[n] ^ sequence[n + 3]);
  }
  return sequence.slice(0, length).join('');
}

export function bitStatistics(bits) {
  if (!bits) return {transitions: 0, longestRun: 0};
  let transitions = 0;
  let longestRun = 1;
  let run = 1;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === bits[i - 1]) {
      run++;
      longestRun = Math.max(longestRun, run);
    } else {
      transitions++;
      run = 1;
    }
  }
  return {transitions, longestRun};
}

export function scramble(bits) {
  const mask = scramblerMask(bits.length);
  const output = [...bits].map((bit, i) => Number(bit) ^ Number(mask[i])).join('');
  const restored = [...output].map((bit, i) => Number(bit) ^ Number(mask[i])).join('');
  return {input: bits, mask, output, restored,
    before: bitStatistics(bits), after: bitStatistics(output)};
}
