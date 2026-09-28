import {PRACTICE_FFT_SIZE, SAMPLE_RATE_KHZ, averagedPowerSpectrum, practiceSignals, squareFourier} from "./impulse-ask-model.js";

function plot(title, points, {xMax, yMin, yMax, xLabel, yLabel, ticks, stems = false, marks = [], tickOffset = 0, note = ""}) {
  const l = 60, r = 940, t = 26, b = 274;
  const x = value => l + value / xMax * (r-l);
  const y = value => b - (value-yMin) / (yMax-yMin) * (b-t);
  const grid = ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${t}" y2="${b}" class="ia-grid"/><text x="${x(v)}" y="297" text-anchor="middle">${v+tickOffset}</text>`).join("");
  const trace = stems ? points.map(([f,a]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${b}" y2="${y(a)}" class="ia-stem"/>`).join("")
    : `<path d="${points.map(([f,a],i) => `${i ? "L" : "M"}${x(f).toFixed(1)},${y(a).toFixed(1)}`).join(" ")}" class="ia-line"/>`;
  const markers = marks.map(([f,label]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${t}" y2="${b}" class="ia-marker"/><text x="${x(f)+6}" y="47">${label}</text>`).join("");
  return `<figure class="ia-figure"><figcaption>${title}</figcaption><svg viewBox="0 0 970 330" role="img" aria-label="${title}: ${xLabel}, ${yLabel}"><rect x="${l}" y="${t}" width="${r-l}" height="${b-t}" class="ia-paper"/>${grid}<line x1="${l}" x2="${r}" y1="${b}" y2="${b}" class="ia-axis"/>${trace}${markers}<text x="500" y="326" text-anchor="middle">${xLabel}</text><text x="14" y="150" text-anchor="middle" transform="rotate(-90 14 150)">${yLabel}</text></svg>${note ? `<p class="ia-plot-note">${note}</p>` : ""}</figure>`;
}

function spectrumPlot(name, estimate) {
  const {power, stepKhz} = estimate;
  const first = Math.ceil(50 / stepKhz), last = Math.floor(150 / stepKhz);
  let peak = 0;
  for (let i = first; i <= last; i++) peak = Math.max(peak, power[i]);
  const points = [];
  for (let i = first; i <= last; i++) points.push([i*stepKhz-50, Math.max(-55, 10*Math.log10(Math.max(power[i]/peak, 1e-8)))]);
  const titles = {ask:"ASK — включаем и выключаем несущую", fsk:"FSK — переключаем две частоты", psk:"BPSK — меняем фазу на 180°"};
  const marks = name === "fsk" ? [[32,"f₀"],[68,"f₁"]] : [[50,"fc"]];
  const notes = {
    ask: "Нулевые биты выключают несущую, единичные оставляют её. Средняя амплитуда не равна нулю, поэтому в центре остаётся узкая линия; переключения добавляют боковые составляющие.",
    fsk: "Биты выбирают частоту 82 или 118 кГц. Поэтому энергия собирается около двух частот. При быстрых переключениях области расширяются и могут сливаться.",
    psk: "Биты меняют знак несущей, то есть её фазу на 180°. Средний знак близок к нулю: постоянной линии несущей нет, а переходы создают боковые составляющие.",
  };
  return plot(titles[name], points, {xMax:100,yMin:-55,yMax:0,xLabel:"Частота, кГц",yLabel:"Мощность, дБ",ticks:[0,25,50,75,100],tickOffset:50,marks,note:notes[name]});
}

function mount(root) {
  root.innerHTML = `<section class="ia-section"><div class="ia-heading"><span class="ia-number">01</span><div><h2>От синусоиды к прямоугольнику</h2><p>У чистой синусоиды одна частота. Прямоугольный сигнал получается из нечётных гармоник: 1, 3, 5… Чем больше высоких гармоник, тем круче фронт.</p></div></div><div class="ia-controls"><label>Старшая гармоника <select name="harmonics"><option value="1">1 — одна синусоида</option><option value="3">3</option><option value="5">5</option><option value="9" selected>9</option><option value="19">19</option></select></label></div><div class="ia-fourier-plots"></div><p class="ia-observation" data-fourier-note></p></section>
  <section class="ia-section"><div class="ia-heading"><span class="ia-number">02</span><div><h2>Три способа передать биты</h2><p>Во всех трёх случаях одна и та же длинная последовательность битов и несущая 100 кГц. Меняется только способ кодирования битов в радиосигнале.</p></div></div><div class="ia-controls"><label>Битовая скорость <input name="bitRate" type="range" min="5" max="25" step="5" value="10"><output data-rate>10 кбит/с</output></label></div><div class="ia-spectrum-plots"></div><p class="ia-observation"><strong>На что смотреть:</strong> у ASK заметна линия несущей, у FSK — две области около выбранных частот, у BPSK — широкая область вокруг несущей без устойчивой линии. Увеличьте скорость: каждый бит короче, поэтому боковые области шире.</p><p class="ia-method" data-method></p></section>`;
  function drawFourier() {
    const count = Number(root.querySelector('[name="harmonics"]').value);
    const series = squareFourier(count);
    root.querySelector(".ia-fourier-plots").innerHTML =
      plot("Сигнал во времени",series.time.map((t,i)=>[t,series.values[i]]),{xMax:1,yMin:-1.5,yMax:1.5,xLabel:"Время, мс",yLabel:"Амплитуда",ticks:[0,.25,.5,.75,1]}) +
      plot("Составляющие ряда Фурье",series.lines.map(line=>[line.frequencyKhz,line.amplitude]),{xMax:40,yMin:0,yMax:1.4,xLabel:"Частота, кГц",yLabel:"Амплитуда",ticks:[0,10,20,30,40],stems:true});
    root.querySelector("[data-fourier-note]").textContent = `Число составляющих: ${series.lines.length}. Частоты кратны 2 кГц; амплитуда убывает как 1/n. Пики — спектральные линии периодического сигнала.`;
  }
  function drawSpectra() {
    const rate = Number(root.querySelector('[name="bitRate"]').value);
    root.querySelector("[data-rate]").textContent = `${rate} кбит/с`;
    const signals = practiceSignals(rate);
    const spectra = ["ask","fsk","psk"].map(name=>[name,averagedPowerSpectrum(signals[name])]);
    root.querySelector(".ia-spectrum-plots").innerHTML = spectra.map(([name,estimate])=>spectrumPlot(name,estimate)).join("");
    root.querySelector("[data-method]").textContent = `Частота дискретизации ${(SAMPLE_RATE_KHZ/1000).toFixed(1).replace(".",",")} МГц. Относительная мощность: ${spectra[0][1].windows} перекрывающихся окон БПФ по ${PRACTICE_FFT_SIZE} отсчётов (${(PRACTICE_FFT_SIZE/SAMPLE_RATE_KHZ).toFixed(2).replace(".",",")} мс на окно), частотный шаг ${spectra[0][1].stepKhz.toFixed(2).replace(".",",")} кГц. Неровности конечной оценки возможны; сравнивайте устойчивую форму, а не отдельные зубцы.`;
  }
  root.addEventListener("change", event => {
    if (event.target.name === "harmonics") drawFourier();
  });
  root.addEventListener("input", event => { if (event.target.name === "bitRate") drawSpectra(); });
  drawFourier();
  drawSpectra();
}
for (const root of document.querySelectorAll("[data-impulse-ask]")) mount(root);
