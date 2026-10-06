import {InitialAccess,Contention,frameObservation,carrierObservation} from './initial-access-model.js';
const fmt=(v,d=1)=>v.toLocaleString('ru-RU',{maximumFractionDigits:d});
const name=id=>String.fromCharCode(65+id);
const button=(action,text,disabled=false)=>`<button type="button" data-action="${action}" ${disabled?'disabled':''}>${text}</button>`;
const select=(key,label,value,min,max)=>`<label>${label}<select data-key="${key}">${Array.from({length:max-min+1},(_,i)=>i+min).map(v=>`<option value="${v}" ${v===value?'selected':''}>${v}</option>`).join('')}</select></label>`;
function plot(title,series,{xmin=0,xmax=32,ymin=-1.1,ymax=1.1,xlabel='',marks=[]}={}){
  const width=window.matchMedia('(max-width:600px)').matches?360:580;
  const x=v=>45+(v-xmin)/(xmax-xmin)*(width-70),y=v=>175-(v-ymin)/(ymax-ymin)*150;
  return `<figure class="ia-plot"><figcaption>${title}</figcaption><svg viewBox="0 0 ${width} 220" role="img" aria-label="${title}">${Array.from({length:5},(_,i)=>{const a=xmin+(xmax-xmin)*i/4,b=ymin+(ymax-ymin)*i/4;return `<path class="ia-grid" d="M${x(a)} 25V175M45 ${y(b)}H${width-25}"/><text x="${x(a)}" y="195" text-anchor="middle">${fmt(a)}</text><text x="38" y="${y(b)+4}" text-anchor="end">${fmt(b)}</text>`;}).join('')}${series.map((s,i)=>`<polyline class="ia-line ia-series-${i}" points="${s.points.map(([a,b])=>`${x(a)},${y(b)}`).join(' ')}"/>`).join('')}${marks.map(m=>`<path class="ia-mark" d="M${x(m.at)} 25V175"/><text x="${x(m.at)+4}" y="17">${m.label}</text>`).join('')}<text x="${width/2}" y="216" text-anchor="middle">${xlabel}</text></svg><div class="ia-legend">${series.map((s,i)=>`<span class="ia-series-${i}">${s.name}</span>`).join('')}</div></figure>`;
}
function complexPlot(d){
  const x=v=>150+95*v,y=v=>140-95*v;
  return `<figure class="ia-complex"><figcaption>Известный символ снят: остаётся фазовый поворот</figcaption><svg viewBox="0 0 300 285" role="img" aria-label="Поворот опорных символов в комплексной плоскости"><circle class="ia-grid" cx="150" cy="140" r="95"/><path class="ia-grid" d="M35 140H265M150 25V255"/><text x="270" y="145">I</text><text x="155" y="24">Q</text>${d.points.map((p,i)=>`<circle class="ia-raw" cx="${x(p.raw[0])}" cy="${y(p.raw[1])}" r="5"/><text x="${x(p.raw[0])+7}" y="${y(p.raw[1])-5}">${i*4} мс</text><circle class="ia-corrected" cx="${x(p.corrected[0])}" cy="${y(p.corrected[1])}" r="3"/>`).join('')}<text x="150" y="279" text-anchor="middle">Оранжевый: до · зелёный: после компенсации</text></svg></figure>`;
}
export function mountInitialAccess(root){
  const phone=new InitialAccess();let contention=new Contention(),mode='manual',guess=0,estimate=0,feedback='',checked=false;
  let localFeedback='',exchangeFeedback='',history=[],seed=7;
  const sections=Object.fromEntries([...root.querySelectorAll('[data-experiment]')].map(e=>[e.dataset.experiment,e]));
  const progress=root.querySelector('[data-progress]');
  function facts(){
    progress.innerHTML=`<div><strong>Телефон A уже знает</strong><p>${phone.knowledge().join(' · ')}</p></div><div><strong>Сейчас может</strong><p>${phone.permission()}</p></div>`;
    root.querySelector('[data-reset]').disabled=false;
  }
  function frame(){
    const d=frameObservation(),solved=phone.frameTiming!==null;
    const stream=[...d.received,...d.received];
    sections.frame.innerHTML=`<p class="ia-question">Где начинается кадр? Выберите сдвиг, при котором совпадение с опорой самое сильное.</p>
      <div class="ia-bits"><strong>Известная опора:</strong> ${d.reference.map(v=>v>0?'+':'−').join(' ')}</div>
      ${plot('Принятые символы: два фрагмента потока',[{name:'Принятый сигнал',points:stream.map((v,i)=>[i,v])},{name:'Сдвинутая опора',points:d.reference.map((v,i)=>[guess+i,v])}],{xmax:95,marks:solved?[{at:d.peak,label:'Кадр 1'},{at:d.peak+48,label:'Кадр 2'}]:[{at:guess,label:'Предположение'}],xlabel:'Номер символа'})}
      ${plot('Корреляция с известной опорой',[{name:'Нормированное совпадение',points:d.scores.map((v,i)=>[i,v])}],{xmax:d.maxTime,marks:[{at:guess,label:'Выбранный сдвиг'}],xlabel:'Сдвиг опоры, символы'})}
      <label>Предполагаемое начало: <output>${guess}</output><input data-key="guess" type="range" min="0" max="${d.scores.length-1}" step="1" value="${guess}" aria-label="Предполагаемое начало кадра"></label>
      ${button('check-frame','Проверить предположение')}
      <p class="ia-feedback" role="status">${feedback||'Верхняя линия показывает символы, нижняя — результат сопоставления с опорой для каждого сдвига.'}</p>
      ${checked&&!solved?`<p>Максимум при сдвиге ${d.peak}, корреляция ${fmt(d.scores[d.peak])}. Передвиньте опору к этому месту: при правильном совпадении её символы складываются согласованно.</p>`:''}
      ${solved?'<p class="ia-result">Граница найдена. Из известного периода 48 символов получаются следующие границы: 18, 66, 114… Телефон может принимать заданные участки кадра в нужные моменты.</p>':''}`;
  }
  function carrier(){
    const locked=phone.frameTiming===null,d=carrierObservation({estimate});
    sections.carrier.innerHTML=`${locked?'<p class="ia-lock">Сначала определите границу кадра в опыте A.</p>':''}
      <div class="ia-pair">${complexPlot(d)}${plot('Накопление фазы по известным символам, °',[{name:'До компенсации',points:d.points.map(p=>[p.t*1000,p.phase*180/Math.PI])},{name:'После компенсации',points:d.points.map(p=>[p.t*1000,p.correctedPhase*180/Math.PI])}],{ymin:Math.min(0,360*d.residual*.032)-50,ymax:Math.max(300,360*d.residual*.032)+50,xlabel:'Время от начала опоры, мс'})}</div>
      <p>При 0 мс фаза совпадает. При 8 мс она ушла на ${fmt(d.points[2].phase*180/Math.PI)}°. Один полный оборот — 360°. Оцените частоту по наклону: Δf̂ = Δφ / (360° · Δt).</p>
      <label>Ваша оценка Δf̂: <output>${estimate} Гц</output><input type="range" data-key="estimate" min="-80" max="80" step="1" value="${estimate}" ${locked||phone.info?'disabled':''} aria-label="Оценка ошибки частоты"></label>
      ${button('apply-carrier','Использовать эту оценку для приёма',locked||phone.info)}
      <p class="ia-feedback">${phone.carrierKnown?'Уход остановлен: служебные символы можно читать.':`После компенсации фаза уходит на ${fmt(360*d.residual*.032)}° за 32 мс. Подберите оценку так, чтобы зелёная линия стала горизонтальной.`}</p>`;
  }
  function system(){
    sections.system.innerHTML=`<div class="ia-resource-strip"><div>↓ Системная информация</div><div>↑ Общий доступ<br>${phone.info?'4 варианта':'правила неизвестны'}</div><div>↓ Окно ответа</div><div>↑ Индивидуальные ресурсы<br>ещё не назначены</div></div>
      ${button('read-info','Принять системную информацию',!phone.carrierKnown||phone.info)} ${button('try-data','Передать пользовательские данные сейчас',!phone.info)}
      ${phone.info?'<p class="ia-result">Правила прочитаны: 4 варианта в общем окне; ответ — в следующем окне. При отсутствии ответа повтор разрешён в одном из следующих 4 окон доступа.</p>':'<p>Для чтения этого фрагмента нужны правильный момент приёма и достаточно точная несущая.</p>'}
      <p class="ia-feedback" role="status">${localFeedback||'У телефона уже есть пользовательский блок. У сети ещё нет контекста этого телефона.'}</p>`;
  }
  function access(){
    const c=contention,done=!!phone.context;
    const statuses={ready:'готов к попытке',waiting:'ждёт ответ, исход неизвестен',context:'получил временный контекст',backoff:'ответ не пришёл; ждёт повтор'};
    sections.access.innerHTML=`${!phone.info?'<p class="ia-lock">Для обращения телефону A нужны правила из опыта C.</p>':''}
      <div class="ia-controls">${select('mode','Режим',mode==='manual'?0:1,0,1).replace('>0</option>','>Ручной: два телефона</option>').replace('>1</option>','>Случайные повторы</option>')}${mode==='random'?select('terminals','Телефонов',c.config.terminals,2,8)+select('options','Вариантов доступа',c.config.options,1,8)+select('backoff','Окон случайного ожидания (0 — без задержки)',c.config.backoff,0,8):''}</div>
      <div class="ia-phones">${c.terminals.map(t=>`<div><strong>Телефон ${name(t.id)}</strong><p>${statuses[t.status]}${t.context?` · ${t.context}`:''}${t.status==='backoff'?` · повтор с окна ${t.retry+1}`:''}</p>${mode==='manual'?select(`choice-${t.id}`,'Вариант обращения',(t.choice??1)+1,1,4):`<p>Попыток: ${t.attempts}; выбор: ${t.choice===null?'—':t.choice+1}</p>`}</div>`).join('')}</div>
      <p><strong>Общее окно доступа ${c.window+1}</strong> · ${c.phase==='response'?'попытки завершены, ожидается окно ответа':'можно отправить попытки'}</p>
      <div class="ia-options">${Array.from({length:c.config.options},(_,i)=>{const ids=c.bins[i]||[];return `<div class="${ids.length>1?'ia-conflict':ids.length===1?'ia-success':''}"><strong>Вариант ${i+1}</strong><p>${ids.length?ids.map(name).join(' + '):'пусто'}</p><small>${ids.length>1?'Конфликт: сеть не различила обращения':ids.length===1?'Сеть обнаружила одиночную попытку':''}</small></div>`;}).join('')}</div>
      <div class="ia-toolbar">${button('attempt',mode==='manual'?'Отправить выбранные обращения':'Следующее общее окно доступа',!phone.info||c.phase!=='access'||c.terminals.every(t=>t.context))}${button('response','Наблюдать окно ответа',c.phase!=='response')}${button('reset-access','Повторить опыт конкуренции')}</div>
      <p class="ia-feedback" role="status">${history.at(-1)||'Начните с A → 2 и B → 2, затем сравните A → 1 и B → 3. Цвет показывает наблюдение сети, а не знание телефонов.'}</p>
      <details><summary>История попыток и ответов</summary><ol>${history.map(v=>`<li>${v}</li>`).join('')}</ol></details>
      ${done?'<p class="ia-result">A получил временный контекст и отдельный служебный ресурс. Продолжите ниже: это ещё не разрешение отправить пользовательский блок.</p>':''}`;
  }
  function exchange(){
    const stage=phone.sent?5:phone.grant?4:phone.requested?3:phone.known?2:phone.context?1:0;
    const actions=[['identify','Передать индивидуальные сведения'],['request','Запросить ресурс для блока'],['grant','Принять назначение пользовательского ресурса']];
    sections.exchange.innerHTML=`<div class="ia-exchange-head"><strong>Телефон A</strong><span>Адресный обмен</span><strong>Сеть</strong></div>
      <ol class="ia-messages">${phone.messages.map(m=>`<li class="${m.from==='Сеть'?'ia-down':'ia-up'}"><strong>${m.from==='Сеть'?'A ← Сеть':'A → Сеть'}</strong><span>${m.text}</span></li>`).join('')||'<li>Ответ общего доступа ещё не получен.</li>'}</ol>
      <div class="ia-toolbar">${actions.map(([a,t],i)=>button(a,t,stage!==i+1)).join('')}</div>
      ${phone.grant?`<div class="ia-controls">${select('data-resource','Ресурс передачи',0,0,1).replace('>0</option>','>Д-A (назначенный)</option>').replace('>1</option>','>С-A (служебный)</option>')}${select('data-time','Момент передачи',phone.grant.time,phone.grant.time-1,phone.grant.time+1)}</div>`:''}
      ${button('send-data','Отправить пользовательский блок',stage!==4)} ${button('check-permission','Проверить право передачи',stage===5)}
      <p class="ia-feedback" role="status">${exchangeFeedback||'Данные в очереди: один блок. Служебное назначение разрешает только передачу индивидуальных сведений.'}</p>
      ${phone.sent?'<p class="ia-result">Первый пользовательский блок передан. Сигнал, знания о системе и служебный контекст были необходимы, но право на этот блок появилось только после назначения.</p>':''}`;
  }
  function draw(){facts();frame();carrier();system();access();exchange();}
  function resetAccess(){contention=new Contention({terminals:mode==='manual'?2:contention.config.terminals,options:mode==='manual'?4:contention.config.options,backoff:contention.config.backoff,seed});history=[];phone.context=null;phone.known=false;phone.serviceGrant=null;phone.grant=null;phone.requested=false;phone.waiting=false;phone.sent=0;phone.queue=1;phone.messages=[];phone.time=0;exchangeFeedback='';}
  root.addEventListener('input',e=>{
    const key=e.target.dataset.key;if(!['guess','estimate'].includes(key))return;
    const value=Number(e.target.value);if(key==='guess'){guess=value;frame();}else{estimate=value;carrier();}
    const replacement=root.querySelector(`[data-key="${key}"]`);replacement.focus();
  });
  root.addEventListener('change',e=>{
    const key=e.target.dataset.key;if(!key||key.startsWith('choice')||key.startsWith('data-')||['guess','estimate'].includes(key))return;
    if(key==='mode')mode=Number(e.target.value)?'random':'manual';
    else contention=new Contention({...contention.config,[key]:Number(e.target.value)});
    resetAccess();draw();root.querySelector(`[data-key="${key}"]`)?.focus();
  });
  root.addEventListener('click',e=>{
    const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
    try{
      if(action==='reset'){phone.reset();contention=new Contention();mode='manual';guess=estimate=0;feedback=localFeedback=exchangeFeedback='';checked=false;history=[];}
      if(action==='check-frame'){checked=true;const result=phone.locateFrame(guess);feedback=result.correct?'Верно: согласованные символы дают максимум корреляции.':'Это не максимум. Сопоставьте выбранный сдвиг с пиком нижнего графика.';}
      if(action==='apply-carrier')phone.tuneCarrier(estimate);
      if(action==='read-info')phone.readSystemInfo();
      if(action==='try-data')localFeedback=phone.checkData().reason;
      if(action==='reset-access'){seed++;resetAccess();}
      if(action==='attempt'){
        const choices=mode==='manual'?Object.fromEntries([...sections.access.querySelectorAll('[data-key^="choice-"]')].map(el=>[Number(el.dataset.key.split('-')[1]),Number(el.value)-1])):null;
        const a=contention.terminals[0],participates=!a.context&&contention.window>=a.retry;
        if(participates)phone.beginAccess();
        const events=contention.attempt(choices);
        history.push(`Окно ${contention.window+1}: ${events.map(ev=>`${ev.ids.map(name).join(' + ')} → ${ev.option+1}: ${ev.kind==='collision'?'конфликт':'одиночная попытка'}`).join('; ')||'терминалы ждут назначенного окна повтора'}. Телефоны ещё не знают исход.`);
      }
      if(action==='response'){
        const a=contention.terminals[0],awaited=a.status==='waiting',detected=a.detected;
        const events=contention.response();if(awaited)phone.resolveAccess(detected);
        history.push(events.map(ev=>ev.kind==='response'?`${name(ev.id)}: ответ и контекст ${ev.context}`:`${name(ev.id)}: тайм-аут, ответа нет; задержка ${ev.delay}, повтор с окна ${ev.retry+1}`).join('; ')||'Окно ответа прошло без новых сообщений.');
      }
      if(action==='identify')phone.identify();
      if(action==='request')phone.requestResource();
      if(action==='grant')phone.assignResource();
      if(action==='send-data'){
        const resource=Number(sections.exchange.querySelector('[data-key="data-resource"]').value)?'С-A':'Д-A';
        const time=Number(sections.exchange.querySelector('[data-key="data-time"]').value);
        phone.transmit(resource,time);exchangeFeedback='Блок принят сетью в назначенном ресурсе и времени.';
      }
      if(action==='check-permission')exchangeFeedback=phone.checkData().reason;
    }catch(error){exchangeFeedback=error.message;}
    draw();const again=root.querySelector(`[data-action="${action}"]:not(:disabled)`);if(again)again.focus();
  });
  window.matchMedia('(max-width:600px)').addEventListener('change',()=>{frame();carrier();});
  draw();return {get simulation(){return phone;},get contention(){return contention;},reset(){phone.reset();contention=new Contention();mode='manual';guess=estimate=0;feedback=localFeedback=exchangeFeedback='';checked=false;history=[];draw();}};
}
document.querySelectorAll('[data-initial-access-story]').forEach(mountInitialAccess);
