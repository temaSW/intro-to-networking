import * as model from './transmission-agreement-model.js';

const name = id => String.fromCharCode(65 + id);
const blue = 'var(--ta-blue)', orange = 'var(--ta-orange)', purple = 'var(--ta-purple)';
const steps = {
  bootstrap: ['Попытка по предположению', 'Чтение описания', 'Чтение продолжения'],
  access: ['Выбор вариантов', 'Передача обращений', 'Ответ узла'],
  allocation: ['Очереди устройств', 'Запросы к узлу', 'Назначения от узла', 'Передача данных'],
};

// A single sample on a fixed complex plane. The dotted ray is its transmitted value.
function vector(point, reference, color, label) {
  const center = 112, scale = 48, limit = 1.8;
  const pos = p => [center + p[0] * scale, center - p[1] * scale];
  const [x, y] = pos(point), [rx, ry] = pos(reference);
  const angle = Math.atan2(y-center, x-center), tip = (a, r) => [x-r*Math.cos(a), y-r*Math.sin(a)];
  const a = tip(angle-.5, 11), b = tip(angle+.5, 11);
  const outside = point.some(v => Math.abs(v)>limit);
  return `<svg class="ta-vector" viewBox="0 0 224 224" role="img" aria-label="${label}">
    <path class="ta-grid" d="M20 112H204M112 20V204"/><circle class="ta-grid" cx="112" cy="112" r="48"/>
    <text x="198" y="105">I</text><text x="119" y="27">Q</text>
    <path d="M112 112L${rx} ${ry}" stroke="${blue}" stroke-width="3" stroke-dasharray="5 4" fill="none"/>
    <circle cx="${rx}" cy="${ry}" r="5" fill="none" stroke="${blue}" stroke-width="2"/>
    ${outside?'<text x="112" y="215" text-anchor="middle">За пределами шкалы</text>':`<path d="M112 112L${x} ${y}M${a}L${x} ${y}L${b}" fill="none" stroke="${color}" stroke-width="4"/><circle cx="${x}" cy="${y}" r="4" fill="${color}"/>`}
  </svg>`;
}

function symbolTile(point, bits, index, escape) {
  const x=36+point[0]*23, y=36-point[1]*23;
  return `<div class="ta-symbol-tile"><small>Символ ${index+1}</small><svg viewBox="0 0 72 72" role="img" aria-label="Принятый символ ${index+1}: I=${point[0].toFixed(2)}, Q=${point[1].toFixed(2)}"><path class="ta-grid" d="M6 36H66M36 6V66"/><path d="M36 36L${x} ${y}" stroke="${orange}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="${orange}"/></svg><strong>${escape(bits)}</strong></div>`;
}

export function mountAgreementScene(root, {range, select, plot, metric, fmt, escape}) {
  const kind=root.dataset.agreement;
  if(!['frequency','bootstrap','access','allocation'].includes(kind))return false;
  let stage=0, seed=1, playing=false, frameHandle=0, lastTime=0;
  const configs={
    frequency:`${range('hz','Частотное рассогласование',-80,80,1,15,'Гц')}${range('symbol','Наблюдаемый символ данных',1,48,1,1)}<button type="button" data-play>Ход времени ▶</button><details class="ta-advanced"><summary>Шум и длина опоры</summary><div class="ta-controls">${range('snr','ОСШ',0,40,1,40,'дБ')}${range('length','Длина известного фрагмента',8,64,8,32,'символа')}</div></details>`,
    bootstrap:`${select('mode','Передатчик: модуляция продолжения',['BPSK','QPSK','16-QAM'],'QPSK')}${select('guess','Приёмник: предположение о модуляции',['BPSK','QPSK','16-QAM'],'BPSK')}`,
    access:`${range('n','Число устройств N',1,16,1,8)}${range('m','Вариантов обращения M',2,12,1,8)}<button type="button" data-attempt>Новая попытка</button>`,
    allocation:`${[4,8,12,6].map((v,i)=>range('demand'+i,'Очередь '+name(i),0,24,1,v,'единиц данных')).join('')}<details class="ta-advanced"><summary>Размер ресурса и состав участников</summary><div class="ta-controls">${range('users','Число пользователей',2,4,1,3)}${range('rows','Частотных частей',2,6,1,3)}</div></details>`,
  };
  root.classList.add('ta-scene');
  root.innerHTML=`<div class="ta-controls">${configs[kind]}</div>${steps[kind]?`<nav class="ta-stage-nav" aria-label="Этапы ${kind==='bootstrap'?'чтения кадра':'обмена'}">${steps[kind].map((s,i)=>`<button type="button" data-stage="${i}" aria-pressed="${i===0}">${i+1}. ${s}</button>`).join('')}</nav>`:''}<div class="ta-scene-result"></div>`;
  const result=root.querySelector('.ta-scene-result');
  function parameters() {
    const p={seed};
    root.querySelectorAll('[data-key]').forEach(e=>{
      p[e.dataset.key]=e.tagName==='SELECT'?e.value:Number(e.value);
      const output=root.querySelector(`[data-output="${e.dataset.key}"]`);
      if(output)output.textContent=e.dataset.key==='snr'&&e.value==='40'?'Без шума':`${fmt(Number(e.value))} ${e.dataset.unit||''}`;
    });
    if(p.snr===40)p.snr=Infinity;
    return p;
  }
  function draw() {
    const p=parameters();
    const open=Array.from(result.querySelectorAll('details'),e=>e.open);
    root.querySelectorAll('[data-stage]').forEach(e=>e.setAttribute('aria-pressed',String(Number(e.dataset.stage)===stage)));
    let html='';
    if(kind==='frequency') {
      const d=model.frequency(p), i=p.symbol-1, t=p.length+i;
      const qpsk=d.reference;
      const cloud=(title,values)=>plot(title,[{name:'Переданное созвездие',points:qpsk,dots:true,radius:6,color:blue},{name:'Полученные символы',points:values,dots:true,radius:3,color:orange}],{square:true,xmin:-1.8,xmax:1.8,ymin:-1.8,ymax:1.8,xlabel:'I',ylabel:'Q'});
      html=`<div class="ta-time-strip"><span>Известная опора · ${p.length} мс</span><span>Данные · 48 мс<progress max="48" value="${p.symbol}" aria-label="Наблюдаемый символ ${p.symbol} из 48"></progress></span></div>
        <p class="ta-scene-caption">Один и тот же символ ${p.symbol} · момент ${t} мс от начала передачи</p>
        <div class="ta-vector-chain"><figure><figcaption>Передали</figcaption>${vector(d.transmitted[i],d.transmitted[i],blue,'Переданный символ')}</figure><span class="ta-scene-arrow" aria-hidden="true">→</span><figure><figcaption>Приняли</figcaption>${vector(d.received[i],d.transmitted[i],orange,'Принятый символ с поворотом')}</figure><span class="ta-scene-arrow" aria-hidden="true">→</span><figure><figcaption>После компенсации</figcaption>${vector(d.corrected[i],d.transmitted[i],purple,'Символ после обратного поворота по оценке частоты')}</figure></div>
        <p class="ta-note">Синий пунктир сохраняет направление переданного символа. Оранжевая стрелка — принятый символ; фиолетовая — результат компенсации.</p>
        <div class="ta-metrics">${metric('Поворот без шума к этому моменту',`${fmt(360*p.hz*t/1000,1)}°`)}${metric('Оценка по известной опоре',`${fmt(d.estimate,2)} Гц`)}${metric('Ошибки 48 символов · до → после',`${d.rawErrors} → ${d.errors}`)}</div>
        <details><summary>Как опора даёт оценку; все символы данных</summary>${plot('Измерение поворота известного фрагмента',[{name:'Фаза после удаления известной модуляции',points:d.phase,dots:true,color:orange},{name:'Поворот по оценке',points:d.estimatedPhase,dash:true,color:purple}],{xmax:63,ymin:-2000,ymax:2000,xlabel:'Время опоры, мс',ylabel:'Фаза, °'})}<div class="ta-pair">${cloud('Все данные до компенсации',d.received)}${cloud('Все данные после компенсации',d.corrected)}</div></details>`;
    }
    if(kind==='bootstrap') {
      const f=model.bootstrapFrame(p.mode), info=stage>=1?model.readBootstrap(f.header):null;
      const wrong=model.decodePayload(f.payload,p.guess), actual=stage===2?model.decodePayload(f.payload.slice(0,info.symbols),info.mode):null;
      const readingMode=info?info.mode:p.guess, width=model.constellation(readingMode)[0].bits.length;
      const shown=f.payload.slice(0,8), bits=model.demodulate(shown,readingMode);
      const mismatch=wrong.bits!==f.payloadBits;
      html=`<div class="ta-wire-frame" role="group" aria-label="Учебный кадр"><div>Синхросигнал<small>15 символов</small></div><div class="${stage===1?'ta-current-field':''}">Начальное описание<small>10 символов BPSK</small></div><div class="${stage!==1?'ta-current-field':''}">Продолжение<small>${f.payload.length} символов ${p.mode}</small></div></div>
        ${stage===1?`<p class="ta-scene-caption">Приёмник читает известный формат BPSK: знак каждого символа даёт один бит</p><div class="ta-header-symbols">${f.header.map((point,i)=>`<span class="${i<2?'ta-mode-bit':'ta-length-bit'}"><small>${point[0]>0?'+1':'−1'}</small><b aria-hidden="true">↓</b><strong>${f.headerBits[i]}</strong></span>`).join('')}</div><div class="ta-pair"><div class="ta-setting"><code>${f.headerBits.slice(0,2)}</code><span aria-hidden="true">↓</span><strong>Модуляция: ${info.mode}</strong></div><div class="ta-setting"><code>${f.headerBits.slice(2)}</code><span aria-hidden="true">↓</span><strong>Длина: ${info.symbols} символов</strong></div></div>`:
          `<p class="ta-scene-caption">Те же принятые точки → чтение как ${readingMode} → ${width} ${width===1?'бит':'бита'} на символ</p><div class="ta-symbol-strip">${shown.map((point,i)=>symbolTile(point,bits.slice(i*width,(i+1)*width),i,escape)).join('')}</div><div class="ta-bit-stream"><span>Первые биты после чтения</span><code>${bits.match(/.{1,8}/g).join(' ')}</code></div>`}
        <div class="ta-receiver-setting"><strong>Настройка приёмника</strong><span>${info?`${info.mode}; прочитать ${info.symbols} символов`:`${p.guess}; длина продолжения неизвестна`}</span></div>
        <div class="ta-readout ${stage===0&&mismatch?'ta-conflict':''}"><small>${stage===0?'Попытка по предположению':stage===1?'Результат чтения описания':'Результат чтения продолжения'}</small><code>${escape(stage===0?wrong.text:stage===1?'Приёмник настроен; продолжение ещё не прочитано':actual.text)}</code></div>
        <details><summary>Что передали и почему результаты отличаются</summary><p>Передали: <code>${f.message}</code>; всего ${f.payloadBits.length} бит. По предположению ${p.guess} получено ${wrong.bits.length} бит. ${mismatch?'Биты не совпали.':'Предположение совпало с форматом передачи.'}</p><p>В начальном описании 2 бита выбирают модуляцию (00 — BPSK, 01 — QPSK, 10 — 16-QAM); 8 бит задают число символов. Двоичная фазовая манипуляция (BPSK) несёт 1 бит на символ, четырёхпозиционная (QPSK) — 2, квадратурная амплитудная манипуляция с 16 точками (16-QAM) — 4.</p></details>`;
    }
    if(kind==='access') {
      const d=model.access(p);
      html=`<div class="ta-exchange-actors"><strong>${p.n} новых устройств</strong><span>${stage===0?'Выбирают независимо':stage===1?'Передают в выбранных вариантах →':'← Ответ центрального узла'}</span><strong>Центральный узел</strong></div>
        <div class="ta-access-slots">${d.first.bins.map((ids,j)=>`<div class="ta-access-slot ${stage===2?(ids.length>1?'ta-conflict':ids.length?'ta-success':''):''}"><strong>Вариант ${j+1}</strong><div class="ta-slot-devices">${ids.map(id=>`<span class="ta-device">${name(id)}</span>`).join('')||'<span class="ta-note">Никто не выбрал</span>'}</div>
          <div class="ta-slot-air" style="--stack-size:${ids.length}">${stage>=1?ids.map((id,k)=>`<span class="ta-air-message" style="--message-index:${k}">Обращение ${name(id)}</span>`).join(''):'<span class="ta-note">Ещё не передавали</span>'}</div>
          <div class="ta-slot-response">${stage===2?(ids.length>1?`× Наложились ${ids.length} обращения; индивидуального ответа нет`:ids.length?`✓ Ответ устройству ${name(ids[0])}`:'— Обращений нет'):'Узел ещё не ответил'}</div></div>`).join('')}</div>
        ${stage===2?`<div class="ta-metrics">${metric('Получили ответ',`${d.first.successes.length} из ${p.n}`)}${metric('Попали в конфликты',d.first.collided.length)}${metric('Остались пустыми',d.empty)}</div>`:''}
        <p class="ta-note">Каждая колонка — один вариант общего обращения. Прямоугольники в ней занимают одно и то же место ресурса.</p>`;
    }
    if(kind==='allocation') {
      for(let i=0;i<4;i++)root.querySelector(`[data-key="demand${i}"]`).closest('label').hidden=i>=p.users;
      const demands=Array.from({length:p.users},(_,i)=>p['demand'+i]), d=model.allocation({demands,rows:p.rows});
      const message=(id)=>stage===1?`Запрос: ${demands[id]} единиц →`:stage>=2?`← Назначено ${d.granted[id]} ячеек`:'Потребность узлу неизвестна';
      const counters=demands.map(()=>0);
      const cells=d.cells.map((id,k)=>{const packet=id>=0?++counters[id]:0;return `<span class="ta-resource-cell ${id===-2?'ta-reserved':stage>=2&&id>=0?'ta-user-'+id:''} ${stage===2?'ta-planned':stage===3&&id>=0?'ta-occupied':''}" aria-label="Интервал ${k%8+1}, частотная часть ${Math.floor(k/8)+1}: ${id===-2?'служебный обмен':stage>=2&&id>=0?name(id)+packet:'свободно'}">${id===-2?'Сл':stage>=2&&id>=0?name(id)+packet:'·'}</span>`;});
      html=`<div class="ta-exchange-actors"><strong>Устройства</strong><span>${stage===0?'До служебного обмена':stage===1?'Запросы →':stage===2?'← Назначения':'Данные в назначенных ячейках →'}</span><strong>Центральный узел</strong></div>
        <div class="ta-demand-lanes">${demands.map((v,i)=>`<div class="ta-demand-lane ta-user-${i}"><div><strong>Устройство ${name(i)} · ${stage===3?'остаток '+d.unmet[i]:'очередь '+v}</strong><div class="ta-packets">${Array.from({length:v},(_,k)=>`<span class="${stage===3&&k<d.granted[i]?'ta-packet-sent':''}" aria-label="Единица ${k+1}: ${stage===3&&k<d.granted[i]?'передана':'в очереди'}">${stage===3&&k<d.granted[i]?'✓':''}${k+1}</span>`).join('')||'<small>Очередь пуста</small>'}</div></div><div class="ta-message-lane"><span>${message(i)}</span>${stage>=2?`<small>${d.assignments[i].length?'t'+d.assignments[i][0].time+'/f'+d.assignments[i][0].frequency+' …':'Нет ячеек'}</small>`:''}</div></div>`).join('')}</div>
        <p class="ta-scene-caption">${stage<2?'Ресурс ещё не назначен':stage===2?'План следующего кадра · данные ещё не передавались':'Следующий кадр · назначенные ячейки заняты данными'}</p>
        <div class="ta-resource-scroll" tabindex="0" role="region" aria-label="Ресурс по времени и частоте"><div class="ta-resource-grid"><strong>f / t</strong>${Array.from({length:8},(_,i)=>`<strong>${i+1}</strong>`).join('')}${Array.from({length:p.rows},(_,r)=>`<strong>f${r+1}</strong>${cells.slice(r*8,(r+1)*8).join('')}`).join('')}</div></div>
        <p class="ta-note">Один квадратик очереди занимает одну ячейку ресурса: A1 — первая единица устройства A. Галочка отмечает переданное; Сл — служебный обмен. f — частотная часть, t — временной интервал.</p>
        <details><summary>Полное содержание назначений</summary>${d.assignments.map((list,i)=>`<p>${name(i)}: ${stage>=2?list.map(a=>`t${a.time}/f${a.frequency}`).join(', ')||'нет ресурса':'назначение ещё не передано'}</p>`).join('')}</details>`;
    }
    result.innerHTML=html;
    result.querySelectorAll('details').forEach((e,i)=>e.open=open[i]||false);
  }
  function stop(){playing=false;cancelAnimationFrame(frameHandle);root.querySelector('[data-play]')?.replaceChildren(document.createTextNode('Ход времени ▶'));}
  function tick(time) {
    if(!playing)return;
    if(time-lastTime>280) {
      const input=root.querySelector('[data-key="symbol"]');
      input.value=String(Number(input.value)%48+1);draw();lastTime=time;
    }
    frameHandle=requestAnimationFrame(tick);
  }
  root.addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.hasAttribute('data-stage')){stage=Number(button.dataset.stage);draw();}
    if(button.hasAttribute('data-attempt')){seed++;stage=0;draw();}
    if(button.hasAttribute('data-play')){if(playing)stop();else{playing=true;lastTime=performance.now();button.textContent='Остановить время ❚❚';frameHandle=requestAnimationFrame(tick);}}
  });
  root.addEventListener('input',()=>{stop();if(kind!=='frequency')stage=0;draw();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  draw();return true;
}
