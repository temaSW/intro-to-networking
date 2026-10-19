import {simulate, stateAt} from './multiplexing-model.js';

const milliseconds = value => `${value.toLocaleString('ru-RU')} мс`;
const events = [
  {time:0, text:'Поступил первый пакет А1. Пакет А2 появится в момент 1 мс.'},
  {time:.5, text:'Прошло 0,5 мс. До поступления А2 осталось ещё 0,5 мс.'},
  {time:1, text:'Поступил второй пакет А2. Где он находится в каждом варианте?'},
  {time:1.5, text:'После поступления А2 прошло 0,5 мс. Что ещё передаётся?'},
  {time:2, text:'С начала опыта прошло 2 мс. Какой пакет теперь занимает каждый выход?'},
  {time:4, text:'С начала опыта прошло 4 мс. Новых пакетов не поступало.'},
];
let instance = 0;

function timeline(results, time, id) {
  const x = t => 220 + t * 160;
  const transfer = (result, y) => result.accepted.filter(job => job.t <= time).map(job => `<rect class="mux-story-transfer" x="${x(job.start)}" y="${y}" width="${(job.finish - job.start) * 160}" height="40" rx="3"/><text x="${x(job.start) + 10}" y="${y + 26}" text-anchor="start" class="mux-story-packet-name">А${job.sequence}</text>`).join('');
  const waiting = (result, y) => result.accepted.filter(job => job.t <= time && job.start > job.t).map(job => `<rect class="mux-story-wait" fill="url(#${id})" x="${x(job.t)}" y="${y}" width="${(job.start - job.t) * 160}" height="40" rx="3"/><text x="${x(job.t) + 10}" y="${y + 26}" text-anchor="start" class="mux-story-packet-name">А${job.sequence}</text>`).join('');
  return `<svg viewBox="0 0 960 460" role="img" aria-label="Два пакета А на общей шкале от нуля до четырёх миллисекунд; выбран момент ${milliseconds(time)}"><title>Поступление, передача и ожидание двух пакетов</title>
    <defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2 L2 -2 M0 8 L8 0 M6 10 L10 6" class="mux-story-hatch"/></pattern></defs>
    ${Array.from({length:9}, (_, i) => i / 2).map(t => `<path d="M${x(t)} 112 V410" class="mux-story-grid"/><text x="${x(t)}" y="435" text-anchor="middle" class="mux-story-tick">${t.toLocaleString('ru-RU')}</text>`).join('')}
    <text x="14" y="60" class="mux-story-label">Поступление</text>
    ${[0,1].map((t, i) => `<g class="${time < t ? 'mux-story-future' : ''}"><rect x="${x(t) - 24}" y="30" width="48" height="32" rx="3" class="mux-story-transfer"/><text x="${x(t)}" y="52" text-anchor="middle" class="mux-story-packet-name">А${i + 1}</text><path d="M${x(t)} 66 V100 m-6 -7 l6 7 l6 -7" class="mux-story-arrival"/></g>`).join('')}
    <text x="14" y="155" class="mux-story-label">Доля А: 0,5 Мбит/с</text><text x="14" y="179" class="mux-story-tick">2 мс на пакет</text>
    <path d="M220 156 H860 M220 222 H860 M220 296 H860 M220 362 H860" class="mux-axis"/>
    ${transfer(results.dedicated, 136)}
    <text x="14" y="229" class="mux-story-label">Ожидание</text>${waiting(results.dedicated, 202)}
    <text x="14" y="295" class="mux-story-label">Общий выход: 2 Мбит/с</text><text x="14" y="319" class="mux-story-tick">0,5 мс на пакет</text>
    ${transfer(results.shared, 276)}
    <text x="14" y="369" class="mux-story-label">Ожидание</text>${waiting(results.shared, 342)}
    <text x="540" y="369" class="mux-story-tick" text-anchor="middle">очередь пуста</text>
    <path d="M${x(time)} 112 V410" class="mux-story-cursor"/><path d="M${x(time) - 6} 106 L${x(time)} 112 L${x(time) + 6} 106" class="mux-story-cursor"/>
    <text x="930" y="455" text-anchor="end" class="mux-story-tick">Время, мс</text>
  </svg>`;
}

function packetState(result, time, sequence) {
  const snapshot = stateAt(result, time);
  if (snapshot.waiting.some(job => job.sequence === sequence)) return {label:'В очереди', waiting:true};
  if (snapshot.transmitting.some(job => job.sequence === sequence)) return {label:'Передаётся'};
  if (result.accepted.some(job => job.sequence === sequence && job.finish <= time + 1e-9)) return {label:'Передан'};
  return {label:'Ещё не поступил'};
}

export function mountPacketStory(root) {
  const config = {flows:4, capacity:2, buffer:8};
  const trace = [{t:0,source:0,sequence:1}, {t:1,source:0,sequence:2}];
  const results = {dedicated:simulate(config,'dedicated',trace),shared:simulate(config,'shared',trace)};
  const id = `mux-packet-wait-${instance++}`;
  let step = 0;
  const next = root.querySelector('[data-story-next]');
  const back = root.querySelector('[data-story-back]');
  const reset = root.querySelector('[data-story-reset]');
  const render = () => {
    const {time, text} = events[step];
    root.querySelector('[data-story-time]').textContent = milliseconds(time);
    root.querySelector('[data-story-event]').textContent = text;
    root.querySelector('[data-story-plot]').innerHTML = timeline(results, time, id);
    root.querySelector('[data-story-states]').innerHTML = Object.entries(results).map(([mode, result]) => `<section><strong>${mode === 'dedicated' ? 'Закреплённая доля А' : 'Общий выход'}</strong><dl>${[1,2].map(sequence => {
      const state = packetState(result, time, sequence);
      return `<div${state.waiting ? ' class="mux-story-is-waiting"' : ''}><dt>А${sequence}</dt><dd>${state.label}</dd></div>`;
    }).join('')}</dl></section>`).join('');
    back.disabled = step === 0;
    reset.disabled = step === 0;
    next.disabled = step === events.length - 1;
  };
  next.addEventListener('click', () => { step = Math.min(step + 1, events.length - 1); render(); });
  back.addEventListener('click', () => { step = Math.max(step - 1, 0); render(); });
  reset.addEventListener('click', () => { step = 0; render(); });
  render();
}

document.querySelectorAll('[data-mux-story]').forEach(mountPacketStory);
