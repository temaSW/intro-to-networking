const number = value => value.toLocaleString('ru-RU', { maximumFractionDigits: 5 });

// Both quantizers share one symmetric error axis, including overload errors.
export function errorExtent(result, comparison) {
  const peak = Math.max(result.maxError, comparison?.maxError ?? 0, 1e-6);
  const target = peak * 1.15;
  const unit = 10 ** Math.floor(Math.log10(target));
  return [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find(step => step * unit >= target) * unit;
}

export function errorChart(result, comparison) {
  const extent = errorExtent(result, comparison);
  const left = 90, right = 810, top = 46, bottom = 190;
  const x = time => left + time / 4 * (right - left);
  const y = error => (top + bottom) / 2 - error / extent * (bottom - top) / 2;
  const horizontal = [-1, -.5, 0, .5, 1].map(fraction => {
    const value = fraction * extent;
    return `<path class="${fraction ? 'q-grid' : 'q-zero'}" d="M${left} ${y(value)}H${right}"/><text x="${left - 10}" y="${y(value) + 5}" text-anchor="end">${number(value)}</text>`;
  }).join('');
  const vertical = [0, 1, 2, 3, 4].map(time => `<path class="q-grid" d="M${x(time)} ${top}V${bottom}"/><text x="${x(time)}" y="213" text-anchor="middle">${time}</text>`).join('');
  const series = (wave, cls, square) => {
    const line = wave.samples.map((p, k) => `${k ? 'L' : 'M'}${x(p.timeMs)} ${y(p.error)}`).join(' ');
    const markers = wave.samples.map(p => square
      ? `<rect class="q-error-log" x="${x(p.timeMs) - 2.5}" y="${y(p.error) - 2.5}" width="5" height="5"/>`
      : `<circle class="q-error-uniform" cx="${x(p.timeMs)}" cy="${y(p.error)}" r="2.5"/>`).join('');
    return `<path class="${cls}" d="${line}"/>${markers}`;
  };
  return `<svg viewBox="0 0 850 240" role="img" aria-label="Ошибка квантования: восстановленный отсчёт минус исходный, в относительных единицах; автоматический масштаб от минус ${number(extent)} до плюс ${number(extent)}"><rect class="q-paper" width="850" height="240"/><text x="${left}" y="20">Ошибка, отн. ед. · автомасштаб ±${number(extent)}</text>${horizontal}${vertical}<path class="q-axis" d="M${left} ${top}V${bottom}H${right}"/>${series(result, 'q-uniform-line', false)}${comparison ? series(comparison, 'q-log-line', true) : ''}<text x="${right}" y="234" text-anchor="end">Время, мс</text></svg>`;
}
