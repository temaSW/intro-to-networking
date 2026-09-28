import {LINE_SPECTRA} from './line-spectrum-data.js';

const entries = [
  ['nrz', 'NRZ', 'Пик около нуля и постоянная составляющая.'],
  ['rz', 'RZ', 'Появляется тактовая линия при f = Rб; спектр импульса шире.'],
  ['amiNrz', 'ЧПИ NRZ', 'Чередование знака подавляет низкие частоты.'],
  ['amiRz', 'ЧПИ RZ', 'Низкие частоты подавлены, короткие импульсы расширяют спектр.'],
  ['manchester', 'Manchester', 'Мало энергии около нуля; частые переходы сдвигают энергию выше.'],
  ['hdb', 'HDB-3', 'Вставки вместо длинных нулей меняют низкочастотную часть спектра ЧПИ.'],
];

function spectrumSvg(key, title) {
  const {db, mean} = LINE_SPECTRA.spectra[key];
  const left = 52, right = 625, top = 18, bottom = 212;
  const x = frequency => left + frequency / LINE_SPECTRA.maxFrequency * (right - left);
  const y = level => bottom - (level + 50) / 75 * (bottom - top);
  const grid = [0, 1, 2, 3].map(f => `<line class="line-spectrum-grid" x1="${x(f)}" x2="${x(f)}" y1="${top}" y2="${bottom}"/><text x="${x(f)}" y="232" text-anchor="middle">${f}</text>`).join('')
    + [-40, -20, 0, 20].map(level => `<line class="line-spectrum-grid" x1="${left}" x2="${right}" y1="${y(level)}" y2="${y(level)}"/><text x="${left - 7}" y="${y(level) + 4}" text-anchor="end">${level}</text>`).join('');
  const trace = db.map((level, index) => `${index ? 'L' : 'M'}${x(index * LINE_SPECTRA.maxFrequency / (db.length - 1)).toFixed(1)},${y(level).toFixed(1)}`).join(' ');
  const dc = mean > .01 ? `<line class="line-spectrum-dc" x1="${x(0) + 3}" x2="${x(0) + 3}" y1="${top + 7}" y2="${bottom - 9}"/><text class="line-spectrum-dc-label" x="${x(0) + 10}" y="${top + 15}">DC</text>` : '';
  return `<svg viewBox="0 0 650 260" role="img" aria-label="Усреднённый спектр ${title} от нуля до 3,5 битовых частот"><rect class="line-spectrum-paper" x="${left}" y="${top}" width="${right-left}" height="${bottom-top}"/>${grid}<path class="line-spectrum-trace" d="${trace}"/>${dc}<text x="337" y="253" text-anchor="middle">Частота f / Rб</text></svg>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum]')) {
  root.innerHTML = `<div class="line-spectrum-grid-layout">${entries.map(([key, title, note]) => `<figure class="line-spectrum-card"><figcaption>${title}</figcaption>${spectrumSvg(key, title)}<p>${note}</p></figure>`).join('')}</div><p class="line-spectrum-method">Одна и та же псевдослучайная последовательность: ${LINE_SPECTRA.bitCount.toLocaleString('ru-RU')} бит для каждого кода. ${LINE_SPECTRA.windows} перекрывающихся окон БПФ по ${LINE_SPECTRA.fftSize.toLocaleString('ru-RU')} отсчётов (4096 бит на окно), окно Ханна, усреднение мощности; 8 отсчётов на бит. Для вывода соседние частотные отсчёты объединены в точки кривой. Каждая кривая нормирована по уровню своей непрерывной части. Отдельные пики и линия DC показывают регулярные составляющие, но высоты разных графиков не сравниваются как абсолютная мощность.</p>`;
}
