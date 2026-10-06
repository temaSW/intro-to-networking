// Slot-driven model: one frame contains seven explicitly timed windows.
export const WINDOWS=['Общие правила','Общий доступ','Ответ сети','Индивидуализация','Запрос ресурса','Назначение','Данные'];
export const State=Object.freeze({SYNCED:'SYNCED',INFO:'SYSTEM_INFO_KNOWN',NEEDED:'ACCESS_NEEDED',RESPONSE:'WAITING_RESPONSE',BACKOFF:'BACKOFF',CONTEXT:'TEMPORARY_CONTEXT',KNOWN:'KNOWN_TO_NETWORK',REQUESTED:'RESOURCE_REQUESTED',GRANTED:'RESOURCE_GRANTED',DATA:'DATA_TRANSMISSION'});
export function random(seed=7){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
export class InitialAccess {
  constructor({terminals=1,opportunities=1,capacity=1,arrival=0,backoff=4,seed=7,continuous=false}={}){
    for(const [v,max] of [[terminals,16],[opportunities,8],[capacity,8],[backoff,16]])if(!Number.isInteger(v)||v<0||v>max)throw new RangeError('Invalid parameter');
    if(!terminals||!opportunities||!Number.isFinite(arrival)||arrival<0||arrival>1)throw new RangeError('Invalid parameter');
    this.config={terminals,opportunities,capacity,arrival,backoff,seed,continuous};this.reset();
  }
  reset(){
    this.rng=random(this.config.seed);this.tick=-1;this.cursor=0;this.events=[];this.slots=[];this.log=[];
    this.terminals=Array.from({length:this.config.terminals},(_,id)=>({id,state:State.SYNCED,info:false,context:null,queue:[],attempts:0,retryFrame:0,responseDue:null,serviceGrant:null,grants:[],sent:0,service:0,firstDemand:null,firstGrant:null,firstService:null,last:'Сигнал найден; синхронизация уже установлена.'}));
    // Network knowledge does not read the real terminal queue without a request.
    this.network=this.terminals.map(()=>({detected:false,context:null,known:false,reported:0,choice:null}));
    this.metrics={arrivals:0,delivered:0,successes:0,conflicts:0,attempts:0,successfulAttempts:0,availableCells:0,serviceMessages:0,grantDelays:[],deliveryDelays:[]};
    this.samples=[{frame:0,queue:0,arrivals:0,delivered:0}];
  }
  get frame(){return Math.max(0,Math.floor(this.tick/7));}
  get phase(){return this.tick<0?-1:this.tick%7;}
  get nextPhase(){return(this.tick+1)%7;}
  event(terminal,kind,text,{direction=null,resource=null,targets=null}={}){
    const e={tick:this.tick,frame:this.frame,phase:this.phase,terminal,kind,text,direction,resource,targets};this.events.push(e);this.log.push(e);this.log=this.log.slice(-250);
    if(terminal!==null)this.terminals[terminal].last=text;return e;
  }
  service(t,kind,text,direction,resource=null){t.service++;this.metrics.serviceMessages++;this.event(t.id,kind,text,{direction,resource});}
  inject(id,count=1){
    const t=this.terminals[id];if(!t||!Number.isInteger(count)||count<1)throw new RangeError('Invalid arrival');
    for(let i=0;i<count;i++)t.queue.push(this.tick);if(t.firstDemand===null)t.firstDemand=this.tick;this.metrics.arrivals+=count;
    if(t.info&&[State.INFO,State.DATA].includes(t.state))t.state=this.network[id].known?State.KNOWN:State.NEEDED;
    this.event(id,'arrival',`Появились данные. Размер очереди: ${t.queue.length}.`);
  }
  canTransmit(id){
    const t=this.terminals[id];return Boolean(t&&t.queue.length&&this.network[id].known&&t.grants.length&&t.state===State.GRANTED&&t.grants.every(g=>g.tick===this.tick+1)&&this.nextPhase===6);
  }
  checkData(id){
    const t=this.terminals[id];if(!t)throw new RangeError('Unknown terminal');
    if(!t.queue.length)return {allowed:false,reason:'В очереди нет пользовательского блока.'};
    if(!t.info)return {allowed:false,reason:'Общие правила неизвестны: сначала нужно прочитать широковещательную информацию.'};
    if(!this.network[id].known)return {allowed:false,reason:'Сеть ещё не может адресно назначить ресурс этому терминалу. Разрешена только служебная попытка в общем доступе.'};
    if(!this.canTransmit(id))return {allowed:false,reason:'Терминал известен, но ячейка и момент пользовательской передачи не назначены.'};
    return {allowed:true,reason:`Можно передать в следующем окне данных, только в ${t.grants.map(g=>`Д${g.cell+1}`).join(', ')}.`};
  }
  transmit(id){
    const t=this.terminals[id];
    if(!t||this.phase!==6||!t.queue.length||!this.network[id].known||!t.grants.length||t.grants.some(g=>g.tick!==this.tick))throw new Error('Data require a grant for this exact time');
    for(const g of t.grants){
      const created=t.queue.shift();t.sent++;this.metrics.delivered++;this.metrics.deliveryDelays.push(this.tick-created);this.network[id].reported=Math.max(0,this.network[id].reported-1);
      this.event(id,'data',`Пользовательский блок передан в Д${g.cell+1}.`,{direction:'up',resource:g.cell});
    }
    if(t.firstService===null)t.firstService=t.service;t.grants=[];t.state=State.DATA;
  }
  step({choices={}}={}){
    for(const [id,choice]of Object.entries(choices))if(!this.terminals[id]||!Number.isInteger(choice)||choice<0||choice>=this.config.opportunities)throw new RangeError('Invalid choice');
    this.tick++;this.events=[];const p=this.phase,f=this.frame;
    if(p===0){
      if(this.config.continuous)for(const t of this.terminals)if(this.rng()<this.config.arrival)this.inject(t.id);
      const readers=this.terminals.filter(t=>!t.info);this.metrics.serviceMessages++;
      this.event(null,'broadcast',`Сеть объявляет: ${this.config.opportunities} вариантов доступа; ответ в следующем окне; правила повтора.`,{direction:'down',targets:readers.map(t=>t.id)});
      for(const t of this.terminals){
        if(!t.info){t.info=true;t.service++;t.state=t.queue.length?State.NEEDED:State.INFO;t.last='Известны окна доступа, ответа и общие правила повтора.';}
        else if(t.state===State.DATA)t.state=State.KNOWN;
      }
    }
    if(p===1){
      const bins=Array.from({length:this.config.opportunities},()=>[]);
      for(const t of this.terminals){
        if(!t.info||this.network[t.id].known||!t.queue.length||![State.INFO,State.NEEDED,State.BACKOFF].includes(t.state))continue;
        if(f<t.retryFrame){this.event(t.id,'wait',`Ожидание повтора: ещё ${t.retryFrame-f} кадров.`);continue;}
        const choice=choices[t.id]??Math.floor(this.rng()*this.config.opportunities);
        t.attempts++;this.metrics.attempts++;t.state=State.RESPONSE;t.responseDue=this.tick+1;
        this.service(t,'attempt',`Попытка №${t.attempts} в общем варианте ${choice+1}.`,'up',choice);bins[choice].push(t);
      }
      bins.forEach((group,choice)=>{
        if(group.length>1){this.metrics.conflicts++;this.event(null,'collision',`Вариант ${choice+1}: совпали ${group.map(t=>`Т${t.id+1}`).join(' и ')}. Запросы не различены.`,{resource:choice,targets:group.map(t=>t.id)});}
        if(group.length===1){const t=group[0],n=this.network[t.id];n.detected=true;n.context=`В${t.id+1}`;n.choice=choice;this.metrics.successes++;this.metrics.successfulAttempts+=t.attempts;}
      });
    }
    if(p===2)for(const t of this.terminals){
      if(t.state!==State.RESPONSE||t.responseDue!==this.tick)continue;const n=this.network[t.id];
      if(n.detected){t.context=n.context;t.serviceGrant=this.tick+1;t.state=State.CONTEXT;this.service(t,'response',`Ответ для варианта ${n.choice+1}: контекст ${n.context} и служебная ячейка следующего окна.`,'down');}
      else{const wait=this.config.backoff?Math.floor(this.rng()*this.config.backoff):0;t.retryFrame=f+1+wait;t.state=State.BACKOFF;this.event(t.id,'timeout',`Окно ответа истекло. Ответа нет; задержка ${wait} кадр(а). Следующая попытка — в кадре ${t.retryFrame+1}.`);}
    }
    if(p===3)for(const t of this.terminals)if(t.state===State.CONTEXT&&t.serviceGrant===this.tick){this.network[t.id].known=true;t.state=State.KNOWN;t.serviceGrant=null;this.service(t,'identity',`Индивидуальные сведения переданы в служебной ячейке ${t.context}; сеть различает терминал.`,'up');}
    if(p===4)for(const t of this.terminals)if(this.network[t.id].known&&t.queue.length){this.network[t.id].reported=t.queue.length;t.state=State.REQUESTED;this.service(t,'request',`Адресный запрос: размер очереди ${t.queue.length}.`,'up');}
    if(p===5){
      const assigned=new Map();let cell=0,start=this.cursor;
      while(cell<this.config.capacity){
        let found=false;
        for(let k=0;k<this.terminals.length&&cell<this.config.capacity;k++){
          const i=(start+k)%this.terminals.length,t=this.terminals[i],n=this.network[i];
          if(!n.known||t.state!==State.REQUESTED||n.reported<=(assigned.get(i)?.length??0))continue;
          const list=assigned.get(i)??[];list.push({cell:cell++,tick:this.tick+1});assigned.set(i,list);this.cursor=(i+1)%this.terminals.length;found=true;
        }
        if(!found)break;
      }
      for(const [id,grants]of assigned){const t=this.terminals[id];t.grants=grants;t.state=State.GRANTED;if(t.firstGrant===null){t.firstGrant=this.tick;this.metrics.grantDelays.push(this.tick-t.firstDemand);}this.service(t,'grant',`Назначение: ${grants.map(g=>`Д${g.cell+1}`).join(', ')} в окне данных кадра ${f+1}; другим терминалам эти ячейки запрещены.`,'down');}
    }
    if(p===6){this.metrics.availableCells+=this.config.capacity;for(const t of this.terminals)if(t.grants.length)this.transmit(t.id);this.samples.push({frame:f+1,queue:this.backlog(),arrivals:this.metrics.arrivals,delivered:this.metrics.delivered});this.samples=this.samples.slice(-1001);}
    this.slots.push({tick:this.tick,frame:f,phase:p,events:this.events.map(e=>({...e}))});this.slots=this.slots.slice(-200);return this.events;
  }
  backlog(){return this.terminals.reduce((sum,t)=>sum+t.queue.length,0);}
  summary(){const m=this.metrics,mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;return {...m,queue:this.backlog(),meanAttempts:m.successes?m.successfulAttempts/m.successes:null,meanGrantDelay:mean(m.grantDelays),meanDeliveryDelay:mean(m.deliveryDelays),utilization:m.availableCells?m.delivered/m.availableCells:null};}
}
