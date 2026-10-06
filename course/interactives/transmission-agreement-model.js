// Pure numerical models. Time is measured in transmitted symbol periods unless stated otherwise.
export function random(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 4294967296; };
}
export function sequence(kind = 'pn') {
  let state = 31;
  return Array.from({length:31}, (_, i) => {
    if (kind === 'ones') return 1;
    if (kind === 'alternating') return i % 2 ? -1 : 1;
    const bit = state & 1;
    state = (state >>> 1) | (((state ^ (state >>> 2)) & 1) << 4);
    return bit ? 1 : -1;
  });
}
export function correlationIllustration(kind = 'bits', {snr=Infinity, samplesPerBit=1} = {}) {
  const dt=1/samplesPerBit,total=48;
  let state=15;
  const reference=Array.from({length:15},()=>{
    if(kind==='ones') return 1;
    const bit=state&1;
    state=(state>>>1)|(((state^(state>>>1))&1)<<3);
    return bit?1:-1;
  });
  const streamRng=random(21);
  const stream=Array.from({length:48},(_,i)=>i<8?-1:streamRng()<.5?-1:1);
  reference.forEach((v,i)=>{stream[18+i]=v;});
  const expand=values=>values.flatMap(v=>Array(samplesPerBit).fill(v));
  const sampledReference=expand(reference),clean=expand(stream),rng=random(79);
  const noise=clean.map(()=>Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng()));
  const noiseMean=noise.reduce((a,v)=>a+v,0)/noise.length;
  const noisePower=noise.reduce((a,v)=>a+(v-noiseMean)**2,0)/noise.length;
  const energy=sampledReference.reduce((a,v)=>a+v*v,0);
  // SNR refers to mean reference power; keep the same noise realization across slider changes.
  const sigma=Number.isFinite(snr)?Math.sqrt(energy/sampledReference.length*10**(-snr/10)/noisePower):0;
  const received=clean.map((v,i)=>v+sigma*(noise[i]-noiseMean));
  const scores=Array.from({length:received.length-sampledReference.length+1},(_,k)=>sampledReference.reduce((sum,v,i)=>sum+v*received[k+i],0)/energy);
  const peak=scores.indexOf(Math.max(...scores));
  return {kind,dt,total,reference,sampledReference,stream,clean,received,scores,peak,peakTime:peak*dt,maxTime:(scores.length-1)*dt};
}
export function timing({ppm = 100, elapsed = 2500, tracking = false} = {}) {
  const ratio = 1 + ppm/1e6;
  const offset = k => (k+.5)/ratio - (k+.5);
  const points = Array.from({length:12}, (_, i) => { const k = elapsed+i; return {k, t:tracking ? k+.5 : (k+.5)/ratio}; });
  return {points, drift:offset(elapsed), ratio, curve:Array.from({length:101}, (_,i)=>[i*100,offset(i*100)])};
}
export function frequency({hz = 10, ms = 40, compensate = false, estimateError = 0} = {}) {
  // Two known references 2 ms apart: phase difference is unambiguous in the ±50 Hz range.
  const phase = Math.atan2(Math.sin(2*Math.PI*hz*.002),Math.cos(2*Math.PI*hz*.002));
  const estimate = phase / (2*Math.PI*.002) + estimateError;
  const residual = hz - (compensate ? estimate : 0);
  const angle = 2*Math.PI*residual*ms/1000;
  const reference = [[1,1],[-1,1],[-1,-1],[1,-1]].map(([x,y])=>[x/Math.sqrt(2),y/Math.sqrt(2)]);
  const received = reference.map(([x,y])=>[x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle)]);
  return {reference,received,estimate,residual,angle,phaseCurve:Array.from({length:101},(_,i)=>[i,360*residual*i/1000])};
}
function classify(choices, count) {
  const bins = Array.from({length:count},()=>[]);
  choices.forEach(([id, option])=>bins[option].push(id));
  return {bins, successes:bins.filter(b=>b.length===1).flat(), collided:bins.filter(b=>b.length>1).flat(), conflicts:bins.filter(b=>b.length>1).length};
}
export function access({n = 24, m = 16, windows = 4, seed = 1} = {}) {
  const rng = random(seed);
  const first = classify(Array.from({length:n},(_,id)=>[id,Math.floor(rng()*m)]),m);
  // Failed devices independently select a future window AND an option inside it.
  const retry = classify(first.collided.map(id=>[id,Math.floor(rng()*windows)*m+Math.floor(rng()*m)]),m*windows);
  const probability = (1-1/m)**(n-1);
  return {first,retry,probability,expected:n*probability,successes:first.successes.length+retry.successes.length};
}
export function pilots({spacing = 8, period = 40, seed = 11} = {}) {
  const rng = random(seed), levels = [-1,-1/3,1/3,1];
  const channel = Array.from({length:97},(_,t)=>1+.4*Math.sin(2*Math.PI*t/period)+.15*Math.cos(2*Math.PI*t/(period*1.7)));
  const positions = Array.from({length:Math.floor(96/spacing)+1},(_,i)=>i*spacing);
  const mask = new Set(positions);
  const transmitted = channel.map((_,t)=>mask.has(t) ? 1 : levels[Math.floor(rng()*4)]);
  const received = channel.map((h,t)=>h*transmitted[t]+.03*(rng()*2-1));
  const estimates = channel.map((_,t)=>{
    const left = Math.min(Math.floor(t/spacing),positions.length-1), right = Math.min(left+1,positions.length-1);
    if (left===right) return received[positions[left]];
    const fraction = (t-positions[left])/(positions[right]-positions[left]);
    return received[positions[left]]*(1-fraction)+received[positions[right]]*fraction;
  });
  const recovered = received.map((y,t)=>y/estimates[t]);
  const data = channel.map((_,t)=>t).filter(t=>!mask.has(t));
  const decide = v=>levels.reduce((a,b)=>Math.abs(v-b)<Math.abs(v-a)?b:a);
  const errors = values=>data.filter(t=>decide(values[t])!==transmitted[t]).length;
  return {channel,positions,transmitted,received,estimates,recovered,data,overhead:positions.length/97,
    rmse:Math.sqrt(channel.reduce((a,h,t)=>a+(h-estimates[t])**2,0)/97),rawErrors:errors(received),errors:errors(recovered)};
}
