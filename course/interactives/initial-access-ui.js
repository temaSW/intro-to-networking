import {InitialAccess,State,WINDOWS} from './initial-access-model.js';

const labels={SYNCED:'Синхронизирован',SYSTEM_INFO_KNOWN:'Правила известны',ACCESS_NEEDED:'Нужен доступ',WAITING_RESPONSE:'Ждёт ответа',BACKOFF:'Ждёт повтор',TEMPORARY_CONTEXT:'Временный контекст',KNOWN_TO_NETWORK:'Известен сети',RESOURCE_REQUESTED:'Ресурс запрошен',RESOURCE_GRANTED:'Есть назначение',DATA_TRANSMISSION:'Данные переданы'};
const messages={broadcast:'Общие правила',attempt:'Попытка доступа',response:'Ответ + служебная ячейка',identity:'Индивидуальные сведения',request:'Запрос ресурса',grant:'Назначение',data:'Пользовательский блок',denied:'Нет разрешения'};
const colors={broadcast:'broadcast',attempt:'access',response:'control',identity:'control',request:'control',grant:'grant',data:'data',denied:'collision'};
const term=id=>`Т${id+1}`,number=v=>v===null?'—':v.toLocaleString('ru-RU',{maximumFractionDigits:2});
let instance=0;
const select=(key,label,values,value)=>`<label>${label}<select data-param="${key}">${values.map(v=>{const [val,text]=Array.isArray(v)?v:[v,v];return `<option value="${val}" ${val===value?'selected':''}>${text}</option>`;}).join('')}</select></label>`;

function scene(s,focus,id,denied=false){
  const visible=s.terminals.length<=4?s.terminals:s.terminals.filter(t=>t.id<3||t.id===focus);
  const h=Math.max(190,visible.length*84+40),center=h/2;
  const nodes=visible.map((t,i)=>{
    const y=30+i*84;
    let e=s.events.filter(e=>e.terminal===t.id&&e.direction).at(-1);
    const broadcast=s.events.find(e=>e.kind==='broadcast'&&e.targets.includes(t.id));if(broadcast)e=broadcast;
    if(denied&&t.id===focus)e={kind:'denied',direction:'up'};
    const collided=s.events.some(e=>e.kind==='collision'&&e.targets.includes(t.id));
    const color=collided?'collision':e?colors[e.kind]:'idle';
    const active=e?`ia-moving ia-${color}`:'ia-wire';
    const arrow=e?`marker-end="url(#ia-arrow-${id}-${color})"`:'';
    const path=e?.direction==='down'?`M680 ${center} Q540 ${y+28} 240 ${y+28}`:`M240 ${y+28} Q540 ${y+28} 680 ${center}`;
    const queue=Array.from({length:Math.min(6,t.queue.length)},(_,k)=>`<rect x="${36+k*20}" y="${y+58}" width="15" height="12" rx="2" class="ia-queue-block"/>`).join('');
    return `<path d="${path}" class="${active}" ${arrow}/>
      <rect x="25" y="${y}" width="215" height="52" rx="8" class="ia-device ${t.id===focus?'ia-selected':''}"/>
      <text x="38" y="${y+21}" class="ia-node-label">${term(t.id)} · ${labels[t.state]}</text>
      <text x="38" y="${y+41}">Очередь: ${t.queue.length} · передано: ${t.sent}</text>${queue}
      ${e?`<rect x="300" y="${y+13}" width="235" height="28" rx="6" class="ia-packet ia-${color}"/><text x="417" y="${y+32}" text-anchor="middle">${collided?'Попытки совпали ×':messages[e.kind]}</text>`:''}
      ${t.state===State.BACKOFF?`<text x="300" y="${y+33}">Повтор: кадр ${t.retryFrame+1}</text>`:''}`;
  }).join('');
  const arrows=['broadcast','access','control','grant','data','collision'].map(c=>`<marker id="ia-arrow-${id}-${c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" class="ia-arrow ia-${c}"/></marker>`).join('');
  return `<figure class="ia-scene"><svg viewBox="0 0 890 ${h}" role="img" aria-label="Передачи между терминалами и сетью. Выбран ${term(focus)}."><defs>${arrows}</defs>${nodes}
    <rect x="680" y="${center-43}" width="180" height="86" rx="10" class="ia-network-node"/><text x="770" y="${center-15}" text-anchor="middle" class="ia-node-label">СЕТЬ</text><text x="770" y="${center+7}" text-anchor="middle">Известны: ${s.network.filter(n=>n.known).length}</text><text x="770" y="${center+28}" text-anchor="middle">Контексты: ${s.network.filter(n=>n.context).length}</text></svg>
    <figcaption>Линии показывают направление текущих передач; маленькие блоки у терминала — его очередь.${visible.length<s.terminals.length?' Показаны первые три и выбранный терминал; остальные участвуют в расчёте.':''}</figcaption></figure>`;
}

function resource(s){
  const m=s.config.opportunities,c=s.config.capacity,rows=[['Широковещание','broadcast'],...Array.from({length:m},(_,i)=>[`Доступ ${i+1}`,'access']),['Служебные ячейки','control'],...Array.from({length:Math.max(c,1)},(_,i)=>[c?`Данные Д${i+1}`:'Данные: нет ячеек','data'])];
  const start=Math.max(0,s.tick-12),cols=14,w=1000,left=170,dx=56,dy=32,top=45,h=top+rows.length*dy+35;
  let cells='';
  for(let j=0;j<cols;j++){
    const tick=start+j,slot=s.slots.find(x=>x.tick===tick);
    for(let r=0;r<rows.length;r++){
      let events=[],kind='',text='';
      if(slot){
        if(r===0)events=slot.events.filter(e=>e.kind==='broadcast');
        else if(r<=m)events=slot.events.filter(e=>e.kind==='attempt'&&e.resource===r-1);
        else if(r===m+1)events=slot.events.filter(e=>['response','identity','request','grant'].includes(e.kind));
        else events=slot.events.filter(e=>e.kind==='data'&&e.resource===r-m-2);
        if(events.length){kind=r===0?'broadcast':r<=m?'access':r===m+1?'control':'data';text=r===0?'ВС':r===m+1?`Сл ${events.length}`:events.map(e=>e.terminal+1).join('+');}
        if(r>0&&r<=m&&slot.events.some(e=>e.kind==='collision'&&e.resource===r-1)){kind='collision';text='× '+events.length;}
      }
      const grant=r>m+1?s.terminals.find(t=>t.grants.some(g=>g.tick===tick&&g.cell===r-m-2)):null;
      if(grant){kind='grant';text=term(grant.id);}
      const detail=grant?`Назначено ${term(grant.id)}, Д${r-m-1}, кадр ${Math.floor(tick/7)+1}, окно 7`:events.map(e=>e.text).join(' ');
      const x=left+j*dx,y=top+r*dy;
      cells+=`<g><title>Кадр ${Math.floor(tick/7)+1}, окно ${tick%7+1}. ${rows[r][0]}: ${detail||'нет передачи'}</title><rect x="${x}" y="${y}" width="${dx-3}" height="${dy-3}" rx="3" class="ia-resource-cell ${kind?'ia-'+kind:''}"/><text x="${x+(dx-3)/2}" y="${y+20}" text-anchor="middle">${text}</text></g>`;
    }
    cells+=`<text x="${left+j*dx+dx/2}" y="30" text-anchor="middle">${Math.floor(tick/7)+1}.${tick%7+1}</text>`;
  }
  const current=s.tick>=0?`<path d="M${left+(s.tick-start)*dx+dx-2} 36V${h-30}" class="ia-now"/>`:'';
  return `<figure class="ia-resource"><figcaption>Занятость общего ресурса во времени</figcaption><div class="ia-scroll"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Временно-ресурсная сетка. Метки времени: кадр и окно. Цвет и подписи различают общий доступ, конфликт, назначение и данные."><text x="${left}" y="15">Время → кадр.окно</text>${rows.map(([name],r)=>`<text x="8" y="${top+r*dy+20}">${name}</text>`).join('')}${cells}${current}<text x="8" y="${h-6}">Вертикально — отдельные ресурсы; служебные мини-ячейки сгруппированы в одну строку.</text></svg></div>
    <div class="ia-legend">${[['broadcast','Общие правила'],['access','Попытка'],['collision','Конфликт'],['control','Служебный обмен'],['grant','Назначено на будущее'],['data','Данные переданы']].map(([c,label])=>`<span><i class="ia-${c}"></i>${label}</span>`).join('')}</div></figure>`;
}

function plot(s){
  const series=s.samples,xmax=Math.max(20,series.at(-1).frame),ymax=Math.max(10,...series.map(x=>Math.max(x.arrivals,x.delivered,x.queue))),left=60,top=20,width=880,height=220;
  const x=v=>left+v/xmax*800,y=v=>height-35-v/ymax*165;
  const lines=[['arrivals','Появилось блоков','ia-offered'],['delivered','Передано блоков','ia-data-line'],['queue','Блоков в очередях','ia-queue-line']];
  return `<figure class="ia-chart"><figcaption>Поток блоков и накопление очередей</figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Появившиеся, переданные и ожидающие блоки по кадрам. Очереди продолжают расти при перегрузке.">${[0,.5,1].map(k=>`<path d="M${left} ${y(k*ymax)}H860" class="ia-plot-grid"/><text x="50" y="${y(k*ymax)+4}" text-anchor="end">${Math.round(k*ymax)}</text>`).join('')}${lines.map(([key,,cls])=>`<polyline points="${series.map(p=>`${x(p.frame)},${y(p[key])}`).join(' ')}" class="${cls}"/>`).join('')}<text x="7" y="14">Блоки</text><text x="${left}" y="211">0</text><text x="860" y="211" text-anchor="end">${xmax} кадров</text></svg><div class="ia-legend">${lines.map(([,label,cls])=>`<span class="${cls}">${label}</span>`).join('')}</div></figure>`;
}

export function mountInitialAccess(root){
  const mode=root.dataset.initialAccess||'single',single=mode==='single',load=mode==='load',id=++instance;
  let s,focus=0,timer=null,feedback='',denied=false,seed=7;
  root.classList.add('ia-simulator');
  root.innerHTML=`${single?'':`<div class="ia-controls">${select('terminals','Терминалов',[2,4,8,16],load?8:2)}${select('opportunities','Общих вариантов доступа',[1,2,4,8],load?2:1)}${load?select('capacity','Ячеек данных на кадр',[0,1,2,4,8],2):''}${select('backoff','Ожидание перед повтором',[[0,'Без случайной задержки'],[4,'Случайно 0–3 кадра'],[8,'Случайно 0–7 кадров']],4)}${load?select('arrival','Новый блок у каждого терминала за кадр',[[0,'Никогда'],[.1,'С вероятностью 10 %'],[.3,'С вероятностью 30 %'],[.6,'С вероятностью 60 %'],[1,'В каждом кадре']],.3):''}</div>`}
    <div class="ia-toolbar"><button type="button" data-action="step" class="ia-primary"></button>${single?'<button type="button" data-action="check">Можно передать данные сейчас?</button>':'<button type="button" data-action="frame">Кадр целиком</button><button type="button" data-action="run">Запустить</button>'}${load?'<button type="button" data-action="hundred">Рассчитать 100 кадров</button>':''}<button type="button" data-action="reset">Сбросить</button>${single?'':'<button type="button" data-action="seed">Другой случайный опыт</button>'}</div>
    <p class="ia-clock"></p><div class="ia-stage"></div><p class="ia-feedback" role="status" aria-live="polite"></p><div class="ia-results"></div>`;
  const results=root.querySelector('.ia-results'),stage=root.querySelector('.ia-stage'),stepButton=root.querySelector('[data-action="step"]');
  const param=key=>+root.querySelector(`[data-param="${key}"]`).value;
  const complete=()=>!load&&s.terminals.every(t=>t.sent>0&&!t.queue.length);
  function stop(){if(timer!==null)clearInterval(timer);timer=null;const b=root.querySelector('[data-action="run"]');if(b)b.textContent='Запустить';}
  function reset(){stop();focus=0;feedback='';denied=false;s=new InitialAccess(single?{seed}:{terminals:param('terminals'),opportunities:param('opportunities'),capacity:load?param('capacity'):2,backoff:param('backoff'),arrival:load?param('arrival'):0,continuous:load,seed});if(!single&&!load)for(const t of s.terminals)s.inject(t.id);render();}
  function next(){feedback='';denied=false;if(single&&s.phase===0&&!s.terminals[0].queue.length&&!s.terminals[0].sent){s.events=[];s.inject(0);render();return;}s.step();if(complete())stop();render();}
  function render(){
    const t=s.terminals[focus],n=s.network[focus],m=s.summary();
    stepButton.textContent=single?(s.tick<0?'Прочитать широковещание':s.phase===0&&!t.queue.length&&!t.sent?'Создать пользовательский блок':['Прочитать широковещание','Передать попытку доступа','Принять ответ сети','Передать индивидуальные сведения','Сообщить потребность','Принять назначение','Передать пользовательский блок'][s.nextPhase]):'Следующее окно';if(complete())stepButton.textContent='Передача завершена';stepButton.disabled=complete();
    root.querySelector('.ia-clock').textContent=s.tick<0?'До первого обращения: синхронизация уже установлена.':`Кадр ${s.frame+1} · окно ${s.phase+1}/7 · ${WINDOWS[s.phase]}`;
    root.querySelector('.ia-feedback').textContent=feedback;
    const current=s.events.filter(e=>e.terminal===focus||(e.terminal===null&&(!e.targets||e.targets.includes(focus)))).map(e=>e.text);
    stage.innerHTML=`${scene(s,focus,id,denied)}<p class="ia-event">${current.join(' ')||t.last}</p>`;
    const known=t.info?`Окна общего доступа и ответа; доступных вариантов: ${s.config.opportunities}.${t.context?` Контекст ${t.context}.`:''}`:'Несущая, такт, границы кадров и место широковещания. Правила ещё неизвестны.';
    const network=n.known?`Терминал известен. Сообщённый размер очереди: ${n.reported}.`:n.context?`Попытка обнаружена, есть ${n.context}; индивидуализация ещё не завершена.`:'Терминал не известен; индивидуального контекста нет.';
    const permission=t.state===State.BACKOFF?`Ждать до кадра ${t.retryFrame+1}, затем повторить.`:t.state===State.RESPONSE?'Ждать в окне ответа.':t.state===State.CONTEXT?'Передать только индивидуальные сведения в служебной ячейке.':s.canTransmit(focus)?'Передать блок в следующем окне данных, только по назначению.':n.known?'Адресно запросить ресурс; данные без назначения запрещены.':t.info?'Служебная попытка в общем окне доступа.':'Принимать широковещание; передача данных запрещена.';
    const assigned=t.grants.length?t.grants.map(g=>`Д${g.cell+1}, кадр ${Math.floor(g.tick/7)+1}, окно ${g.tick%7+1}`).join('; '):t.serviceGrant!==null?'Есть только служебная ячейка для индивидуализации; пользовательского ресурса нет.':'Нет';
    results.innerHTML=`${s.terminals.length>1?`<label class="ia-focus">Наблюдаемый терминал<select data-focus>${s.terminals.map(t=>`<option value="${t.id}" ${focus===t.id?'selected':''}>${term(t.id)} · ${labels[t.state]} · очередь ${t.queue.length}</option>`).join('')}</select></label>`:''}
      <dl class="ia-facts"><div><dt>Терминал знает</dt><dd>${known}</dd></div><div><dt>Сеть знает</dt><dd>${network}</dd></div><div><dt>Разрешено</dt><dd>${permission}</dd></div><div><dt>Выделенный ресурс</dt><dd>${assigned}</dd></div><div><dt>Пользовательские данные</dt><dd>В очереди ${t.queue.length}, передано ${t.sent}. <strong>${s.canTransmit(focus)?'Передача назначена':'Сейчас передавать нельзя'}</strong></dd></div></dl>
      ${single&&t.sent?`<p class="ia-finish">Первый блок дошёл до сети. До него выполнено ${t.firstService} служебных действий: общие правила, попытка, ответ, индивидуализация, запрос и назначение.</p>`:''}${resource(s)}
      ${single?'':`<div class="ia-metrics"><div>Успешных доступов<strong>${m.successes} / ${s.terminals.length}</strong></div><div>Конфликтных вариантов<strong>${m.conflicts}</strong></div><div>Попыток до успеха<strong>${number(m.meanAttempts)}</strong></div><div>До первого назначения, окон<strong>${number(m.meanGrantDelay)}</strong></div>${load?`<div>Блоков в очередях<strong>${m.queue}</strong></div><div>Передано блоков<strong>${m.delivered}</strong></div><div>Использование ячеек данных<strong>${m.utilization===null?'—':number(m.utilization*100)+' %'}</strong></div>`:''}</div>`}
      ${load?plot(s):''}<details><summary>События и состояние всех терминалов</summary><div class="ia-scroll"><table class="ia-terminal-table"><thead><tr><th>Терминал</th><th>Состояние</th><th>Очередь</th><th>Попытки</th><th>Передано</th></tr></thead><tbody>${s.terminals.map(t=>`<tr><th>${term(t.id)}</th><td>${labels[t.state]}</td><td>${t.queue.length}</td><td>${t.attempts}</td><td>${t.sent}</td></tr>`).join('')}</tbody></table></div><ol class="ia-log">${s.log.slice(-24).map(e=>`<li>${e.tick<0?'До старта':`${e.frame+1}.${e.phase+1}`} · ${e.terminal===null?'Сеть':term(e.terminal)}: ${e.text}</li>`).join('')}</ol></details>`;
  }
  root.addEventListener('change',e=>{if(e.target.matches('[data-param]'))reset();if(e.target.matches('[data-focus]')){focus=+e.target.value;denied=false;feedback='';render();results.querySelector('[data-focus]').focus();}});
  root.addEventListener('click',e=>{
    const button=e.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(action==='reset'){reset();return;}if(action==='seed'){seed++;reset();return;}
    if(action==='check'){const check=s.checkData(focus);feedback=check.reason;denied=!check.allowed;render();return;}
    if(action==='step'){next();return;}
    if(action==='frame'||action==='hundred'){feedback='';denied=false;const steps=action==='hundred'?700:7-s.nextPhase;for(let i=0;i<steps;i++)s.step();if(complete())stop();render();return;}
    if(action==='run'){if(timer!==null){stop();return;}button.textContent='Пауза';timer=setInterval(()=>{if(document.hidden){stop();return;}next();},800);}
  });
  reset();return {get simulation(){return s;},reset,stop};
}
document.querySelectorAll('[data-initial-access]').forEach(mountInitialAccess);
