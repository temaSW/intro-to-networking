import {DEFAULTS, BUFFER, evaluate} from './path-performance-model.js';
const n=value=>value.toLocaleString('ru-RU',{maximumFractionDigits:3});
const MODES={bottleneck:'Скорости участков',delay:'Куда уходит время',load:'Нагрузка и очередь',routes:'Два маршрута'};
const QUESTIONS={bottleneck:'Что изменится после ускорения доступа со 100 до 1000 Мбит/с? Какой следующий участок имеет смысл ускорять?',delay:'Какая часть времени изменится при увеличении размера пакета? А при увеличении расстояния?',load:'Что увидит приложение при росте фоновой нагрузки? Исключает ли средняя нагрузка ниже скорости выхода потери при всплесках?',routes:'Какой маршрут лучше для короткого сообщения, а какой имеет больший ресурс для длительного потока? Изменится ли ответ при появлении фона?'};
const palette=['tx','prop','wait','proc'];
function delayBar(r,scale) {
  if(r.total===null) return '<p><strong>Контрольный пакет потерян на агрегации. Задержка доставки не определена.</strong></p>';
  let x=50;
  const segments=[r.tx,r.propagation,r.waiting,r.processing].map((v,i)=>{
    const width=v/scale*660;
    const visible=Math.max(0,Math.min(width,710-x));
    const rect=visible>0?`<rect class="perf-${palette[i]}" x="${x}" y="35" width="${visible}" height="30"/>`:'';
    x+=width;return rect;
  }).join('');
  return `<svg class="perf-chart" viewBox="0 0 760 105" role="img" aria-label="Общая задержка ${n(r.total)} мс: передача ${n(r.tx)}, распространение ${n(r.propagation)}, ожидание ${n(r.waiting)}, обработка ${n(r.processing)} мс">
    <line x1="50" x2="710" y1="74" y2="74"/>${segments}<text x="50" y="98">0</text><text x="380" y="98" text-anchor="middle">${scale/2}</text><text x="710" y="98" text-anchor="end">${scale} мс</text></svg>${r.total>scale?'<p><strong>Полоса обрезана на границе шкалы; полный результат -- в числах. Доступна шкала 250 мс.</strong></p>':''}`;
}
function queuePlot(r) {
  const points=r.queue.samples.map(s=>`${50+s.time*6.6},${130-s.queue*12}`).join(' ');
  return `<svg class="perf-chart" viewBox="0 0 760 175" role="img" aria-label="Очередь агрегации за 100 мс. Максимум ${r.queue.maxQueue} из ${BUFFER} пакетов. Потеряно ${r.queue.lost} из ${r.queue.offered} пришедших пакетов.">
  <path class="perf-grid" d="M50 34 H710 M50 82 H710 M50 130 H710"/>
  <polyline class="perf-queue" points="${points}"/>
  <text x="5" y="22">Пакеты</text><text x="30" y="39">8</text><text x="30" y="87">4</text><text x="30" y="135">0</text>
  <text x="50" y="165">0</text><text x="380" y="165" text-anchor="middle">50</text><text x="710" y="165" text-anchor="end">100 мс</text></svg>`;
}
export function mountPerformance(root) {
  const configs={bottleneck:{...DEFAULTS},delay:{...DEFAULTS,aggregation:100},load:{...DEFAULTS,load:80},routes:{...DEFAULTS}};
  let mode='bottleneck',revealed=false,scale=25;
  const field=(key,label,min,max,modes)=>`<label class="perf-field" data-modes="${modes}">${label}<span class="perf-pair"><input aria-label="${label}: ползунок" data-key="${key}" type="range" min="${min}" max="${max}" step="1"><input aria-label="${label}: точное значение" data-key="${key}" type="number" min="${min}" max="${max}" step="1" required></span></label>`;
  root.innerHTML=`<form class="perf-controls"><label>Вопрос опыта<select name="mode">${Object.entries(MODES).map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select></label>
  ${field('access','Скорость доступа, Мбит/с',10,1000,'bottleneck routes')}
  ${field('aggregation','Скорость агрегации A, Мбит/с',10,200,'bottleneck load routes')}
  ${field('distance','Длина ядра A, км',10,20000,'delay routes')}
  ${field('bytes','Размер пакета, байт',64,1500,'delay load routes')}
  ${field('load','Средний фон, % скорости агрегации A',0,150,'load routes')}
  <label data-modes="load routes">Поступление фона<select name="pattern"><option value="burst">Всплески: 5 мс поступления / 5 мс паузы</option><option value="steady">Равномерное</option></select></label>
  <label>Шкала задержки<select name="scale"><option value="25">0–25 мс</option><option value="250">0–250 мс</option></select></label>
  <div class="perf-actions"><button type="button" data-reveal>Проверить прогноз</button><button type="button" data-reset>Исходные условия режима</button></div>
  </form><p class="perf-error" role="alert" data-error></p><p data-question></p><div data-path></div><div data-results hidden></div>`;
  const form=root.querySelector('form');
  const render=()=>{
    const c=configs[mode];
    root.querySelector('[data-question]').textContent=QUESTIONS[mode];
    root.querySelectorAll('[data-modes]').forEach(e=>{e.hidden=!e.dataset.modes.split(' ').includes(mode);});
    root.querySelectorAll('[data-key]').forEach(e=>{e.value=c[e.dataset.key];});
    form.elements.pattern.value=c.pattern;
    const variants=mode==='routes'?['A','B']:['A'];
    const results=variants.map(v=>evaluate(c,v));
    root.querySelector('[data-path]').innerHTML=results.map(r=>`<p><strong>Маршрут ${r.variant}</strong> · терминал → доступ → агрегация → ядро → внешняя сеть → сервер</p>
      <div class="perf-path" role="list" aria-label="Участки маршрута ${r.variant}">${r.links.map(l=>`<div role="listitem"><strong>${l.name}</strong><span>${n(l.rate)} Мбит/с</span><span>${n(l.km)} км</span>${revealed&&r.bottlenecks.includes(l.name)?'<b>Ограничивает бюджет потока</b>':''}</div>`).join('')}</div>`).join('');
    const output=root.querySelector('[data-results]');output.hidden=!revealed;
    root.querySelector('[data-reveal]').hidden=revealed;
    if(!revealed)return;
    output.innerHTML=`<p>Один контрольный пакет; промежуточные узлы передают его после полного приёма. Скорость распространения принята равной 200 000 км/с; обработка -- 0,05 мс на промежуточный узел. Буфер агрегации -- 8 ожидающих пакетов. Фон есть только на этом выходе.</p>
    <p>Бюджет для нового длительного потока оценивается по остатку после среднего фона. Это не измерение скорости: всплески, потери, служебные расходы и ограничения транспорта могут уменьшить результат.</p>
    <ul class="perf-legend"><li class="perf-tx-key">Передача</li><li class="perf-prop-key">Распространение</li><li class="perf-wait-key">Ожидание</li><li class="perf-proc-key">Обработка</li></ul>
    ${results.map(r=>`<section class="perf-result"><h3>Результат · маршрут ${r.variant}</h3>
      <p>Предел без конкуренции: <strong>${n(r.raw)} Мбит/с</strong>. Бюджет после фона: <strong>${n(r.available)} Мбит/с</strong>. Ограничивающий участок: <strong>${r.bottlenecks.join(', ')}</strong>.</p>
      <div class="perf-scroll" tabindex="0" role="region" aria-label="Разложение задержки маршрута ${r.variant}">${delayBar(r,scale)}</div>
      <div class="perf-scroll" tabindex="0" role="region" aria-label="Численные составляющие задержки"><table class="perf-delay-table"><thead><tr><th>Передача</th><th>Распространение</th><th>Ожидание</th><th>Обработка</th><th>Всего</th></tr></thead><tbody><tr><td>${n(r.tx)} мс</td><td>${n(r.propagation)} мс</td><td>${r.waiting===null?'потеря':n(r.waiting)+' мс'}</td><td>${n(r.processing)} мс</td><td>${r.total===null?'не доставлен':n(r.total)+' мс'}</td></tr></tbody></table></div>
      ${r.total===null?'<p>Передача, распространение и обработка в таблице -- расчёт для всего пути без очереди; при потере этот путь не завершён.</p>':''}
      ${(mode==='load'||mode==='routes')?`<p>Средний фон: ${n(r.background)} Мбит/с (${n(r.utilization*100)}% выхода). За 100 мс пришло ${r.queue.offered} пакетов с учётом контрольного; потеряно <strong>${r.queue.lost}</strong>. Максимальная очередь: ${r.queue.maxQueue} / 8 пакетов. Максимальное ожидание принятых пакетов: ${n(r.queue.maxWait)} мс.</p>
      <div class="perf-scroll" tabindex="0" role="region" aria-label="Очередь агрегации маршрута ${r.variant}">${queuePlot(r)}</div>
      <details><summary>Точные значения очереди</summary><div class="perf-scroll" tabindex="0" role="region" aria-label="Очередь по времени"><table><thead><tr><th>Время, мс</th><th>Ожидают пакетов</th></tr></thead><tbody>${r.queue.samples.map(s=>`<tr><td>${s.time}</td><td>${s.queue}</td></tr>`).join('')}</tbody></table></div></details>`:''}
    </section>`).join('')}`;
  };
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('input',event=>{
    const key=event.target.dataset.key;if(!key)return;
    if(!event.target.checkValidity()) {root.querySelector('[data-error]').textContent=`Введите целое число от ${event.target.min} до ${event.target.max}.`;return;}
    root.querySelector('[data-error]').textContent='';configs[mode][key]=Number(event.target.value);render();
  });
  form.elements.mode.addEventListener('change',()=>{mode=form.elements.mode.value;revealed=false;root.querySelector('[data-error]').textContent='';render();});
  form.elements.pattern.addEventListener('change',()=>{configs[mode].pattern=form.elements.pattern.value;render();});
  form.elements.scale.addEventListener('change',()=>{scale=Number(form.elements.scale.value);render();});
  root.querySelector('[data-reveal]').addEventListener('click',()=>{revealed=true;render();});
  root.querySelector('[data-reset]').addEventListener('click',()=>{
    configs[mode]={...DEFAULTS,...(mode==='delay'?{aggregation:100}:mode==='load'?{load:80}:{})};
    root.querySelector('[data-error]').textContent='';revealed=false;render();
  });
  render();
}
document.querySelectorAll('[data-path-performance]').forEach(mountPerformance);
