import * as model from './channel-playground-model.js?v=20261006-ray-motion';

const META = {
  attenuation: ['Затухание', 'Станет ли связь слабее при удвоении расстояния? Что изменит усиление?', 'Увеличьте расстояние, найдите границу работоспособности. Включите усилитель и измените его коэффициент шума.'],
  bandwidth: ['Межсимвольные искажения', 'Восстановит ли регенератор исходные биты, если импульсы уже сливаются?', 'Изменяйте битовую скорость при той же полосе канала, затем включите регенератор.'],
  noise: ['Шум и помехи', 'Когда точка перейдёт через границу решения? Будет ли помеха выглядеть как шум?', 'Уменьшите SNR, затем переключитесь на внешнюю помеху и измените её частоту.'],
  multipath: ['Многолучёвость', 'Всегда ли дополнительный луч делает сигнал сильнее?', 'Изменяйте задержку отражения. Сопоставьте сумму копий с провалами H(f).'],
  coherence: ['Полоса когерентности', 'На каком расстоянии друг от друга частоты начинают испытывать разное действие канала?', 'Раздвигайте f₁ и f₂, сравнивайте усиление и фазу. Затем увеличьте задержки лучей.'],
  shift: ['Частотное рассогласование', 'Как изменится сдвиг при той же скорости и более высокой несущей?', 'Сравните 0,1 и 6 ГГц; затем остановите движение и добавьте рассогласование генераторов.'],
  spread: ['Время когерентности', 'Будет ли канал меняться по амплитуде, если все лучи имеют одинаковый сдвиг?', 'Начните без отражений. Добавьте лучи с разными направлениями, увеличьте скорость и сравните T с Tс.'],
  media: ['Сравнение сред', 'Какие из наблюдавшихся эффектов будут важны в разных средах?', 'Выберите среду и сопоставьте причины искажений с её физикой.'],
};
const COLORS = ['#1479b8', '#d66720', '#8b62c5', '#168a69'];
const finite = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('ru-RU', {maximumFractionDigits: digits}) : '∞';
const metric = (title, value) => `<div class="cp-metric"><span>${title}</span><strong>${value}</strong></div>`;
function drawPlot(title, series, {xmin = 0, xmax = 1, ymin = -1, ymax = 1, xlabel = '', ylabel = '', markers = [], bands = [], horizontalBands = [], yticks, square = false, width = 720} = {}) {
  const W = Math.max(320, Math.min(square ? 461 : 720, width)), H = square ? W - 11 : 245, L = 60, R = 15, T = 22, B = 42;
  const x = v => L + (v - xmin) / (xmax - xmin) * (W - L - R);
  const y = v => H - B - (v - ymin) / (ymax - ymin) * (H - T - B);
  const ticks = Array.from({length: 5}, (_, i) => {
    const xx = xmin + (xmax - xmin) * i / 4;
    return `<path class="cp-grid" d="M${x(xx)} ${T}V${H - B}"/><text x="${x(xx)}" y="${H - B + 19}" text-anchor="middle">${finite(xx)}</text>`;
  }).join('') + (yticks || Array.from({length:5}, (_,i)=>ymin+(ymax-ymin)*i/4)).map(yy=>`<path class="cp-grid" d="M${L} ${y(yy)}H${W-R}"/><text x="${L-8}" y="${y(yy)+4}" text-anchor="end">${finite(yy)}</text>`).join('');
  const curves = series.map((s, index) => {
    const color = s.color || COLORS[index % COLORS.length];
    if (s.points) return s.points.map(p => `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="${s.radius || 3}" fill="${color}" opacity=".8"/>`).join('');
    return `<polyline points="${s.x.map((v, i) => `${x(v).toFixed(2)},${y(s.y[i]).toFixed(2)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  }).join('');
  const id = drawPlot.id++;
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><defs><clipPath id="cp-clip-${id}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>${ticks}<g clip-path="url(#cp-clip-${id})">${horizontalBands.map(b=>`<rect x="${L}" y="${y(b.high)}" width="${W-L-R}" height="${y(b.low)-y(b.high)}" class="${b.className}"/><text x="${W-R-5}" y="${y(b.high)+14}" text-anchor="end">${b.label}</text>`).join('')}${bands.map(b => `<rect x="${x(b[0])}" y="${T}" width="${x(b[1])-x(b[0])}" height="${H-T-B}" class="cp-band"/>`).join('')}${curves}${markers.map(m => `<path d="M${x(m.value)} ${T}V${H-B}" class="cp-marker"/><text x="${x(m.value)+4}" y="${T+13}">${m.label}</text>`).join('')}</g><text x="${W/2}" y="${H-3}" text-anchor="middle">${xlabel}</text><text x="${L}" y="14">${ylabel}</text></svg>`;
  return `<figure class="cp-plot ${square ? 'cp-square' : ''}"><figcaption>${title}</figcaption>${svg}<div class="cp-legend">${series.filter(s => s.label).map((s, i) => `<span><i style="background:${s.color || COLORS[i % COLORS.length]}"></i>${s.label}</span>`).join('')}</div></figure>`;
}
drawPlot.id = 0;

function slider(key, label, min, max, step, value, unit = '') {
  return `<label class="cp-control"><span>${label} <output data-output="${key}" data-unit="${unit}">${finite(value, 3)} ${unit}</output></span><input type="range" data-param="${key}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${label}"></label>`;
}
function select(key, label, choices, value) {
  return `<label class="cp-control"><span>${label}</span><select data-param="${key}">${choices.map(([v, text]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${text}</option>`).join('')}</select></label>`;
}
const MEDIA = {
  wire: ['Проводная линия', ['Растёт с длиной; зависит от частоты и сопротивления.', 'Ограничена линией и аппаратурой.', 'Разные частоты могут иметь разные задержки; импульсы искажаются.', 'Наводки и перекрёстные помехи; экранирование и баланс помогают.', 'Отражения на несогласованных концах и неоднородностях.', 'Обычно медленное; возможны изменения контактов и температуры.']],
  fiber: ['Оптоволокно', ['Потери в волокне, соединениях и изгибах.', 'Большая, но конечная; ограничивается также источником и приёмником.', 'Хроматическая и модовая дисперсия растягивают импульсы.', 'Электромагнитные наводки на само волокно не действуют; шум приёмника остаётся.', 'Радиомодель лучей напрямую не переносится: важны моды и оптические отражения.', 'Обычно медленное; температура и механические воздействия меняют линию.']],
  radio: ['Радиоканал', ['Геометрическое расхождение, поглощение и препятствия.', 'Ограничена аппаратурой и выделенным частотным ресурсом.', 'Задержанные пути могут растягивать импульсы.', 'Другие передатчики, фон и шум приёмника.', 'Часто существенна: отражения, рассеяние, дифракция.', 'Движение и изменение окружения; возможны быстрые замирания.']],
};

export function mountChannelPlayground(root, options = {}) {
  const fixed = options.mode || root.dataset.channelMode;
  if (fixed && !META[fixed]) throw new Error(`Unknown channel mode: ${fixed}`);
  const lecture = (options.layout || root.dataset.channelLayout) === 'lecture';
  const shared = options.sharedState;
  let mode = fixed || 'attenuation', p = shared?.parameters || model.defaults(), view = 'time', medium = 'radio';
  const initialParameters = () => ({...model.defaults(), ...(lecture && mode === 'attenuation' ? {aid: 'amplifier', gainDb: 0, noiseFigure: 0} : {}), ...(lecture && mode==='spread' ? {paths:[{amplitude:.7,delay:.5,angle:90}]} : {})});
  if (!shared) p = initialParameters();
  const prediction = {}, explanations = {};
  root.classList.add('channel-playground');
  if (lecture) root.classList.add('cp-lecture');
  function notifyPeers() {
    if (!shared) return;
    shared.parameters = p;
    for (const [peer, update] of shared.listeners) if (peer !== root) update();
  }
  const plot = (title, series, options = {}) => drawPlot(title, series, {width: root.querySelector('.cp-results')?.clientWidth || 720, ...options});
  function pathControls(withAngles = false) {
    return `<fieldset class="cp-paths"><legend>Отражённые лучи</legend><p>Прямой луч: амплитуда 1, задержка 0${withAngles ? `, угол ${finite(p.direction)}°` : ''}.</p>${p.paths.map((path, i) => `<div class="cp-path"><strong>Луч ${i+1}</strong>${slider(`path-${i}-amplitude`, 'Относительная амплитуда', 0, 1, .05, path.amplitude)}${slider(`path-${i}-delay`, 'Задержка', 0, 5, .025, path.delay, 'мкс')}${withAngles ? slider(`path-${i}-angle`, 'Направление прихода', 0, 180, 5, path.angle, '°') : ''}<button type="button" data-remove="${i}">Убрать луч ${i+1}</button></div>`).join('')}<button type="button" data-add ${p.paths.length >= 3 ? 'disabled' : ''}>Добавить отражённый луч</button></fieldset>`;
  }
  function controls() {
    const motion = () => slider('carrierGHz', 'Несущая', .1, 6, .1, p.carrierGHz, 'ГГц') + slider('speed', 'Скорость', 0, 60, 1, p.speed, 'м/с') + slider('direction', 'Угол движения к прямому лучу', 0, 180, 5, p.direction, '°');
    const amplifier = () => select('aid', 'Усилитель', [['none','Без усилителя'], ['ideal','Идеальный'], ['amplifier','С собственным шумом']], p.aid) + (p.aid !== 'none' ? slider('gainDb', 'Усиление по мощности', 0, 40, .01, p.gainDb, 'дБ') : '');
    if (lecture) {
      switch (mode) {
        case 'attenuation': return slider('distance', 'Расстояние', .1, 20, .1, p.distance, 'км') + slider('gainDb', 'Коэффициент передачи', -30, 40, .01, p.gainDb, 'дБ') + slider('noiseFigure', 'Коэффициент шума (КШ)', 0, 15, .5, p.noiseFigure, 'дБ');
        case 'bandwidth': return slider('rate', 'Битовая скорость', 1, 20, .5, p.rate, 'кбит/с') + slider('bandwidth', 'Полоса канала', .1, 20, .1, p.bandwidth, 'кГц') + select('regeneration', 'Регенератор', [['off','Выключен'], ['on','Включён']], p.regeneration);
        case 'noise': return select('disturbance', 'Добавленный сигнал', [['noise','Шум'], ['interference','Внешняя помеха']], p.disturbance) + (p.disturbance === 'noise' ? slider('snr', 'Отношение сигнал/шум Eₛ/N₀', -12, 24, 1, p.snr, 'дБ') : slider('interference', 'Амплитуда помехи / сигнала', 0, 3, .05, p.interference));
        case 'multipath': return pathControls();
        case 'coherence': return slider('frequencyGap', 'Разнос двух частот', 0, 1, .01, p.f2-p.f1, 'МГц') + slider('path-0-delay', 'Копия приходит позже на', 0, 5, .025, p.paths[0].delay, 'мкс');
        case 'shift': return slider('speed', 'Скорость', 0, 60, 1, p.speed, 'м/с') + slider('carrierGHz', 'Несущая', .1, 6, .1, p.carrierGHz, 'ГГц') + slider('offset', 'Рассогласование генераторов', -500, 500, 5, p.offset, 'Гц');
        case 'spread': return slider('speed', 'Скорость движения приёмника', 0, 60, 1, p.speed, 'м/с') + slider('duration', 'Длительность одной передачи', .1, 100, .1, p.duration, 'мс') + slider('probePercent','Момент внутри передачи',0,100,.1,p.probePercent ?? 0,'%');
        case 'media': return '';
      }
    }
    switch (mode) {
      case 'attenuation': return slider('power', 'Мощность передатчика', 0, 40, 1, p.power, 'дБм') + slider('distance', 'Расстояние', .1, 20, .1, p.distance, 'км') + slider('loss', 'Дополнительные потери', 0, 5, .1, p.loss, 'дБ/км') + slider('sensitivity', 'Чувствительность приёмника', -90, -40, 1, p.sensitivity, 'дБм') + amplifier() + (p.aid==='amplifier' ? slider('noiseFigure', 'Коэффициент шума NF', 0, 15, .5, p.noiseFigure, 'дБ') : '');
      case 'bandwidth': return slider('bandwidth', 'Полоса канала', .1, 20, .1, p.bandwidth, 'кГц') + slider('rate', 'Битовая скорость', 1, 20, .5, p.rate, 'кбит/с') + select('regeneration', 'Регенератор после канала', [['off','Выключен'], ['on','Включён']], p.regeneration);
      case 'noise': return select('disturbance', 'Источник добавленного сигнала', [['noise','Шум'], ['interference','Внешняя помеха']], p.disturbance) + (p.disturbance === 'noise' ? slider('snr', 'SNR (энергия символа / N₀)', -12, 24, 1, p.snr, 'дБ') : slider('interference', 'Амплитуда помехи / сигнала', 0, 3, .05, p.interference) + slider('interferenceFrequency', 'Частота помехи в полосе I/Q', .01, .49, .01, p.interferenceFrequency, 'циклов/символ'));
      case 'multipath': return slider('carrier', 'Частота сигнала', .1, 3, .05, p.carrier, 'МГц') + pathControls();
      case 'coherence': return slider('f1', 'Маркер f₁', 0, 4, .01, p.f1, 'МГц') + slider('f2', 'Маркер f₂', 0, 4, .01, p.f2, 'МГц') + slider('signalBandwidth', 'Полоса сигнала Bₛ вокруг f₁', .01, 2, .01, p.signalBandwidth, 'МГц') + pathControls();
      case 'shift': return motion() + slider('offset', 'Рассогласование генераторов', -500, 500, 5, p.offset, 'Гц');
      case 'spread': return motion() + slider('duration', 'Длительность фрагмента T', .1, 100, .1, p.duration, 'мс') + pathControls(true);
      case 'media': return select('medium', 'Среда', Object.entries(MEDIA).map(([key, value]) => [key, value[0]]), medium);
    }
  }
  function views() {
    if (lecture && mode==='spread') return [['time','Одна передача']];
    return ({attenuation: [['time','Форма']], bandwidth: [['time','Импульсы'],['spectrum','Полоса канала']], noise: [['time','Во времени'],['constellation','Созвездие']], multipath: [['time','Копии и сумма'],['frequency','H(f)']], coherence: [['compare','Два сигнала'],['frequency','Канал по частоте']], shift: [['spectrum','Спектр']], spread: [['time','Уровень во времени'],['spectrum','Сдвиги лучей']], media: []})[mode];
  }
  function shell() {
    root.classList.toggle('cp-media-mode', lecture && mode==='media');
    const vv = views(); if (!vv.some(([v]) => v === view)) view = vv[0]?.[0] || '';
    const introduction = lecture ? '' : `<h2>${META[mode][0]}</h2><div class="cp-chain"><span>Передатчик · s(t)</span><b aria-hidden="true">→</b><span>${META[mode][0]}</span><b aria-hidden="true">→</b><span>Приёмник · r(t)</span></div><div class="cp-experiment"><strong>Предскажите</strong><p>${META[mode][1]}</p><textarea rows="2" placeholder="Моя гипотеза…" aria-label="Предсказание результата">${(prediction[mode] || '').replaceAll('&','&amp;').replaceAll('<','&lt;')}</textarea><p><strong>Проверьте:</strong> ${META[mode][2]}</p></div>`;
    root.innerHTML = `${!fixed ? `<nav class="cp-modes" aria-label="Режимы канала">${Object.entries(META).map(([key, m], i) => `<button type="button" data-mode="${key}" aria-pressed="${mode===key}">${i+1}. ${m[0]}</button>`).join('')}</nav>` : ''}${introduction}<div class="cp-layout"><div class="cp-controls" role="group" aria-label="Параметры канала">${controls()}<button type="button" data-reset>${shared ? 'Сбросить общие параметры' : 'Сбросить параметры'}</button></div><section class="cp-observation" aria-label="Наблюдение"><div class="cp-views" aria-label="Представление">${(vv.length > 1 ? vv : []).map(([key,label]) => `<button type="button" data-view="${key}" aria-pressed="${view===key}">${label}</button>`).join('')}</div><div class="cp-results"></div></section></div>${!lecture ? `<details class="cp-explanation" ${explanations[mode] ? 'open' : ''}><summary>Подсказка к опыту</summary><div class="cp-explanation-body"></div></details>` : ''}`;
    root.querySelector('textarea')?.addEventListener('input', e => {prediction[mode] = e.target.value;});
    root.querySelector('.cp-explanation')?.addEventListener('toggle', e => {explanations[mode] = e.target.open;});
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {mode = b.dataset.mode; shell();}));
    root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {view = b.dataset.view; root.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b)); render();}));
    root.querySelectorAll('[data-param]').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.param, value = input.tagName === 'SELECT' ? input.value : Number(input.value);
      if (key.startsWith('path-')) {const [,i,field] = key.split('-'); p.paths[Number(i)][field] = Number(value);}
      else if (key==='frequencyGap') p.f2=p.f1+value;
      else if (key === 'medium') medium = value; else p[key] = value;
      const output = input.parentElement.querySelector('output');
      if (output) output.textContent = finite(value, 3) + ' ' + output.dataset.unit;
      if (key === 'disturbance' || key === 'aid' || key==='movingPaths') shell(); else render();
      notifyPeers();
    }));
    root.querySelector('[data-add]')?.addEventListener('click', () => {if (p.paths.length < 3) p.paths.push({amplitude: .5, delay: 1+p.paths.length, angle: 120+20*p.paths.length}); shell(); notifyPeers();});
    root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {p.paths.splice(Number(b.dataset.remove),1); shell(); notifyPeers();}));
    root.querySelector('[data-reset]').addEventListener('click', () => {p = initialParameters(); shell(); notifyPeers();});
    render();
  }
  function render() {
    let metrics = '', charts = '', note = '', explanation = '', dataNote = '';
    if (mode === 'attenuation') {
      const a = model.attenuation(p);
      const {time:t, output, receiver, receiverLimit, clipped, inputPower, outputPower, receiverPower, noiseDbm, outputLevel} = model.attenuationSignal(p);
      metrics = metric('После среды', `${finite(a.received)} дБм`) + metric('Сигнал на входе приёмника', `${finite(outputLevel)} дБм`) + metric('Диапазон приёмника', `${p.sensitivity}…${p.receiverMaximum} дБм`) + metric('Ограниченные отсчёты', `${finite(100*clipped/t.length,1)} %`);
      if (p.aid==='amplifier') metrics += metric('Собственный шум на выходе', Number.isFinite(noiseDbm) ? `${finite(noiseDbm)} дБм` : 'Нет');
      {
        charts = plot('Мощность сигнала во времени', [{x:t,y:inputPower,label:'После среды',color:'#7a8994'}, {x:t,y:outputPower,label:'Вход приёмника',color:COLORS[0],dash:true}, {x:t,y:receiverPower,label:'После ограничения',color:COLORS[1]}],{xmax:12,ymin:-100,ymax:40,yticks:[-100,-65,-25,0,40],xlabel:'Условное время',ylabel:'Мощность, дБм',horizontalBands:[{low:p.receiverMaximum,high:40,className:'cp-overload-band',label:'Перегрузка'}, {low:p.sensitivity,high:p.receiverMaximum,className:'cp-range-band',label:'Динамический диапазон'}, {low:-100,high:p.sensitivity,className:'cp-weak-band',label:'Ниже чувствительности'}]});
        const millivolts = 1000 * Math.sqrt(50 * 1e-3 * 10 ** (p.sensitivity/10));
        const upper = receiverLimit * millivolts, limit = upper * 1.25;
        charts += plot('Форма сигнала на входе приёмника', [{x:t,y:output.map(x=>x*millivolts),label:'До ограничения',dash:true}, {x:t,y:receiver.map(x=>x*millivolts),label:'После ограничения'}, {x:[0,12],y:[upper,upper],label:'Максимальная амплитуда',color:COLORS[2],dash:true}, {x:[0,12],y:[-upper,-upper],color:COLORS[2],dash:true}],{xmax:12,ymin:-limit,ymax:limit,yticks:[-upper,0,upper],xlabel:'Условное время',ylabel:'Напряжение, мВ'});
      }
      note = a.usable ? 'Запас неотрицательный: связь условно работоспособна.' : 'Запас отрицательный: работоспособность не гарантирована.';
      explanation = 'Коэффициент передачи задан по мощности: G = 10^(g/10), по амплитуде — √G. ×4 по мощности соответствует 6,02 дБ и ×2 по амплитуде. Идеальный каскад не добавляет шума и остаётся линейным; ограничение амплитуды происходит на входе следующего приёмника. Его чувствительность −65 дБм, верхняя граница −25 дБм. При наличии собственного шума Nа = G(F − 1)kT₀B, F = 10^(NF/10), NF — коэффициент шума в децибелах, T₀ = 290 К, B = 100 МГц, k — постоянная Больцмана. Синусоидальный сигнал нормирован к единичной средней мощности; уровень сигнала показан до ограничения отдельно от шума.';
    } else if (mode === 'bandwidth') {
      const b = model.bandwidth(p);
      metrics = metric('Длительность бита', `${finite(1/p.rate,3)} мс`) + metric('Память предыдущего бита', `${finite(100*b.tail,1)} %`) + metric('Ошибочные решения', `${b.errors} / ${model.BITS.length}`);
      if (view==='time') {
        charts = plot('Импульсы и память канала', [{x:b.time,y:b.tx,label:'s(t)'},{x:b.time,y:b.rx,label:'r(t)'},{points:b.decisions.map((_,i)=>[(i+.5)/p.rate,b.rx[i*64+32]]),label:'Отсчёты решений',color:COLORS[2]}],{xmax:12/p.rate,ymin:-1.2,ymax:1.2,xlabel:'Время, мс',ylabel:'Относительная амплитуда'});
        if(p.regeneration==='on') charts += plot('Новые импульсы после регенерации', [{x:b.regeneratedTime,y:b.tx,label:'Исходные биты с той же задержкой',dash:true},{x:b.regeneratedTime,y:b.regenerated,label:'Выход регенератора'}],{xmax:13/p.rate,ymin:-1.2,ymax:1.2,xlabel:'Время, мс · задержка один символ',ylabel:'Относительная амплитуда'});
      }
      else {const f=Array.from({length:201},(_,i)=>i*.1); charts=plot('Полоса канала и масштаб скорости', [{x:f,y:f.map(f=>model.lowpassGain(f,p.bandwidth)),label:'Передача канала'}],{xmax:20,ymin:0,ymax:1.1,xlabel:'Частота, кГц',ylabel:'Относительное усиление',markers:[{value:p.bandwidth,label:'Полоса (−3 дБ)'},{value:p.rate/2,label:'Половина битовой скорости'}]});}
      note = `Решения: ${b.decisions.join(' ')}; передано: ${model.BITS.join(' ')}. Регенератор формирует прямоугольные импульсы по решениям приёмника; ${b.errors ? 'ошибочные биты остаются ошибочными.' : 'в этом фрагменте решения совпали с исходными битами.'}`;
      dataNote = `Передано: ${model.BITS.join(' ')}; решения: ${b.decisions.join(' ')}.`;
      explanation = 'Канал — фильтр нижних частот первого порядка; B задаёт уровень −3 дБ. Он сглаживает фронты и сохраняет часть предыдущего уровня к моменту решения следующего символа: это межсимвольная интерференция. Амплитуда фиксирована; шума нет. Регенератор принимает решение в середине символа по порогу ноль, затем формирует новые импульсы с задержкой один символ. Тактирование задано. Он восстанавливает форму, но не исправляет ошибочные решения при сильной ISI. Половина битовой скорости — ориентир частотного масштаба, а не строгая ширина спектра прямоугольных импульсов.';
    } else if (mode === 'noise') {
      const n = model.noisySymbols(p);
      metrics = metric('Ошибочные решения в примере', `${n.errors} / ${n.points.length}`) + metric('Передача', 'BPSK · 2 состояния');
      if (view==='constellation') {
        const extent = Math.max(2, ...n.points.flatMap(x=>[Math.abs(x.re),Math.abs(x.im)]));
        charts = plot('Созвездие и граница решения I = 0', [{points:n.points.filter(x=>!x.error).map(x=>[x.re,x.im]),label:'Верное решение'},{points:n.points.filter(x=>x.error).map(x=>[x.re,x.im]),label:'Ошибка',color:'#d34b55'},{points:[[-1,0],[1,0]],label:'Переданные состояния',color:COLORS[2],radius:6}],{xmin:-extent,xmax:extent,ymin:-extent,ymax:extent,xlabel:'I',ylabel:'Q',markers:[{value:0,label:'Граница'}],square:true});
      } else {const points=n.points.slice(0,24), t=points.map((_,i)=>i), extent=Math.max(2,...points.flatMap(x=>[Math.abs(x.re),Math.abs(x.re-x.tx)]))*1.1;charts=plot('Отсчёты сигнала в моменты решений', [{x:t,y:points.map(x=>x.tx),label:'s: исходные уровни'},{x:t,y:points.map(x=>x.re),label:'r: I приёмника'},{x:t,y:points.map(x=>x.re-x.tx),label:'Добавленная компонента'}],{xmax:23,ymin:-extent,ymax:extent,xlabel:'Номер символа',ylabel:'Амплитуда'});}
      note = `Первые 24 бита: ${n.points.slice(0,24).map(x=>x.bit).join('')}; принято: ${n.points.slice(0,24).map(x=>x.decision).join('')}. Красные точки пересекли границу решения.`;
      dataNote = `Первые 24 бита: ${n.points.slice(0,24).map(x=>x.bit).join('')}; принято: ${n.points.slice(0,24).map(x=>x.decision).join('')}.`;
      explanation = 'Показаны отсчёты комплексной огибающей двоичной фазовой манипуляции (BPSK). Шум — независимые гауссовы добавки в синфазной I и квадратурной Q координатах; отношение сигнал/шум SNR здесь задано как Eₛ/N₀. Внешняя помеха — периодический треугольный сигнал в синфазной координате: точки располагаются на отрезках, а не окружностях. Число ошибок относится только к этому фрагменту.';
    } else if (mode==='multipath' || mode==='coherence') {
      const m=model.multipath(p), c=model.coherence(p), max=m.paths.reduce((v,x)=>v+x.amplitude,0);
      metrics = mode==='multipath' ? metric('Лучей',m.paths.length) + metric('Амплитуда суммы на частоте сигнала',finite(model.response(m.paths,p.carrier).magnitude)) : metric('Амплитуда первого сигнала',finite(c.h1.magnitude)) + metric('Амплитуда второго сигнала',finite(c.h2.magnitude)) + metric('Полоса когерентности · ориентир',`${finite(c.bc)} МГц`);
      const hplot=plot('Частотная характеристика общего канала', [{x:m.frequencies,y:m.h,label:'Амплитуда принятого сигнала'}],{xmax:4,ymin:0,ymax:max*1.05,xlabel:'Частота, МГц',ylabel:'Относительная амплитуда',markers:mode==='coherence'?[{value:p.f1,label:'Первая частота'},{value:p.f2,label:'Вторая частота'}]:[{value:p.carrier,label:'Частота сигнала'}]});
      if(mode==='multipath') {
        const copies=plot('Прямой луч и задержанные копии',m.copies.map((copy,i)=>({x:m.time,y:copy,label:i===0?'Прямой луч':`Отражение ${i}`})),{xmax:12,ymin:-1.2,ymax:1.2,xlabel:'Время, мкс',ylabel:'Амплитуда'});
        const sum=plot('Сумма на приёмнике', [{x:m.time,y:m.copies[0],label:'s(t)',dash:true},{x:m.time,y:m.sum,label:'r(t)'}],{xmax:12,ymin:-max,ymax:max,xlabel:'Время, мкс',ylabel:'Амплитуда'});
        charts=view==='time'?copies+sum+hplot:hplot+sum;
        note='Задержка сдвигает начало копии и её фазу. Усиление на одной частоте может сопровождаться провалом на другой.';
      } else {
        const cycles=Array.from({length:301},(_,i)=>3*i/300);
        const comparison=(frequency,h)=>plot(`Сигнал ${finite(frequency)} МГц`,[{x:cycles,y:cycles.map(t=>Math.sin(2*Math.PI*t)),label:'Передано',dash:true},{x:cycles,y:cycles.map(t=>h.re*Math.sin(2*Math.PI*t)+h.im*Math.cos(2*Math.PI*t)),label:'Принято'}],{xmax:3,ymin:-max*1.05,ymax:max*1.05,xlabel:'Число периодов собственного сигнала',ylabel:'Относительная амплитуда'});
        charts=view==='compare'?comparison(p.f1,c.h1)+comparison(p.f2,c.h2):hplot;
        note=`Различие комплексного действия на маркерах: ${finite(c.difference*100,1)} % от суммы амплитуд путей. ${c.ratio<.1?'Bₛ ≪ Bс: ожидается приблизительно плоский канал.':c.ratio>=1?'Bₛ ≳ Bс: частотная селективность существенна.':'Переходная область: исследуйте форму H(f) внутри выделенной полосы.'}`;
      }
      explanation='Фаза каждого луча следует из задержки: −2πfτ. H(f) — комплексная сумма путей, на графике показан её модуль, без искусственной нормировки максимумов. При больших задержках провалы обычно становятся чаще. RMS-разброс взвешен по мощностям лучей; Bс ≈ 1/(5στ) — учебный ориентир, зависящий от выбранного критерия сходства, а не строгое универсальное определение. Два удалённых маркера могут случайно попасть в похожие точки периодической характеристики: это не означает, что весь интервал между ними одинаков. Фаза в глубоком провале плохо определена.';
    } else if (mode==='shift') {
      const s=model.frequencyShift(p), extent=Math.max(700,Math.abs(s.total)*1.3), f=Array.from({length:401},(_,i)=>-extent+2*extent*i/400);
      metrics=metric('Допплер',`${finite(s.motion)} Гц`) + metric('Генераторы',`${finite(s.oscillator)} Гц`) + metric('Суммарный сдвиг',`${finite(s.total)} Гц`);
      charts=plot('Смещение спектра относительно несущей', [{x:f,y:f.map(x=>Math.exp(-((x/20)**2))),label:'Передано'},{x:f,y:f.map(x=>Math.exp(-(((x-s.total)/20)**2))),label:'Принято'}],{xmin:-extent,xmax:extent,ymin:0,ymax:1.15,xlabel:'f − fс, Гц',ylabel:'Условная спектральная амплитуда',markers:[{value:s.total,label:'Δf'}]});
      note='0° — движение навстречу: положительный сдвиг; 90° — поперёк: нулевой; 180° — удаление: отрицательный.';
      explanation='Один путь: fD ≈ (v/c) fс cos θ. Рассогласование генераторов добавляется отдельно и остаётся при нулевой скорости. Ширина нарисованной линии условная и фиксированная: она нужна для различимости графика и не изображает доплеровское рассеяние.';
    } else if (mode==='spread') {
      const d=model.dopplerSpread(p, lecture ? p.duration/1000 : .1), max=d.paths.reduce((v,x)=>v+x.amplitude,0);
      metrics=metric('Минимум уровня за передачу',finite(d.fragmentMin)) + metric('Максимум уровня за передачу',finite(d.fragmentMax)) + metric('Время когерентности · ориентир',`${finite(d.tc*1000)} мс`);
      if(view==='time') charts=plot('Уровень принятого сигнала; фон — время передачи', [{x:d.time.map(t=>t*1000),y:d.power,label:'Относительная мощность'}],{xmax:100,ymin:0,ymax:max*max*1.05,xlabel:'Время, мс',ylabel:'Относительная мощность',bands:[[0,p.duration]],markers:Number.isFinite(d.tc)?[{value:d.tc*1000,label:'Время когерентности'}]:[]});
      else {const range=Math.max(100,...d.shifts.map(Math.abs))*1.2;charts=plot('Доплеровские сдвиги отдельных лучей',d.paths.map((path,i)=>({x:[d.shifts[i],d.shifts[i]],y:[0,path.amplitude**2],label:i===0?'Прямой луч':`Отражение ${i}`})),{xmin:-range,xmax:range,ymin:0,ymax:1.1,xlabel:'Доплеровский сдвиг, Гц',ylabel:'Относительная мощность'});}
      if (lecture) {
        const t=d.time.map(x=>x*1000), envelope=d.h.map(x=>100*x.magnitude);
        const moment=(p.probePercent ?? 0)/100*p.duration;
        const snapshot=model.movingRaySnapshot(p,moment/1000);
        metrics=metric('Момент после начала передачи',`${finite(moment,2)} мс`) + metric('Приёмник прошёл',`${finite(snapshot.displacement*1000,1)} мм`) + metric('Амплитуда суммы сейчас',`${finite(snapshot.amplitude*100,1)} %`);
        const rx=350-(p.speed ? (p.probePercent ?? 0)*2 : 0);
        const motionId=`cp-motion-${drawPlot.id++}`;
        charts=`<figure class="cp-plot"><figcaption>Приёмник движется навстречу прямому лучу</figcaption><svg viewBox="0 0 430 225" role="img" aria-label="Прямой луч приходит слева, отражённый сверху. Приёмник движется влево: прямой путь сокращается, путь сбоку почти не меняется.">
          <defs><marker id="${motionId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${COLORS[0]}"/></marker><marker id="${motionId}-side" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z" fill="${COLORS[2]}"/></marker></defs>
          <text x="20" y="24">Прямой луч приходит слева</text><text x="180" y="48">Отражённый — сверху</text>
          ${[70,90,110,130].map(y=>`<path d="M140 ${y}H390" stroke="${COLORS[2]}" opacity=".15"/>`).join('')}
          <path d="M20 110H${rx-12}" stroke="${COLORS[0]}" stroke-width="3" marker-end="url(#${motionId})"/>
          <path d="M${rx} 60V98" stroke="${COLORS[2]}" stroke-width="3" marker-end="url(#${motionId}-side)"/>
          <circle cx="350" cy="110" r="9" fill="none" stroke="currentColor" stroke-dasharray="3 3" opacity=".5"/>
          <circle cx="${rx}" cy="110" r="10" fill="${COLORS[1]}"/><text x="${rx}" y="148" text-anchor="middle">Приёмник</text>
          <path d="M350 174H150" stroke="${COLORS[0]}" stroke-width="2" marker-end="url(#${motionId})"/><text x="250" y="196" text-anchor="middle">Направление движения</text>
          <text x="20" y="218">Позиция в начале · пунктирный кружок</text></svg>
          <div class="cp-legend"><span>Прямой путь сократился на ${finite(-snapshot.pathChanges[0]*1000,1)} мм</span><span>Путь сбоку: почти без изменения</span><span>Длина волны: ${finite(snapshot.wavelength*1000,1)} мм</span></div></figure>`;
        charts+=plot('Две приходящие волны и их сумма в выбранный момент',[
          {x:snapshot.cycles,y:snapshot.copies[0],label:'Прямой луч',color:COLORS[0],dash:true},
          {x:snapshot.cycles,y:snapshot.copies[1],label:'Отражённый луч',color:COLORS[2],dash:true},
          {x:snapshot.cycles,y:snapshot.sum,label:'Сумма на приёмнике',color:COLORS[1]}
        ],{xmax:2,ymin:-1.8,ymax:1.8,yticks:[-1.7,-1,0,1,1.7],xlabel:'Колебания несущей · два периода',ylabel:'Относительная амплитуда'});
        charts+=plot('Как меняется амплитуда суммы за передачу',[
          {x:t,y:t.map(()=>100),label:'Передано: постоянная амплитуда',dash:true,color:COLORS[0]},
          {x:t,y:envelope,label:'Принято: сумма прямого и отражённого лучей',color:COLORS[1]}
        ],{xmax:p.duration,ymin:0,ymax:180,yticks:[0,50,100,150],xlabel:'Время от начала передачи, мс',ylabel:'Амплитуда относительно переданной, %',markers:[{value:moment,label:'Выбранный момент'}]});
      }
      note=Number.isFinite(d.tc)?`Полоса фона на графике — фрагмент T. ${p.duration/1000<d.tc/10?'T ≪ Tс: канал меняется относительно медленно.':p.duration/1000>=d.tc?'T ≳ Tс: изменения внутри фрагмента существенны.':'Сравните изменение h(t) внутри фрагмента.'}`:'Разброса нет: относительные фазы лучей постоянны. Возможен общий частотный сдвиг и вращение фазы.';
      explanation='У каждого луча свой угол прихода: fD,k = (v/c) fс cos θk. Bᴅ здесь — диапазон сдвигов путей с ненулевой мощностью. Разные сдвиги меняют относительные фазы и создают замирания. Общий сдвиг вращает весь коэффициент, но не создаёт разброса и изменений его модуля; оценка Tс относится к изменениям после отделения общего вращения. Tс ≈ 1/Bᴅ — характерный масштаб, а не точная граница. При слабом дополнительном луче изменения могут быть малы даже при широком диапазоне сдвигов. Если канал зависит от частоты и меняется со временем, откуда система знает его текущее состояние? Это вопрос следующей темы о служебном обмене.';
    } else {
      const labels=['Затухание','Ограниченность полосы','Дисперсия','Внешние помехи','Многолучёвость','Изменение во времени'];
      charts=`<div class="cp-media">${lecture ? '' : `<h3>Выбранная среда: ${MEDIA[medium][0].toLowerCase()}</h3>`}<div class="cp-table-scroll" tabindex="0" role="region" aria-label="Сравнение сред; на узком экране таблицу можно прокрутить"><table><caption>Значимость эффектов и их причины</caption><thead><tr><th scope="col">Эффект</th>${Object.entries(MEDIA).map(([key, data])=>`<th scope="col" class="${!lecture && key===medium?'cp-selected':''}">${data[0]}</th>`).join('')}</tr></thead><tbody>${labels.map((label,i)=>`<tr><th scope="row">${label}</th>${Object.entries(MEDIA).map(([key,data])=>`<td class="${!lecture && key===medium?'cp-selected':''}">${data[1][i]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
      note='Сравнение качественное: значимость зависит от длины линии, частоты, конструкции и окружения.';
      explanation='Дисперсия — разная задержка разных частот или мод. Ограниченная полоса и дисперсия могут обе искажать форму, но не являются одним и тем же механизмом. Проводные отражения связаны с несогласованием; в радио задержанные пути формирует окружение. Нельзя переносить численные настройки учебного радиоканала на волокно или кабель.';
    }
    const visibleNote = lecture ? dataNote : note;
    root.querySelector('.cp-results').innerHTML=`<div class="cp-metrics">${metrics}</div>${charts}${visibleNote ? `<p class="cp-note" role="status">${visibleNote}</p>` : ''}`;
    if (!lecture) root.querySelector('.cp-explanation-body').innerHTML=`<p>${explanation}</p>`;
  }
  shell();
  shared?.listeners.set(root, () => {p = shared.parameters; shell();});
  let lastWidth = root.clientWidth;
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (root.clientWidth !== lastWidth) {lastWidth = root.clientWidth; render();}
  });
  observer?.observe(root);
  return {setMode(next) {if(!META[next]) throw new Error('Unknown mode'); if(fixed) throw new Error('Standalone mode is fixed'); mode=next; shell();}, getState() {return structuredClone(p);}, destroy() {observer?.disconnect(); shared?.listeners.delete(root); root.replaceChildren(); root.classList.remove('channel-playground', 'cp-lecture', 'cp-media-mode');}};
}
// Explicitly grouped lecture blocks share this channel's parameters.
// Unmarked blocks keep the independent-instance behavior.
const groups = new Map();
document.querySelectorAll('[data-channel-playground]').forEach(root => {
  const name = root.dataset.channelGroup;
  if (name && !groups.has(name)) groups.set(name, {parameters: model.defaults(), listeners: new Map()});
  mountChannelPlayground(root, {sharedState: name ? groups.get(name) : undefined});
});
