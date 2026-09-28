import {scramble, scramblerMask} from './scrambler-model.js?v=20260929-1';

const root = document.querySelector('[data-scrambler-widget]');
if (root) {
  const example = '111000000000';
  root.innerHTML = `<div class="scrambler-flow-scroll"><div class="scrambler-flow" aria-label="Путь битов через скремблер и дескремблер"><span>Исходные биты</span><b aria-hidden="true">→</b><span class="scrambler-flow-xor">⊕ маска</span><b aria-hidden="true">→</b><span>К физическому кодированию</span><b aria-hidden="true">→</b><span class="scrambler-flow-xor">⊕ та же маска</span><b aria-hidden="true">→</b><span>Исходные биты</span></div></div><p class="scrambler-flow-note">Передатчик и приёмник должны получить одинаковую последовательность маски. Тогда <strong>(бит ⊕ маска) ⊕ маска = бит</strong>.</p><div class="scrambler-controls"><label for="scrambler-bits">Входные биты, до 32 символов</label><input id="scrambler-bits" type="text" inputmode="numeric" spellcheck="false" value="${example}" aria-describedby="scrambler-input-hint"><small id="scrambler-input-hint">Измените биты или выберите пример.</small></div><div class="scrambler-presets"><button type="button" data-scrambler-preset="${example}">Общий пример</button><button type="button" data-scrambler-preset="000000000000">Все нули</button><button type="button" data-scrambler-preset="${scramblerMask(12)}">Вход = маска</button></div><div class="scrambler-result" aria-live="polite"></div>`;
  const input = root.querySelector('input');
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
    const cells = value => [...value].map((bit, i) => `<td class="${i === selected ? 'scrambler-selected' : ''}">${bit}</td>`).join('');
    const outputCells = [...data.output].map((bit, i) => `<td class="${i === selected ? 'scrambler-selected' : ''}"><button type="button" data-bit-index="${i}" aria-pressed="${i === selected}" aria-label="Выбрать бит ${i + 1}">${bit}</button></td>`).join('');
    const indices = [...bits].map((_, i) => `<th scope="col">${i + 1}</th>`).join('');
    const a = data.input[selected], p = data.mask[selected], y = data.output[selected];
    result.innerHTML = `<div class="scrambler-table-scroll"><table class="scrambler-bit-table"><thead><tr><th scope="col">Бит №</th>${indices}</tr></thead><tbody><tr><th scope="row">Вход</th>${cells(data.input)}</tr><tr><th scope="row">Маска</th>${cells(data.mask)}</tr><tr class="scrambler-output-row"><th scope="row">После XOR</th>${outputCells}</tr><tr><th scope="row">Восстановлено</th>${cells(data.restored)}</tr></tbody></table></div><p class="scrambler-equation">Бит ${selected + 1}: <strong>${a} ⊕ ${p} = ${y}</strong>; на приёмнике <strong>${y} ⊕ ${p} = ${a}</strong>.</p><div class="scrambler-statistics"><p><strong>Вход:</strong> переходы — ${data.before.transitions}; максимум подряд одинаковых битов — ${data.before.longestRun}.</p><p><strong>После скремблера:</strong> переходы — ${data.after.transitions}; максимум подряд одинаковых битов — ${data.after.longestRun}.</p></div>`;
  };

  input.addEventListener('input', render);
  root.querySelector('.scrambler-presets').addEventListener('click', event => {
    const button = event.target.closest('button[data-scrambler-preset]');
    if (!button) return;
    input.value = button.dataset.scramblerPreset;
    selected = 4;
    render();
  });
  result.addEventListener('click', event => {
    const button = event.target.closest('button[data-bit-index]');
    if (!button) return;
    selected = Number(button.dataset.bitIndex);
    render();
    result.querySelector(`button[data-bit-index="${selected}"]`)?.focus();
  });
  render();
}
