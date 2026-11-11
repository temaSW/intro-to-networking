/** Deterministic teaching models. PCM: microseconds; Beacon: milliseconds. */
export const PCM = Object.freeze({sampleRate:8000, slots:32, bits:8, voices:30, cycleUs:125, cycles:8});
export function channelSlot(channel) {
  if(!Number.isInteger(channel)||channel<1||channel>30) throw new RangeError('channel');
  return channel<16?channel:channel+1;
}
export function sampleCode(channel,cycle) {
  channelSlot(channel);
  if(!Number.isInteger(cycle)||cycle<0||cycle>=PCM.cycles) throw new RangeError('cycle');
  // Illustrative byte values, not a G.711 speech encoder.
  const phase=channel*.37;
  return Math.round(127.5+85*Math.sin(cycle*.63+phase)+25*Math.cos(cycle*1.12+phase));
}
export function pcmState(timeUs,channel=1) {
  const slot=channelSlot(channel),horizon=PCM.cycleUs*PCM.cycles;
  if(!Number.isFinite(timeUs)||timeUs<0||timeUs>horizon) throw new RangeError('time');
  const bitUs=PCM.cycleUs/(PCM.slots*PCM.bits);
  const bits=Math.min(2048,Math.floor(timeUs/bitUs+1e-8));
  const completedSlots=Math.floor(bits/8),wholeCycles=Math.floor(completedSlots/32),partialSlots=completedSlots%32;
  const serviceSlots=wholeCycles*2+(partialSlots>0?1:0)+(partialSlots>16?1:0);
  const activeSlot=Math.min(31,Math.floor((timeUs%125)/(125/32)));
  const cycle=Math.min(7,Math.floor(timeUs/125));
  const received=Array.from({length:8},(_,i)=>timeUs+1e-8>=i*125+(slot+1)*125/32);
  const speechBits=(completedSlots-serviceSlots)*8+(bits%8&&![0,16].includes(partialSlots)?bits%8:0);
  return {cycle,slot,activeSlot:timeUs===horizon?null:activeSlot,bits,speechBits,serviceBits:bits-speechBits,
    received,code:sampleCode(channel,cycle),bitsInSlot:bits%8,completedCycles:wholeCycles};
}
export const BEACON = Object.freeze({duration:0.5, periods:[100,500], horizon:1000});
export function beaconPlan(period,listen=0.5) {
  if(!BEACON.periods.includes(period)||!Number.isFinite(listen)||listen<0||listen>499.5) throw new RangeError('beacon parameters');
  const nextStart=Math.ceil((listen-1e-9)/period)*period;
  const end=nextStart+BEACON.duration;
  return {period,listen,nextStart,end,wait:end-listen,count:1000/period,airtime:1000/period*BEACON.duration};
}
export function beaconState(plan,time) {
  if(!Number.isFinite(time)||time<0||time>1000) throw new RangeError('time');
  const index=Math.floor(time/plan.period),offset=time-index*plan.period;
  const sending=time<1000&&offset<BEACON.duration;
  const discovered=time+1e-9>=plan.end;
  const listening=time>=plan.listen;
  const receiving=listening&&!discovered&&time>=plan.nextStart;
  const completed=Math.max(0,Math.min(plan.count,Math.floor((time-BEACON.duration+1e-9)/plan.period)+1));
  const occupied=Array.from({length:plan.count},(_,i)=>Math.max(0,Math.min(BEACON.duration,time-i*plan.period))).reduce((sum,value)=>sum+value,0);
  return {sending,discovered,listening,receiving,completed,occupied,
    waited:Math.max(0,Math.min(time,plan.end)-plan.listen),remaining:Math.max(0,plan.end-Math.max(time,plan.listen)),
    stage:discovered?'Сеть обнаружена':!listening?'Приём выключен':receiving?'Приём Beacon':'Поиск сети…'};
}
