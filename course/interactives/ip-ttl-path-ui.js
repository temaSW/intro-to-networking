import {NODES, packetJourney, traceJourney} from './ip-ttl-path-model.js';

export function mountPath(root) {
  const get = key => root.querySelector(`[data-path-${key}]`);
  const trace = root.dataset.ipPathDemo === 'trace';
  const play = get('play'), step = get('step'), packet = get('packet');
  const range = get('range'), number = get('number');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let events, index, current, flight = null, running = false, frame = 0, previous = null, dwell = 0;
  const duration = trace ? 360 : 650;
  function draw() {
    let position = current.to;
    if (flight && !reduced.matches) {
      const t = Math.min(1, flight.elapsed / duration), smooth = t * t * (3 - 2 * t);
      position = flight.event.from + (flight.event.to - flight.event.from) * smooth;
    }
    packet.setAttribute('transform', `translate(${80 + position * 160} 75)`);
    const shown = flight ? flight.event : current;
    get('label').textContent = shown.label;
    get('badge').textContent = flight && !shown.reply ? `TTL = ${shown.sentTTL}` : shown.badge;
    packet.classList.toggle('ip-ttl-dropped', !flight && !!current.dropped);
    packet.classList.toggle('ip-path-reply', !!shown.reply);
    for (const node of root.querySelectorAll('[data-path-node]')) node.classList.toggle('ip-current', !flight && Number(node.dataset.pathNode) === current.to);
    play.textContent = running ? 'Пауза' : 'Запуск';
    play.disabled = step.disabled = index >= events.length;
  }
  function pause() { running = false; cancelAnimationFrame(frame); previous = null; draw(); }
  function complete(event) {
    current = event; index++; flight = null; dwell = 0;
    get('status').textContent = event.status;
    if (event.record) {
      const {ttl, probe, responder, response} = event.record;
      root.querySelector(`[data-path-result="${ttl}-${probe}"]`).textContent = '✓';
      root.querySelector(`[data-path-responder="${ttl}"]`).textContent = `${responder} · ${response}`;
    }
    if (index === events.length) pause();
    draw();
  }
  function tick(now) {
    if (!running) return;
    if (!root.isConnected) {pause(); return;}
    const dt = previous === null ? 0 : Math.min(100, now - previous); previous = now;
    if (flight) {
      flight.elapsed += dt;
      if (flight.elapsed >= duration) complete(flight.event);
    } else {
      dwell += dt;
      if (dwell >= (current.from === current.to ? 500 : 180)) {
        const event = events[index];
        if (event.from === event.to) complete(event);
        else flight = {event, elapsed: 0};
        dwell = 0;
      }
    }
    draw();
    if (running) frame = requestAnimationFrame(tick);
  }
  function reset() {
    running = false; cancelAnimationFrame(frame); previous = null; flight = null; dwell = 0;
    events = trace ? traceJourney() : packetJourney(Number(range.value)); index = 0;
    current = {from: 0, to: 0, label: trace ? 'Echo Request' : 'Пакет к B', badge: `TTL = ${trace ? 1 : range.value}`};
    for (const cell of root.querySelectorAll('[data-path-result], [data-path-responder]')) cell.textContent = '—';
    if (number) number.value = range.value;
    get('status').textContent = trace ? 'A готов начать трассировку: первый запрос к B с TTL 1.' : `A готов отправить пакет к B с TTL ${range.value}.`;
    draw();
  }
  play.addEventListener('click', () => {
    if (running) {pause(); return;}
    if (index >= events.length) return;
    running = true; previous = null; draw(); frame = requestAnimationFrame(tick);
  });
  step.addEventListener('click', () => {pause(); if (index < events.length) complete(flight ? flight.event : events[index]);});
  get('reset').addEventListener('click', reset);
  if (range) {
    range.addEventListener('input', reset);
    number.addEventListener('input', () => {if (number.validity.valid && number.value !== '') {range.value = number.value; reset();}});
    number.addEventListener('change', () => {if (number.validity.valid && number.value !== '') range.value = number.value; reset();});
  }
  const expand = get('expand');
  if (root.requestFullscreen) {
    expand.hidden = false;
    expand.addEventListener('click', async () => {
      try {if (document.fullscreenElement === root) await document.exitFullscreen(); else await root.requestFullscreen();}
      catch {get('status').textContent = 'Полноэкранный режим недоступен. Управление доступно в обычном виде.';}
    });
    document.addEventListener('fullscreenchange', () => {expand.textContent = document.fullscreenElement === root ? 'Обычный вид' : 'На весь экран';});
  }
  document.addEventListener('visibilitychange', () => {if (document.hidden) pause();});
  get('controls').hidden = false; reset();
}

document.querySelectorAll('[data-ip-path-demo]').forEach(mountPath);
