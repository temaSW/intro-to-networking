import {PCM,pcmSlot,pcmRead,NR,STAGES,CHANNELS,nrEvents,slotDirection,SSB_REGIONS} from './transmission-frame-model.js';

const legend='<div class="frame-legend"><span class="sync">Синхронизация</span><span class="reference">Опорные сигналы</span><span class="control">Управление</span><span class="access">Доступ</span><span class="payload">Пользовательские данные</span></div>';
const button=(text,attrs='')=>`<button type="button" ${attrs}>${text}</button>`;
function focusKey(root) {
  const active=document.activeElement;
  return root.contains(active)&&active.tagName==='BUTTON'?Object.entries(active.dataset):null;
}
function restoreFocus(root,key) {
  if(key?.length) [...root.querySelectorAll('button')].find(b=>key.every(([k,v])=>b.dataset[k]===v))?.focus({preventScroll:true});
}

export function mountPcm(root) {
  let selected=1, offset=0, frame=0;
  root.innerHTML=`<div class="frame-heading"><strong>Цикл ИКМ-30 / E1</strong><span>32 × 8 = 256 бит · 125 мкс · 2,048 Мбит/с</span></div>
    <p class="frame-caption">Вариант с поканальной сигнализацией: 30 речевых каналов, КИ 0 и КИ 16 — служебные. КИ — канальный интервал.</p>
    ${legend}<div class="pcm-slots" aria-label="32 канальных интервала"></div>
    <div class="frame-controls"><label>Цикл внутри сверхцикла <select data-frame>${Array.from({length:16},(_,i)=>`<option value="${i}">${i}</option>`).join('')}</select></label>
    <label>Смещение начала приёмника, бит <input data-offset type="range" min="0" max="255" value="0"><output data-offset-value>0</output></label></div>
    <div class="frame-presets" aria-label="Примеры смещения">${[0,1,8].map(n=>button(n===0?'Начало совпадает':n===1?'Сдвиг на 1 бит':'Сдвиг на 1 КИ',`data-shift="${n}"`)).join('')}</div>
    <div class="frame-detail" aria-live="polite" data-pcm-detail></div>
    <div class="pcm-superframe"><strong>Сверхцикл: 16 циклов × 125 мкс = 2 мс</strong><p>КИ 0 привязывает цикл; КИ 16 в цикле 0 содержит признак сверхцикла, а в циклах 1–15 — сигнализацию каналов.</p><div class="pcm-superframe-row"></div></div>`;
  const draw=()=>{
    const focus=focusKey(root);
    root.querySelector('.pcm-slots').innerHTML=Array.from({length:32},(_,i)=>{
      const s=pcmSlot(i,frame);
      return button(`<small>КИ ${i}</small><strong>${i===0?'СИНХ':i===16?'СИГН':`Речь ${i<16?i:i-1}`}</strong>`,`class="${s.kind}" data-slot="${i}" aria-pressed="${i===selected}"`);
    }).join('');
    const s=pcmSlot(selected,frame),read=pcmRead(selected,offset,frame);
    const source=pcmSlot(read.sourceSlot,read.sourceFrame);
    root.querySelector('[data-offset-value]').textContent=offset;
    root.querySelector('[data-pcm-detail]').innerHTML=`<h4>${s.title}</h4><p>${s.text}</p>
      <div class="pcm-word" aria-label="Переданные восемь бит">${[...s.bits].map((b,i)=>`<span><small>${i+1}</small><b>${b}</b></span>`).join('')}</div>
      <div class="pcm-receive"><span>Передано в КИ ${selected}: <code>${s.bits}</code></span><span>Приёмник относит к КИ ${selected}: <code>${read.bits}</code></span></div>
      <p class="frame-outcome">${read.aligned?'Границы совпадают: слово и назначение канала восстановлены.':read.wordAligned?`Границы восьмибитных слов сохранены, но приёмник читает КИ ${read.sourceSlot} цикла ${read.sourceFrame}: «${source.title}». Назначение не совпадает с ожидаемым КИ ${selected}.`:`Начало чтения — КИ ${read.sourceSlot} цикла ${read.sourceFrame}, бит ${read.bitOffset+1}. Слово собрано из частей соседних интервалов; такт битов в этой модели сохранён.`}</p>`;
    root.querySelector('.pcm-superframe-row').innerHTML=Array.from({length:16},(_,i)=>button(`<small>Цикл ${i}</small><span>${i===0?'0000':`${i} / ${i+15}`}</span>`,`data-cycle="${i}" aria-pressed="${i===frame}"`)).join('');
    restoreFocus(root,focus);
  };
  root.addEventListener('click',e=>{
    const slot=e.target.closest('[data-slot]'),shift=e.target.closest('[data-shift]'),cycle=e.target.closest('[data-cycle]');
    if(slot) selected=Number(slot.dataset.slot);
    else if(shift) {offset=Number(shift.dataset.shift);root.querySelector('[data-offset]').value=offset;}
    else if(cycle) {frame=Number(cycle.dataset.cycle);root.querySelector('[data-frame]').value=frame;}
    else return;
    draw();
  });
  root.querySelector('[data-offset]').addEventListener('input',e=>{offset=Number(e.target.value);draw();});
  root.querySelector('[data-frame]').addEventListener('change',e=>{frame=Number(e.target.value);draw();});
  draw();
}

function ssbDiagram(focus='all') {
  const regions=SSB_REGIONS.map(r=>`<rect data-region="${r.id}" class="${r.id==='pbch'?'control':'sync'}" x="${80+r.start*2}" y="${35+r.symbol*44}" width="${(r.end-r.start)*2}" height="36"/>`).join('');
  const labels=SSB_REGIONS.map(r=>`<text x="${80+(r.start+r.end)}" y="${58+r.symbol*44}" text-anchor="middle">${r.label}</text>`).join('');
  const pilots=SSB_REGIONS.filter(r=>r.id==='pbch').map(r=>Array.from({length:r.end-r.start},(_,i)=>r.start+i).filter(k=>k%4===0).map(k=>`<rect class="reference" x="${80+k*2}" y="${35+r.symbol*44}" width="2" height="36"/>`).join('')).join('');
  return `<div class="ssb-focus" data-ssb-focus="${focus}"><div class="nr-elements">${['all','pss','sss','pbch','dmrs'].map(id=>button({all:'Весь SSB',pss:'PSS',sss:'SSS',pbch:'PBCH → MIB',dmrs:'DM-RS (DMRS)'}[id],`data-ssb-part="${id}" aria-pressed="${focus===id}"`)).join('')}</div>
    <div class="frame-scroll"><svg class="ssb-map" viewBox="0 0 600 245" role="img" aria-label="SSB: четыре символа по времени, 240 поднесущих по частоте; PSS в символе 0, SSS в символе 2, PBCH и опорные сигналы в символах 1–3">
    <text x="80" y="20">Частота → поднесущие 0…239</text>${[0,1,2,3].map(i=>`<text x="8" y="${58+i*44}">Симв. ${i}</text><rect class="empty" x="80" y="${35+i*44}" width="480" height="36"/>`).join('')}${regions}${pilots}${labels}
    <text x="80" y="230">PSS / SSS: поднесущие 56…182 · пустые позиции не заняты блоком</text></svg></div>
    <p class="frame-caption">Время идёт по строкам. Тонкие полосы — отдельные поднесущие DM-RS: пример для физического идентификатора ячейки 0 (каждая четвёртая поднесущая в областях PBCH). Они заменяют часть позиций PBCH, а не накладываются на его данные. MIB — содержимое PBCH.</p>
    <p>${{all:'SSB объединяет поиск ячейки, физическую опору и первую порцию информации о системе.',pss:'PSS — первичный сигнал синхронизации (Primary Synchronization Signal): известная последовательность для поиска и начальной временной/частотной опоры.',sss:'SSS — вторичный сигнал синхронизации (Secondary Synchronization Signal): вместе с PSS определяет физический идентификатор ячейки.',pbch:'PBCH — физический широковещательный канал (Physical Broadcast Channel): несёт основной информационный блок MIB (Master Information Block). Его позиции делятся с DM-RS.',dmrs:'DM-RS — демодуляционные опорные сигналы (Demodulation Reference Signals). Известная последовательность позволяет оценить канал для чтения PBCH. Синхронизационные PSS/SSS и демодуляционные DM-RS решают разные задачи.'}[focus]}</p></div>`;
}

export function mountNr(root) {
  let stage='overview',mode='fdd',selected='ssb',slot=0,direction='dl',ssbFocus='all';
  root.innerHTML=`<div class="frame-heading"><strong>Радиокадр NR: 10 мс</strong><span>10 подкадров × 1 мс → 20 слотов × 0,5 мс → 14 символов в слоте</span></div>
    <p class="frame-caption">Разнос поднесущих 30 кГц, нормальный циклический префикс. DL (downlink) — станция → телефон; UL (uplink) — телефон → станция.</p>
    <div class="frame-controls"><label>Разделение направлений <select data-duplex><option value="fdd">FDD — разные полосы частот</option><option value="tdd">TDD — разные интервалы времени</option></select></label></div>
    <div class="nr-stages" aria-label="Этап взаимодействия">${STAGES.map(s=>button(s.label,`data-stage="${s.id}" aria-pressed="${s.id===stage}"`)).join('')}</div>
    ${legend}<p data-duplex-note></p><div class="frame-scroll"><div class="nr-frame" data-nr-frame></div></div>
    <p class="frame-caption">Номера слотов для сообщений — пример размещения, а не обязательные позиции стандарта. Каждый этап показывает отдельный пример кадра; вся процедура не обязана завершиться за 10 мс. Пустая клетка означает «передача не показана».</p>
    <div class="nr-elements" aria-label="Элементы выбранного этапа"></div>
    <div class="frame-detail" aria-live="polite" data-nr-detail></div>`;
  const draw=()=>{
    const focus=focusKey(root);
    const events=nrEvents(stage,mode);
    root.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stage===stage)));
    root.querySelector('[data-duplex-note]').textContent=mode==='fdd'?'FDD: UL и DL имеют общую шкалу кадров, но идут в разных полосах; одна временная позиция доступна обоим направлениям.':'TDD: UL и DL используют одну полосу. Показан пример D–D–D–S–U: D — нисходящий слот, U — восходящий, S — переходный (10 DL-символов, 2 защитных, 2 UL). Рисунок этой конфигурации повторяется; он не универсален.';
    let html='<div class="nr-axis"><span>Время →</span>'+Array.from({length:10},(_,i)=>`<span>${i}–${i+1} мс</span>`).join('')+'</div>';
    for(const dir of ['dl','ul']) {
      html+=`<div class="nr-frame-row"><strong>${dir==='dl'?'DL ↓':'UL ↑'}</strong>`;
      for(let n=0;n<NR.slots;n++) {
        const d=slotDirection(n,mode),blocked=d!=='both'&&d!=='mixed'&&d!==dir;
        const list=events.filter(e=>e.direction===dir&&e.slot===n);
        const kind=list.find(e=>e.id===selected)?.kind||list[0]?.kind||'';
        html+=button(`<small>${n}</small><span>${blocked?'—':d==='mixed'?'S':list.map(e=>CHANNELS[e.id].label.split(' · ')[0]).join(' + ')||'·'}</span>`,`class="${kind} ${blocked?'blocked':''}" data-nr-slot="${n}" data-direction="${dir}" aria-label="${dir.toUpperCase()}, слот ${n}${blocked?', направление недоступно':''}" aria-pressed="${n===slot&&dir===direction}" ${blocked?'disabled':''}`);
      }
      html+='</div>';
    }
    root.querySelector('[data-nr-frame]').innerHTML=html;
    root.querySelector('.nr-elements').innerHTML=events.map(e=>button(`${e.label} · ${e.direction.toUpperCase()} ${e.slot}`,`class="${e.kind}" data-event="${e.id}" data-event-slot="${e.slot}" data-event-direction="${e.direction}" aria-pressed="${selected===e.id&&direction===e.direction&&slot===e.slot}"`)).join('');
    const event=events.find(e=>e.id===selected&&e.direction===direction&&e.slot===slot);
    const list=events.filter(e=>e.slot===slot&&e.direction===direction);
    const d=slotDirection(slot,mode);
    const symbols=Array.from({length:14},(_,i)=>{
      let title='Ресурс не показан',kind='empty';
      if(d==='mixed') {title=i<10?'DL':i<12?'Защитный интервал':'UL';kind=i>=10&&i<12?'guard':'control';}
      else if(list.length) {
        if(list.some(e=>e.id==='ssb')&&i>=4&&i<8){title='SSB';kind='sync';}
        else if(list.some(e=>e.id==='control')&&i<2){title='PDCCH';kind='control';}
        else if(i>=2&&list.some(e=>!['control','ssb','reference','prach'].includes(e.id))){const data=list.find(e=>!['control','ssb','reference','prach'].includes(e.id));title=data.label;kind=data.kind;}
      }
      return `<div class="${kind}" title="${title}"><small>${i}</small><span>${title==='Ресурс не показан'?'·':title==='Защитный интервал'?'Пауза':title.split(' · ')[0]}</span>${list.some(e=>e.id==='reference')&&[2,11].includes(i)?'<span class="reference">DM-RS</span>':''}</div>`;
    }).join('');
    const detail=root.querySelector('[data-nr-detail]');
    detail.innerHTML=`<h4>${direction.toUpperCase()} · слот ${slot} · ${slot*.5}–${(slot+1)*.5} мс</h4>
      ${event?`<h4>${event.title}</h4><p>${event.text}</p>`:`<p>${d==='mixed'?'Переходный слот разделён на нисходящую часть, защитную паузу и восходящую часть. Пауза позволяет переключить направление.':'Для этого места передача выбранного этапа не показана. Это не означает, что ресурс пуст в работающей сети.'}</p>`}
      ${event?.id==='ssb'?ssbDiagram(ssbFocus):event?.id==='prach'?'<div class="nr-prach-window access">UL: возможность PRACH → обнаружение преамбулы</div>':`<div class="frame-scroll"><div class="nr-symbols">${symbols}</div></div><p class="frame-caption">Числа — индексы символов 0…13. Полоса делится по частоте; цветная метка показывает только часть её ресурса. Размещение управления и данных внутри слота схематично, не задаёт точный формат назначения.</p>`}
      ${stage==='overview'?'<p class="frame-caption">Обзор типов ресурсов разных участников, а не процедура одного телефона.</p>':`<a href="#${stage==='search'?'nr-discovery':stage==='system'?'nr-system':stage==='access'?'nr-access':'nr-data'}">К инженерскому вопросу этого этапа →</a>`}`;
    restoreFocus(root,focus);
  };
  root.addEventListener('click',e=>{
    const phase=e.target.closest('[data-stage]'),element=e.target.closest('[data-event]'),cell=e.target.closest('[data-nr-slot]'),part=e.target.closest('[data-ssb-part]');
    if(part) ssbFocus=part.dataset.ssbPart;
    else if(phase) {stage=phase.dataset.stage;const first=nrEvents(stage,mode)[0];selected=first.id;slot=first.slot;direction=first.direction;}
    else if(element) {selected=element.dataset.event;slot=Number(element.dataset.eventSlot);direction=element.dataset.eventDirection;}
    else if(cell) {slot=Number(cell.dataset.nrSlot);direction=cell.dataset.direction;selected=nrEvents(stage,mode).find(x=>x.slot===slot&&x.direction===direction)?.id||'';}
    else return;
    draw();
  });
  root.querySelector('[data-duplex]').addEventListener('change',e=>{mode=e.target.value;const first=nrEvents(stage,mode)[0];selected=first.id;slot=first.slot;direction=first.direction;draw();});
  draw();
}
document.querySelectorAll('[data-pcm-frame]').forEach(mountPcm);
document.querySelectorAll('[data-nr-frame-map]').forEach(mountNr);
