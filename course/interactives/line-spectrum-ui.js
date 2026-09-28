import {LINE_SPECTRA} from './line-spectrum-data.js';
import {lineCodes} from './companding-line-model.js';

const EXAMPLE_BITS = '111000000000';
const example = lineCodes(EXAMPLE_BITS);
const entries = {
  nrz: ['NRZ', 'Единица держится весь бит. У сигнала есть постоянная составляющая.'],
  rz: ['RZ', 'Импульс короче: энергия заметна на более высоких частотах. Переходы единиц дают тактовую линию.'],
  amiNrz: ['ЧПИ NRZ', 'Чередование знака единиц подавляет составляющие около нулевой частоты.'],
  amiRz: ['ЧПИ RZ', 'Полярность чередуется, а импульсы короче: энергия смещается выше, чем у ЧПИ NRZ.'],
  hdb: ['HDB-3', 'Вставки разрывают длинные нули ЧПИ и меняют форму спектра.'],
  manchester: ['Manchester', 'Переход в середине каждого бита подавляет область около нуля и смещает мощность к битовой частоте.'],
};

function waveformSvg(key, title) {
  const values = example[key];
  const left = 30, right = 590, top = 18, bottom = 100;
  const cell = (right - left) / EXAMPLE_BITS.length;
  const middle = (top + bottom) / 2;
  const levelY = value => middle - value * 27;
  let path = `M${left} ${levelY(key === 'hdb' ? values[0].level : values[0][0])}`;
  for (let i = 0; i < values.length; i++) {
    const second = key === 'hdb' ? values[i].level : values[i][1];
    const next = i + 1 < values.length ? (key === 'hdb' ? values[i + 1].level : values[i + 1][0]) : second;
    const x = left + i * cell;
    path += `H${x + cell / 2}V${levelY(second)}H${x + cell}V${levelY(next)}`;
  }
  const guides = [...EXAMPLE_BITS].map((bit, i) => `<line x1="${left + i * cell}" x2="${left + i * cell}" y1="${top}" y2="${bottom}" class="line-spectrum-bit-guide"/><text x="${left + (i + .5) * cell}" y="13" text-anchor="middle">${bit}</text>`).join('');
  return `<svg viewBox="0 0 620 112" role="img" aria-label="Фрагмент ${title} для битов ${EXAMPLE_BITS}">${guides}<line x1="${left}" x2="${right}" y1="${middle}" y2="${middle}" class="line-spectrum-zero"/><path d="${path}" class="line-spectrum-wave"/></svg>`;
}

function spectrumSvg(key, title) {
  const {relativePower, mean} = LINE_SPECTRA.spectra[key];
  const left = 55, right = 590, top = 15, bottom = 172;
  const x = frequency => left + frequency / LINE_SPECTRA.maxFrequency * (right - left);
  const y = power => bottom - power * (bottom - top);
  const ticks = [0, .5, 1, 1.5, 2, 2.5].map(f => `<line x1="${x(f)}" x2="${x(f)}" y1="${top}" y2="${bottom}" class="line-spectrum-grid"/><text x="${x(f)}" y="191" text-anchor="middle">${String(f).replace('.', ',')}</text>`).join('');
  const trace = relativePower.map((power, i) => `${i ? 'L' : 'M'}${x(i * LINE_SPECTRA.maxFrequency / (relativePower.length - 1)).toFixed(1)},${y(power).toFixed(1)}`).join(' ');
  const area = `${trace} L${right},${bottom} L${left},${bottom} Z`;
  const dc = mean > .01 ? `<circle cx="${x(0) + 5}" cy="${top + 5}" r="4" class="line-spectrum-dc-dot"/><text x="${x(0) + 24}" y="${top + 10}" class="line-spectrum-dc-label">DC</text>` : '';
  const clock = key === 'rz' ? `<line x1="${x(1)}" x2="${x(1)}" y1="${top + 5}" y2="${bottom}" class="line-spectrum-clock"/><text x="${x(1) + 8}" y="${top + 13}" class="line-spectrum-clock-label">такт</text>` : '';
  return `<svg viewBox="0 0 620 225" role="img" aria-label="Сглаженная относительная мощность ${title} в зависимости от частоты"><line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="line-spectrum-axis"/><text x="${left - 8}" y="${top + 5}" text-anchor="end">1</text><text x="${left - 8}" y="${bottom + 5}" text-anchor="end">0</text>${ticks}<path d="${area}" class="line-spectrum-area"/><path d="${trace}" class="line-spectrum-trace"/>${clock}${dc}<text x="322" y="218" text-anchor="middle">Частота / битовая скорость</text></svg>`;
}

function card(key) {
  const [title, note] = entries[key];
  return `<figure class="line-spectrum-card"><figcaption>${title}</figcaption><div class="line-spectrum-panel"><span>Форма сигнала · ${EXAMPLE_BITS}</span>${waveformSvg(key, title)}</div><div class="line-spectrum-panel"><span>Где сосредоточена мощность</span>${spectrumSvg(key, title)}</div><p>${note}</p></figure>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum]')) {
  const keys = root.dataset.lineSpectrum.split(',').map(key => key.trim());
  root.innerHTML = `<div class="line-spectrum-grid-layout">${keys.map(card).join('')}</div>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum-method]')) {
  root.textContent = `Метод для всех шести графиков одинаков: ${LINE_SPECTRA.bitCount.toLocaleString('ru-RU')} псевдослучайных бит, ${LINE_SPECTRA.windows} перекрывающихся окон БПФ по ${LINE_SPECTRA.fftSize.toLocaleString('ru-RU')} отсчётов (4096 бит на окно), окно Ханна и усреднение мощности. Кривая показывает сглаженную непрерывную часть спектра каждого кода, нормированную к её собственному максимуму; метка DC указывает на постоянную составляющую, а пунктир у RZ — на частоту тактовой линии. По высоте разных карточек нельзя сравнивать абсолютную мощность.`;
}
