import { tcpStory } from './security-tcp-story-model.js';

for (const root of document.querySelectorAll('[data-tcp-story]')) {
  if (root.dataset.ready) continue;
  root.dataset.ready = 'true';
  const get = key => root.querySelector(`[data-ts="${key}"]`);
  let scene = 0, step = 0;
  const records = Array.from({ length: 6 }, () => {
    const record = document.createElement('span'); record.className = 'ts-record';
    get('records').append(record); return record;
  });
  function render() {
    const state = tcpStory(scene, step);
    root.querySelectorAll('[data-ts-scene]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.tsScene) === scene)));
    get('counter').textContent = `Шаг ${step + 1} / ${state.length}`;
    get('previous').disabled = step === 0;
    get('next').disabled = step === state.length - 1;
    get('client').textContent = scene === 2 ? 'Новые попытки' : scene === 3 ? (step < 2 ? 'Клиенты без подтверждения' : 'Обычный клиент') : 'Один клиент';
    get('single').hidden = scene === 2 || (scene === 3 && step < 2);
    for (const name of ['syn', 'synAck', 'ack', 'missing', 'burst']) get(name).hidden = !state[name];
    // One current event on the exchange, rather than the whole accumulated transcript.
    if (state.ack || state.missing || state.expired) { get('syn').hidden = true; get('synAck').hidden = true; }
    else if (state.synAck) get('syn').hidden = true;
    if (scene === 3 && step >= 2) get('burst').hidden = true;
    get('missing').textContent = state.expired ? 'ACK не пришёл · срок ожидания истёк' : 'ACK не пришёл · запись остаётся до тайм-аута';
    get('probeBox').hidden = scene !== 2;
    get('probe').textContent = state.probe || '';
    get('probeBox').classList.toggle('ts-rejected', state.rejected);
    get('burstCount').textContent = `${state.protected ? 6 : state.used} начальных запросов SYN`;
    get('burstNote').textContent = state.protected ? 'Сервер ответил; ACK не пришли, но записей ожидания нет' : 'Сервер отвечает; завершающие ACK не приходят';
    get('burst').classList.toggle('ts-burst-compact', state.protected);
    get('replyNote').textContent = state.protected ? 'В ответе есть проверочная метка; хранить ожидание не нужно' : 'Ответ сервера';
    get('ackNote').textContent = state.checked ? 'Метка вернулась в подтверждении: сервер принимает соединение' : 'Завершение установления';
    get('establishedCount').textContent = state.established ? 'Да' : 'Пока нет';
    get('used').textContent = `${state.used} / 6`;
    get('used').classList.toggle('st-alert', state.used === 6);
    records.forEach((record, index) => {
      const occupied = index < state.used;
      record.classList.toggle('ts-occupied', occupied);
      record.textContent = occupied ? `Клиент ${index + 1}: ждём подтверждения` : 'Свободно';
    });
    get('records').setAttribute('aria-label', `Занято ${state.used} из шести записей`);
    get('tableNote').textContent = state.protected ? (state.established ? 'Клиент подключился; запись ожидания не понадобилась' : 'Ожидаем подтверждения без записи в этой таблице')
      : state.established ? 'Соединение установлено -- ожидание завершено'
      : state.expired ? 'Тайм-аут -- запись удалена'
      : state.used === 0 ? 'Все места свободны'
      : state.used === 6 ? 'Таблица заполнена'
      : 'Записи хранятся до ACK или тайм-аута';
    get('explanation').textContent = state.explanation;
    const nextActions = [
      ['Клиент просит соединение →', 'Сервер отвечает →', 'Клиент подтверждает →'],
      ['Клиент просит соединение →', 'Сервер отвечает →', 'Подтверждение не приходит →', 'Проходит 10 секунд →'],
      ['Две попытки без подтверждения →', 'Ещё две попытки →', 'Ещё две попытки →', 'Подключается обычный клиент →'],
      ['Шесть попыток без подтверждения →', 'Подключается обычный клиент →', 'Сервер отвечает с меткой →', 'Клиент возвращает подтверждение →']
    ];
    get('next').textContent = nextActions[scene][step] || 'Случай завершён';
  }
  root.querySelectorAll('[data-ts-scene]').forEach(button => button.addEventListener('click', () => { scene = Number(button.dataset.tsScene); step = 0; render(); }));
  get('next').addEventListener('click', () => { step = Math.min(tcpStory(scene, step).length - 1, step + 1); render(); });
  get('previous').addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
  get('reset').addEventListener('click', () => { step = 0; render(); });
  root.querySelectorAll('[data-ts-controls]').forEach(control => { control.hidden = false; });
  render();
}
