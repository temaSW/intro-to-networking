import { createTCP, advanceTCP, tcpMetrics, CAPACITY } from './security-tcp-model.js';
import { udpReflection } from './security-udp-model.js';

for (const root of document.querySelectorAll('[data-security-tcp]')) {
  if (root.dataset.ready) continue;
  root.dataset.ready = 'true';
  const get = key => root.querySelector(`[data-tcp="${key}"]`);
  let state = createTCP(), timer = null;
  const cells = Array.from({ length: CAPACITY }, () => {
    const cell = document.createElement('span'); cell.className = 'st-slot'; cell.setAttribute('aria-hidden', 'true');
    get('slots').append(cell); return cell;
  });
  function stop() {
    if (timer !== null) clearInterval(timer);
    timer = null; get('play').disabled = false; get('pause').disabled = true; get('step').disabled = false;
  }
  function render() {
    const metrics = tcpMetrics(state), entries = state.pending.filter(item => item.slot);
    get('time').textContent = `${state.time} с`;
    get('used').textContent = `${metrics.used} / ${CAPACITY}`;
    get('used').classList.toggle('st-alert', metrics.used === CAPACITY);
    get('rate-label').textContent = state.config.rate;
    for (const key of ['syn', 'synAck', 'ack', 'expired', 'rejected', 'established']) get(key).textContent = state.recent[key];
    get('load').textContent = `${metrics.kbps.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} кбит/с`;
    get('channel').value = metrics.kbps;
    cells.forEach((cell, i) => {
      cell.className = 'st-slot';
      if (entries[i]) cell.classList.add(entries[i].completeAt === null ? 'st-slot-waits' : 'st-slot-completes');
    });
    get('slots').setAttribute('aria-label', `Занято ${metrics.used} из ${CAPACITY} записей`);
    get('probe').textContent = state.probe;
    get('probe-count').textContent = `Установлено: ${state.probeOK} · Не принято: ${state.probeFailed}`;
  }
  function tick() { state = advanceTCP(state); render(); }
  function reset() {
    stop(); state = createTCP({ rate: get('rate').value, complete: get('complete').value,
      timeout: get('timeout').value, protected: get('protection').checked }); render();
  }
  for (const key of ['rate', 'complete', 'timeout']) {
    const range = get(key), number = get(`${key}-number`);
    range.addEventListener('input', () => { number.value = range.value; reset(); });
    number.addEventListener('input', () => {
      if (!number.validity.valid || number.value === '') return;
      range.value = number.value; reset();
    });
    number.addEventListener('change', () => { number.value = range.value; });
  }
  get('protection').addEventListener('change', reset);
  get('step').addEventListener('click', tick);
  get('play').addEventListener('click', () => {
    if (timer !== null) return;
    get('play').disabled = true; get('pause').disabled = false; get('step').disabled = true;
    timer = setInterval(tick, 1000);
  });
  get('pause').addEventListener('click', stop);
  get('reset').addEventListener('click', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  const disclosure = root.closest('details');
  if (disclosure) disclosure.addEventListener('toggle', () => { if (!disclosure.open) stop(); });
  root.querySelector('[data-st-controls]').hidden = false;
  render();
}

let instance = 0;
for (const root of document.querySelectorAll('[data-security-udp]')) {
  if (root.dataset.ready) continue;
  root.dataset.ready = 'true';
  const get = key => root.querySelector(`[data-udp="${key}"]`);
  let step = 0;
  const id = `st-udp-arrow-${++instance}`;
  get('marker').id = id;
  root.querySelectorAll('[data-st-arrow]').forEach(path => path.setAttribute('marker-end', `url(#${id})`));
  function render() {
    const state = udpReflection(step, get('services').value);
    for (const name of ['request', 'response', 'multiple']) get(name).toggleAttribute('hidden', !state[name]);
    get('title').textContent = `${step + 1} / 4 · ${state.title}`;
    get('service-label').textContent = step === 3 ? `Служб: ${state.services}` : 'Одна служба';
    get('load').textContent = `${state.victimKbps} кбит/с`;
    get('status').textContent = step < 2 ? 'Ответы ещё не отправлены'
      : state.victimKbps > state.capacityKbps ? 'Нагрузка выше ёмкости' : 'Нагрузка не выше ёмкости';
    get('status').classList.toggle('st-alert', state.victimKbps > state.capacityKbps);
    get('explanation').textContent = state.explanation;
    get('previous').disabled = step === 0; get('next').disabled = step === 3;
  }
  get('previous').addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
  get('next').addEventListener('click', () => { step = Math.min(3, step + 1); render(); });
  get('reset').addEventListener('click', () => { step = 0; render(); });
  get('services').addEventListener('input', () => { get('services-number').value = get('services').value; render(); });
  get('services-number').addEventListener('input', () => {
    const number = get('services-number');
    if (!number.validity.valid || number.value === '') return;
    get('services').value = number.value; render();
  });
  get('services-number').addEventListener('change', () => { get('services-number').value = get('services').value; });
  root.querySelector('[data-st-controls]').hidden = false;
  render();
}
