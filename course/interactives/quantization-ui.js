import { quantizedWave, quantize } from './quantization-model.js';

const number = x => x.toLocaleString('ru-RU', { maximumFractionDigits: 4 });
document.querySelectorAll('[data-quantization-point]').forEach(root => {
  root.innerHTML = `<div class="q-controls"><label>Исходный отсчёт <output data-input-out></output><input data-input type="range" min="-1.4" max="1.4" step="0.01" value="0.37"></label><label>Разрядность <output data-bits-out></output><input data-bits type="range" min="2" max="4" step="1" value="3"></label></div><div class="q-chart" tabindex="0" role="region" aria-label="Интервалы квантования и выбор уровня" data-scale></div><ol class="q-point-steps" data-steps aria-live="polite"></ol><p class="q-result" data-error></p>`;
  const input = root.querySelector('[data-input]'), bits = root.querySelector('[data-bits]');
  function draw() {
    const q = quantize(Number(input.value), Number(bits.value));
    const step = 2 / q.levels, x = v => 55 + (v + 1.5) / 3 * 740;
    const bins = Array.from({length:q.levels}, (_, i) => {
      const lower = -1 + i * step, center = lower + step / 2;
      return `<rect class="q-bin ${i === q.index ? 'q-bin-active' : ''}" x="${x(lower)}" y="59" width="${x(lower + step) - x(lower)}" height="45"/><text x="${x(center)}" y="86" text-anchor="middle">${i}</text><path class="q-boundary" d="M${x(lower)} 104V114"/>`;
    }).join('');
    const ticks = [-1, -.5, 0, .5, 1].map(v=>`<text x="${x(v)}" y="134" text-anchor="middle">${number(v)}</text>`).join('');
    root.querySelector('[data-input-out]').textContent = `${number(q.value)} отн. ед.`;
    root.querySelector('[data-bits-out]').textContent = `${q.bits} бит · ${q.levels} интервалов`;
    root.querySelector('[data-scale]').innerHTML = `<svg viewBox="0 0 850 210" role="img" aria-label="Отсчёт ${number(q.value)} попадает в интервал номер ${q.index}, уровень ${number(q.reconstructed)}"><rect class="q-paper" width="850" height="210"/><text x="55" y="22">Интервалы и их номера · шаг ${number(step)}</text>${bins}${ticks}<path class="q-input-pointer" d="M${x(q.value)} 35V57 M${x(q.value)-5} 49L${x(q.value)} 57L${x(q.value)+5} 49"/><text x="${x(q.value)}" y="45" text-anchor="${q.value>0 ? 'end' : 'start'}" dx="${q.value>0 ? -9 : 9}">Отсчёт</text><path class="q-level-pointer" d="M${x(q.reconstructed)} 105V165"/><circle class="q-log" cx="${x(q.reconstructed)}" cy="165" r="5"/><text x="${x(q.reconstructed)}" y="190" text-anchor="middle">Уровень ${number(q.reconstructed)}</text><text x="795" y="205" text-anchor="end">Амплитуда, отн. ед.</text></svg>`;
    root.querySelector('[data-steps]').innerHTML = `<li><span>1. Отсчёт</span><strong>${number(q.value)}</strong></li><li><span>2. Интервал № ${q.index}</span><strong>[${number(q.lower)}; ${number(q.upper)}${q.index===q.levels-1 ? ']' : ')'}</strong></li><li><span>3. Уровень</span><strong>${number(q.reconstructed)}</strong></li><li><span>4. Кодовое слово</span><strong><code>${q.word}</code></strong></li>`;
    root.querySelector('[data-error]').textContent = `Ошибка: ${number(q.reconstructed)} − (${number(q.value)}) = ${number(q.error)} отн. ед.${q.overloaded ? ' Перегрузка: отсчёт вне диапазона, выбран крайний код.' : ''}`;
  }
  root.addEventListener('input', draw);
  draw();
});
function chart(result, comparison) {
  const left = 66, right = 810, x = t => left + t / 4 * (right - left);
  const y = a => 146 - a * 73;
  const curve = Array.from({ length: 401 }, (_, k) => `${k ? 'L' : 'M'}${x(k / 100)} ${y(result.original(k / 100))}`).join(' ');
  const grid = [0, 1, 2, 3, 4].map(t => `<path class="q-grid" d="M${x(t)} 28V264"/><text x="${x(t)}" y="288" text-anchor="middle">${t}</text>`).join('');
  const labels = [-1, 0, 1].map(a => `<text x="54" y="${y(a) + 5}" text-anchor="end">${a}</text>`).join('');
  const brokenLine = (r, cls) => `<path class="${cls}" d="${r.samples.map((p, k) => `${k ? 'L' : 'M'}${x(p.timeMs)} ${y(p.reconstructed)}`).join(' ')}"/>`;
  const stems = result.samples.map(p => `<path class="q-error" d="M${x(p.timeMs)} ${y(p.value)}V${y(p.reconstructed)}"/>`).join('');
  const over = result.samples.filter(p => p.overloaded).map(p => `<rect class="q-overload" x="${x(p.timeMs) - 5}" y="${y(p.value) - 5}" width="10" height="10"/>`).join('');
  return `<svg viewBox="0 0 850 315" role="img" aria-label="Исходный сигнал и ломаные через квантованные отсчёты за четыре миллисекунды; по вертикали амплитуда в относительных единицах"><rect class="q-paper" width="850" height="315"/>${grid}${labels}<text x="66" y="18">Амплитуда, отн. ед.</text><path class="q-limit" d="M${left} ${y(1)}H${right} M${left} ${y(-1)}H${right}"/><path class="q-axis" d="M${left} 28V264H${right}"/><path class="q-original" d="${curve}"/>${comparison ? '' : stems}${brokenLine(result, 'q-uniform-line')}${comparison ? brokenLine(comparison, 'q-log-line') : ''}${over}<text x="${right}" y="308" text-anchor="end">Время, мс</text></svg>`;
}

document.querySelectorAll('[data-quantization]').forEach((root, instance) => {
  const compare = root.dataset.quantization === 'compare';
  root.innerHTML = `<div class="q-controls"><label>Разрядность <output data-bits-out></output><input data-bits type="range" min="2" max="8" value="4" step="1"></label><label>Амплитуда <output data-amplitude-out></output><input data-amplitude type="range" min="0.1" max="1.4" value="${compare ? '.8' : '.7'}" step="0.05"></label></div><div class="q-chart" data-chart tabindex="0" role="region" aria-label="График квантования"></div><div class="q-legend"><span><i class="q-key-original"></i>Исходный сигнал</span><span><i class="q-key-uniform"></i>Равномерная шкала</span>${compare ? '<span><i class="q-key-log"></i>Нелинейная шкала</span>' : '<span><i class="q-key-error"></i>Ошибка отсчёта</span>'}<span><i class="q-key-limit"></i>Границы диапазона ±1</span><span><i class="q-key-overload"></i>Перегруженные отсчёты</span></div><p class="q-result" data-result aria-live="polite"></p><p class="q-chart-note">Ломаные соединяют квантованные отсчёты для сравнения; между отсчётами значения не вычисляются.</p><details><summary>Отсчёт, кодовое слово и ошибка</summary><label class="q-sample-label" for="q-sample-${instance}">Номер отсчёта <input id="q-sample-${instance}" data-sample type="number" min="0" max="32" value="3"></label><div data-word></div></details>`;
  const bits = root.querySelector('[data-bits]'), amplitude = root.querySelector('[data-amplitude]');
  const sample = root.querySelector('[data-sample]');
  function draw() {
    const n = Number(bits.value), a = Number(amplitude.value);
    const u = quantizedWave(a, n), c = compare ? quantizedWave(a, n, 'log') : null;
    root.querySelector('[data-bits-out]').textContent = `${n} бит · ${2 ** n} уровней`;
    root.querySelector('[data-amplitude-out]').textContent = `${number(a)} отн. ед.`;
    root.querySelector('[data-chart]').innerHTML = chart(u, c);
    root.querySelector('[data-result]').textContent = `Максимальная абсолютная ошибка: равномерная шкала ${number(u.maxError)}${c ? `; нелинейная шкала ${number(c.maxError)}` : ''} отн. ед.${u.overloads ? ` Перегрузка: ${u.overloads} из 33 отсчётов за пределами диапазона.` : ''}`;
    const k = Math.max(0, Math.min(32, Math.round(Number(sample.value) || 0)));
    const p = u.samples[k], q = c?.samples[k];
    const row = (p, name) => `<tr><th scope="row">${name}</th><td>${p.index}</td><td><code>${p.word}</code></td><td>${number(p.reconstructed)}</td><td>${number(p.error)}</td></tr>`;
    root.querySelector('[data-word]').innerHTML = `<p>Время ${number(p.timeMs)} мс; исходный отсчёт ${number(p.value)} отн. ед.</p><div class="q-table"><table><thead><tr><th scope="col">Шкала</th><th scope="col">Номер уровня</th><th scope="col">Слово</th><th scope="col">Восстановлено</th><th scope="col">Ошибка, отн. ед.</th></tr></thead><tbody>${row(p, 'Равномерная')}${q ? row(q, 'Нелинейная') : ''}</tbody></table></div>`;
  }
  root.addEventListener('input', draw);
  draw();
});
