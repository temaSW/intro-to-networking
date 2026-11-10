import {checkBeaconPeriod,checkFilePlan,checkAccessTime,checkAccessIntervals,checkDirectionalAllocation} from './topic04-two-tasks-model.js';
const root=document.querySelector('[data-topic04-tasks]');
if(root){
  const q=s=>root.querySelector(s),field=n=>q(`[name="${n}"]`),button=a=>q(`[data-action="${a}"]`);
  const number=(value,d=3)=>Number(value).toLocaleString('ru-RU',{maximumFractionDigits:d});
  const read=n=>{const value=field(n).value.trim().replace(',','.');return value===''?NaN:Number(value);};
  let beaconOpened=false,fileOpened=false,ready=463;
  function beaconCheck(){
    let r;try{r=checkBeaconPeriod(read('period'));}catch{q('[data-beacon-message]').textContent='Для наглядной проверки укажите период от 2 до 200 мс.';q('[data-beacon-result]').hidden=true;return;}
    q('[data-beacon-message]').textContent=r.pass?'Выбранный период выполняет оба требования. Сопоставьте проверку со своим диапазоном допустимых значений.':'Выбранный период не выполняет все требования. Проверьте оба ограничения в своём расчёте.';
    q('[data-beacon-result]').hidden=false;
    q('[data-delay]').textContent=`Время получения: не более ${number(r.worstDelay)} мс. ${r.delayPass?'Укладывается в 100 мс.':'Превышает 100 мс.'}`;q('[data-delay]').classList.toggle('is-fail',!r.delayPass);
    q('[data-share]').textContent=`Служебное время: ${number(r.servicePercent)}%. ${r.resourcePass?'Не превышает 5%.':'Превышает 5%.'}`;q('[data-share]').classList.toggle('is-fail',!r.resourcePass);
    const end=Math.max(120,Math.ceil((r.period+8)/20)*20),x=t=>65+t*600/end;
    let svg=`<svg viewBox="0 0 720 190" role="img" aria-label="Терминал включается сразу после начала; следующее полное сообщение заканчивается в ${number(r.worstDelay)} мс"><path class="sp-axis" d="M65 146 H680"/>`;
    for(let i=0;i<=6;i++){const t=end*i/6;svg+=`<path class="sp-axis" d="M${x(t)} 142 V150"/><text x="${x(t)}" y="169" text-anchor="middle">${number(t,1)}</text>`;}
    svg+=`<path class="sp-limit" d="M${x(100)} 26 V145"/><text x="${x(100)-5}" y="21" text-anchor="end">Срок 100 мс</text><rect class="sp-old-signal" x="${x(0)}" y="48" width="${x(2)-x(0)}" height="28"><title>Сообщение от 0 до 2 мс: начало пропущено</title></rect><rect class="sp-signal" x="${x(r.period)}" y="48" width="${x(2)-x(0)}" height="28"><title>Полное сообщение от ${r.period} до ${r.period+2} мс</title></rect><path class="sp-axis" d="M${x(0)+1} 36 V136"/><text x="${x(0)+9}" y="36">Включение 0+</text><path class="sp-wait" d="M${x(0)+1} 105 H${x(r.worstDelay)} m -6 -4 6 4-6 4"/><text x="${Math.max(105,(x(0)+x(r.worstDelay))/2)}" y="126" text-anchor="middle">до ${number(r.worstDelay)} мс</text><text x="686" y="169">мс</text></svg>`;
    q('[data-beacon-chart]').innerHTML=svg;
    q('[data-beacon-caption]').textContent=`Верхняя оценка: ожидание следующего начала T и приём ещё 2 мс. Доля служебного времени: 2 / T × 100%. Шкала рисунка: 0–${end} мс. Обозначение 0+ означает включение сразу после начала; точное время может быть немного меньше этой оценки.`;
  }
  button('beacon-check').onclick=()=>{beaconOpened=true;beaconCheck();};
  field('period').oninput=()=>{if(beaconOpened)beaconCheck();};
  function fileChart(r){
    const x=t=>110+(t-460)*56;
    let svg='<svg viewBox="0 0 720 230" role="img" aria-label="Полоса Б, интервалы 3 и 4 с 464 до 468 мс; ниже показан ваш план"><path class="sp-axis" d="M110 194 H682"/>';
    for(const t of [460,462,464,466,468,470])svg+=`<path class="sp-axis" d="M${x(t)} 28 V199"/><text x="${x(t)}" y="219" text-anchor="middle">${t}</text>`;
    svg+='<text x="8" y="63">Ресурс Б</text><text x="8" y="113">Д1</text><text x="8" y="163">Д2</text>';
    for(const s of r.slots)svg+=`<rect class="sp-signal" x="${x(s.start)}" y="43" width="112" height="28"/><text x="${x(s.start+1)}" y="62" text-anchor="middle">Интервал ${s.id}</text>`;
    for(let i=0;i<r.rows.length;i++){const row=r.rows[i],left=Math.max(460,row.start),right=Math.min(470,row.end),y=93+i*50;if(right>left)svg+=`<rect class="${row.valid?'sp-signal':'sp-bad'}" x="${x(left)}" y="${y}" width="${x(right)-x(left)}" height="28"><title>${row.id}: ${row.start}–${row.end} мс</title></rect><text x="${(x(left)+x(right))/2}" y="${y+19}" text-anchor="middle">${row.bytes} Б</text>`;else svg+=`<text x="118" y="${y+19}">Передача вне показанного участка</text>`;}
    svg+='<text x="690" y="219">мс</text></svg>';q('[data-file-chart]').innerHTML=svg;
  }
  function fileCheck(){
    let r;try{r=checkFilePlan([{bytes:read('bytes1'),start:read('start1')},{bytes:read('bytes2'),start:read('start2')}],ready);}catch{q('[data-file-message]').textContent='Введите размеры двух частей файла целыми байтами и время начала каждой передачи.';q('[data-file-result]').hidden=true;return;}
    q('[data-file-result]').hidden=false;q('[data-variation]').hidden=false;
    q('[data-file-message]').textContent=ready===465?(r.totalPass&&r.deliveredBytes===r.maxBytes?'Использован весь оставшийся ресурс: 128 байт. Для остатка потребуется новое назначение.':'Проверьте, сколько данных вашего плана ещё можно передать после готовности в 465 мс.'):(r.pass?'Оба канальных кадра помещаются в ресурс; все 250 байт можно передать.':'Весь план пока не выполняется. Сопоставьте время, объём данных и доступные ячейки.');
    fileChart(r);const cells=q('[data-cells]');cells.replaceChildren();
    for(const slot of r.slots){
      const item=document.createElement('div');item.className='sp-cell';const row=r.rows.find(row=>row.slot===slot.id),missed=slot.start<ready;
      item.classList.toggle('is-missed',missed||!!row&&!row.valid);
      const title=document.createElement('strong');title.textContent=`Интервал ${slot.id} · ${slot.start}–${slot.end} мс`;item.append(title);
      const p=document.createElement('p');p.textContent=missed?'К началу интервала данные ещё не готовы.':row?`${row.id}: ${row.bytes} байт данных + 16 служебных = ${row.bytes+16} байт.`:'В вашем плане нет передачи с этой границы.';item.append(p);
      if(row){const bar=document.createElement('div');bar.className='sp-bytebar';bar.setAttribute('aria-hidden','true');const header=document.createElement('span');header.className='sp-overhead';header.style.width=`${16/144*100}%`;const data=document.createElement('span');data.className='sp-payload';data.style.width=`${Math.min(128,row.bytes)/144*100}%`;bar.append(header,data);item.append(bar);const label=document.createElement('p');label.className='sp-muted';label.textContent=row.bytes<=128?`16 Б служебных · ${row.bytes} Б данных · ${128-row.bytes} Б свободно`:`Переполнение ячейки на ${row.bytes-128} Б.`;item.append(label);}
      cells.append(item);
    }
    const feedback=q('[data-file-feedback]');feedback.replaceChildren();
    const line=(text,fail=false)=>{const p=document.createElement('p');p.className=`sp-feedback-line ${fail?'is-fail':''}`;p.textContent=text;feedback.append(p);};
    line(`Сумма данных в вашем плане: ${r.totalBytes} байт. ${r.totalPass?'Это весь файл.':'По условию требуется ровно 250 байт.'}`,!r.totalPass);
    for(const row of r.rows)line(`${row.id}: ${row.start}–${row.end} мс. ${row.valid?'Время и вместимость допустимы.':row.issues.join(' ')}`,!row.valid);
    if(r.deliveredBytes!==null)line(`По вашему плану в допустимых ячейках передаётся ${r.deliveredBytes} из 250 байт; остаётся ${r.remainingBytes}.`,r.remainingBytes>0);
    if(ready===465)line(`При готовности в 465 мс по этому назначению доступна ${r.slots.filter(s=>s.start>=ready).length} ячейка: максимум ${r.maxBytes} полезных байт. Для оставшихся как минимум ${r.minimumRemaining} байт потребуется новое назначение.`);
  }
  button('file-check').onclick=()=>{fileOpened=true;fileCheck();};
  for(const name of ['bytes1','bytes2','start1','start2'])field(name).oninput=()=>{if(fileOpened)fileCheck();};
  button('toggle-ready').onclick=()=>{ready=ready===463?465:463;q('[data-ready]').textContent=String(ready);button('toggle-ready').textContent=ready===465?'Вернуть условие «готово в 463 мс»':'Проверить условие «готово в 465 мс»';q('[data-file-result]').hidden=true;fileOpened=false;q('[data-file-message]').textContent=`Изменено только время готовности: ${ready} мс. Сначала рассчитайте последствия, затем снова нажмите «Проверить мой план».`;};
  let accessOpened=false,intervalsOpened=false,qualityOpened=false;
  function accessCheck(){
    let r;try{r=checkAccessTime(read('access-start'));}catch{q('[data-access-message]').textContent='Введите выбранное начало от 0 до 100 мс.';q('[data-access-result]').hidden=true;return;}
    q('[data-access-result]').hidden=false;q('[data-access-message]').textContent=r.pass?'Выбранное начало выполняет все условия. Проверьте свой диапазон и самый ранний момент.':'Выбранное начало не выполняет все условия. Проверьте готовность, целое обращение и срок окончания.';
    const x=t=>110+t*5.05;
    let svg='<svg viewBox="0 0 720 200" role="img" aria-label="Окна обращения; терминал готов в 31 мс, срок окончания 51 мс"><path class="sp-axis" d="M110 158 H675"/>';
    for(const t of [0,20,40,60,80,100])svg+=`<path class="sp-axis" d="M${x(t)} 154 V163"/><text x="${x(t)}" y="184" text-anchor="middle">${t}</text>`;
    for(const w of r.windows)svg+=`<rect class="sp-signal" x="${x(w.start)}" y="45" width="${x(w.end)-x(w.start)}" height="25"><title>Окно ${w.start}–${w.end} мс</title></rect>`;
    svg+=`<text x="8" y="63">Окна</text><text x="8" y="116">Обращение</text><path class="sp-axis" d="M${x(31)} 29 V150"/><text x="${x(31)-5}" y="22" text-anchor="end">Готовность 31 мс</text><path class="sp-limit" d="M${x(51)} 29 V150"/><text x="${x(51)+5}" y="22">Срок 51 мс</text><rect class="${r.pass?'sp-signal':'sp-bad'}" x="${x(r.start)}" y="98" width="${x(r.end)-x(r.start)}" height="25"><title>Выбрано ${r.start}–${r.end} мс</title></rect><text x="686" y="184">мс</text></svg>`;
    q('[data-access-chart]').innerHTML=svg;const feedback=q('[data-access-feedback]');feedback.replaceChildren();
    for(const [text,pass] of [[`Выбрано начало ${number(r.start)} мс; конец ${number(r.end)} мс.`,true],[r.readyPass?'К началу передачи терминал уже готов.':'Передача начинается до готовности в 31 мс.',r.readyPass],[r.window?`Все 2 мс помещаются в окно ${r.window.start}–${r.window.end} мс.`:'Обращение не помещается целиком в разрешённое окно.',!!r.window],[r.deadlinePass?'Окончание не позже 51 мс.':'Окончание позже 51 мс.',r.deadlinePass]]){const p=document.createElement('p');p.className=`sp-feedback-line ${pass?'':'is-fail'}`;p.textContent=text;feedback.append(p);}
  }
  button('access-check').onclick=()=>{accessOpened=true;accessCheck();};field('access-start').oninput=()=>{if(accessOpened)accessCheck();};
  function intervalsCheck(){
    let r;try{r=checkAccessIntervals(read('interval-count'));}catch{q('[data-intervals-message]').textContent='Для таблицы проверки введите целое число интервалов от 1 до 8.';q('[data-intervals-result]').hidden=true;return;}
    q('[data-intervals-result]').hidden=false;q('[data-intervals-message]').textContent=r.pass?'Число интервалов выполняет оба требования. Объясните, почему нельзя уменьшить или увеличить его при этих условиях.':'Проверьте оба требования: больше интервалов уменьшает вероятность совпадения, но резервирует больше времени.';
    q('[data-collision-probability]').textContent=`Коллизии: ${r.collisions} из ${r.pairs.length} пар, ${number(r.probability*100)}%. Требование: не выше 1/3.`;q('[data-collision-probability]').classList.toggle('is-fail',!r.probabilityPass);
    q('[data-access-resource]').textContent=`Выделено ${r.reservedMs} из 40 мс, то есть ${number(r.resourcePercent)}% кадра. Требование: не более 15%.`;q('[data-access-resource]').classList.toggle('is-fail',!r.resourcePass);
    let table=`<table class="sp-pairs" aria-label="Все равновероятные пары выбора двух терминалов"><thead><tr><th>А / Б</th>${Array.from({length:r.count},(_,i)=>`<th>${i+1}</th>`).join('')}</tr></thead><tbody>`;
    for(let a=1;a<=r.count;a++)table+=`<tr><th scope="row">${a}</th>${r.pairs.filter(p=>p.a===a).map(p=>`<td class="${p.collision?'sp-collision':'sp-separated'}" aria-label="А: ${p.a}, Б: ${p.b}; ${p.collision?'коллизия':'оба обращения приняты'}">${p.collision?'×':'✓'}</td>`).join('')}</tr>`;
    q('[data-pair-grid]').innerHTML=table+'</tbody></table>';
    q('[data-reservation]').innerHTML=`<div class="sp-reservation-track" role="img" aria-label="На доступ выделено ${r.reservedMs} мс из 40; лимит 6 мс"><span class="sp-reservation-fill ${r.resourcePass?'':'is-fail'}" style="width:${r.resourcePercent}%"></span><span class="sp-reservation-limit"></span><span class="sp-reservation-label">Лимит 15%</span></div>`;
    q('[data-reservation-caption]').textContent=`Каждый из ${r.count} интервалов резервирует 2 мс. Остальным передачам остаётся ${40-r.reservedMs} мс кадра. Здесь считаем выделенный ресурс, даже если часть интервалов в конкретной попытке пуста.`;
  }
  button('intervals-check').onclick=()=>{intervalsOpened=true;intervalsCheck();};field('interval-count').oninput=()=>{if(intervalsOpened)intervalsCheck();};
  const readMode=name=>field(name).value.trim().toUpperCase().replace(/^М/,'M');
  function qualityCheck(){
    let r;try{r=checkDirectionalAllocation({mode:readMode('up-mode'),cells:read('up-cells')},{mode:readMode('down-mode'),cells:read('down-cells')});}catch{q('[data-quality-message]').textContent='Для обоих направлений укажите M1 или M2 и целое число ячеек от 1 до 8.';q('[data-quality-result]').hidden=true;return;}
    q('[data-quality-result]').hidden=false;q('[data-quality-message]').textContent=r.pass?'Оба назначения допустимы и используют минимальное число ячеек. Сопоставьте их с измерениями разных приёмников.':'Проверьте качество именно у приёмника, вместимость и минимальное число ячеек.';
    const x=snr=>285+snr*20;
    let svg='<svg viewBox="0 0 720 215" role="img" aria-label="От терминала у приёмника 8 дБ; к терминалу у приёмника 16 дБ">';
    for(const [d,y,label,receiver] of [[r.up,55,'Терминал → узел','приёмник: точка доступа'],[r.down,150,'Узел → терминал','приёмник: терминал']]){
      svg+=`<text x="8" y="${y-3}">${label}</text><text x="8" y="${y+17}">${receiver}</text><path class="sp-axis" d="M${x(0)} ${y} H${x(18)}"/>`;
      for(const snr of [0,6,12,18])svg+=`<path class="sp-axis" d="M${x(snr)} ${y-4} V${y+4}"/><text x="${x(snr)}" y="${y+23}" text-anchor="middle">${snr}</text>`;
      svg+=`<path class="sp-limit" d="M${x(d.threshold)} ${y-17} V${y+7}"/><circle class="${d.allowed?'sp-quality-ok':'sp-quality-bad'}" cx="${x(d.snr)}" cy="${y}" r="5"/><text x="${x(d.snr)}" y="${y-25}" text-anchor="middle">${d.snr} дБ</text><text x="${x(d.threshold)}" y="${y+43}" text-anchor="middle">Порог ${d.mode}: ${d.threshold} дБ</text><text x="${x(18)+18}" y="${y+4}">дБ</text>`;
    }
    q('[data-quality-chart]').innerHTML=svg+'</svg>';
    const cards=q('[data-direction-results]');cards.replaceChildren();
    for(const [d,title] of [[r.up,'Терминал → точка доступа'],[r.down,'Точка доступа → терминал']]){
      const card=document.createElement('div');card.className=`sp-cell ${d.optimal?'':'is-missed'}`;const h=document.createElement('strong');h.textContent=title;card.append(h);
      for(const text of [`У приёмника ${d.snr} дБ; ${d.mode} требует ${d.threshold} дБ. ${d.allowed?'Режим допустим.':'Режим недопустим при таком качестве.'}`,`Выделено ячеек: ${d.cells}, по ${d.bytesPerCell} байт; ёмкость ${d.capacity} байт. ${d.volumePass?'Для 250 байт достаточно.':`Не хватает ${250-d.capacity} байт.`}`,d.optimal?`Минимальное число ячеек для этого направления: ${d.minimumCells}. Ваше назначение его достигает.`:d.feasible?`Передача возможна, но ресурс не минимален. Минимальное число ячеек при допустимом режиме: ${d.minimumCells}.`:`Минимальное число ячеек при допустимом режиме для этого направления: ${d.minimumCells}.`]){const p=document.createElement('p');p.textContent=text;card.append(p);}
      const cells=document.createElement('div');cells.className='sp-mini-cells';d.fills.forEach((payload,i)=>{const cell=document.createElement('div');cell.className='sp-mini-cell';const caption=document.createElement('span');caption.textContent=`${i+1}: ${payload}/${d.bytesPerCell} Б`;const bar=document.createElement('div');bar.className='sp-mini-bar';const fill=document.createElement('i');fill.style.width=`${payload/d.bytesPerCell*100}%`;bar.append(fill);cell.append(caption,bar);cells.append(cell);});card.append(cells);cards.append(card);
    }
  }
  button('quality-check').onclick=()=>{qualityOpened=true;qualityCheck();};for(const name of ['up-mode','up-cells','down-mode','down-cells'])field(name).oninput=()=>{if(qualityOpened)qualityCheck();};

}
