// Generic frequency search; offsets and channel widths are not a Wi-Fi plan.
export const channels = Array.from({length:12}, (_,i) => ({number:i+1, center:i*5}));
export const sources = [
  {name:'Точка доступа A', label:'A', center:10, halfWidth:4, peak:1, known:true},
  {name:'Точка доступа B', label:'B', center:15, halfWidth:4, peak:.75, known:true},
  {name:'Точка доступа C', label:'C', center:30, halfWidth:4, peak:.65, known:true},
  {name:'Посторонняя передача', label:'Другая система', center:45, halfWidth:4, peak:.9, known:false},
];
export const receiverHalfWidth = 4;
export const energyThreshold = .12;

export function density(source, frequency) {
  const offset = (frequency-source.center)/source.halfWidth;
  return Math.abs(offset)>=1 ? 0 : source.peak*(1+Math.cos(Math.PI*offset))/2;
}

// Exact integral of the compact raised-cosine envelope, in relative power units.
export function bandPower(source, low, high) {
  const a = Math.max(low,source.center-source.halfWidth);
  const b = Math.min(high,source.center+source.halfWidth);
  if (a>=b) return 0;
  const primitive = f => source.peak/2*((f-source.center)+source.halfWidth/Math.PI*Math.sin(Math.PI*(f-source.center)/source.halfWidth));
  return primitive(b)-primitive(a);
}

export function observe(index) {
  if (!Number.isInteger(index) || index<0 || index>=channels.length) throw new RangeError('Unknown channel');
  const channel = channels[index];
  const low=channel.center-receiverHalfWidth, high=channel.center+receiverHalfWidth;
  const powers = sources.map(s=>bandPower(s,low,high));
  const power = powers.reduce((sum,p)=>sum+p,0);
  // Idealized feature check needs most of a known transmission inside the band.
  // No actual waveform/correlation, noise, packet decoding or capture simulation.
  const recognized = sources.filter((s,i)=>s.known && powers[i]/(s.peak*s.halfWidth)>=.8).map(s=>s.label);
  return {channel,low,high,power,energy:power>=energyThreshold,recognized};
}
