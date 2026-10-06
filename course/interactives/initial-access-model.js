// Functional acquisition and access model. Time is in educational windows.
import {correlationIllustration, random} from './transmission-agreement-model.js';
export {random};
export const frameObservation = () => correlationIllustration('bits');
export function carrierObservation({hz=25, estimate=0}={}) {
  if (![hz,estimate].every(Number.isFinite) || Math.abs(hz)>80 || Math.abs(estimate)>80) throw new RangeError('Invalid frequency');
  return {hz,estimate,residual:hz-estimate,points:Array.from({length:9},(_,i)=>{
    const t=i*.004,phase=2*Math.PI*hz*t,correctedPhase=2*Math.PI*(hz-estimate)*t;
    return {t,phase,correctedPhase,raw:[Math.cos(phase),Math.sin(phase)],corrected:[Math.cos(correctedPhase),Math.sin(correctedPhase)]};
  })};
}
export class InitialAccess {
  constructor(){this.reset();}
  reset(){
    this.frameTiming=null;this.carrierKnown=false;this.carrierEstimate=0;this.info=false;
    this.context=null;this.known=false;this.requested=false;this.serviceGrant=null;this.grant=null;
    this.time=0;this.queue=1;this.sent=0;this.waiting=false;this.timedOut=false;this.messages=[];
  }
  locateFrame(guess){
    const d=frameObservation();
    if(!Number.isInteger(guess)||guess<0||guess>=d.scores.length)throw new RangeError('Invalid frame guess');
    const correct=guess===d.peak;if(correct)this.frameTiming=d.peak;
    return {correct,peak:d.peak,score:d.scores[guess]};
  }
  tuneCarrier(estimate){
    if(this.frameTiming===null)throw new Error('Find frame timing first');
    if(this.info)throw new Error('Restart the story before changing acquired carrier');
    const d=carrierObservation({estimate});this.carrierEstimate=estimate;this.carrierKnown=Math.abs(d.residual)<=1;return d;
  }
  readSystemInfo(){
    if(this.frameTiming===null||!this.carrierKnown)throw new Error('Frame and carrier required');
    this.info=true;return {options:4,responseWindow:1,backoff:4};
  }
  canUse(resource){
    if(resource==='common')return this.info&&!this.context&&!this.waiting;
    if(resource==='service')return !!this.serviceGrant;
    if(resource==='data')return this.checkData().allowed;
    return false;
  }
  beginAccess(){
    if(!this.canUse('common'))throw new Error('Only informed unknown terminals may attempt common access');
    this.waiting=true;this.timedOut=false;
  }
  resolveAccess(detected){
    if(!this.waiting)throw new Error('No expected response');
    this.time++;this.waiting=false;
    if(detected){this.context='В-A';this.serviceGrant={resource:'С-A',time:this.time+1};this.messages.push({from:'Сеть',to:'A',text:'Временный контекст В-A; служебный ресурс С-A для индивидуальных сведений'});}
    else this.timedOut=true;
  }
  identify(){
    if(!this.serviceGrant||this.serviceGrant.time!==this.time+1)throw new Error('Service grant required');
    this.time++;this.serviceGrant=null;this.known=true;
    this.messages.push({from:'A',to:'Сеть',text:'Индивидуальные сведения в С-A; теперь сеть различает телефон'});
  }
  requestResource(){
    if(!this.known||!this.queue||this.requested)throw new Error('Addressed context and data required');
    this.time++;this.requested=true;this.messages.push({from:'A',to:'Сеть',text:'Адресный запрос: есть один пользовательский блок'});
  }
  assignResource(){
    if(!this.requested||this.grant)throw new Error('Request required');
    this.time++;this.grant={resource:'Д-A',time:this.time+1};
    this.messages.push({from:'Сеть',to:'A',text:`Назначение: Д-A, момент ${this.grant.time}; только для пользовательского блока`});
  }
  checkData(resource=this.grant?.resource,time=this.time+1){
    let reason='';
    if(!this.queue)reason='Пользовательский блок уже передан.';
    else if(!this.info)reason='Сначала нужно найти структуру кадра, уточнить несущую и прочитать общие правила.';
    else if(!this.known)reason='Индивидуальный ресурс не назначен. Сеть ещё не знает телефон для адресного назначения; разрешена только служебная попытка через общий ресурс.';
    else if(!this.grant)reason='Телефон известен сети, но служебный ресурс не даёт права передавать пользовательские данные. Нужны запрос и пользовательское назначение.';
    else if(resource!==this.grant.resource||time!==this.grant.time)reason='Назначение действует только в указанном ресурсе и в указанное время.';
    return {allowed:!reason,reason:reason||`Можно передать блок в ${resource}, в момент ${time}.`};
  }
  transmit(resource,time){
    if(!this.grant||resource!==this.grant.resource||time!==this.grant.time)throw new Error('Назначение действует только в указанном ресурсе и в указанное время.');
    const permission=this.checkData(resource,time);if(!permission.allowed)throw new Error(permission.reason);
    this.time=time;this.queue--;this.sent++;this.grant=null;this.requested=false;
    this.messages.push({from:'A',to:'Сеть',text:`Первый пользовательский блок передан в ${resource}, момент ${time}`});
  }
  knowledge(){return ['символьный такт',this.frameTiming!==null&&'границу кадра',this.carrierKnown&&'уточнённую несущую',this.info&&'правила доступа',this.context&&`временный контекст ${this.context}`,this.known&&'адресный контекст',this.grant&&`назначение ${this.grant.resource} в момент ${this.grant.time}`].filter(Boolean);}
  permission(){
    if(this.sent)return 'Первый блок передан; для следующих данных потребуется новое назначение.';
    if(this.grant)return 'Передать пользовательский блок только в назначенном ресурсе и времени.';
    if(this.requested)return 'Принимать адресное назначение ресурса.';
    if(this.known)return 'Запросить пользовательский ресурс.';
    if(this.context)return 'Передать индивидуальные сведения в служебном ресурсе.';
    if(this.waiting)return 'Ждать ответа: исход попытки телефону ещё неизвестен.';
    if(this.info)return 'Обратиться через общий ресурс; пользовательская передача запрещена.';
    if(this.carrierKnown)return 'Принимать широковещательную служебную информацию.';
    if(this.frameTiming!==null)return 'Принимать нужные участки кадра и уточнять несущую.';
    return 'Только принимать; искать кадр по известной последовательности.';
  }
}
export class Contention {
  constructor({terminals=2,options=4,backoff=4,seed=7}={}){
    for(const [v,min,max] of [[terminals,2,8],[options,1,8],[backoff,0,8]])if(!Number.isInteger(v)||v<min||v>max)throw new RangeError('Invalid contention parameter');
    this.config={terminals,options,backoff,seed};this.reset();
  }
  reset(){this.rng=random(this.config.seed);this.window=0;this.phase='access';this.events=[];this.bins=[];this.terminals=Array.from({length:this.config.terminals},(_,id)=>({id,status:'ready',choice:null,retry:0,detected:false,context:null,attempts:0}));}
  attempt(choices=null){
    if(this.phase!=='access')throw new Error('Wait for response timeout');
    const eligible=this.terminals.filter(t=>!t.context&&this.window>=t.retry);
    if(choices&&eligible.some(t=>!Number.isInteger(choices[t.id])||choices[t.id]<0||choices[t.id]>=this.config.options))throw new RangeError('Invalid choices');
    this.events=[];this.bins=Array.from({length:this.config.options},()=>[]);
    for(const t of eligible){t.choice=choices?choices[t.id]:Math.floor(this.rng()*this.config.options);t.status='waiting';t.attempts++;this.bins[t.choice].push(t.id);}
    this.bins.forEach((ids,option)=>{if(!ids.length)return;const detected=ids.length===1;ids.forEach(id=>this.terminals[id].detected=detected);this.events.push({kind:detected?'success':'collision',ids,option});});
    this.phase='response';return this.events;
  }
  response(){
    if(this.phase!=='response')throw new Error('Attempt required');this.events=[];
    for(const t of this.terminals)if(t.status==='waiting'){
      if(t.detected){t.context=`В-${String.fromCharCode(65+t.id)}`;t.status='context';this.events.push({kind:'response',id:t.id,context:t.context});}
      else{const delay=this.config.backoff?Math.floor(this.rng()*this.config.backoff):0;t.retry=this.window+1+delay;t.status='backoff';this.events.push({kind:'timeout',id:t.id,delay,retry:t.retry});}
    }
    this.window++;this.phase='access';return this.events;
  }
}
