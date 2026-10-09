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
// Complex values are [I,Q]; these helpers operate on samples, not display state.
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const mul=(a,b)=>[a[0]*b[0]-a[1]*b[1],a[0]*b[1]+a[1]*b[0]];
const conj=a=>[a[0],-a[1]];
export const magnitude=a=>Math.hypot(...a);
const rotation=angle=>[Math.cos(angle),Math.sin(angle)];
const divide=(a,b)=>{const e=Math.max(1e-12,b[0]**2+b[1]**2);return mul(a,conj(b)).map(v=>v/e);};
const gaussian=rng=>Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng());
const qpsk=[[1,1],[-1,1],[-1,-1],[1,-1]].map(p=>p.map(v=>v/Math.sqrt(2)));
const nearest=(p,list)=>list.reduce((best,v,i)=>magnitude([p[0]-v[0],p[1]-v[1]])<magnitude([p[0]-list[best][0],p[1]-list[best][1]])?i:best,0);
const evm=(received,transmitted,indices)=>Math.sqrt(indices.reduce((sum,i)=>sum+(received[i][0]-transmitted[i][0])**2+(received[i][1]-transmitted[i][1])**2,0)/Math.max(1,indices.length));
export function frequency({hz=35,snr=Infinity,length=32,seed=13}={}) {
  const dt=.001,rng=random(seed),sigma=Number.isFinite(snr)?Math.sqrt(10**(-snr/10)/2):0;
  const known=Array.from({length},(_,i)=>qpsk[(i*3+Math.floor(i/3))%4]);
  const receive=(p,t)=>add(mul(p,rotation(2*Math.PI*hz*t)),[sigma*gaussian(rng),sigma*gaussian(rng)]);
  const referenceReceived=known.map((p,i)=>receive(p,i*dt));
  const stripped=referenceReceived.map((p,i)=>mul(p,conj(known[i])));
  const correlation=stripped.slice(1).reduce((sum,p,i)=>add(sum,mul(p,conj(stripped[i]))),[0,0]);
  const estimate=Math.atan2(correlation[1],correlation[0])/(2*Math.PI*dt);
  const transmitted=Array.from({length:48},(_,i)=>qpsk[(i*7+Math.floor(i/5))%4]);
  const times=transmitted.map((_,i)=>(length+i)*dt);
  const received=transmitted.map((p,i)=>receive(p,times[i]));
  const corrected=received.map((p,i)=>mul(p,rotation(-2*Math.PI*estimate*times[i])));
  let last=0,unwrapped=0;
  const phase=stripped.map((p,i)=>{
    const angle=Math.atan2(p[1],p[0]);
    if(i===0)unwrapped=angle;else unwrapped+=Math.atan2(Math.sin(angle-last),Math.cos(angle-last));
    last=angle;return [i*dt*1000,unwrapped*180/Math.PI];
  });
  const indices=transmitted.map((_,i)=>i);
  const errors=values=>indices.filter(i=>nearest(values[i],qpsk)!==nearest(transmitted[i],qpsk)).length;
  return {dt,known,referenceReceived,reference:qpsk,transmitted,received,corrected,phase,estimate,residual:hz-estimate,
    estimatedPhase:phase.map(([t])=>[t,360*estimate*t/1000]),rawEvm:evm(received,transmitted,indices),evm:evm(corrected,transmitted,indices),rawErrors:errors(received),errors:errors(corrected)};
}
function classify(choices,count) {
  const bins=Array.from({length:count},()=>[]);
  choices.forEach(([id,option])=>bins[option].push(id));
  return {bins,successes:bins.filter(b=>b.length===1).flat(),collided:bins.filter(b=>b.length>1).flat(),conflicts:bins.filter(b=>b.length>1).length};
}
export function access({n=8,m=6,seed=1}={}) {
  const rng=random(seed),choices=Array.from({length:n},(_,id)=>[id,Math.floor(rng()*m)]);
  const first=classify(choices,m),probability=(1-1/m)**(n-1);
  return {choices,first,probability,expected:n*probability,empty:first.bins.filter(b=>!b.length).length,share:first.successes.length/n};
}
export function allocation({demands=[4,8,12],rows=4,columns=8,reserved=2}={}) {
  const total=rows*columns,capacity=total-reserved,granted=demands.map(()=>0);
  let remaining=capacity;
  // One element per nonempty request each round: a transparent teaching rule, not an optimized scheduler.
  while(remaining>0) {
    let changed=false;
    demands.forEach((request,i)=>{if(remaining>0&&granted[i]<request){granted[i]++;remaining--;changed=true;}});
    if(!changed)break;
  }
  const cells=Array(reserved).fill(-2);
  granted.forEach((count,i)=>cells.push(...Array(count).fill(i)));
  while(cells.length<total)cells.push(-1);
  const assignments=demands.map((_,id)=>cells.flatMap((v,index)=>v===id?[{time:index%columns+1,frequency:Math.floor(index/columns)+1}]:[]));
  return {total,capacity,reserved,cells,granted,assignments,unmet:demands.map((v,i)=>v-granted[i]),unused:remaining};
}
export function constellation(mode='QPSK') {
  const count=mode==='BPSK'?2:mode==='QPSK'?4:16,bitsPerSymbol=Math.log2(count);
  const levels=[-3,-1,3,1];
  return Array.from({length:count},(_,n)=>({bits:n.toString(2).padStart(bitsPerSymbol,'0'),point:mode==='BPSK'?[n?1:-1,0]:mode==='QPSK'?[(n&2)?1/Math.sqrt(2):-1/Math.sqrt(2),(n&1)?1/Math.sqrt(2):-1/Math.sqrt(2)]:[levels[n>>2]/Math.sqrt(10),levels[n&3]/Math.sqrt(10)]}));
}
export function modulate(bits,mode) {
  const alphabet=constellation(mode),width=alphabet[0].bits.length;
  return Array.from({length:Math.ceil(bits.length/width)},(_,i)=>alphabet[parseInt(bits.slice(i*width,(i+1)*width).padEnd(width,'0'),2)].point);
}
export function demodulate(symbols,mode) {
  const alphabet=constellation(mode),locations=alphabet.map(a=>a.point);
  return symbols.map(p=>alphabet[nearest(p,locations)].bits).join('');
}
export function bootstrapFrame(mode='QPSK') {
  const modes=['BPSK','QPSK','16-QAM'],message='ACCESS=4;DATA=OK';
  const payloadBits=Array.from(message,c=>c.charCodeAt(0).toString(2).padStart(8,'0')).join('');
  const payload=modulate(payloadBits,mode);
  const headerBits=modes.indexOf(mode).toString(2).padStart(2,'0')+payload.length.toString(2).padStart(8,'0');
  return {mode,message,payloadBits,payload,headerBits,header:modulate(headerBits,'BPSK'),syncLength:15,totalSymbols:15+10+payload.length};
}
export function readBootstrap(header) {
  const bits=demodulate(header,'BPSK');
  return {mode:['BPSK','QPSK','16-QAM'][parseInt(bits.slice(0,2),2)],symbols:parseInt(bits.slice(2),2)};
}
export function decodePayload(payload,mode) {
  const bits=demodulate(payload,mode);
  const text=Array.from({length:Math.floor(bits.length/8)},(_,i)=>{
    const n=parseInt(bits.slice(i*8,i*8+8),2);return n>=32&&n<=126?String.fromCharCode(n):'·';
  }).join('');
  return {bits,text};
}
export function pilots({spacing=8,center=24,depth=.8,width=5,snr=Infinity,seed=11}={}) {
  const count=64,rng=random(seed),sigma=Number.isFinite(snr)?Math.sqrt(10**(-snr/10)/2):0;
  const positions=Array.from({length:Math.floor(63/spacing)+1},(_,i)=>i*spacing);
  if(positions.at(-1)!==63)positions.push(63);
  const mask=new Set(positions),data=Array.from({length:count},(_,i)=>i).filter(k=>!mask.has(k));
  const channel=Array.from({length:count},(_,k)=>{
    const amplitude=1-depth*Math.exp(-(((k-center)/width)**2)),phase=1.2*Math.sin(k/11)+.55*k/63;
    return rotation(phase).map(v=>v*amplitude);
  });
  const dataSymbols=channel.map(()=>qpsk[Math.floor(rng()*4)]);
  const transmitted=dataSymbols.map((p,k)=>mask.has(k)?[1,0]:p);
  const received=channel.map((h,k)=>add(mul(h,transmitted[k]),[sigma*gaussian(rng),sigma*gaussian(rng)]));
  const observations=positions.map(k=>divide(received[k],transmitted[k]));
  const estimates=channel.map((_,k)=>{
    let right=positions.findIndex(p=>p>=k);if(right===0)return observations[0].slice();
    const left=right-1,fraction=(k-positions[left])/(positions[right]-positions[left]);
    return observations[left].map((v,j)=>v*(1-fraction)+observations[right][j]*fraction);
  });
  const recovered=received.map((y,k)=>divide(y,estimates[k]));
  const errors=values=>data.filter(k=>nearest(values[k],qpsk)!==nearest(transmitted[k],qpsk)).length;
  return {channel,positions,observations,transmitted,received,estimates,recovered,data,reference:qpsk,overhead:positions.length/count,
    rmse:evm(estimates,channel,Array.from({length:count},(_,i)=>i)),rawEvm:evm(received,transmitted,data),evm:evm(recovered,transmitted,data),rawErrors:errors(received),errors:errors(recovered)};
}
