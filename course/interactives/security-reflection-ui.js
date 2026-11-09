import { udpReflection } from './security-udp-model.js';

document.querySelectorAll('[data-security-reflection]').forEach(root => {
  const get = key => root.querySelector(`[data-rf="${key}"]`);
  let step = 0;
  function render() {
    const state = udpReflection(step, get('count').value);
    root.dataset.step = step;
    get('counter').textContent = `${step + 1} / 4`;
    get('previous').disabled = step === 0; get('next').disabled = step === 3;
    get('next').textContent = ['Отправить запрос с чужим адресом →', 'Служба отправляет ответ →', 'Обратиться к нескольким службам →', 'Обмен показан'][step];
    get('event').textContent = [
      'Служба отправляет ответ по адресу источника, указанному в запросе.',
      'Нарушитель отправил запрос, но в адрес источника вписал адрес пострадавшего.',
      'Служба отправила большой ответ пострадавшему, хотя запрос создал нарушитель. Ответ нагружает канал пострадавшего.',
      `${state.services} служб отвечают одному пострадавшему: ответы складываются на его входном канале.`
    ][step];
    get('service').textContent = step === 3 ? `${state.services} служб` : 'Служба';
    get('received').textContent = step >= 2 ? 'Получает незапрошенные ответы' : 'Пока ответов нет';
    get('many').hidden = step !== 3;
    get('load').textContent = `По 10 запросов/с к каждой службе → ${state.victimKbps} кбит/с ответов к пострадавшему. Его канал: 400 кбит/с. ${state.victimKbps > 400 ? 'Направляемая нагрузка превышает ёмкость канала.' : 'Направляемая нагрузка не превышает ёмкость канала.'}`;
  }
  get('next').addEventListener('click', () => { step = Math.min(3, step + 1); render(); });
  get('previous').addEventListener('click', () => { step = Math.max(0, step - 1); render(); });
  get('reset').addEventListener('click', () => { step = 0; render(); });
  get('count').addEventListener('input', () => { get('count-number').value = get('count').value; render(); });
  get('count-number').addEventListener('input', () => { const n = get('count-number'); if (n.validity.valid && n.value) { get('count').value = n.value; render(); } });
  root.querySelector('[data-rf-controls]').hidden = false;
  root.dataset.ready = 'true'; render();
});
