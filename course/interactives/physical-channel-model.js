// Educational link trial. MHz, Mbit/s, dBm, dB and seconds.
export const ANTENNAS = {
  omni:{name:'Всенаправленная',gain:0,mount:'Установка без точного наведения'},
  panel:{name:'Панельная',gain:4,mount:'Наведение и крепление на стене'},
  dish:{name:'Узконаправленная',gain:8,mount:'Точное наведение и жёсткое крепление'},
};
export const MODES = {QPSK:{bits:2,threshold:14},'16-QAM':{bits:4,threshold:22},'64-QAM':{bits:6,threshold:28}};
// Coding-rate thresholds are conditional characteristics of the educational equipment.
export const CODINGS = {
  '1/2':{rate:1/2,thresholdShift:-3},
  '2/3':{rate:2/3,thresholdShift:-1.5},
  '3/4':{rate:3/4,thresholdShift:0},
  '5/6':{rate:5/6,thresholdShift:1.5},
};
export const DESIGN_OPTIONS = {
  bandwidth:Array.from({length:20},(_,i)=>i+1),
  power:Array.from({length:25},(_,i)=>i),
};
export const REQUIREMENTS = {duration:300,targetBler:.01,overhead:.2};
export const VARIANTS = {
  1:{minRate:10,maxBandwidth:5,maxEirp:20,minimumLoss:84,maximumLoss:92},
  2:{minRate:12,maxBandwidth:10,maxEirp:20,minimumLoss:87,maximumLoss:95},
  3:{minRate:15,maxBandwidth:16,maxEirp:16,minimumLoss:86,maximumLoss:94},
  4:{minRate:18,maxBandwidth:12,maxEirp:22,minimumLoss:87,maximumLoss:95},
  5:{minRate:20,maxBandwidth:8,maxEirp:24,minimumLoss:82,maximumLoss:90},
  6:{minRate:24,maxBandwidth:12,maxEirp:22,minimumLoss:84,maximumLoss:92},
  7:{minRate:30,maxBandwidth:16,maxEirp:20,minimumLoss:82,maximumLoss:90},
  8:{minRate:36,maxBandwidth:20,maxEirp:20,minimumLoss:82,maximumLoss:90},
};
export function variantSettings(variant=1) {
  if(!Number.isInteger(variant)||!Object.hasOwn(VARIANTS,variant))throw new RangeError('Unsupported variant');
  return {...REQUIREMENTS,...VARIANTS[variant],variant};
}
export const designDefaults = () => ({bandwidth:5,modulation:'16-QAM',antenna:'omni',power:12,coding:'3/4'});
export function environment(variant=1) {
  const c=variantSettings(variant);
  const raw=Array.from({length:REQUIREMENTS.duration},(_,time)=>{
    const pulse=(center,width)=>Math.exp(-(((time-center)/width)**2));
    return 1.2+1.1*Math.sin(time*.055)+5*pulse(84,9)+6*pulse(206,12);
  });
  const minimum=Math.min(...raw),span=Math.max(...raw)-minimum;
  // One deterministic fading trace, with extrema matching the published channel passport.
  return raw.map((value,time)=>({time,loss:c.minimumLoss+(c.maximumLoss-c.minimumLoss)*(value-minimum)/span}));
}
// Static assessment is shared by the trial and exhaustive checks of the variant pool.
export function assessDesign(p,variant=1) {
  const c=variantSettings(variant);
  if(!p || !DESIGN_OPTIONS.bandwidth.includes(p.bandwidth) || !MODES[p.modulation] || !ANTENNAS[p.antenna] || !CODINGS[p.coding] || !DESIGN_OPTIONS.power.includes(p.power))
    throw new RangeError('Unsupported design setting');
  const antenna=ANTENNAS[p.antenna],m=MODES[p.modulation],coding=CODINGS[p.coding],eirp=p.power+antenna.gain;
  const threshold=m.threshold+coding.thresholdShift;
  const nominalRate=p.bandwidth*m.bits*coding.rate*(1-c.overhead),noise=-94+10*Math.log10(p.bandwidth/5);
  const snrRange={minimum:p.power+2*antenna.gain-c.maximumLoss-noise,
    maximum:p.power+2*antenna.gain-c.minimumLoss-noise};
  const operatingRate=nominalRate*(1-c.targetBler),requiredSnr=threshold;
  const reserveSnr=snrRange.minimum-requiredSnr,rateReserve=operatingRate-c.minRate;
  const checks={bandwidth:p.bandwidth<=c.maxBandwidth,eirp:eirp<=c.maxEirp,
    rate:operatingRate>=c.minRate,snr:snrRange.minimum>=requiredSnr};
  return {variant,requirements:c,legal:checks.bandwidth&&checks.eirp,eirp,nominalRate,noise,threshold,snrRange,
    channel:{minimumLoss:c.minimumLoss,maximumLoss:c.maximumLoss},targetBler:c.targetBler,operatingRate,
    minimumRate:checks.snr?operatingRate:0,requiredSnr,reserveSnr,rateReserve,checks,
    feasible:Object.values(checks).every(Boolean)};
}
export function design(p,variant=1) {
  const r=assessDesign(p,variant);
  if(!r.legal)return {...r,samples:[]};
  const antenna=ANTENNAS[p.antenna];
  const samples=environment(variant).map(e=>{
    const received=p.power+2*antenna.gain-e.loss,snr=received-r.noise;
    const supported=snr>=r.requiredSnr,rate=supported?r.operatingRate:0;
    return {...e,received,snr,supported,bler:supported?r.targetBler:null,rate,meets:rate>=r.requirements.minRate};
  });
  return {...r,samples,averageRate:samples.reduce((v,s)=>v+s.rate,0)/samples.length};
}
