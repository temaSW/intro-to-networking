import {LINE_SPECTRA} from './line-spectrum-data.js?v=20260929-1';

const titles = {
  nrz: 'NRZ', rz: 'RZ', amiNrz: 'ЧПИ NRZ', amiRz: 'ЧПИ RZ',
  hdb: 'HDB-3', manchester: 'Manchester',
};
const captions = {
  'nrz,rz': 'Первый нуль: NRZ — около 1, RZ — около 2',
  'amiNrz,amiRz': 'Чередование знака убирает область около нуля',
  'hdb,manchester': 'Максимумы расположены в разных частотных областях',
};

function spectrumSvg(keys) {
  const left = 74, right = 792, top = 34, bottom = 245;
  const x = frequency => left + frequency / LINE_SPECTRA.maxFrequency * (right - left);
  const y = fraction => bottom - fraction * (bottom - top);
  const horizontal = [0, .25, .5, .75, 1].map(fraction =>
    `<line x1="${left}" x2="${right}" y1="${y(fraction)}" y2="${y(fraction)}" class="line-spectrum-grid"/><text x="${left - 12}" y="${y(fraction) + 6}" text-anchor="end">${Math.round(fraction * 100)}</text>`).join('');
  const vertical = [0, .5, 1, 1.5, 2, 2.5].map(frequency =>
    `<line x1="${x(frequency)}" x2="${x(frequency)}" y1="${top}" y2="${bottom}" class="line-spectrum-grid"/><text x="${x(frequency)}" y="270" text-anchor="middle">${String(frequency).replace('.', ',')}</text>`).join('');
  const curves = keys.map((key, index) => {
    const estimate = LINE_SPECTRA.spectra[key];
    const path = estimate.relativePower.map((power, point) =>
      `${point ? 'L' : 'M'}${x(point * LINE_SPECTRA.maxFrequency / (estimate.relativePower.length - 1)).toFixed(1)},${y(Math.sqrt(power)).toFixed(1)}`).join(' ');
    return `<path d="${path}" class="line-spectrum-curve line-spectrum-curve-${index + 1}"/>`;
  }).join('');
  const firstNulls = keys.includes('rz') ? `<circle cx="${x(1)}" cy="${bottom}" r="5" class="line-spectrum-null-1"/><text x="${x(1)}" y="${bottom - 15}" text-anchor="middle" class="line-spectrum-null-text-1">нуль NRZ</text><circle cx="${x(2)}" cy="${bottom}" r="5" class="line-spectrum-null-2"/><text x="${x(2)}" y="${bottom - 15}" text-anchor="middle" class="line-spectrum-null-text-2">нуль RZ</text>` : '';
  return `<svg viewBox="0 0 820 310" role="img" aria-label="Линейные спектры амплитуды ${keys.map(key => titles[key]).join(' и ')}: частота от нуля до 2,5 битовых скоростей, амплитуда каждого кода от нуля до 100 процентов собственного максимума"><text x="${left}" y="24" class="line-spectrum-axis-title">Амплитуда, %</text>${horizontal}${vertical}${curves}${firstNulls}<text x="433" y="303" text-anchor="middle" class="line-spectrum-axis-title">Частота / битовая скорость</text></svg>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum]')) {
  const keys = root.dataset.lineSpectrum.split(',').map(key => key.trim());
  const legend = keys.map((key, index) => `<span><i class="line-spectrum-swatch line-spectrum-swatch-${index + 1}" aria-hidden="true"></i>${titles[key]}</span>`).join('');
  const separateLines = keys.includes('rz')
    ? '<p class="line-spectrum-lines">У обоих кодов есть отдельная линия при частоте 0 (DC), у RZ также есть тактовая линия при 1. На плавных кривых эти узкие линии не показаны.</p>'
    : '';
  root.innerHTML = `<figure class="line-spectrum-comparison"><figcaption>${captions[keys.join(',')]}</figcaption><div class="line-spectrum-legend">${legend}</div><div class="line-spectrum-scroll">${spectrumSvg(keys)}</div>${separateLines}</figure>`;
}

for (const root of document.querySelectorAll('[data-line-spectrum-method]')) {
  root.textContent = `Все три сравнения рассчитаны для одних и тех же ${LINE_SPECTRA.bitCount.toLocaleString('ru-RU')} псевдослучайных бит. Мощность усреднена по ${LINE_SPECTRA.windows} перекрывающимся окнам БПФ длиной ${LINE_SPECTRA.fftSize.toLocaleString('ru-RU')} отсчётов (4096 бит), с окном Ханна; соседние частотные точки дополнительно сглажены. Показан квадратный корень из усреднённой мощности. У каждой кривой собственный максимум принят за 100%: график позволяет сравнивать форму и ширину, но не абсолютную амплитуду двух сигналов.`;
}
