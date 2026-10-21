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
export const CHANNEL = {minimumLoss:87,maximumLoss:95};
export const REQUIREMENTS = {duration:300,minRate:10,targetBler:.01,maxEirp:20,maxBandwidth:20};
export const designDefaults = () => ({bandwidth:5,modulation:'16-QAM',antenna:'omni',power:12,coding:'3/4'});
export function environment() {
  const raw=Array.from({length:REQUIREMENTS.duration},(_,time)=>{
    const pulse=(center,width)=>Math.exp(-(((time-center)/width)**2));
    return 1.2+1.1*Math.sin(time*.055)+5*pulse(84,9)+6*pulse(206,12);
  });
  const minimum=Math.min(...raw),span=Math.max(...raw)-minimum;
  // One deterministic fading trace, with extrema matching the published channel passport.
  return raw.map((value,time)=>({time,loss:CHANNEL.minimumLoss+(CHANNEL.maximumLoss-CHANNEL.minimumLoss)*(value-minimum)/span}));
}
export function design(p) {
  if(!p || !DESIGN_OPTIONS.bandwidth.includes(p.bandwidth) || !MODES[p.modulation] || !ANTENNAS[p.antenna] || !CODINGS[p.coding] || !DESIGN_OPTIONS.power.includes(p.power))
    throw new RangeError('Unsupported design setting');
  const antenna=ANTENNAS[p.antenna],m=MODES[p.modulation],coding=CODINGS[p.coding],eirp=p.power+antenna.gain;
  const threshold=m.threshold+coding.thresholdShift;
  const nominalRate=p.bandwidth*m.bits*coding.rate*.8, noise=-94+10*Math.log10(p.bandwidth/5);
  const legal=eirp<=REQUIREMENTS.maxEirp && p.bandwidth<=REQUIREMENTS.maxBandwidth;
  if(!legal) return {legal:false,eirp,nominalRate,noise,threshold,samples:[],feasible:false};
  const snrRange={minimum:p.power+2*antenna.gain-CHANNEL.maximumLoss-noise,
    maximum:p.power+2*antenna.gain-CHANNEL.minimumLoss-noise};
  const targetBler=REQUIREMENTS.targetBler;
  const operatingRate=nominalRate*(1-targetBler),requiredSnr=threshold;
  const reserveSnr=snrRange.minimum-requiredSnr,rateReserve=operatingRate-REQUIREMENTS.minRate;
  const checks={rate:operatingRate>=REQUIREMENTS.minRate,snr:snrRange.minimum>=requiredSnr};
  const minimumRate=checks.snr?operatingRate:0;
  const samples=environment().map(e=>{
    const received=p.power+2*antenna.gain-e.loss,snr=received-noise;
    // Below the specified SNR the target BLER is not guaranteed; no new BLER is invented.
    const supported=snr>=requiredSnr,rate=supported?operatingRate:0;
    return {...e,received,snr,supported,bler:supported?targetBler:null,rate,meets:rate>=REQUIREMENTS.minRate};
  });
  const averageRate=samples.reduce((v,s)=>v+s.rate,0)/samples.length;
  return {legal:true,eirp,nominalRate,noise,threshold,snrRange,channel:{...CHANNEL},samples,averageRate,targetBler,operatingRate,
    minimumRate,requiredSnr,reserveSnr,rateReserve,checks,feasible:checks.rate&&checks.snr};
}
