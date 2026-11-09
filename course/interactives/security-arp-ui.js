import { arpState, LAST_STEP } from './security-arp-model.js';

let instance = 0;
for (const root of document.querySelectorAll('[data-security-arp]')) {
  if (root.dataset.ready) continue;
  root.dataset.ready = 'true';
  const find = name => root.querySelector(`[data-arp="${name}"]`);
  const markerId = `security-arp-arrow-${++instance}`;
  find('marker').id = markerId;
  find('description').id = `${markerId}-description`;
  root.querySelector('svg').setAttribute('aria-describedby', find('description').id);
  root.querySelectorAll('[data-arp-arrow]').forEach(path => path.setAttribute('marker-end', `url(#${markerId})`));
  let step = 0;
  let view = 'network';
  const entryNotes = [
    'Эта запись определяет получателя кадра S → G.',
    'X объявил MAC X, но на S ещё хранится MAC G. Сообщение само по себе запись не заменяет.',
    'По условиям примера S принял сообщение: MAC G заменён на MAC X.',
    'S использует MAC X из этой записи. Конечный IP-адрес пакета -- R.',
    'На S по-прежнему MAC X. Действие X не меняет таблицу на S.',
  ];
  function render() {
    const state = arpState(step, find('action').value);
    find('title').textContent = `${state.step + 1} / ${LAST_STEP + 1} · ${state.title}`;
    find('explanation').textContent = state.explanation;
    find('mapping').textContent = state.mapping;
    find('entry-note').textContent = entryNotes[step];
    find('entry').classList.toggle('arp-entry-linked', view === 'exchange' && step < LAST_STEP);
    for (const name of ['network', 'exchange']) find(name).hidden = view !== name;
    root.querySelectorAll('[data-arp-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.arpView === view));
    });
    root.querySelectorAll('[data-arp-event]').forEach(button => {
      const selected = Number(button.dataset.arpEvent) === step;
      button.setAttribute('aria-current', selected ? 'step' : 'false');
      button.classList.toggle('arp-event-current', selected);
      button.classList.toggle('arp-event-past', Number(button.dataset.arpEvent) < step);
    });
    root.querySelector('[data-arp-event="4"]').classList.toggle('arp-event-drop', find('action').value === 'drop');
    find('last-event').textContent = find('action').value === 'drop' ? 'X отбрасывает пакет' : 'X передаёт кадр шлюзу';
    find('last-detail').textContent = find('action').value === 'drop' ? 'Локальное действие на X; кадр к G не создан' : 'По корректной записи на X';
    find('entry').classList.toggle('arp-entry-changed', state.accepted);
    for (const name of ['direct', 'message', 'toX', 'toG', 'dropped']) {
      find(name).toggleAttribute('hidden', !state[name]);
    }
    find('path').textContent = state.path ? `Путь данных: ${state.path}` : 'Сейчас меняются сведения для локальной доставки';
    find('description').textContent = `${state.explanation} В таблице S: IP G → ${state.mapping}. Конечный адрес IP-пакета -- R.`;
    find('previous').disabled = step === 0;
    find('next').disabled = step === LAST_STEP;
    find('action').disabled = step < 3;
  }
  root.querySelectorAll('[data-arp-view]').forEach(button => {
    button.addEventListener('click', () => { view = button.dataset.arpView; render(); });
  });
  root.querySelectorAll('[data-arp-event]').forEach(button => {
    button.addEventListener('click', () => { step = Number(button.dataset.arpEvent); render(); });
  });
  find('views').hidden = false;
  find('previous').addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
  find('next').addEventListener('click', () => { step = Math.min(LAST_STEP, step + 1); render(); });
  find('reset').addEventListener('click', () => { step = 0; find('action').value = 'forward'; render(); });
  find('action').addEventListener('change', render);
  root.querySelector('[data-arp-controls]').hidden = false;
  render();
}
