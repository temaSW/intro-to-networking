// Independent calculation tasks for lecture 04. Milliseconds and decimal bytes.
export function checkBeaconPeriod(period){
  if(!Number.isFinite(period)||period<2||period>200)throw new RangeError('Period outside visual-check range');
  const duration=2,worstDelay=period+duration,servicePercent=100*duration/period;
  return {period,duration,worstDelay,servicePercent,delayPass:worstDelay<=100+1e-9,resourcePass:servicePercent<=5+1e-9,pass:worstDelay<=100+1e-9&&servicePercent<=5+1e-9};
}
export function checkAccessTime(start){
  if(!Number.isFinite(start)||start<0||start>100)throw new RangeError('Invalid start time');
  const end=start+2,windows=Array.from({length:5},(_,i)=>({start:8+20*i,end:12+20*i}));
  const readyPass=start>=31-1e-9,window=windows.find(w=>start>=w.start-1e-9&&end<=w.end+1e-9)??null,deadlinePass=end<=51+1e-9;
  return {start,end,windows,readyPass,window,deadlinePass,pass:readyPass&&!!window&&deadlinePass};
}
export function checkAccessIntervals(count){
  if(!Number.isInteger(count)||count<1||count>8)throw new RangeError('Invalid number of intervals');
  const pairs=Array.from({length:count},(_,a)=>Array.from({length:count},(_,b)=>({a:a+1,b:b+1,collision:a===b}))).flat();
  const collisions=pairs.filter(p=>p.collision).length,probability=collisions/pairs.length,reservedMs=2*count,resourcePercent=reservedMs/40*100;
  const probabilityPass=probability<=1/3+1e-9,resourcePass=resourcePercent<=15+1e-9;
  return {count,pairs,collisions,probability,reservedMs,resourcePercent,probabilityPass,resourcePass,pass:probabilityPass&&resourcePass};
}
export const SIMPLE_MODES={M1:{threshold:6,bytes:100},M2:{threshold:12,bytes:200}};
export function checkDirectionalAllocation(uplink,downlink){
  function direction(answer,snr){
    if(!answer||!Object.hasOwn(SIMPLE_MODES,answer.mode)||!Number.isInteger(answer.cells)||answer.cells<1||answer.cells>8)throw new RangeError('Invalid allocation');
    const mode=SIMPLE_MODES[answer.mode],allowed=snr>=mode.threshold,capacity=mode.bytes*answer.cells,volumePass=capacity>=250;
    const minimumCells=Math.min(...Object.values(SIMPLE_MODES).filter(m=>snr>=m.threshold).map(m=>Math.ceil(250/m.bytes)));
    const fills=Array.from({length:answer.cells},(_,i)=>Math.max(0,Math.min(mode.bytes,250-i*mode.bytes)));
    return {mode:answer.mode,cells:answer.cells,snr,threshold:mode.threshold,bytesPerCell:mode.bytes,capacity,allowed,volumePass,minimumCells,fills,feasible:allowed&&volumePass,optimal:allowed&&volumePass&&answer.cells===minimumCells};
  }
  const up=direction(uplink,8),down=direction(downlink,16);return {up,down,pass:up.optimal&&down.optimal};
}
export const SIMPLE_GRANT={frame:12,start:440,firstIntervalOffset:20,intervalDuration:2,band:'Б',slots:[3,4],cellBytes:144,overheadBytes:16,fileBytes:250};
export function checkFilePlan(plan,ready=463){
  if(![463,465].includes(ready)||!Array.isArray(plan)||plan.length!==2||plan.some(p=>!Number.isInteger(p.bytes)||p.bytes<1||p.bytes>250||!Number.isFinite(p.start)||p.start<0||p.start>1000))throw new RangeError('Incomplete plan');
  const g=SIMPLE_GRANT,capacity=g.cellBytes-g.overheadBytes;
  const slots=g.slots.map(id=>({id,start:g.start+g.firstIntervalOffset+(id-1)*g.intervalDuration,end:g.start+g.firstIntervalOffset+id*g.intervalDuration}));
  const rows=plan.map((p,i)=>{
    const end=p.start+g.intervalDuration,slot=slots.find(s=>Math.abs(s.start-p.start)<1e-7),issues=[];
    if(p.bytes>capacity)issues.push(`Данные и служебная часть занимают ${p.bytes+g.overheadBytes} байт при ёмкости ${g.cellBytes}.`);
    if(!slot)issues.push('Начало не совпадает с границей выделенного интервала.');
    if(p.start<ready-1e-7)issues.push(`Данные готовы только в ${ready} мс.`);
    return {id:`Д${i+1}`,bytes:p.bytes,start:p.start,end,slot:slot?.id??null,issues};
  });
  if(Math.max(rows[0].start,rows[1].start)<Math.min(rows[0].end,rows[1].end)-1e-7)for(const row of rows)row.issues.push('Две передачи перекрываются во времени.');
  for(const row of rows)row.valid=row.issues.length===0;
  const totalBytes=rows.reduce((sum,row)=>sum+row.bytes,0),totalPass=totalBytes===g.fileBytes;
  const deliveredBytes=totalPass?rows.filter(r=>r.valid).reduce((sum,r)=>sum+r.bytes,0):null;
  const availableSlots=slots.filter(s=>s.start>=ready-1e-7),maxBytes=availableSlots.length*capacity;
  return {ready,capacity,slots,rows,totalBytes,totalPass,deliveredBytes,remainingBytes:deliveredBytes===null?null:g.fileBytes-deliveredBytes,maxBytes,minimumRemaining:Math.max(0,g.fileBytes-maxBytes),pass:totalPass&&rows.every(r=>r.valid)};
}
