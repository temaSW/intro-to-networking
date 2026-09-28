// Pure models shared by the lecture widget and reusable exercises.
export const SEGMENTS = [
  { base: 0, step: 1 }, { base: 16, step: 1 },
  { base: 32, step: 2 }, { base: 64, step: 4 },
  { base: 128, step: 8 }, { base: 256, step: 16 },
  { base: 512, step: 32 }, { base: 1024, step: 64 },
];

export function compand(sample) {
  const value = Math.max(-2047, Math.min(2047, Math.trunc(Number(sample) || 0)));
  const magnitude = Math.abs(value);
  const segment = Math.max(0, SEGMENTS.findLastIndex(({base}) => magnitude >= base));
  const {base, step} = SEGMENTS[segment];
  const position = Math.min(15, Math.floor((magnitude - base) / step));
  const word = `${value >= 0 ? 1 : 0}${segment.toString(2).padStart(3, '0')}${position.toString(2).padStart(4, '0')}`;
  const reconstructed = (value >= 0 ? 1 : -1) * (base + (position + 0.5) * step);
  return {value, segment, base, step, position, word, reconstructed,
    error: reconstructed - value};
}

// Each bit is represented by two equal half-bit levels; B/V markers retain the HDB-3 decisions.
export function lineCodes(input) {
  const bits = String(input).replace(/[^01]/g, '').slice(0, 64);
  const nrz = [], rz = [], amiNrz = [], amiRz = [], hdb = [], manchester = [], differential = [], cmi = [];
  let polarity = -1, onesSince = 0, lastPulse = -1, phase = 1, cmiOne = -1;
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i];
    nrz.push(bit === '1' ? [1, 1] : [0, 0]);
    rz.push(bit === '1' ? [1, 0] : [0, 0]);
    if (bit === '1') {
      polarity *= -1;
      amiNrz.push([polarity, polarity]);
      amiRz.push([polarity, 0]);
    } else { amiNrz.push([0, 0]); amiRz.push([0, 0]); }
    manchester.push(bit === '1' ? [1, -1] : [-1, 1]);
    if (bit === '1') phase *= -1;
    differential.push([phase, -phase]);
    if (bit === '1') { cmiOne *= -1; cmi.push([cmiOne, cmiOne]); }
    else cmi.push([-1, 1]);

    if (bit === '1') {
      lastPulse *= -1;
      hdb.push({level:lastPulse, marker:''});
      onesSince++;
    } else {
      hdb.push({level:0, marker:''});
      if (i >= 3 && bits.slice(i - 3, i + 1) === '0000' &&
          hdb.slice(-4).every(cell => cell.level === 0)) {
        if (onesSince % 2 === 0) {
          const b = -lastPulse;
          hdb[i - 3] = {level:b, marker:'B'};
          hdb[i] = {level:b, marker:'V'};
          lastPulse = b;
        } else {
          hdb[i] = {level:lastPulse, marker:'V'};
        }
        onesSince = 0;
      }
    }
  }
  return {bits, nrz, rz, amiNrz, amiRz, hdb,
    hdbRz:hdb.map(({level}) => [level, 0]),
    manchester, differential, cmi};
}

// The first two columns of the teaching table are opposite-polarity variants.
export const FOUR_B_THREE_T = {
  '0000':'---','0001':'--0','0010':'-0-','0011':'0--',
  '0100':'--+','0101':'-+-','0110':'+--','0111':'-+0',
  '1000':'+0-','1001':'0-+','1010':'+-0','1011':'-0+',
  '1100':'0+-','1101':'-++','1110':'++-','1111':'+-+',
};

export function fourBThreeT(input) {
  const bits = String(input).replace(/[^01]/g, '');
  const blocks = [];
  for (let i = 0; i + 4 <= bits.length; i += 4) {
    const word = bits.slice(i, i + 4);
    const first = FOUR_B_THREE_T[word];
    blocks.push({word, first, opposite:first.replace(/[+-]/g, c => c === '+' ? '-' : '+')});
  }
  return {blocks, remainder:bits.length % 4};
}
