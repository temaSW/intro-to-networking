import {compare} from './multiplexing-model.js';

const number = value => value === null ? 'нет завершённых пакетов' : value.toLocaleString('ru-RU', {maximumFractionDigits: 2});
export function mountMultiplexing(root) {
  const fields = [...root.querySelectorAll('[data-parameter]')];
  const results = root.querySelector('[data-results]');
  const plot = root.querySelector('[data-plot]');
  const update = () => {
    const config = Object.fromEntries(fields.map(field => [field.dataset.parameter, field.tagName === 'SELECT' ? field.value : Number(field.value)]));
    fields.forEach(field => {
      const output = root.querySelector(`[data-value="${field.dataset.parameter}"]`);
      if (output) output.textContent = field.value;
    });
    const data = compare(config);
    results.innerHTML = `<p>С текущими параметрами каждый источник передаёт ${config.activity} мс и молчит ${100 - config.activity} мс за цикл. Закреплённая скорость каждого -- <strong>${number(config.capacity / config.flows)} Мбит/с</strong>; скорость передачи пакета через общий выход -- <strong>${config.capacity} Мбит/с</strong>.</p>
      <p>Поступило <strong>${data.shared.offered}</strong> пакетов за 1 с. Средняя входная нагрузка -- <strong>${number(data.shared.offered / 1000)} Мбит/с</strong> при скорости выхода <strong>${config.capacity} Мбит/с</strong>.</p>
      <div class="mux-scroll" tabindex="0" role="region" aria-label="Результаты двух способов обслуживания"><table><thead><tr><th scope="col">За 1 с наблюдения</th><th scope="col">Закреплённые доли</th><th scope="col">Общий выход</th></tr></thead><tbody>
      ${[
        ['Использование выхода, %', ...Object.values(data).map(d => number(d.utilization * 100))],
        ['Передано пакетов', data.dedicated.sent, data.shared.sent],
        ['Осталось в системе, пакетов', data.dedicated.pending, data.shared.pending],
        ['Потеряно пакетов', data.dedicated.lost, data.shared.lost],
        ['Потери от поступивших, %', ...Object.values(data).map(d => number(d.offered ? 100 * d.lost / d.offered : 0))],
        ['Среднее ожидание переданных, мс', ...Object.values(data).map(d => number(d.wait))],
        ['Средняя задержка переданных, мс', ...Object.values(data).map(d => number(d.delay))],
      ].map(row => `<tr><th scope="row">${row[0]}</th><td>${row[1]}</td><td>${row[2]}</td></tr>`).join('')}</tbody></table></div>`;
    const line = (samples, cls) => `<polyline class="${cls}" points="${samples.map(s => `${55 + s.t * .62},${230 - s.queue * 200 / 240}`).join(' ')}"/>`;
    plot.innerHTML = `<svg viewBox="0 0 720 285" role="img" aria-label="Число ожидающих пакетов во времени; шкала от нуля до 240 пакетов"><title>Суммарная очередь перед выходом</title>
      <path class="mux-axis" d="M55 30 V230 H680 M55 130 H680 M55 30 H680"/>
      <g class="mux-label"><text x="55" y="20">Очередь, пакеты</text><text x="17" y="234">0</text><text x="10" y="134">120</text><text x="10" y="36">240</text><text x="55" y="252">0</text><text x="345" y="252">500</text><text x="642" y="252">1000</text><text x="525" y="277">Время, мс</text></g>
      ${line(data.dedicated.samples, 'mux-reserved')}${line(data.shared.samples, 'mux-shared')}</svg>`;
    root.querySelector('[data-sample-table]').innerHTML = `<table><thead><tr><th scope="col">Время, мс</th><th scope="col">Очередь: доли</th><th scope="col">Очередь: общий выход</th></tr></thead><tbody>${data.shared.samples.filter((_, i) => i % 10 === 0).map((s, i) => `<tr><td>${s.t}</td><td>${data.dedicated.samples[i * 10].queue}</td><td>${s.queue}</td></tr>`).join('')}</tbody></table>`;
  };
  fields.forEach(field => field.addEventListener('input', update));
  update();
}
document.querySelectorAll('[data-multiplexing]').forEach(mountMultiplexing);
