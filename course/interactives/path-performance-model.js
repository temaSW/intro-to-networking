/** SI on input: Mbit/s, km, bytes. Results: ms; FIFO queue of equal packets. */
export const DEFAULTS = Object.freeze({access:100, aggregation:20, distance:1000, bytes:1500, load:0, pattern:'burst'});
export const BUFFER = 8; // Waiting packets, excluding the packet being transmitted.
export const HORIZON = 100; // ms, common observation interval for both routes.
export const PROBE_TIME = 52.5; // ms, packet ready for aggregation output.
export function validate(c) {
  for(const [key,min,max] of [['access',10,1000],['aggregation',10,200],['distance',10,20000],['bytes',64,1500],['load',0,150]])
    if(!Number.isFinite(c[key]) || c[key]<min || c[key]>max) throw new RangeError(key);
  if(!Number.isInteger(c.bytes) || !['steady','burst'].includes(c.pattern)) throw new RangeError('packet or pattern');
}
export function route(config, variant='A') {
  validate(config);
  if(!['A','B'].includes(variant)) throw new RangeError('route');
  const c=config;
  const names=['Доступ','Агрегация','Ядро','Внешняя сеть','К серверу'];
  const rates=[c.access,c.aggregation,1000,50,100];
  const lengths=[1,20,c.distance,50,1];
  if(variant==='B') {
    rates.splice(1,1,c.aggregation*2); rates.splice(3,1,100,100);
    names.splice(3,1,'Внешняя сеть 1','Внешняя сеть 2');
    lengths.splice(2,2,c.distance*2,50,50);
  }
  return names.map((name,i)=>({name,rate:rates[i],km:lengths[i]}));
}
export function queue(rate, bytes, background, pattern='burst') {
  if(!Number.isFinite(rate) || rate<=0 || !Number.isFinite(bytes) || bytes<=0 ||
     !Number.isFinite(background) || background<0 || !['steady','burst'].includes(pattern)) throw new RangeError('queue');
  const service=bytes*8/(rate*1000);
  let active=[], nextSample=0, offered=0, lost=0, accepted=0, waitSum=0, maxWait=0, maxQueue=0, probe=null;
  const samples=[];
  const sample=t=>{
    const waiting=active.filter(j=>j.start>t+1e-9 && j.arrival<=t+1e-9).length;
    samples.push({time:t,queue:waiting});
  };
  const arrive=(time,isProbe=false)=>{
    while(nextSample<time-1e-9 && nextSample<=HORIZON) sample(nextSample++);
    active=active.filter(j=>j.finish>time+1e-9);
    const waiting=Math.max(0,active.length-1);
    offered++;
    if(active.length && waiting>=BUFFER) {
      lost++;
      if(isProbe) probe={lost:true,arrival:time,wait:null,queue:waiting};
    } else {
      const start=active.length?Math.max(time,active.at(-1).finish):time;
      const job={arrival:time,start,finish:start+service};
      active.push(job); accepted++; waitSum+=start-time; maxWait=Math.max(maxWait,start-time);
      maxQueue=Math.max(maxQueue,active.filter(j=>j.start>time+1e-9).length);
      if(isProbe) probe={...job,lost:false,wait:start-time,queue:waiting};
    }
  };
  const spacing=background>0?bytes*8/(background*1000):Infinity;
  let probeSent=false;
  for(let i=0;i*spacing<HORIZON-1e-9;i++) {
    const virtual=i*spacing;
    const time=pattern==='burst'?Math.floor(virtual/10)*10+(virtual%10)/2:virtual;
    if(!probeSent && PROBE_TIME<time-1e-9) {arrive(PROBE_TIME,true);probeSent=true;}
    arrive(time);
  }
  if(!probeSent) arrive(PROBE_TIME,true);
  while(nextSample<=HORIZON) sample(nextSample++);
  return {offered,lost,accepted,meanWait:waitSum/accepted,maxWait,maxQueue,probe,samples,service};
}
export function evaluate(config={...DEFAULTS},variant='A') {
  const links=route(config,variant);
  const background=config.aggregation*config.load/100;
  const residual=links.map((l,i)=>Math.max(0,l.rate-(i===1?background:0)));
  const raw=Math.min(...links.map(l=>l.rate)), available=Math.min(...residual);
  const q=queue(links[1].rate,config.bytes,background,config.pattern);
  const tx=links.reduce((sum,l)=>sum+config.bytes*8/(l.rate*1000),0);
  const propagation=links.reduce((sum,l)=>sum+l.km/200,0); // v=200,000 km/s.
  const processing=(links.length-1)*.05;
  const waiting=q.probe.wait;
  return {variant,links,background,raw,available,
    bottlenecks:links.filter((l,i)=>Math.abs(residual[i]-available)<1e-8).map(l=>l.name),
    tx,propagation,processing,waiting,total:q.probe.lost?null:tx+propagation+processing+waiting,
    queue:q, utilization:background/links[1].rate};
}
