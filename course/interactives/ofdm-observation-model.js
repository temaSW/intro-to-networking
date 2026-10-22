import {fft} from './impulse-ask-model.js';

export const AMPLIFIERS = {
  A:{name:'УМ-1',noiseFigureDb:10,minGain:12,maxGain:42,clip:1.25},
  B:{name:'УМ-2',noiseFigureDb:3,minGain:24,maxGain:36,clip:.35},
  C:{name:'УМ-3',noiseFigureDb:6,minGain:30,maxGain:48,clip:3},
};
export const CABLES = {
  A:{name:'Кабель А',bandwidth:.65,lossDb:.5,priceRub:300},
  B:{name:'Кабель Б',bandwidth:3,lossDb:1.5,priceRub:1200},
  C:{name:'Кабель В',bandwidth:10,lossDb:8,priceRub:800},
  D:{name:'Кабель Г',bandwidth:6,lossDb:.8,priceRub:3500},
};
export function equipmentSettings(amplifier, gainDb) {
  const a=AMPLIFIERS[amplifier];
  if(!a || !Number.isFinite(gainDb) || gainDb<a.minGain || gainDb>a.maxGain)
    throw new RangeError('Invalid amplifier setting');
  return {gainDb,noiseFigureDb:a.noiseFigureDb,clip:a.clip};
}
// Complex baseband. Fs in MHz, delays in samples; NF relative to a calibrated reference source.
export function ofdmDefaults() {
  return {size:128, prefix:32, blocks:40, sampleRate:8, active:24, seed:17019,
    transmitDbm:0, lossDb:36, channelNoise:.0011, referenceNoise:.001, noiseFigureDb:10,
    gainDb:36, clip:1.25, frequencyOffsetKhz:7.5, frequencyAdjustmentKhz:0, equalizer:false, sensitivityDbm:-50, maximumInputDbm:-35,
    paths:[{delay:0, re:1, im:0}, {delay:8, re:.86*Math.cos(.4), im:.86*Math.sin(.4)}]};
}
// Cases vary the physical record and installed equipment; diagnoses are not UI labels.
const reflected=(delay,amplitude,phase)=>({delay,re:amplitude*Math.cos(phase),im:amplitude*Math.sin(phase)});
const direct=()=>({delay:0,re:1,im:0});
export const OFDM_VARIANTS = {
  1:{channel:{seed:17019,sampleRate:8,lossDb:36,channelNoise:.0011,referenceNoise:.001,frequencyOffsetKhz:7.5,
    paths:[direct(),reflected(8,.86,.4)]},initial:{amplifier:'A',gainDb:36,cableId:'A'}},
  2:{channel:{seed:27131,sampleRate:4,lossDb:42,channelNoise:.0008,referenceNoise:.0015,frequencyOffsetKhz:0,
    paths:[direct(),reflected(6,.75,.9),reflected(13,.25,-.8)]},initial:{amplifier:'A',gainDb:30,cableId:'B'}},
  3:{channel:{seed:38147,sampleRate:16,lossDb:30,channelNoise:.0005,referenceNoise:.0007,frequencyOffsetKhz:-6,
    paths:[direct()]},initial:{amplifier:'B',gainDb:36,cableId:'A'}},
  4:{channel:{seed:49157,sampleRate:2,lossDb:44,channelNoise:.0008,referenceNoise:.002,frequencyOffsetKhz:0,
    paths:[direct()]},initial:{amplifier:'A',gainDb:24,cableId:'C'}},
  5:{channel:{seed:50177,sampleRate:12,lossDb:32,channelNoise:.0009,referenceNoise:.0006,frequencyOffsetKhz:0,
    paths:[direct(),reflected(4,.72,1)]},initial:{amplifier:'C',gainDb:42,cableId:'A'}},
  6:{channel:{seed:61193,sampleRate:24,lossDb:40,channelNoise:.0025,referenceNoise:.0004,frequencyOffsetKhz:11,
    paths:[direct()]},initial:{amplifier:'A',gainDb:36,cableId:'D'}},
  7:{channel:{seed:72211,sampleRate:6,lossDb:34,channelNoise:.0006,referenceNoise:.0007,frequencyOffsetKhz:0,
    paths:[direct()]},initial:{amplifier:'B',gainDb:36,cableId:'A'}},
  8:{channel:{seed:83219,sampleRate:20,lossDb:38,channelNoise:.0007,referenceNoise:.0013,frequencyOffsetKhz:-9.5,
    paths:[direct(),reflected(3,.6,-.7),reflected(11,.5,1.2),reflected(19,.22,-1.4)]},initial:{amplifier:'A',gainDb:42,cableId:'C'}},
};
export function observationVariant(variant=1) {
  if(!Number.isInteger(variant)||!Object.hasOwn(OFDM_VARIANTS,variant))throw new RangeError('Unsupported observation variant');
  return structuredClone(OFDM_VARIANTS[variant]);
}
export function observationDefaults(variant=1) {
  return {...observationVariant(variant).initial,frequencyAdjustmentKhz:0,equalizer:false};
}
export function observeVariant(variant=1,controls={}) {
  const test=observationVariant(variant),c={...observationDefaults(variant),...controls};
  if(!CABLES[c.cableId])throw new RangeError('Unsupported cable');
  const r=observeOFDM({...test.channel,...equipmentSettings(c.amplifier,c.gainDb),
    frequencyAdjustmentKhz:c.frequencyAdjustmentKhz,equalizer:c.equalizer});
  const cable=cableWaveform(r.rxBits,{rate:2*r.carriers.length*r.parameters.sampleRate/(r.parameters.size+r.parameters.prefix),...CABLES[c.cableId]});
  return {...r,variant,cable};
}
// Serial NRZ output through a bandwidth-limited cable after demodulation.
// Rate in Mbit/s, bandwidth in MHz, time in us. No extra cable noise is added.
export function cableWaveform(bits, {rate=4.8, bandwidth=.65, lossDb=0, offset=128, count=24}={}) {
  if (!Array.isArray(bits) || bits.some(x=>x!==0 && x!==1) ||
      ![rate,bandwidth].every(x=>Number.isFinite(x)&&x>0) || !Number.isFinite(lossDb) || lossDb<0 ||
      !Number.isInteger(offset) || offset<0 || !Number.isInteger(count) || count<1 || offset+count>bits.length)
    throw new RangeError('Invalid cable waveform');
  const samplesPerBit=64, memory=Math.exp(-2*Math.PI*bandwidth/(rate*samplesPerBit)), amplitude=10**(-lossDb/20);
  const trace=[], decisions=[];
  let voltage=0;
  for(let n=0;n<offset+count;n++) {
    if(n===offset) trace.push({time:0,value:voltage});
    for(let k=0;k<samplesPerBit;k++) {
      voltage=memory*voltage+(1-memory)*(bits[n]?1:-1)*amplitude;
      if(n>=offset) {
        const time=(n-offset+(k+1)/samplesPerBit)/rate;
        trace.push({time,value:voltage});
        if(k===samplesPerBit/2-1) decisions.push({time,value:voltage,bit:voltage>=0?1:0,source:bits[n],index:n});
      }
    }
  }
  return {trace,decisions,bits:bits.slice(offset,offset+count),rate,bandwidth,lossDb,offset,count,
    duration:count/rate,errors:decisions.filter(x=>x.bit!==x.source).length};
}
export function observeOFDM(overrides={}) {
  const p={...ofdmDefaults(),...overrides}, n=p.size;
  p.amplifierNoise=overrides.amplifierNoise ?? p.referenceNoise*Math.sqrt(10**(p.noiseFigureDb/10)-1);
  if (!Number.isInteger(n) || n<2 || (n&(n-1)) || !Number.isInteger(p.active) || p.active<1 || 2*p.active>=n ||
      !Number.isInteger(p.blocks) || p.blocks<1 || !Number.isInteger(p.prefix) || p.prefix<0 || p.prefix>n ||
      !(p.sampleRate>0 && p.clip>0 && p.channelNoise>=0 && p.amplifierNoise>=0) ||
      ![p.sampleRate,p.clip,p.channelNoise,p.amplifierNoise,p.referenceNoise,p.noiseFigureDb,p.frequencyOffsetKhz,p.frequencyAdjustmentKhz].every(Number.isFinite) ||
      p.referenceNoise<0 || p.noiseFigureDb<0 || typeof p.equalizer!=='boolean' ||
      !Number.isInteger(p.seed) || p.seed<1 || p.seed>0xffffffff ||
      ![p.lossDb,p.gainDb,p.transmitDbm,p.sensitivityDbm,p.maximumInputDbm].every(Number.isFinite) || !p.paths.length ||
      p.paths.some(x=>!Number.isInteger(x.delay)||x.delay<0||![x.re,x.im].every(Number.isFinite)) ||
      p.sensitivityDbm>=p.maximumInputDbm ||
      Math.max(...p.paths.map(x=>x.delay))>p.prefix)
    throw new RangeError('Invalid OFDM experiment');
  let seed=p.seed;
  const rng=()=>{seed=(1664525*seed+1013904223)>>>0; return (seed+.5)/2**32;};
  const gaussian=()=>Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng());
  const carriers=Array.from({length:2*p.active},(_,i)=>i<p.active ? i-p.active : i-p.active+1);
  const txBits=[], txSymbols=[], txRe=[], txIm=[];
  const scale=n/Math.sqrt(carriers.length);
  for(let b=0;b<p.blocks;b++) {
    const re=new Float64Array(n), im=new Float64Array(n);
    for(const k of carriers) {
      const bits=[rng()>=.5 ? 1:0,rng()>=.5 ? 1:0];
      const point={i:(bits[0]?1:-1)/Math.SQRT2,q:(bits[1]?1:-1)/Math.SQRT2,carrier:k,block:b};
      txBits.push(...bits); txSymbols.push(point);
      re[(k+n)%n]=point.i; im[(k+n)%n]=point.q;
    }
    const time=fft(re,im,true);
    for(let i=-p.prefix;i<n;i++) {txRe.push(time.real[(i+n)%n]*scale); txIm.push(time.imag[(i+n)%n]*scale);}
  }
  const attenuation=10**(-p.lossDb/20), gain=10**(p.gainDb/20);
  const channelRe=[], channelIm=[], rxRe=[], rxIm=[];
  let clipped=0, channelNoiseEnergy=0, amplifierNoiseEnergy=0, inputEnergy=0;
  for(let i=0;i<txRe.length;i++) {
    let re=0, im=0;
    for(const path of p.paths) {
      const j=i-path.delay;
      if(j>=0) {re+=path.re*txRe[j]-path.im*txIm[j]; im+=path.re*txIm[j]+path.im*txRe[j];}
    }
    const cn=[gaussian()*p.channelNoise/Math.SQRT2,gaussian()*p.channelNoise/Math.SQRT2];
    const an=[gaussian()*p.amplifierNoise/Math.SQRT2,gaussian()*p.amplifierNoise/Math.SQRT2];
    channelNoiseEnergy+=cn[0]**2+cn[1]**2; amplifierNoiseEnergy+=an[0]**2+an[1]**2;
    channelRe.push(re*attenuation+cn[0]); channelIm.push(im*attenuation+cn[1]);
    re=(channelRe[i]+an[0])*gain; im=(channelIm[i]+an[1])*gain;
    const inputPower=(re*re+im*im)/(gain*gain);
    inputEnergy+=inputPower;
    const magnitude=Math.hypot(re,im), compression=Math.min(1,p.clip/Math.max(magnitude,1e-30));
    if(magnitude>p.clip) clipped++;
    // Receiver oscillator offset acts on complex time samples before FFT.
    const phase=2*Math.PI*(p.frequencyOffsetKhz-p.frequencyAdjustmentKhz)*i/(p.sampleRate*1000);
    rxRe.push(compression*(re*Math.cos(phase)-im*Math.sin(phase)));
    rxIm.push(compression*(re*Math.sin(phase)+im*Math.cos(phase)));
  }
  const spectrumTx=new Float64Array(n), spectrumRx=new Float64Array(n), spectrumOutput=new Float64Array(n), spectrumProcessed=new Float64Array(n), points=[], rxBits=[];
  for(let b=0;b<p.blocks;b++) {
    const start=b*(n+p.prefix)+p.prefix;
    const tx=fft(txRe.slice(start,start+n),txIm.slice(start,start+n));
    const rx=fft(rxRe.slice(start,start+n),rxIm.slice(start,start+n));
    for(let k=0;k<n;k++) {
      spectrumTx[k]+=(tx.real[k]**2+tx.imag[k]**2)/(n*n*p.blocks);
      // Retain input-referred power for diagnostics; the instrument displays actual output power.
      spectrumOutput[k]+=(rx.real[k]**2+rx.imag[k]**2)/(n*n*p.blocks);
      if(!carriers.includes(k<=n/2?k:k-n))
        spectrumProcessed[k]+=(rx.real[k]**2+rx.imag[k]**2)/(n*n*p.blocks);
      spectrumRx[k]+=(rx.real[k]**2+rx.imag[k]**2)/(n*n*gain*gain*p.blocks);
    }
    for(const k of carriers) {
      const index=(k+n)%n;
      // Known scalar loss/gain set the axes. Optional regularized one-tap channel equalization follows.
      const re=rx.real[index]/(scale*gain*attenuation), im=rx.imag[index]/(scale*gain*attenuation);
      let pi=re, pq=im;
      if(p.equalizer) {
        let hr=0, hi=0;
        for(const path of p.paths) {
          const a=-2*Math.PI*k*path.delay/n;
          hr+=path.re*Math.cos(a)-path.im*Math.sin(a);
          hi+=path.re*Math.sin(a)+path.im*Math.cos(a);
        }
        const variance=(p.channelNoise**2+p.amplifierNoise**2)/(attenuation**2)*carriers.length/n;
        const denominator=Math.max(hr*hr+hi*hi+variance,1e-14);
        const ei=(pi*hr+pq*hi)/denominator;
        pq=(pq*hr-pi*hi)/denominator; pi=ei;
      }
      // Digital output uses the same amplitude reference as the amplifier output.
      spectrumProcessed[index]+=(pi*pi+pq*pq)*(scale*gain*attenuation)**2/(n*n*p.blocks);
      const point={i:pi,q:pq,carrier:k,block:b};
      points.push(point); rxBits.push(point.i>=0?1:0,point.q>=0?1:0);
    }
  }
  const spectrum=Array.from({length:n},(_,i)=> {
    const k=i-n/2,index=(k+n)%n, f=k*p.sampleRate/n;
    let hr=0,hi=0;
    for(const path of p.paths) {
      const a=-2*Math.PI*f*path.delay/p.sampleRate;
      hr+=path.re*Math.cos(a)-path.im*Math.sin(a); hi+=path.re*Math.sin(a)+path.im*Math.cos(a);
    }
    return {frequency:f,tx:p.transmitDbm+10*Math.log10(Math.max(spectrumTx[index],1e-14)),
      rx:p.transmitDbm+10*Math.log10(Math.max(spectrumRx[index],1e-14)),output:p.transmitDbm+10*Math.log10(Math.max(spectrumOutput[index],1e-14)),
      processed:p.transmitDbm+10*Math.log10(Math.max(spectrumProcessed[index],1e-14)),channelGain:Math.hypot(hr,hi)};
  });
  const errors=rxBits.reduce((sum,bit,i)=>sum+(bit!==txBits[i]),0);
  const meanInputPower=inputEnergy/txRe.length;
  // Fixed educational receiver specifications, independent of the waveform or noise realization.
  const receiverRange={minimum:p.sensitivityDbm,maximum:p.maximumInputDbm,
    current:p.transmitDbm+10*Math.log10(Math.max(meanInputPower,1e-30))};
  return {parameters:p,carriers,txSymbols,points,txBits,rxBits,errors,bitCount:txBits.length,
    spectrum,clipped,samples:txRe.length,channelNoiseEnergy,amplifierNoiseEnergy,receiverRange,
    outputPower:spectrumOutput.reduce((a,b)=>a+b,0),
    transmittedPower:spectrumTx.reduce((a,b)=>a+b,0),receivedPower:spectrumRx.reduce((a,b)=>a+b,0)};
}
