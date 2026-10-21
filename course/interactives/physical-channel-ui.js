import {mountOFDM} from './ofdm-observation-ui.js';
import {design, designDefaults, CHANNEL, ANTENNAS, MODES, CODINGS, DESIGN_OPTIONS, REQUIREMENTS} from './physical-channel-model.js';

const fmt=x=>Number(x.toFixed(2)).toLocaleString('ru-RU');
const select=(name,label,options)=>`<label>${label}<select name="${name}">${options.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>`;
const button=(action,label)=>`<button type="button" data-action="${action}">${label}</button>`;
const settingsLabel=p=>`${p.bandwidth} МГц · ${p.modulation}, r=${p.coding} · ${p.power} дБм · одинаковые антенны: ${ANTENNAS[p.antenna].name.toLowerCase()} на каждой стороне`;

function renderTrial(trial) {
  const r=trial.result;
  if(!r.legal) return `<p role="status">Испытание не запущено: ЭИИМ ${fmt(r.eirp)} дБм превышает разрешённые в задаче ${REQUIREMENTS.maxEirp} дБм. Измените мощность передатчика или антенну.</p>`;
  const x=t=>60+t/300*800;
  const panels=[{key:'loss',title:'Потери беспроводного канала L(t), дБ',min:86,max:96,ticks:[87,91,95]},
    {key:'snr',title:'SNR на приёмнике, дБ',min:-10,max:50,ticks:[-10,0,10,20,30,40,50]},
    {key:'rate',title:'Скорость с обеспечением BLER=0,01, Мбит/с',min:0,max:80,ticks:[0,20,40,60,80]}];
  const svg=`<svg viewBox="0 0 900 550" role="img" aria-label="Пятиминутное испытание: потери канала, SNR и доступная скорость во времени">
    ${panels.map((panel,i)=>{
      const top=30+i*170,y=v=>top+120-(Math.max(panel.min,Math.min(panel.max,v))-panel.min)/(panel.max-panel.min)*120;
      return `<text x="60" y="${top-10}">${panel.title}</text>
      ${panel.ticks.map(t=>`<path d="M60 ${y(t)}H860" class="ofdm-grid"/><text x="10" y="${y(t)+5}">${fmt(t)}</text>`).join('')}
      ${panel.key==='snr'?`<path d="M60 ${y(r.requiredSnr)}H860" class="pc-trial-threshold"/><text x="635" y="${y(r.requiredSnr)-7}" class="ofdm-small-label">SNR для BLER=0,01</text>`:''}
      ${panel.key==='rate'?`<path d="M60 ${y(10)}H860" class="pc-trial-threshold"/><text x="700" y="${y(10)-7}" class="ofdm-small-label">Требуется 10 Мбит/с</text>`:''}
      <polyline points="${r.samples.map(s=>`${x(s.time).toFixed(2)},${y(s[panel.key]).toFixed(2)}`).join(' ')}" class="${panel.key==='loss'?'pc-trial-loss':'ofdm-received'}"/>
      <path d="M60 ${top}V${top+120}H860" class="pc-axis"/><path d="M60 ${top}V${top+120}" class="pc-trial-cursor" data-trial-cursor="${top}"/>
      ${[0,60,120,180,240,300].map(t=>`<text x="${x(t)-8}" y="${top+139}">${t}</text>`).join('')}`;
    }).join('')}<text x="735" y="544">Время, с</text></svg>`;
  return `<p role="status"><strong>${r.feasible?'Требования испытания выполнены':'Требования испытания не выполнены'}.</strong></p>
    <p>ЭИИМ: ${fmt(r.eirp)} дБм. Номинальная полезная скорость: ${fmt(r.nominalRate)} Мбит/с. Требуемый SNR при BLER=0,01: ${fmt(r.threshold)} дБ.</p>
    <p>Шум в выбранной полосе постоянен: ${fmt(r.noise)} дБм. Диапазон SNR по паспорту трассы: ${fmt(r.snrRange.minimum)}…${fmt(r.snrRange.maximum)} дБ.</p>
    <dl class="pc-results">${[['Полезная скорость режима при BLER=0,01',r.operatingRate,'Мбит/с'],['Запас полезной скорости режима',r.rateReserve,'Мбит/с'],['Запас SNR при 95 дБ',r.reserveSnr,'дБ'],['Средняя скорость записи',r.averageRate,'Мбит/с']].map(([title,value,unit])=>`<div><dt>${title}</dt><dd>${value===null?'Номинальной скорости недостаточно':`${fmt(value)} ${unit}`}</dd></div>`).join('')}</dl>
    <p>${r.checks.rate?'Выполнено':'Нарушено'}: скорость режима с учётом BLER=0,01 не ниже ${REQUIREMENTS.minRate} Мбит/с. ${r.checks.snr?'Выполнено':'Нарушено'}: минимальный SNR при потерях ${CHANNEL.maximumLoss} дБ не ниже требуемого ${fmt(r.requiredSnr)} дБ. Для пригодности проекта нужны оба условия.</p>
    <p class="ofdm-caption">Нулевая скорость на графике означает, что выбранный режим не обеспечивает заданный BLER. Фактический BLER ниже порога SNR в этой модели не рассчитывается.</p>
    <figure><figcaption>Испытание № ${trial.id}: ${settingsLabel(trial.settings)}</figcaption><div class="pc-scroll pc-trial-plot" tabindex="0" aria-label="Графики испытания с локальной прокруткой">${svg}</div></figure>
    <label>Момент измерения, с <output data-trial-time>0</output><input name="trial-time" type="range" min="0" max="299" step="1" value="0"></label>
    <p data-trial-reading></p>
    <details><summary>Численные результаты по секундам</summary><div class="pc-scroll" tabindex="0"><table><thead><tr><th>Время, с</th><th>Потери канала, дБ</th><th>Принятая мощность, дБм</th><th>SNR, дБ</th><th>Скорость, Мбит/с</th><th>BLER=0,01 обеспечивается</th></tr></thead><tbody>${r.samples.map(s=>`<tr><td>${s.time}</td><td>${fmt(s.loss)}</td><td>${fmt(s.received)}</td><td>${fmt(s.snr)}</td><td>${fmt(s.rate)}</td><td>${s.supported?'Да':'Нет'}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function mount(shell) {
  const root=shell.closest('main'), diagnostic=root.querySelector('[data-diagnostic-workspace]'), workspace=root.querySelector('[data-design-workspace]');
  diagnostic.innerHTML='<section aria-labelledby="diagnostic-title"><h3 id="diagnostic-title">Задание 1. Исследование OFDM-сигнала</h3><div data-ofdm-observation></div></section>';
  mountOFDM(diagnostic.querySelector('[data-ofdm-observation]'));
  let trialNumber=0,currentTrial=null;
  workspace.innerHTML=`<section aria-labelledby="design-title"><h3 id="design-title">Испытательный стенд линии между зданиями</h3>
    <div class="pc-link-sketch" role="img" aria-label="Источник видеопотока в здании А, беспроводная линия, получатель в здании Б"><span>Здание А<br><strong>Видеопоток 10 Мбит/с</strong></span><span aria-hidden="true">⇢</span><span>Беспроводная линия<br><strong>Замирания: L=87…95 дБ</strong></span><span aria-hidden="true">⇢</span><span>Здание Б<br><strong>Получатель</strong></span></div>
    <p><strong>Паспорт трассы:</strong> неподвижные здания, антенны закреплены и наведены. Изменяются только потери распространения: от ${CHANNEL.minimumLoss} до ${CHANNEL.maximumLoss} дБ. При фиксированных настройках шум постоянен, рост потерь на 1 дБ уменьшает SNR на 1 дБ.</p>
    <p>Расчётный BLER зафиксирован: <strong>10⁻² (1% блоков)</strong>. Доля успешных блоков -- 0,99.</p>
    <p>Служебный оверхэд -- <strong>20%</strong>; полезные данные занимают 80% ресурса после учёта кодирования.</p>

    <details><summary>Характеристики антенн</summary><div class="pc-scroll" tabindex="0"><table><caption>Одинаковая модель на обеих сторонах; усиление указано для одной антенны</caption><thead><tr><th>Антенны</th><th>Усиление одной, дБи</th><th>Установка</th></tr></thead><tbody>${Object.values(ANTENNAS).map(a=>`<tr><td>${a.name}</td><td>${a.gain}</td><td>${a.mount}</td></tr>`).join('')}</tbody></table></div></details>
    <p>Перед испытанием сузьте выбор расчётом и зафиксируйте границы поиска.</p>
    <div class="pc-controls pc-design-controls">${select('bandwidth','Полоса, МГц',DESIGN_OPTIONS.bandwidth.map(v=>[v,v]))}
    ${select('modulation','Модуляция',Object.keys(MODES).map(k=>[k,k]))}
    ${select('coding','Кодовая скорость',Object.keys(CODINGS).map(v=>[v,v]))}
    ${select('power','Мощность передатчика, дБм',DESIGN_OPTIONS.power.map(v=>[v,v]))}
    ${select('antenna','Одинаковые антенны на обеих сторонах',Object.entries(ANTENNAS).map(([k,a])=>[k,a.name]))}</div>
    <p class="ofdm-caption">Выбранные настройки будут проверены при запуске испытания. Эквивалентную изотропно излучаемую мощность (ЭИИМ) и номинальную скорость предварительно рассчитайте самостоятельно.</p>

    ${button('run-trial','Испытать линию: 5 минут')}
    <p class="ofdm-caption">Результат рассчитывается сразу. Одинаковые условия воспроизводятся при каждом повторе, поэтому варианты можно сравнивать.</p>
    <p data-trial-state role="status">Линия ещё не испытана.</p><div data-trial-result></div>
    </section>`;
  const get=name=>root.querySelector(`[name="${name}"]`),area=name=>root.querySelector(`[data-${name}]`);
  const settings=()=>({bandwidth:+get('bandwidth').value,modulation:get('modulation').value,coding:get('coding').value,power:+get('power').value,antenna:get('antenna').value});
  function updateProposal() {
    area('trial-state').textContent=currentTrial?'Настройки изменены. Ниже остаётся результат испытания № '+currentTrial.id+'. Запустите новое испытание для выбранного варианта.':'Линия ещё не испытана.';
  }
  function reading() {
    if(!currentTrial?.result.legal)return;
    const s=currentTrial.result.samples[+get('trial-time').value];
    area('trial-time').textContent=s.time;
    for(const cursor of workspace.querySelectorAll('[data-trial-cursor]'))cursor.setAttribute('d',`M${60+s.time/300*800} ${cursor.dataset.trialCursor}v120`);
    area('trial-reading').textContent=`${s.time} с: SNR ${fmt(s.snr)} дБ; доступная скорость ${fmt(s.rate)} Мбит/с; BLER=0,01 ${s.supported?'обеспечивается':'не обеспечивается'}. Потери канала ${fmt(s.loss)} дБ; принимаемая мощность ${fmt(s.received)} дБм.`;
  }
  const initial=designDefaults();for(const [key,value] of Object.entries(initial))get(key).value=value;
  for(const key of ['bandwidth','modulation','coding','power','antenna'])get(key).addEventListener('change',updateProposal);
  workspace.addEventListener('input',e=>{if(e.target.name==='trial-time')reading();});
  root.addEventListener('click',event=>{
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='run-trial') {
      const p=settings();
      currentTrial={id:++trialNumber,settings:p,result:design(p)};
      area('trial-result').innerHTML=renderTrial(currentTrial);
      area('trial-state').textContent=`Показано испытание № ${currentTrial.id}: ${settingsLabel(p)}.`;
      reading();

    }
  });
  updateProposal();
}
document.querySelectorAll('[data-diagnostic-workspace]').forEach(mount);
