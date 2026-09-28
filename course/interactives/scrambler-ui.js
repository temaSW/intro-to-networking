import {scramble, scramblerMask} from './scrambler-model.js?v=20260929-1';

function timingChart(data, selected) {
  const cell = 40, left = 94, right = 14, top = 30, rowHeight = 65;
  const width = left + data.input.length * cell + right;
  const height = top + 4 * rowHeight + 30;
  const x = index => left + index * cell;
  const rows = [
    ['In', 'input', data.input],
    ['Mask', 'mask', data.mask],
    ['Out', 'output', data.output],
    ['Restored', 'restored', data.restored],
  ];
  const grid = Array.from({length: data.input.length + 1}, (_, i) =>
    `<line class="scrambler-grid" x1="${x(i)}" y1="${top - 8}" x2="${x(i)}" y2="${top + 4 * rowHeight - 5}"/>`).join('');
  const indices = [...data.input].map((_, i) =>
    `<text class="scrambler-index" x="${x(i) + cell / 2}" y="18" text-anchor="middle">${i + 1}</text>`).join('');
  const tracks = rows.map(([label, name, bits], row) => {
    const high = top + row * rowHeight + 8;
    const low = high + 29;
    const level = bit => bit === '1' ? high : low;
    let path = `M ${x(0)} ${level(bits[0])}`;
    for (let i = 0; i < bits.length; i++) {
      path += ` H ${x(i + 1)}`;
      if (i + 1 < bits.length && bits[i + 1] !== bits[i]) path += ` V ${level(bits[i + 1])}`;
    }
    return `<text class="scrambler-track-label scrambler-${name}-label" x="5" y="${high + 19}">${label}</text><text class="scrambler-level" x="${left - 9}" y="${high + 5}" text-anchor="end">1</text><text class="scrambler-level" x="${left - 9}" y="${low + 5}" text-anchor="end">0</text><line class="scrambler-low-guide" x1="${left}" y1="${low}" x2="${x(bits.length)}" y2="${low}"/><path class="scrambler-trace scrambler-${name}-trace" d="${path}"/>`;
  }).join('');
  const targets = [...data.input].map((_, i) =>
    `<rect class="scrambler-bit-target" data-bit-index="${i}" x="${x(i)}" y="${top - 8}" width="${cell}" height="${4 * rowHeight + 3}"><title>Выбрать бит ${i + 1}</title></rect>`).join('');
  return `<div class="scrambler-chart-scroll"><svg class="scrambler-timing no-lightbox" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Временные диаграммы In, Mask, Out и Restored. Выбран бит ${selected + 1}."><rect class="scrambler-selected-interval" x="${x(selected)}" y="${top - 8}" width="${cell}" height="${4 * rowHeight + 3}"/>${grid}${indices}${tracks}${targets}<text class="scrambler-time-label" x="${x(data.input.length)}" y="${height - 6}" text-anchor="end">Время · битовые интервалы →</text></svg></div>`;
}

const root = document.querySelector('[data-scrambler-widget]');
if (root) {
  const example = '111000000000';
  root.innerHTML = `<div class="scrambler-flow-scroll"><div class="scrambler-flow" aria-label="Путь битов через скремблер и дескремблер"><span>Исходные биты</span><b aria-hidden="true">→</b><span class="scrambler-flow-xor">⊕ маска</span><b aria-hidden="true">→</b><span>К физическому кодированию</span><b aria-hidden="true">→</b><span class="scrambler-flow-xor">⊕ та же маска</span><b aria-hidden="true">→</b><span>Исходные биты</span></div></div><p class="scrambler-flow-note">Передатчик и приёмник должны получить одинаковую последовательность маски. Тогда <strong>(бит ⊕ маска) ⊕ маска = бит</strong>.</p><div class="scrambler-controls"><label for="scrambler-bits">Входные биты, до 32 символов</label><input id="scrambler-bits" type="text" inputmode="numeric" spellcheck="false" value="${example}" aria-describedby="scrambler-input-hint"><small id="scrambler-input-hint">Измените биты или выберите пример.</small></div><div class="scrambler-presets"><button type="button" data-scrambler-preset="${example}">Общий пример</button><button type="button" data-scrambler-preset="000000000000">Все нули</button><button type="button" data-scrambler-preset="${scramblerMask(12)}">Вход = маска</button></div><div class="scrambler-bit-control"><label for="scrambler-selected-bit">Разобрать бит</label><select id="scrambler-selected-bit"></select></div><div class="scrambler-result" aria-live="polite"></div>`;
  const input = root.querySelector('input');
  const picker = root.querySelector('select');
  const result = root.querySelector('.scrambler-result');
  let selected = 4;

  const render = () => {
    const bits = input.value.replace(/[^01]/g, '').slice(0, 32);
    if (input.value !== bits) input.value = bits;
    if (!bits) {
      result.textContent = 'Введите хотя бы один бит: 0 или 1.';
      return;
    }
    const data = scramble(bits);
    selected = Math.min(selected, bits.length - 1);
    if (picker.options.length !== bits.length) {
      picker.innerHTML = [...bits].map((_, i) => `<option value="${i}">${i + 1}</option>`).join('');
    }
    picker.value = String(selected);
    const a = data.input[selected], p = data.mask[selected], y = data.output[selected];
    result.innerHTML = `${timingChart(data, selected)}<p class="scrambler-equation">Бит ${selected + 1}: <strong>${a} ⊕ ${p} = ${y}</strong>; на приёмнике <strong>${y} ⊕ ${p} = ${a}</strong>.</p><div class="scrambler-statistics"><p><strong>In:</strong> переходы ${data.before.transitions}; макс. серия ${data.before.longestRun}.</p><p><strong>Out:</strong> переходы ${data.after.transitions}; макс. серия ${data.after.longestRun}.</p></div>`;
  };

  input.addEventListener('input', render);
  picker.addEventListener('change', () => {
    selected = Number(picker.value);
    render();
  });
  root.querySelector('.scrambler-presets').addEventListener('click', event => {
    const button = event.target.closest('button[data-scrambler-preset]');
    if (!button) return;
    input.value = button.dataset.scramblerPreset;
    selected = 4;
    render();
  });
  result.addEventListener('click', event => {
    const interval = event.target.closest('[data-bit-index]');
    if (!interval) return;
    selected = Number(interval.dataset.bitIndex);
    render();
  });
  render();
}
