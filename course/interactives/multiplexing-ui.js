import {compare, stateAt} from './multiplexing-model.js';

const number = value => value === null ? 'нет завершённых пакетов' : value.toLocaleString('ru-RU', {maximumFractionDigits: 2});
const plural = new Intl.PluralRules('ru');
const packetCount = value => `${number(value)} ${{one:'пакет',few:'пакета',many:'пакетов',other:'пакета'}[plural.select(value)]}`;
const sourceName = source => source < 4 ? ['А', 'Б', 'В', 'Г'][source] : String(source + 1);
const token = (source, sequence = '') => `<span class="mux-token mux-source-${source % 4}">${sourceName(source)}${sequence !== '' && source >= 4 ? '·' : ''}${sequence}</span>`;
const packets = jobs => jobs.length ? jobs.slice(0, 8).map(job => token(job.source, job.sequence)).join('') + (jobs.length > 8 ? `<span>+${jobs.length - 8}</span>` : '') : '<span class="mux-empty">пусто</span>';

const activeSources = (config, time) => Array.from({length:config.flows}, (_, source) => source).filter(source => {
  const phase = config.pattern === 'synchronous' ? 0 : Math.floor(source * 100 / config.flows);
  return (time + phase) % 100 < config.activity;
});

function cause(config, state, time, dedicated) {
  const active = activeSources(config, time);
  const rate = dedicated ? config.capacity / config.flows : config.capacity;
  let explanation;
  if (dedicated) {
    const source = state.waiting[0]?.source ?? active[0] ?? state.transmitting[0]?.source;
    if (source === undefined) {
      explanation = 'Сейчас источники не создают пакетов, ожидающих и передаваемых пакетов нет. Выделенные доли простаивают.';
    } else if (!active.includes(source)) {
      explanation = `Источник ${sourceName(source)} сейчас молчит, но его ранее поступившие пакеты ещё передаются со скоростью ${number(rate)} Мбит/с. Пауза в поступлении не означает, что накопленные данные уже переданы.`;
    } else if (rate < 1) {
      explanation = `У ${sourceName(source)} пакет появляется каждые <strong>1 мс</strong>, а его передача занимает <strong>около ${number(1 / rate)} мс</strong>. Пакеты приходят быстрее, чем уходят; лишние ждут в очереди или теряются, если места нет.`;
    } else {
      explanation = `У ${sourceName(source)} новый пакет появляется каждые <strong>1 мс</strong>, а передача занимает <strong>${number(1 / rate)} мс</strong>. Его выделенная доля успевает обслуживать поступающие пакеты.`;
    }
    const unused = config.capacity - state.transmitting.length * rate;
    if (state.waiting.length && unused > 1e-9) {
      explanation += ` <strong>Свободны ${number(unused)} Мбит/с других долей, но ожидающие пакеты не могут их использовать:</strong> каждая доля закреплена только за своим источником.`;
    }
  } else if (active.length > config.capacity) {
    explanation = `За 1 мс активные источники создают <strong>${packetCount(active.length)}</strong>, а выход может передать <strong>${packetCount(config.capacity)}</strong>. Поступает больше, чем успевает уйти: избыток ожидает в очереди, а при полном буфере отбрасывается.`;
  } else if (active.length === 1 && config.capacity === 1) {
    explanation = `Каждую 1 мс поступает один пакет, и его передача занимает 1 мс. ${state.waiting.length ? 'Ранее накопленная очередь сохраняется: свободной скорости для её сокращения нет.' : 'Выход заканчивает предыдущий пакет к приходу следующего; очередь не накапливается.'}`;
  } else if (active.length === config.capacity) {
    explanation = `За 1 мс поступает <strong>${packetCount(active.length)}</strong>, и выход может передать столько же. Но одновременное поступление не означает одновременную передачу: выход передаёт пакеты по одному, поэтому часть пакетов кратковременно ожидает.`;
  } else if (active.length) {
    explanation = `За 1 мс поступает <strong>${packetCount(active.length)}</strong>, а выход может передать <strong>${packetCount(config.capacity)}</strong>. ${state.waiting.length ? 'Ресурса хватает и на новые пакеты, и на передачу части ранее накопленной очереди.' : `Один пакет занимает выход на <strong>${number(1 / rate)} мс</strong>; между поступлениями выход успевает освобождаться.`}`;
  } else {
    explanation = state.waiting.length || state.transmitting.length ? 'Новые пакеты сейчас не поступают. Выход передаёт оставшиеся данные; после их передачи он освободится.' : 'Новые пакеты сейчас не поступают, накопленной очереди нет. Выход свободен.';
  }
  return `<div class="mux-cause"><p class="mux-cause-title">Почему получается такое состояние?</p><p>${explanation}</p></div>`;
}

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
  return `<div class="mux-lane${job ? ' mux-lane-busy' : ''}"><div class="mux-lane-fill" style="width:${progress}%"></div><span>${job ? `${token(job.source, job.sequence)} передаётся` : idle}</span><small>${number(rate)} Мбит/с · ${number(1 / rate)} мс на пакет</small></div>`;
}

function scene(config, data, time, mode) {
  const state = stateAt(data, time);
  const dedicated = mode === 'dedicated';
  const rate = dedicated ? config.capacity / config.flows : config.capacity;
  const used = state.transmitting.length * rate;
  const rows = dedicated ? Array.from({length:config.flows}, (_, source) => {
    const queue = state.waiting.filter(job => job.source === source);
    const limit = Math.floor(config.buffer / config.flows) + (source < config.buffer % config.flows ? 1 : 0);
    return `<div class="mux-resource-row"><div class="mux-source-name">${token(source)}</div><div class="mux-queue${queue.length === limit && limit > 0 ? ' mux-queue-full' : ''}"><div class="mux-packets">${packets(queue)}</div><small>${queue.length} / ${limit} мест</small></div><span aria-hidden="true">→</span>${lane(state.transmitting.find(job => job.source === source), rate, time, `Только для ${sourceName(source)}; простой`)}</div>`;
  }).join('') : `<div class="mux-shared-path"><div class="mux-source-list">${Array.from({length:config.flows}, (_, source) => token(source)).join('')}<span>→ одна очередь</span></div><div class="mux-queue${state.waiting.length === config.buffer && config.buffer > 0 ? ' mux-queue-full' : ''}"><div class="mux-packets">${packets(state.waiting)}</div><small>${state.waiting.length} / ${config.buffer} мест; первым передаётся пакет слева</small></div><div class="mux-path-arrow" aria-hidden="true">↓</div>${lane(state.transmitting[0], rate, time, 'Выход свободен')}</div>`;
  return `<section class="mux-scene"><h4>${dedicated ? 'Закреплённые доли' : 'Общий выход'}</h4><p class="mux-scene-rule">${dedicated ? `У каждого источника своя очередь и ${number(rate)} Мбит/с. Чужую долю занять нельзя.` : `Одна очередь для всех. Каждый пакет передаётся со скоростью ${number(rate)} Мбит/с.`}</p>
    ${cause(config, state, time, dedicated)}
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
    const active = activeSources(config, time);
    root.querySelector('[data-input-rate]').innerHTML = `<strong>Сейчас создают пакеты: ${active.length ? active.map(sourceName).join(', ') : 'никто'}.</strong> Суммарная скорость поступления -- ${active.length} Мбит/с; полная скорость выхода -- ${number(config.capacity)} Мбит/с. При закреплённых долях одному источнику доступны только ${number(config.capacity / config.flows)} Мбит/с.`;
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
