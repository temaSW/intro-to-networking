import {compare, stateAt} from './multiplexing-model.js';

const number = value => value === null ? 'нет завершённых пакетов' : value.toLocaleString('ru-RU', {maximumFractionDigits: 2});
const sourceName = source => source < 4 ? ['А', 'Б', 'В', 'Г'][source] : String(source + 1);
const token = (source, sequence = '') => `<span class="mux-token mux-source-${source % 4}">${sourceName(source)}${sequence !== '' && source >= 4 ? '·' : ''}${sequence}</span>`;
const packets = jobs => jobs.length ? jobs.slice(0, 8).map(job => token(job.source, job.sequence)).join('') + (jobs.length > 8 ? `<span>+${jobs.length - 8}</span>` : '') : '<span class="mux-empty">пусто</span>';

function activitySvg(config, time) {
  const height = 62 + config.flows * 28;
  const rects = Array.from({length: config.flows}, (_, source) => {
    const phase = config.pattern === 'synchronous' ? 0 : Math.floor(source * 100 / config.flows);
    const bands = [];
    for (let t = 0; t < 100; t++) if ((t + phase) % 100 < config.activity) {
      bands.push(`<rect x="${80 + t * 6}" y="${35 + source * 28}" width="6.1" height="18" class="mux-band mux-source-${source % 4}"/>`);
    }
    return `<text x="10" y="${49 + source * 28}" class="mux-label">${sourceName(source)}</text><path d="M80 ${44 + source * 28} H680" class="mux-axis"/>${bands.join('')}`;
  }).join('');
  return `<svg viewBox="0 0 720 ${height}" role="img" aria-label="Передача источников в первые 100 миллисекунд. Заполненная полоса означает поступление данных; вертикальная линия показывает выбранный момент."><text x="10" y="20" class="mux-label">Источник</text>${rects}
    <path d="M${80 + time * 6} 28 V${height - 25}" class="mux-cursor"/>
    ${[0,25,50,75,100].map(t => `<text x="${80 + t * 6}" y="${height - 5}" class="mux-label" text-anchor="middle">${t}</text>`).join('')}
    <text x="690" y="20" class="mux-label" text-anchor="end">Время, мс</text></svg>`;
}

function lane(job, rate, time, idle) {
  const progress = job ? Math.max(0, Math.min(100, (time - job.start) / (job.finish - job.start) * 100)) : 0;
  return `<div class="mux-lane${job ? ' mux-lane-busy' : ''}"><div class="mux-lane-fill" style="width:${progress}%"></div><span>${job ? `${token(job.source, job.sequence)} передаётся` : idle}</span><small>${number(rate)} Мбит/с</small></div>`;
}

function scene(config, data, time, mode) {
  const state = stateAt(data, time);
  const dedicated = mode === 'dedicated';
  const rate = dedicated ? config.capacity / config.flows : config.capacity;
  const used = state.transmitting.length * rate;
  const rows = dedicated ? Array.from({length:config.flows}, (_, source) => {
    const queue = state.waiting.filter(job => job.source === source);
    const limit = Math.floor(config.buffer / config.flows) + (source < config.buffer % config.flows ? 1 : 0);
    return `<div class="mux-resource-row"><div class="mux-source-name">${token(source)}</div><div class="mux-queue${queue.length === limit && limit > 0 ? ' mux-queue-full' : ''}"><div class="mux-packets">${packets(queue)}</div><small>${queue.length} / ${limit} мест</small></div><span aria-hidden="true">→</span>${lane(state.transmitting.find(job => job.source === source), rate, time, 'Простой')}</div>`;
  }).join('') : `<div class="mux-shared-path"><div class="mux-source-list">${Array.from({length:config.flows}, (_, source) => token(source)).join('')}<span>→ одна очередь</span></div><div class="mux-queue${state.waiting.length === config.buffer && config.buffer > 0 ? ' mux-queue-full' : ''}"><div class="mux-packets">${packets(state.waiting)}</div><small>${state.waiting.length} / ${config.buffer} мест; первым передаётся пакет слева</small></div><div class="mux-path-arrow" aria-hidden="true">↓</div>${lane(state.transmitting[0], rate, time, 'Выход свободен')}</div>`;
  return `<section class="mux-scene"><h4>${dedicated ? 'Закреплённые доли' : 'Общий выход'}</h4><p class="mux-scene-rule">${dedicated ? `У каждого источника своя очередь и ${number(rate)} Мбит/с. Чужую долю занять нельзя.` : `Одна очередь для всех. Каждый пакет передаётся со скоростью ${number(rate)} Мбит/с.`}</p>
    <div class="mux-machine" tabindex="0" role="region" aria-label="${dedicated ? 'Очереди и выделенные доли' : 'Общая очередь и выход'}">${dedicated ? '<div class="mux-resource-head"><span>Вход</span><span>Очередь →</span><span>Передача</span></div>' : ''}${rows}</div>
    <p class="mux-instant">Сейчас используется <strong>${number(used)} из ${number(config.capacity)} Мбит/с</strong></p><div class="mux-use" role="img" aria-label="Используется ${number(used)} из ${number(config.capacity)} Мбит/с"><span style="width:${used / config.capacity * 100}%"></span></div>
    <dl class="mux-counts"><div><dt>Передано</dt><dd>${state.sent}</dd></div><div><dt>В очереди</dt><dd>${state.waiting.length}</dd></div><div><dt>Потеряно</dt><dd>${state.rejected.length}</dd></div></dl></section>`;
}

export function mountMultiplexing(root) {
  const fields = [...root.querySelectorAll('[data-parameter]')];
  const timeRange = root.querySelector('[data-time-range]');
  const timeInput = root.querySelector('[data-time-input]');
  const play = root.querySelector('[data-play]');
  let config, data, timer = null;
  const stop = () => { clearInterval(timer); timer = null; play.textContent = 'Воспроизвести'; play.setAttribute('aria-pressed', 'false'); };
  const showMoment = () => {
    const time = Number(timeInput.value);
    timeRange.value = time;
    root.querySelector('[data-time-value]').textContent = number(time);
    root.querySelector('[data-activity]').innerHTML = activitySvg(config, time);
    root.querySelector('[data-scenes]').innerHTML = scene(config, data.dedicated, time, 'dedicated') + scene(config, data.shared, time, 'shared');
  };
  const setTime = value => { timeInput.value = Math.max(0, Math.min(100, value)); showMoment(); };
  const update = () => {
    stop();
    config = Object.fromEntries(fields.map(field => [field.dataset.parameter, field.tagName === 'SELECT' ? field.value : Number(field.value)]));
    fields.forEach(field => {
      const output = root.querySelector(`[data-value="${field.dataset.parameter}"]`);
      if (output) output.textContent = field.value;
      const input = root.querySelector(`[data-number="${field.dataset.parameter}"]`);
      if (input) input.value = field.value;
    });
    data = compare(config);
    // The detailed totals retain the original one-second observation window.
    root.querySelector('[data-results]').innerHTML = `<p>За 1 с поступило ${data.shared.offered} пакетов. Средняя входная нагрузка: ${number(data.shared.offered / 1000)} Мбит/с; скорость выхода: ${number(config.capacity)} Мбит/с.</p><div class="mux-scroll" tabindex="0" role="region" aria-label="Результаты за одну секунду"><table><thead><tr><th>За 1 с</th><th>Закреплённые доли</th><th>Общий выход</th></tr></thead><tbody>${[
      ['Передано пакетов', data.dedicated.sent, data.shared.sent],
      ['Осталось в системе', data.dedicated.pending, data.shared.pending],
      ['Потеряно пакетов', data.dedicated.lost, data.shared.lost],
      ['Потери от поступивших, %', ...Object.values(data).map(d => number(d.offered ? d.lost / d.offered * 100 : 0))],
      ['Использование выхода, %', ...Object.values(data).map(d => number(d.utilization * 100))],
      ['Среднее ожидание переданных, мс', ...Object.values(data).map(d => number(d.wait))],
      ['Средняя задержка переданных, мс', ...Object.values(data).map(d => number(d.delay))],
    ].map(row => `<tr><th scope="row">${row[0]}</th><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('')}</tbody></table></div>`;
    const line = (samples, cls) => `<polyline class="${cls}" points="${samples.map(s => `${55 + s.t * .62},${230 - s.queue * 200 / 240}`).join(' ')}"/>`;
    root.querySelector('[data-plot]').innerHTML = `<svg viewBox="0 0 720 285" role="img" aria-label="Суммарная очередь за одну секунду, шкала от нуля до 240 пакетов"><path class="mux-axis" d="M55 30 V230 H680 M55 130 H680 M55 30 H680"/><g class="mux-label"><text x="55" y="20">Очередь, пакеты</text><text x="17" y="234">0</text><text x="10" y="134">120</text><text x="10" y="36">240</text><text x="55" y="252">0</text><text x="345" y="252">500</text><text x="642" y="252">1000</text><text x="525" y="277">Время, мс</text></g>${line(data.dedicated.samples, 'mux-reserved')}${line(data.shared.samples, 'mux-shared')}</svg>`;
    root.querySelector('[data-sample-table]').innerHTML = `<table><thead><tr><th>Время, мс</th><th>Очередь: доли</th><th>Очередь: общий выход</th></tr></thead><tbody>${data.shared.samples.filter((_, i) => i % 10 === 0).map((s, i) => `<tr><td>${s.t}</td><td>${data.dedicated.samples[i * 10].queue}</td><td>${s.queue}</td></tr>`).join('')}</tbody></table>`;
    setTime(12.25);
  };
  fields.forEach(field => field.addEventListener('input', update));
  root.querySelectorAll('[data-number]').forEach(input => input.addEventListener('input', () => {
    const field = fields.find(field => field.dataset.parameter === input.dataset.number);
    const value = Number(input.value);
    if (input.value === '' || !Number.isFinite(value) || !input.checkValidity()) return;
    field.value = input.value; update();
  }));
  timeRange.addEventListener('input', () => { stop(); setTime(Number(timeRange.value)); });
  timeInput.addEventListener('input', () => { if (timeInput.value !== '' && timeInput.checkValidity()) { stop(); setTime(Number(timeInput.value)); } });
  timeInput.addEventListener('change', () => { stop(); setTime(Number(timeInput.value) || 0); });
  root.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => { stop(); setTime(Number(timeInput.value) + Number(button.dataset.step)); }));
  root.querySelector('[data-reset]').addEventListener('click', () => { stop(); setTime(0); });
  play.addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (Number(timeInput.value) >= 100) setTime(0);
    play.textContent = 'Пауза'; play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => { if (!root.isConnected) { stop(); return; } setTime(Number(timeInput.value) + .25); if (Number(timeInput.value) >= 100) stop(); }, 100);
  });
  update();
}

document.querySelectorAll('[data-multiplexing]').forEach(mountMultiplexing);
