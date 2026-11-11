/** Educational full-duplex link. Time in ms; only MAC bytes DA..FCS. */
export const DEFAULTS = Object.freeze({rate:10, propagation:0.2, recovery:0.6, error:false});
export function compare(config = DEFAULTS) {
  const c={...DEFAULTS,...config};
  if (![10,100,1000].includes(c.rate) || !Number.isFinite(c.propagation) || c.propagation<0 || c.propagation>2 || !Number.isFinite(c.recovery) || c.recovery<0 || c.recovery>5 || typeof c.error!=='boolean') throw new RangeError('Invalid link parameters');
  return [1500,100].map(payload=>{
    const count=1500/payload, bytes=payload+18, tx=bytes*8/(c.rate*1000), bad=count===1?0:7;
    const frames=Array.from({length:count},(_,index)=>({index,start:index*tx,end:(index+1)*tx,arrival:(index+1)*tx+c.propagation,damaged:c.error&&index===bad,retry:false}));
    const initialTx=count*tx, initialEnd=initialTx+c.propagation;
    // A higher layer learns of the failure after receiver-side recovery + return propagation.
    const feedbackStart=frames[bad].arrival+c.recovery;
    const feedbackEnd=feedbackStart+c.propagation;
    const retryStart=c.error?Math.max(initialTx,feedbackEnd):null;
    if(c.error) frames.push({index:bad,start:retryStart,end:retryStart+tx,arrival:retryStart+tx+c.propagation,damaged:false,retry:true});
    const end=Math.max(...frames.map(f=>f.arrival));
    const wait=c.error?retryStart-initialTx:0;
    return {payload,count,bytes,tx,bad,frames,initialTx,initialEnd,feedbackStart,feedbackEnd,retryStart,end,wait,
      wireBytes:count*bytes+(c.error?bytes:0),overhead:count*18+(c.error?18:0),retryBytes:c.error?bytes:0,
      phases:[{kind:'tx',start:0,end:initialTx},{kind:'wait',start:initialTx,end:initialTx+wait},...(c.error?[{kind:'retry',start:retryStart,end:retryStart+tx}]:[]),{kind:'prop',start:end-c.propagation,end}]};
  });
}
export function snapshot(lane,time) {
  const accepted=new Set(lane.frames.filter(f=>!f.damaged&&time+1e-9>=f.arrival).map(f=>f.index));
  const badFrame=lane.frames[lane.bad];
  let stage='Готов к передаче';
  if(time>=lane.end-1e-9) stage='Блок получен целиком';
  else if(lane.retryStart!==null&&time>=lane.retryStart) stage=time<lane.retryStart+lane.tx?'Повторная передача':'Повтор в пути';
  else if(badFrame.damaged&&time>=badFrame.arrival) stage=time<lane.initialTx?'Ошибка FCS · остальные кадры идут':'Ожидание повтора';
  else if(time>0) stage=time<lane.initialTx?'Передача в линию':'Последние байты в пути';
  const sent=lane.frames.reduce((sum,f)=>sum+Math.min(1,Math.max(0,(time-f.start)/lane.tx))*lane.bytes,0);
  return {accepted,received:accepted.size*lane.payload,sent,stage,done:time>=lane.end-1e-9};
}
