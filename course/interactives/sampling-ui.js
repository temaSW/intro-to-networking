import {sampledTone, spectralCopies} from "./sampling-model.js";

const format = number => Number(number.toFixed(2)).toLocaleString("ru-RU");

function waveSvg(result) {
  const left = 48, right = 756, top = 24, bottom = 214, duration = 5;
  const x = time => left + time / duration * (right - left);
  const y = amplitude => (top + bottom) / 2 - amplitude * 78;
  const curve = value => Array.from({length: 501}, (_, index) => {
    const time = index * duration / 500;
    return `${index ? "L" : "M"}${x(time).toFixed(1)} ${y(value(time)).toFixed(1)}`;
  }).join(" ");
  const ticks = Array.from({length: 6}, (_, time) => `<line class="ks-grid" x1="${x(time)}" y1="${top}" x2="${x(time)}" y2="${bottom}"/><text x="${x(time)}" y="242" text-anchor="middle">${time}</text>`).join("");
  const samples = result.samples.map(point => `<line class="ks-sample" x1="${x(point.timeMs).toFixed(1)}" y1="${y(0)}" x2="${x(point.timeMs).toFixed(1)}" y2="${y(point.amplitude).toFixed(1)}"/>`).join("");
  return `<svg viewBox="0 0 800 264" role="img" aria-label="Исходная и видимая по отсчётам синусоиды и вертикальные импульсы отсчётов за пять миллисекунд"><rect class="ks-paper" width="800" height="264"/>${ticks}<text x="48" y="17">Амплитуда, отн. ед.</text>${[-1,0,1].map(a => `<text x="38" y="${y(a)+5}" text-anchor="end">${a}</text>`).join('')}<line class="ks-axis" x1="${left}" y1="${y(0)}" x2="${right}" y2="${y(0)}"/><path class="ks-apparent" d="${curve(result.apparent)}"/><path class="ks-original" d="${curve(result.original)}"/>${samples}<text x="${right}" y="259" text-anchor="end">Время, мс</text></svg>`;
}

function spectrumSvg(result) {
  const left = 50, right = 752, top = 34, bottom = 182;
  const x = frequency => left + (frequency + 7) / 14 * (right - left);
  const rect = (start, end, className) => `<rect class="${className}" x="${x(start)}" y="${top + 24}" width="${x(end) - x(start)}" height="${bottom - top - 24}"/>`;
  const ticks = Array.from({length: 15}, (_, index) => index - 7).map(frequency => `<line class="ks-grid" x1="${x(frequency)}" y1="${top}" x2="${x(frequency)}" y2="${bottom}"/><text x="${x(frequency)}" y="207" text-anchor="middle">${frequency}</text>`).join("");
  const neighbors = result.copies.filter(copy => copy.index !== 0).map(copy => rect(copy.leftKhz, copy.rightKhz, "ks-neighbor")).join("");
  const center = rect(-result.maxFrequencyKhz, result.maxFrequencyKhz, "ks-center");
  const overlap = result.gapKhz < 0 ? [
    rect(result.sampleRateKhz - result.maxFrequencyKhz, result.maxFrequencyKhz, "ks-overlap"),
    rect(-result.maxFrequencyKhz, result.maxFrequencyKhz - result.sampleRateKhz, "ks-overlap"),
  ].join("") : "";
  const guides = [-result.nyquistKhz, result.nyquistKhz].map(frequency => `<line class="ks-nyquist" x1="${x(frequency)}" y1="${top}" x2="${x(frequency)}" y2="${bottom}"/>`).join("");
  return `<svg viewBox="0 0 800 231" role="img" aria-label="Исходная полоса и две соседние копии спектра после дискретизации"><rect class="ks-paper" width="800" height="231"/>${ticks}${neighbors}${center}${overlap}${guides}<line class="ks-axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/><text x="${right}" y="226" text-anchor="end">Частота, кГц</text></svg>`;
}

function mountTone(root) {
  root.innerHTML = `<div class="ks-controls"><label>Частота синусоиды <output data-frequency>1,2 кГц</output><input data-frequency-input type="range" min="0.2" max="2.4" step="0.1" value="1.2"></label><label>Частота дискретизации <output data-rate>2 кГц</output><input data-rate-input type="range" min="1" max="5" step="0.1" value="2"></label></div><div class="ks-chart" data-chart tabindex="0" role="region" aria-label="График дискретизации"></div><div class="ks-legend"><span><i class="ks-original-key"></i>Исходная синусоида</span><span><i class="ks-apparent-key"></i>Частота, видимая по отсчётам</span><span><i class="ks-sample-key"></i>Импульсы отсчётов</span></div><p class="ks-result" data-result aria-live="polite"></p>`;
  const frequencyInput = root.querySelector("[data-frequency-input]");
  const rateInput = root.querySelector("[data-rate-input]");
  const draw = () => {
    const result = sampledTone(Number(frequencyInput.value), Number(rateInput.value));
    root.querySelector("[data-frequency]").textContent = `${format(result.frequencyKhz)} кГц`;
    root.querySelector("[data-rate]").textContent = `${format(result.sampleRateKhz)} кГц`;
    root.querySelector("[data-chart]").innerHTML = waveSvg(result);
    root.querySelector("[data-result]").textContent = Math.abs(result.frequencyKhz - result.nyquistKhz) < 1e-9
      ? `Частота равна fₛ/2 = ${format(result.nyquistKhz)} кГц. Граничный случай: однозначность для любой фазы не гарантирована.`
      : result.aliases
      ? `Граница fₛ/2 = ${format(result.nyquistKhz)} кГц. Отсчёты также совпадают с синусоидой ${format(result.apparentKhz)} кГц: исходную частоту по ним не определить.`
      : `Граница fₛ/2 = ${format(result.nyquistKhz)} кГц. Синусоида ниже этой границы; показанная частота по отсчётам совпадает с исходной.`;
  };
  root.addEventListener("input", draw);
  draw();
}

function mountSpectrum(root) {
  root.innerHTML = `<div class="ks-controls"><label>Верхняя частота сигнала <output data-max>1,2 кГц</output><input data-max-input type="range" min="0.5" max="1.8" step="0.1" value="1.2"></label><label>Частота дискретизации <output data-rate>3,4 кГц</output><input data-rate-input type="range" min="2" max="5" step="0.1" value="3.4"></label></div><div class="ks-chart" data-chart tabindex="0" role="region" aria-label="График дискретизации"></div><div class="ks-legend"><span><i class="ks-center-key"></i>Исходная полоса</span><span><i class="ks-neighbor-key"></i>Соседние копии</span><span><i class="ks-overlap-key"></i>Наложение</span><span><i class="ks-nyquist-key"></i>±fₛ/2</span></div><p class="ks-result" data-result aria-live="polite"></p>`;
  const maxInput = root.querySelector("[data-max-input]");
  const rateInput = root.querySelector("[data-rate-input]");
  const draw = () => {
    const result = spectralCopies(Number(maxInput.value), Number(rateInput.value));
    root.querySelector("[data-max]").textContent = `${format(result.maxFrequencyKhz)} кГц`;
    root.querySelector("[data-rate]").textContent = `${format(result.sampleRateKhz)} кГц`;
    root.querySelector("[data-chart]").innerHTML = spectrumSvg(result);
    root.querySelector("[data-result]").textContent = result.gapKhz > 1e-9
      ? `Между копиями есть промежуток ${format(result.gapKhz)} кГц: fₛ > 2fₘₐₓ.`
      : result.gapKhz < -1e-9
        ? `Копии перекрываются на ${format(-result.gapKhz)} кГц: fₛ < 2fₘₐₓ, возникает наложение спектров.`
        : "Копии касаются краями: fₛ = 2fₘₐₓ. Для практического фильтра нужен запас.";
  };
  root.addEventListener("input", draw);
  draw();
}

document.querySelectorAll('[data-sampling="tone"]').forEach(mountTone);
document.querySelectorAll('[data-sampling="spectrum"]').forEach(mountSpectrum);
