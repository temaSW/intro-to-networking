import { createApplication, advanceApplication, APP_DURATION } from './security-app-model.js';

const NS = 'http://www.w3.org/2000/svg';
document.querySelectorAll('[data-security-app]').forEach(root => {
  const get = key => root.querySelector(`[data-app="${key}"]`);
  let state = createApplication(), timer = null, busy = false, animations = [], generation = 0;
  const slot = index => 678 - index * 22;
  function dot(id, x, y, refused = false) {
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', x); circle.setAttribute('cy', y); circle.setAttribute('r', 8);
    circle.setAttribute('class', `aq-dot${refused ? ' aq-refused' : ''}`);
    const title = document.createElementNS(NS, 'title'); title.textContent = `Запрос ${id}`; circle.append(title);
    return circle;
  }
  function buttons() {
    get('step').disabled = busy || state.time >= APP_DURATION;
    get('play').disabled = state.time >= APP_DURATION;
    get('play').textContent = timer ? 'Пауза' : 'Запуск';
    get('play').setAttribute('aria-pressed', String(Boolean(timer)));
  }
  function paint() {
    const protect = get('protect').checked;
    root.dataset.protected = protect;
    get('time').textContent = `${state.time} / ${APP_DURATION} с`;
    get('gateLabel').textContent = protect ? 'Вход с ограничением' : 'Вход открыт';
    get('completed').textContent = state.completed;
    get('rejectedLabel').textContent = `Отказано: ${state.rejected}`;
    get('rejectPath').toggleAttribute('hidden', !protect);
    get('queueLabel').textContent = state.waiting.length ? `Очередь: ${state.waiting.length}` : 'Очередь пуста';
    get('queueDetail').textContent = state.waiting.length ? (protect && state.waiting.length > 2 ? 'Сначала разбирается ранее принятый избыток' : 'Ждут, пока сервер освободится') : 'Никто не ждёт';
    get('waiting').replaceChildren(...state.waiting.map((id, i) => dot(id, slot(i), 155)));
    get('status').textContent = !state.time ? 'Очередь пуста. «Показать одну секунду» отправит три запроса к серверу.'
      : `Пришли 3 запроса. Сервер обработал 2. ${state.refused.length ? `Получили отказ: ${state.refused.length}. ` : ''}Сейчас ждут: ${state.waiting.length}.`;
    if (state.time === APP_DURATION) get('status').textContent += ' Показаны 20 секунд; «К началу» начнёт новый опыт.';
    buttons();
  }
  function stop() {
    clearInterval(timer); timer = null;
    animations.forEach(animation => { try { animation.finish(); } catch {} });
    buttons();
  }
  async function step() {
    if (busy || state.time >= APP_DURATION) return;
    const before = state;
    state = advanceApplication(state, get('protect').checked);
    paint();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { if (state.time === APP_DURATION) stop(); return; }
    busy = true; buttons();
    const run = ++generation;
    get('waiting').setAttribute('visibility', 'hidden');
    const ids = [...before.waiting, ...state.arrivals];
    animations = ids.map(id => {
      const previous = before.waiting.indexOf(id), incoming = previous < 0;
      const refused = state.refused.includes(id), waiting = state.waiting.indexOf(id);
      const x = incoming ? 108 : slot(previous);
      const endX = refused ? 208 : waiting >= 0 ? slot(waiting) : 764;
      const endY = refused ? 265 : 155;
      const circle = dot(id, 0, 0, refused); get('motion').append(circle);
      const keys = incoming ? [
        { transform: `translate(${x}px, 155px)`, opacity: 1, offset: 0 },
        { transform: 'translate(208px, 155px)', opacity: 1, offset: .35 },
        { transform: `translate(${endX}px, ${endY}px)`, opacity: waiting >= 0 ? 1 : 0, offset: 1 }
      ] : [
        { transform: `translate(${x}px, 155px)`, opacity: 1 },
        { transform: `translate(${endX}px, ${endY}px)`, opacity: waiting >= 0 ? 1 : 0 }
      ];
      return circle.animate(keys, { duration: 1050, delay: incoming ? state.arrivals.indexOf(id) * 100 : 0, fill: 'both', easing: 'ease-in-out' });
    });
    await Promise.allSettled(animations.map(animation => animation.finished));
    if (generation !== run) return;
    get('motion').replaceChildren(); get('waiting').removeAttribute('visibility'); animations = []; busy = false;
    if (state.time === APP_DURATION) stop();
    buttons();
  }
  get('step').addEventListener('click', step);
  get('play').addEventListener('click', () => { if (timer) stop(); else { timer = setInterval(step, 1700); step(); buttons(); } });
  get('protect').addEventListener('change', () => { stop(); paint(); });
  get('reset').addEventListener('click', () => {
    stop(); generation++; animations = []; busy = false; get('motion').replaceChildren(); get('waiting').removeAttribute('visibility'); state = createApplication(); paint();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  root.querySelector('[data-app-controls]').hidden = false;
  root.dataset.ready = 'true'; paint();
});
