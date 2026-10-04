import * as model from './channel-playground-model.js';

const META = {
  attenuation: ['Затухание', 'Станет ли связь слабее при удвоении расстояния? Что изменит усиление?', 'Увеличьте расстояние, найдите границу работоспособности. Включите усилитель и измените его коэффициент шума.'],
  bandwidth: ['Ограниченная полоса', 'Восстановит ли регенератор исходные биты, если импульсы уже сливаются?', 'Сузьте полосу до 0,3 кГц и включите регенератор. Затем уменьшите скорость или расширьте полосу.'],
  noise: ['Шум и помехи', 'Когда точка перейдёт через границу решения? Будет ли помеха выглядеть как шум?', 'Уменьшите SNR, затем переключитесь на внешнюю помеху и измените её частоту.'],
  multipath: ['Многолучёвость', 'Всегда ли дополнительный луч делает сигнал сильнее?', 'Изменяйте задержку отражения. Сопоставьте сумму копий с провалами H(f).'],
  coherence: ['Полоса когерентности', 'На каком расстоянии друг от друга частоты начинают испытывать разное действие канала?', 'Раздвигайте f₁ и f₂, сравнивайте усиление и фазу. Затем увеличьте задержки лучей.'],
  shift: ['Уход частоты', 'Как изменится сдвиг при той же скорости и более высокой несущей?', 'Сравните 0,1 и 6 ГГц; затем остановите движение и добавьте рассогласование генераторов.'],
  spread: ['Время когерентности', 'Будет ли канал меняться по амплитуде, если все лучи имеют одинаковый сдвиг?', 'Начните без отражений. Добавьте лучи с разными направлениями, увеличьте скорость и сравните T с Tс.'],
  media: ['Сравнение сред', 'Какие из наблюдавшихся эффектов будут важны в разных средах?', 'Выберите среду и сопоставьте причины искажений с её физикой.'],
};
const COLORS = ['#1479b8', '#d66720', '#8b62c5', '#168a69'];
const LECTURE_HINTS = {
  attenuation: 'Сопоставьте уровень до усилителя, уровень после него и график добавленного шума. Запас рассчитан до усилителя.',
  bandwidth: 'Сравните отсчёты решений с исходными битами, затем отдельно рассмотрите форму новых импульсов.',
  noise: 'Сравните структуру облака точек и положение границы решения. Число ошибок относится только к показанному фрагменту.',
  multipath: 'Проверьте одновременно временную сумму копий и частотную характеристику при одной задержке.',
  coherence: 'Сравните не только маркеры, но и весь интервал между ними. Оценка полосы когерентности условна.',
  shift: 'По отдельности измените скорость, направление движения и рассогласование генераторов.',
  spread: 'Рассмотрите отдельно модуль и фазу коэффициента канала. Оценка времени когерентности условна.',
  media: 'Сопоставьте физические причины похожих искажений в разных средах.',
};
const finite = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString('ru-RU', {maximumFractionDigits: digits}) : '∞';
const metric = (title, value) => `<div class="cp-metric"><span>${title}</span><strong>${value}</strong></div>`;
function drawPlot(title, series, {xmin = 0, xmax = 1, ymin = -1, ymax = 1, xlabel = '', ylabel = '', markers = [], bands = [], square = false, width = 720} = {}) {
  const W = Math.max(320, Math.min(square ? 461 : 720, width)), H = square ? W - 11 : 245, L = 60, R = 15, T = 22, B = 42;
  const x = v => L + (v - xmin) / (xmax - xmin) * (W - L - R);
  const y = v => H - B - (v - ymin) / (ymax - ymin) * (H - T - B);
  const ticks = Array.from({length: 5}, (_, i) => {
    const xx = xmin + (xmax - xmin) * i / 4, yy = ymin + (ymax - ymin) * i / 4;
    return `<path class="cp-grid" d="M${x(xx)} ${T}V${H - B} M${L} ${y(yy)}H${W - R}"/><text x="${x(xx)}" y="${H - B + 19}" text-anchor="middle">${finite(xx)}</text><text x="${L - 8}" y="${y(yy) + 4}" text-anchor="end">${finite(yy)}</text>`;
  }).join('');
  const curves = series.map((s, index) => {
    const color = s.color || COLORS[index % COLORS.length];
    if (s.points) return s.points.map(p => `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="${s.radius || 3}" fill="${color}" opacity=".8"/>`).join('');
    return `<polyline points="${s.x.map((v, i) => `${x(v).toFixed(2)},${y(s.y[i]).toFixed(2)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''}/>`;
  }).join('');
  const id = drawPlot.id++;
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}"><defs><clipPath id="cp-clip-${id}"><rect x="${L}" y="${T}" width="${W-L-R}" height="${H-T-B}"/></clipPath></defs>${ticks}<g clip-path="url(#cp-clip-${id})">${bands.map(b => `<rect x="${x(b[0])}" y="${T}" width="${x(b[1])-x(b[0])}" height="${H-T-B}" class="cp-band"/>`).join('')}${curves}${markers.map(m => `<path d="M${x(m.value)} ${T}V${H-B}" class="cp-marker"/><text x="${x(m.value)+4}" y="${T+13}">${m.label}</text>`).join('')}</g><text x="${W/2}" y="${H-3}" text-anchor="middle">${xlabel}</text><text x="${L}" y="14">${ylabel}</text></svg>`;
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
    return `<fieldset class="cp-paths"><legend>Отражённые пути</legend><p>Прямой путь: амплитуда 1, задержка 0${withAngles ? `, угол ${finite(p.direction)}°` : ''}.</p>${p.paths.map((path, i) => `<div class="cp-path"><strong>Луч ${i+1}</strong>${slider(`path-${i}-amplitude`, 'Относительная амплитуда', 0, 1, .05, path.amplitude)}${slider(`path-${i}-delay`, 'Задержка', 0, 5, .025, path.delay, 'мкс')}${withAngles ? slider(`path-${i}-angle`, 'Направление прихода', 0, 180, 5, path.angle, '°') : ''}<button type="button" data-remove="${i}">Убрать луч ${i+1}</button></div>`).join('')}<button type="button" data-add ${p.paths.length >= 3 ? 'disabled' : ''}>Добавить отражение</button></fieldset>`;
  }
  function controls() {
    const motion = () => slider('carrierGHz', 'Несущая', .1, 6, .1, p.carrierGHz, 'ГГц') + slider('speed', 'Скорость', 0, 60, 1, p.speed, 'м/с') + slider('direction', 'Угол движения к прямому лучу', 0, 180, 5, p.direction, '°');
    switch (mode) {
      case 'attenuation': return slider('power', 'Мощность передатчика', 0, 40, 1, p.power, 'дБм') + slider('distance', 'Расстояние', .1, 20, .1, p.distance, 'км') + slider('loss', 'Дополнительные потери', 0, 5, .1, p.loss, 'дБ/км') + slider('sensitivity', 'Чувствительность приёмника', -90, -40, 1, p.sensitivity, 'дБм') + select('aid', 'Устройство на входе приёмника', [['none','Без усилителя'], ['amplifier','Усилитель ×4']], p.aid) + (p.aid==='amplifier' ? slider('noiseFigure', 'Коэффициент шума NF', 0, 15, .5, p.noiseFigure, 'дБ') : '');
      case 'bandwidth': return slider('bandwidth', 'Полоса канала', .1, 20, .1, p.bandwidth, 'кГц') + slider('rate', 'Символьная скорость', 1, 20, .5, p.rate, 'ксимв/с') + select('regeneration', 'Регенератор после канала', [['off','Выключен'], ['on','Включён']], p.regeneration);
      case 'noise': return select('disturbance', 'Источник добавленного сигнала', [['noise','Шум'], ['interference','Внешняя помеха']], p.disturbance) + (p.disturbance === 'noise' ? slider('snr', 'SNR (энергия символа / N₀)', -12, 24, 1, p.snr, 'дБ') : slider('interference', 'Амплитуда помехи / сигнала', 0, 3, .05, p.interference) + slider('interferenceFrequency', 'Частота помехи в полосе I/Q', .01, .49, .01, p.interferenceFrequency, 'циклов/символ'));
      case 'multipath': return slider('carrier', 'Частота сигнала', .1, 3, .05, p.carrier, 'МГц') + pathControls();
      case 'coherence': return slider('f1', 'Маркер f₁', 0, 4, .01, p.f1, 'МГц') + slider('f2', 'Маркер f₂', 0, 4, .01, p.f2, 'МГц') + slider('signalBandwidth', 'Полоса сигнала Bₛ вокруг f₁', .01, 2, .01, p.signalBandwidth, 'МГц') + pathControls();
      case 'shift': return motion() + slider('offset', 'Рассогласование генераторов', -500, 500, 5, p.offset, 'Гц');
      case 'spread': return motion() + slider('duration', 'Длительность фрагмента T', .1, 100, .1, p.duration, 'мс') + pathControls(true);
      case 'media': return select('medium', 'Среда', Object.entries(MEDIA).map(([key, value]) => [key, value[0]]), medium);
    }
  }
  function views() {
    return ({attenuation: [['time','Форма'],['level','Уровни']], bandwidth: [['time','Импульсы'],['spectrum','Полоса H(f)']], noise: [['time','Во времени'],['constellation','Созвездие']], multipath: [['time','Копии и сумма'],['frequency','H(f)']], coherence: [['frequency','H(f) и маркеры'],['delay','Профиль задержек']], shift: [['spectrum','Спектр']], spread: [['time','Канал во времени'],['spectrum','Сдвиги лучей']], media: []})[mode];
  }
  function shell() {
    const vv = views(); if (!vv.some(([v]) => v === view)) view = vv[0]?.[0] || '';
    const introduction = lecture ? '' : `<h2>${META[mode][0]}</h2><div class="cp-chain"><span>Передатчик · s(t)</span><b aria-hidden="true">→</b><span>${META[mode][0]}</span><b aria-hidden="true">→</b><span>Приёмник · r(t)</span></div><div class="cp-experiment"><strong>Предскажите</strong><p>${META[mode][1]}</p><textarea rows="2" placeholder="Моя гипотеза…" aria-label="Предсказание результата">${(prediction[mode] || '').replaceAll('&','&amp;').replaceAll('<','&lt;')}</textarea><p><strong>Проверьте:</strong> ${META[mode][2]}</p></div>`;
    root.innerHTML = `${!fixed ? `<nav class="cp-modes" aria-label="Режимы канала">${Object.entries(META).map(([key, m], i) => `<button type="button" data-mode="${key}" aria-pressed="${mode===key}">${i+1}. ${m[0]}</button>`).join('')}</nav>` : ''}${introduction}<div class="cp-layout"><div class="cp-controls" role="group" aria-label="Параметры канала">${controls()}<button type="button" data-reset>${shared ? 'Сбросить общие параметры' : 'Сбросить параметры'}</button></div><section class="cp-observation" aria-label="Наблюдение"><div class="cp-views" aria-label="Представление">${vv.map(([key,label]) => `<button type="button" data-view="${key}" aria-pressed="${view===key}">${label}</button>`).join('')}</div><div class="cp-results"></div></section></div><details class="cp-explanation" ${explanations[mode] ? 'open' : ''}><summary>Подсказка к опыту</summary><div class="cp-explanation-body"></div></details>`;
    root.querySelector('textarea')?.addEventListener('input', e => {prediction[mode] = e.target.value;});
    root.querySelector('details').addEventListener('toggle', e => {explanations[mode] = e.target.open;});
    root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {mode = b.dataset.mode; shell();}));
    root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {view = b.dataset.view; root.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b)); render();}));
    root.querySelectorAll('[data-param]').forEach(input => input.addEventListener('input', () => {
      const key = input.dataset.param, value = input.tagName === 'SELECT' ? input.value : Number(input.value);
      if (key.startsWith('path-')) {const [,i,field] = key.split('-'); if(field==='power') p.paths[Number(i)].amplitude=Math.sqrt(value); else p.paths[Number(i)][field] = value;}
      else if (key === 'medium') medium = value; else p[key] = value;
      const output = input.parentElement.querySelector('output');
      if (output) output.textContent = finite(value, 3) + ' ' + output.dataset.unit;
      if (key === 'disturbance' || key === 'aid') shell(); else render();
      notifyPeers();
    }));
    root.querySelector('[data-add]')?.addEventListener('click', () => {if (p.paths.length < 3) p.paths.push({amplitude: .5, delay: 1+p.paths.length, angle: 120+20*p.paths.length}); shell(); notifyPeers();});
    root.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {p.paths.splice(Number(b.dataset.remove),1); shell(); notifyPeers();}));
    root.querySelector('[data-reset]').addEventListener('click', () => {p = model.defaults(); shell(); notifyPeers();});
    render();
  }
  function render() {
    let metrics = '', charts = '', note = '', explanation = '', dataNote = '';
    if (mode === 'attenuation') {
      const a = model.attenuation(p);
      metrics = metric('Передано', `${finite(p.power)} дБм`) + metric('Потери', `${finite(a.lossDb)} дБ`) + metric('Принято до устройства', `${finite(a.received)} дБм`) + metric('Запас до устройства', `${finite(a.margin)} дБ`);
      const {time:t, tx, input, output, addedNoise, noiseDbm, outputLevel} = model.attenuationSignal(p);
      if (p.aid==='amplifier') metrics += metric('Уровень после усилителя', `${finite(outputLevel)} дБм`) + metric('Собственный шум на выходе', Number.isFinite(noiseDbm) ? `${finite(noiseDbm)} дБм` : 'Нет · NF = 0 дБ');
      if (view === 'level') charts = plot('Энергетический бюджет до устройства', [{x:[0,1], y:[p.power,a.received], label:'Уровень сигнала'}, {x:[0,1],y:[p.sensitivity,p.sensitivity],label:'Чувствительность',dash:true}],{xmax:1,ymin:-120,ymax:40,xlabel:'0 — передатчик; 1 — вход приёмника',ylabel:'дБм'});
      else {
        charts = plot('Переданные цифровые уровни', [{x:t,y:tx,label:'s(t)'}],{xmax:12,ymin:-1.5,ymax:1.5,xlabel:'Символы',ylabel:'Относительная амплитуда'});
        const limit = Math.max(1.5, ...input.map(Math.abs), ...output.map(Math.abs));
        charts += plot('Принятый сигнал', [{x:t,y:input,label:'После затухания'}, ...(p.aid==='amplifier' ? [{x:t,y:output,label:'После усилителя с собственным шумом'}] : [])],{xmax:12,ymin:-limit,ymax:limit,xlabel:'Символы',ylabel:'В единицах амплитуды порога'});
        if (p.aid==='amplifier') {const noiseLimit=Math.max(.001,...addedNoise.map(Math.abs))*1.1; charts += plot('Собственный шум усилителя · отдельный масштаб', [{x:t,y:addedNoise,label:'Добавленная компонента'}],{xmax:12,ymin:-noiseLimit,ymax:noiseLimit,xlabel:'Символы',ylabel:'В единицах амплитуды порога'});}
      }
      note = a.usable ? 'Запас неотрицательный: связь условно работоспособна.' : 'Запас отрицательный: работоспособность не гарантирована.';
      explanation = 'Учебные потери: 40 дБ на 1 км + геометрическое расхождение 20 log₁₀(d / 1 км) + дополнительные потери на километр. Канал этого опыта не добавляет шума. Усилитель ×4 по амплитуде имеет усиление G = 16 по мощности и добавляет собственный шум Nа = G(F − 1)kT₀B, где F = 10^(NF/10). Опорная температура T₀ = 290 К, шумовая полоса B = 100 МГц, k — постоянная Больцмана; они фиксированы. Опорный тепловой шум используется для определения NF, но не добавляется к показанному идеальному входу. Поэтому здесь нельзя вычислять NF как отношение SNR бесшумного входа к SNR выхода. NF = 0 дБ — идеальный усилитель без собственного шума. Запас показан до усилителя; отдельный график шума имеет свой масштаб.';
    } else if (mode === 'bandwidth') {
      const b = model.bandwidth(p);
      metrics = metric('B / Rₛ', finite(p.bandwidth/p.rate)) + metric('Остаток предыдущего уровня', `${finite(100*b.tail,1)} %`) + metric('Ошибочные решения', `${b.errors} / ${model.BITS.length}`);
      if (view==='time') {
        charts = plot('Импульсы и память канала', [{x:b.time,y:b.tx,label:'s(t)'},{x:b.time,y:b.rx,label:'r(t)'},{points:b.decisions.map((_,i)=>[(i+.5)/p.rate,b.rx[i*64+32]]),label:'Отсчёты решений',color:COLORS[2]}],{xmax:12/p.rate,ymin:-1.2,ymax:1.2,xlabel:'Время, мс',ylabel:'Относительная амплитуда'});
        if(p.regeneration==='on') charts += plot('Новые импульсы после регенерации', [{x:b.regeneratedTime,y:b.tx,label:'Исходные биты с той же задержкой',dash:true},{x:b.regeneratedTime,y:b.regenerated,label:'Выход регенератора'}],{xmax:13/p.rate,ymin:-1.2,ymax:1.2,xlabel:'Время, мс · задержка один символ',ylabel:'Относительная амплитуда'});
      }
      else {const f=Array.from({length:201},(_,i)=>i*.1); charts=plot('Полоса канала и масштаб скорости', [{x:f,y:f.map(f=>model.lowpassGain(f,p.bandwidth)),label:'|H(f)|'}],{xmax:20,ymin:0,ymax:1.1,xlabel:'Частота, кГц',ylabel:'Относительное усиление',markers:[{value:p.bandwidth,label:'B (−3 дБ)'},{value:p.rate/2,label:'Rₛ/2'}]});}
      note = `Решения: ${b.decisions.join(' ')}; передано: ${model.BITS.join(' ')}. Регенератор формирует прямоугольные импульсы по решениям приёмника; ${b.errors ? 'ошибочные биты остаются ошибочными.' : 'в этом фрагменте решения совпали с исходными битами.'}`;
      dataNote = `Передано: ${model.BITS.join(' ')}; решения: ${b.decisions.join(' ')}.`;
      explanation = 'Канал — фильтр нижних частот первого порядка; B задаёт уровень −3 дБ. Он сглаживает фронты и сохраняет часть предыдущего уровня к моменту решения следующего символа: это межсимвольная интерференция. Амплитуда фиксирована; шума нет. Регенератор принимает решение в середине символа по порогу ноль, затем формирует новые импульсы с задержкой один символ. Тактирование задано. Он восстанавливает форму, но не исправляет ошибочные решения при сильной ISI. Rₛ/2 — ориентир частотного масштаба, а не строгая ширина спектра прямоугольных импульсов.';
    } else if (mode === 'noise') {
      const n = model.noisySymbols(p);
      metrics = metric('Ошибочные решения в примере', `${n.errors} / ${n.points.length}`) + metric('Передача', 'BPSK · 2 состояния');
      if (view==='constellation') {
        const extent = Math.max(2, ...n.points.flatMap(x=>[Math.abs(x.re),Math.abs(x.im)]));
        charts = plot('Созвездие и граница решения I = 0', [{points:n.points.filter(x=>!x.error).map(x=>[x.re,x.im]),label:'Верное решение'},{points:n.points.filter(x=>x.error).map(x=>[x.re,x.im]),label:'Ошибка',color:'#d34b55'},{points:[[-1,0],[1,0]],label:'Переданные состояния',color:COLORS[2],radius:6}],{xmin:-extent,xmax:extent,ymin:-extent,ymax:extent,xlabel:'I',ylabel:'Q',markers:[{value:0,label:'Граница'}],square:true});
      } else {const points=n.points.slice(0,24), t=points.map((_,i)=>i), extent=Math.max(2,...points.flatMap(x=>[Math.abs(x.re),Math.abs(x.re-x.tx)]))*1.1;charts=plot('Отсчёты сигнала в моменты решений', [{x:t,y:points.map(x=>x.tx),label:'s: исходные уровни'},{x:t,y:points.map(x=>x.re),label:'r: I приёмника'},{x:t,y:points.map(x=>x.re-x.tx),label:'Добавленная компонента'}],{xmax:23,ymin:-extent,ymax:extent,xlabel:'Номер символа',ylabel:'Амплитуда'});}
      note = `Первые 24 бита: ${n.points.slice(0,24).map(x=>x.bit).join('')}; принято: ${n.points.slice(0,24).map(x=>x.decision).join('')}. Красные точки пересекли границу решения.`;
      dataNote = `Первые 24 бита: ${n.points.slice(0,24).map(x=>x.bit).join('')}; принято: ${n.points.slice(0,24).map(x=>x.decision).join('')}.`;
      explanation = 'Показаны отсчёты комплексной огибающей BPSK. Шум — независимые гауссовы добавки в I и Q; SNR здесь задан как Eₛ/N₀. Внешняя помеха — один тон: его фаза последовательно вращается, поэтому точки имеют структуру. Случайный набор фиксирован, чтобы изменение одного параметра было сопоставимым. Число ошибок относится только к этому фрагменту и не является оценкой надёжности линии.';
    } else if (mode==='multipath' || mode==='coherence') {
      const m=model.multipath(p), c=model.coherence(p), max=m.paths.reduce((v,x)=>v+x.amplitude,0);
      metrics = mode==='multipath' ? metric('Путей',m.paths.length) + metric('|H| на частоте сигнала',finite(model.response(m.paths,p.carrier).magnitude)) : metric('Среднеквадратический разброс задержек',`${finite(c.rms)} мкс`) + metric('Ориентир Bс ≈ 1/(5στ)',`${finite(c.bc)} МГц`) + metric('Bₛ / Bс',finite(c.ratio));
      const hplot=plot('Частотная характеристика общего канала', [{x:m.frequencies,y:m.h,label:'|H(f)|'}],{xmax:4,ymin:0,ymax:max*1.05,xlabel:'Частота, МГц',ylabel:'Относительная амплитуда',markers:mode==='coherence'?[{value:p.f1,label:'f₁'},{value:p.f2,label:'f₂'}]:[{value:p.carrier,label:'Частота сигнала'}],bands:mode==='coherence'?[[p.f1-p.signalBandwidth/2,p.f1+p.signalBandwidth/2]]:[]});
      if(mode==='multipath') {
        const copies=plot('Прямой путь и задержанные копии',m.copies.map((copy,i)=>({x:m.time,y:copy,label:i===0?'Прямой путь':`Отражение ${i}`})),{xmax:12,ymin:-1.2,ymax:1.2,xlabel:'Время, мкс',ylabel:'Амплитуда'});
        const sum=plot('Сумма на приёмнике', [{x:m.time,y:m.copies[0],label:'s(t)',dash:true},{x:m.time,y:m.sum,label:'r(t)'}],{xmax:12,ymin:-max,ymax:max,xlabel:'Время, мкс',ylabel:'Амплитуда'});
        charts=view==='time'?copies+sum+hplot:hplot+sum;
        note='Задержка сдвигает начало копии и её фазу. Усиление на одной частоте может сопровождаться провалом на другой.';
      } else {
        const profile=plot('Мощности и задержки путей', m.paths.map((path,i)=>({x:[path.delay,path.delay],y:[0,path.amplitude**2],label:i===0?'Прямой путь':`Отражение ${i}`})),{xmax:5,ymin:0,ymax:1.1,xlabel:'Задержка, мкс',ylabel:'Относительная мощность'});
        charts=view==='delay'?profile+hplot:hplot+profile;
        metrics+=metric('|H(f₁)| / |H(f₂)|',`${finite(c.h1.magnitude)} / ${finite(c.h2.magnitude)}`) + metric('Фаза f₁ / f₂',`${finite(Math.atan2(c.h1.im,c.h1.re)*180/Math.PI,0)}° / ${finite(Math.atan2(c.h2.im,c.h2.re)*180/Math.PI,0)}°`);
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
      const d=model.dopplerSpread(p), max=d.paths.reduce((v,x)=>v+x.amplitude,0);
      metrics=metric('Допплеровский разброс Bᴅ',`${finite(d.spread)} Гц`) + metric('Ориентир Tс ≈ 1/Bᴅ',`${finite(d.tc*1000)} мс`) + metric('T / Tс',finite(p.duration/1000/d.tc));
      if(view==='time') charts=plot('Комплексный коэффициент канала во времени', [{x:d.time.map(t=>t*1000),y:d.h.map(h=>h.magnitude),label:'|h(t)|'},{x:d.time.map(t=>t*1000),y:d.h.map(h=>h.re),label:'Re h(t)'},{x:d.time.map(t=>t*1000),y:d.h.map(h=>h.im),label:'Im h(t)'}],{xmax:d.time.at(-1)*1000,ymin:-max,ymax:max,xlabel:'Время, мс',ylabel:'Коэффициент канала',bands:[[0,p.duration]],markers:Number.isFinite(d.tc)?[{value:d.tc*1000,label:'Tс'}]:[]});
      else {const range=Math.max(100,...d.shifts.map(Math.abs))*1.2;charts=plot('Доплеровские сдвиги отдельных лучей',d.paths.map((path,i)=>({x:[d.shifts[i],d.shifts[i]],y:[0,path.amplitude**2],label:i===0?'Прямой путь':`Отражение ${i}`})),{xmin:-range,xmax:range,ymin:0,ymax:1.1,xlabel:'Доплеровский сдвиг, Гц',ylabel:'Относительная мощность'});}
      note=Number.isFinite(d.tc)?`Полоса фона на графике — фрагмент T. ${p.duration/1000<d.tc/10?'T ≪ Tс: канал меняется относительно медленно.':p.duration/1000>=d.tc?'T ≳ Tс: изменения внутри фрагмента существенны.':'Сравните изменение h(t) внутри фрагмента.'}`:'Разброса нет: относительные фазы лучей постоянны. Возможен общий частотный сдвиг и вращение фазы.';
      explanation='У каждого луча свой угол прихода: fD,k = (v/c) fс cos θk. Bᴅ здесь — диапазон сдвигов путей с ненулевой мощностью. Разные сдвиги меняют относительные фазы и создают замирания. Общий сдвиг вращает весь коэффициент, но не создаёт разброса и изменений его модуля; оценка Tс относится к изменениям после отделения общего вращения. Tс ≈ 1/Bᴅ — характерный масштаб, а не точная граница. При слабом дополнительном луче изменения могут быть малы даже при широком диапазоне сдвигов. Если канал зависит от частоты и меняется со временем, откуда система знает его текущее состояние? Это вопрос следующей темы о служебном обмене.';
    } else {
      const labels=['Затухание','Ограниченность полосы','Дисперсия','Внешние помехи','Многолучёвость','Изменение во времени'];
      charts=`<div class="cp-media"><h3>Выбранная среда: ${MEDIA[medium][0].toLowerCase()}</h3><div class="cp-table-scroll" tabindex="0" role="region" aria-label="Сравнение сред; на узком экране таблицу можно прокрутить"><table><caption>Значимость эффектов и их причины</caption><thead><tr><th scope="col">Эффект</th>${Object.entries(MEDIA).map(([key, data])=>`<th scope="col" class="${key===medium?'cp-selected':''}">${data[0]}</th>`).join('')}</tr></thead><tbody>${labels.map((label,i)=>`<tr><th scope="row">${label}</th>${Object.entries(MEDIA).map(([key,data])=>`<td class="${key===medium?'cp-selected':''}">${data[1][i]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
      note='Сравнение качественное: значимость зависит от длины линии, частоты, конструкции и окружения.';
      explanation='Дисперсия — разная задержка разных частот или мод. Ограниченная полоса и дисперсия могут обе искажать форму, но не являются одним и тем же механизмом. Проводные отражения связаны с несогласованием; в радио задержанные пути формирует окружение. Нельзя переносить численные настройки учебного радиоканала на волокно или кабель.';
    }
    const visibleNote = lecture ? dataNote : note;
    root.querySelector('.cp-results').innerHTML=`<div class="cp-metrics">${metrics}</div>${charts}${visibleNote ? `<p class="cp-note" role="status">${visibleNote}</p>` : ''}`;
    root.querySelector('.cp-explanation-body').innerHTML=`<p>${lecture ? LECTURE_HINTS[mode] : explanation}</p>`;
  }
  shell();
  shared?.listeners.set(root, () => {p = shared.parameters; shell();});
  let lastWidth = root.clientWidth;
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
    if (root.clientWidth !== lastWidth) {lastWidth = root.clientWidth; render();}
  });
  observer?.observe(root);
  return {setMode(next) {if(!META[next]) throw new Error('Unknown mode'); if(fixed) throw new Error('Standalone mode is fixed'); mode=next; shell();}, getState() {return structuredClone(p);}, destroy() {observer?.disconnect(); shared?.listeners.delete(root); root.replaceChildren(); root.classList.remove('channel-playground', 'cp-lecture');}};
}
// Explicitly grouped lecture blocks share this channel's parameters.
// Unmarked blocks keep the independent-instance behavior.
const groups = new Map();
document.querySelectorAll('[data-channel-playground]').forEach(root => {
  const name = root.dataset.channelGroup;
  if (name && !groups.has(name)) groups.set(name, {parameters: model.defaults(), listeners: new Map()});
  mountChannelPlayground(root, {sharedState: name ? groups.get(name) : undefined});
});
