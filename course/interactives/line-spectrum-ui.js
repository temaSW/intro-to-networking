import {LINE_SPECTRA} from './line-spectrum-data.js?v=20260929-2';

const titles = {
  nrz: 'NRZ', rz: 'RZ', amiNrz: 'ЧПИ NRZ', amiRz: 'ЧПИ RZ',
  hdb: 'HDB-3', manchester: 'Manchester',
};

function spectrumSvg(comparison) {
  const left = 106, right = 790, upper = 40, lower = 280;
  const rows = [
    {key: comparison.keys[0], top: 40, bottom: 135},
    {key: comparison.keys[1], top: 180, bottom: 275},
  ];
  const x = frequency => left + frequency / LINE_SPECTRA.maxFrequency * (right - left);
  const vertical = [0, .5, 1, 1.5, 2, 2.5].map(frequency =>
    `<line x1="${x(frequency)}" x2="${x(frequency)}" y1="${upper}" y2="${lower}" class="line-spectrum-grid"/><text x="${x(frequency)}" y="306" text-anchor="middle">${String(frequency).replace('.', ',')}</text>`).join('');
  const panels = rows.map(({key, top, bottom}, index) => {
    const height = bottom - top;
    const stems = comparison.spectra[key].lines.filter(line => line.amplitude >= 2).map(line => {
      const tip = bottom - line.amplitude / 100 * height;
      return `<line x1="${x(line.frequency)}" x2="${x(line.frequency)}" y1="${bottom}" y2="${tip}" class="line-spectrum-stem line-spectrum-stem-${index + 1}"/><circle cx="${x(line.frequency)}" cy="${tip}" r="3" class="line-spectrum-dot-${index + 1}"/>`;
    }).join('');
    return `<text x="${left - 14}" y="${top + 49}" text-anchor="end" class="line-spectrum-name line-spectrum-name-${index + 1}">${titles[key]}</text><text x="${left - 14}" y="${top + 5}" text-anchor="end">100</text><text x="${left - 14}" y="${bottom + 6}" text-anchor="end">0</text><line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="line-spectrum-axis"/>${stems}`;
  }).join('');
  return `<svg viewBox="0 0 820 345" role="img" aria-label="Амплитуды гармоник при бесконечном повторении битов ${comparison.pattern}: ${comparison.keys.map(key => titles[key]).join(' и ')}"><text x="${left}" y="25" class="line-spectrum-axis-title">Амплитуда, % от максимума в паре</text>${vertical}${panels}<text x="445" y="339" text-anchor="middle" class="line-spectrum-axis-title">Частота / битовая скорость (f/Rб)</text></svg>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum]')) {
  const keys = root.dataset.lineSpectrum.split(',').map(key => key.trim());
  const comparison = LINE_SPECTRA.comparisons.find(item => item.keys.join(',') === keys.join(','));
  if (!comparison) throw new Error(`Unknown line-code comparison: ${keys.join(',')}`);
  root.innerHTML = `<figure class="line-spectrum-comparison"><figcaption>Гармоники повторяющихся битов <code>${comparison.pattern}</code></figcaption><p class="line-spectrum-instruction">Каждая вертикальная линия — одна гармоника; её положение показывает частоту, высота — относительную амплитуду.</p><div class="line-spectrum-scroll">${spectrumSvg(comparison)}</div></figure>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum-method]')) {
  root.textContent = 'Для каждого сравнения битовый шаблон многократно повторён, и по получившемуся периодическому сигналу вычислены коэффициенты ряда Фурье. Высоты линий в каждой паре приведены к её самой высокой линии (100%). У случайного потока появляется непрерывная часть спектра; эти графики показывают влияние правил кодирования на периодическом примере.';
}
