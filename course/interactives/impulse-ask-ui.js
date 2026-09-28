import {PRACTICE_FFT_SIZE, SAMPLE_RATE_KHZ, averagedPowerSpectrum, practiceSignals, periodicPulseFourier} from "./impulse-ask-model.js";

function plot(title, points, {xMax, yMin, yMax, xLabel, yLabel, ticks, stems = false, marks = [], tickOffset = 0, tickLabel, note = "", reference = [], average = null, bitGuides = []}) {
  const l = 60, r = 940, t = 26, b = 274;
  const x = value => l + value / xMax * (r-l);
  const y = value => b - (value-yMin) / (yMax-yMin) * (b-t);
  const grid = ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${t}" y2="${b}" class="ia-grid"/><text x="${x(v)}" y="297" text-anchor="middle">${tickLabel ? tickLabel(v) : v+tickOffset}</text>`).join("");
  const path = data => data.map(([f,a],i) => `${i ? "L" : "M"}${x(f).toFixed(1)},${y(a).toFixed(1)}`).join(" ");
  const shade = bitGuides.map((bit,i) => `<rect x="${x(i*xMax/bitGuides.length)}" y="${t}" width="${(r-l)/bitGuides.length}" height="${b-t}" class="ia-bit-shade ${bit ? "ia-bit-one" : ""}"/><text x="${x((i+.5)*xMax/bitGuides.length)}" y="19" text-anchor="middle">${bit}</text>`).join("");
  const guide = average === null ? "" : `<line x1="${l}" x2="${r}" y1="${y(average)}" y2="${y(average)}" class="ia-average"/><text x="${r-8}" y="${y(average)-7}" text-anchor="end">DC = ${average.toFixed(2).replace(".",",")}</text>`;
  const background = reference.length ? `<path d="${path(reference)}" class="ia-reference"/>` : "";
  const trace = stems ? points.map(([f,a]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${b}" y2="${y(a)}" class="ia-stem ${f === 0 ? "ia-dc-stem" : ""}"/>`).join("")
    : `<path d="${path(points)}" class="ia-line"/>`;
  const markers = marks.map(([f,label]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${t}" y2="${b}" class="ia-marker"/><text x="${x(f)+6}" y="47">${label}</text>`).join("");
  return `<figure class="ia-figure"><figcaption>${title}</figcaption><svg viewBox="0 0 970 330" role="img" aria-label="${title}: ${xLabel}, ${yLabel}"><rect x="${l}" y="${t}" width="${r-l}" height="${b-t}" class="ia-paper"/>${shade}${grid}<line x1="${l}" x2="${r}" y1="${b}" y2="${b}" class="ia-axis"/>${background}${guide}${trace}${markers}<text x="500" y="326" text-anchor="middle">${xLabel}</text><text x="14" y="150" text-anchor="middle" transform="rotate(-90 14 150)">${yLabel}</text></svg>${note ? `<p class="ia-plot-note">${note}</p>` : ""}</figure>`;
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

function timePlot(name, signal, bitRateKbps) {
  const spanMs = 3 / bitRateKbps;
  const count = Math.ceil(spanMs * SAMPLE_RATE_KHZ);
  const points = Array.from({length: count}, (_, i) => [i / SAMPLE_RATE_KHZ, signal[i]]);
  const labels = {ask:"ASK: амплитуда на трёх битах", fsk:"FSK: частота на трёх битах", psk:"BPSK: фаза на трёх битах"};
  return plot(labels[name], points, {
    xMax:spanMs, yMin:-1.2, yMax:1.2, xLabel:"Время, мс", yLabel:"Амплитуда",
    ticks:[0, 1/bitRateKbps, 2/bitRateKbps, spanMs],
    tickLabel:value=>value.toFixed(2).replace(".",","),
    bitGuides:[1,0,1],
  });
}

function mount(root) {
  root.innerHTML = `<section class="ia-section"><div class="ia-heading"><span class="ia-number">01</span><div><h2>Ряд Фурье и постоянная составляющая</h2><p>Период сигнала 0,5 мс, верхний уровень H = 1. Меняйте нижний уровень L, долю высокого уровня D и число гармоник N. Сравнивайте идеальный прямоугольник с его частичной суммой.</p></div></div><div class="ia-controls"><label>Нижний уровень L <select name="low"><option value="-1" selected>−1: двуполярный</option><option value="0">0: однополярный</option></select></label><label>Доля высокого уровня D <select name="duty"><option value="0.25">25%</option><option value="0.5" selected>50%</option><option value="0.75">75%</option></select></label><label>Гармоники до N <select name="harmonics"><option value="1">1</option><option value="3">3</option><option value="5">5</option><option value="9" selected>9</option><option value="19">19</option></select></label></div><div class="ia-fourier-plots"></div><p class="ia-observation" data-fourier-note></p></section>
  <section class="ia-section"><div class="ia-heading"><span class="ia-number">02</span><div><h2>Биты во времени и в спектре</h2><p>Сверху каждого спектра показаны первые три бита 101 той же длинной последовательности. Несущая равна 100 кГц. Все три способа используют одинаковые биты и битовую скорость.</p></div></div><div class="ia-controls"><label>Битовая скорость <input name="bitRate" type="range" min="5" max="25" step="5" value="10"><output data-rate>10 кбит/с</output></label></div><div class="ia-spectrum-plots"></div><p class="ia-observation"><strong>Сравнивайте:</strong> положение сильных составляющих, линию точно на частоте несущей и ширину боковых областей. При смене скорости сначала посмотрите на длительность бита во времени, затем на ширину спектра.</p><p class="ia-method" data-method></p></section>`;
  if (root.dataset.impulseAsk === "fourier") root.querySelectorAll(".ia-section")[1].remove();
  if (root.dataset.impulseAsk === "modulation") root.querySelectorAll(".ia-section")[0].remove();
  function drawFourier() {
    const count = Number(root.querySelector('[name="harmonics"]').value);
    const low = Number(root.querySelector('[name="low"]').value);
    const duty = Number(root.querySelector('[name="duty"]').value);
    const series = periodicPulseFourier(count, low, duty);
    root.querySelector(".ia-fourier-plots").innerHTML =
      plot("Один сигнал: идеальная форма и сумма гармоник",series.time.map((t,i)=>[t,series.values[i]]),{
        xMax:1,yMin:-1.5,yMax:1.5,xLabel:"Время, мс",yLabel:"Уровень",ticks:[0,.25,.5,.75,1],
        reference:series.time.map((t,i)=>[t,series.ideal[i]]),average:series.dc,
        note:"Пунктир — идеальный прямоугольник; сплошная кривая — сумма N гармоник и DC. Линия DC показывает среднее за период."
      }) +
      plot("Амплитуды составляющих",series.lines.map(line=>[line.frequencyKhz,line.amplitude]),{
        xMax:40,yMin:0,yMax:1.4,xLabel:"Частота, кГц",yLabel:"Амплитуда",ticks:[0,10,20,30,40],stems:true,
        note:"Столбец при 0 кГц — модуль DC. Остальные линии стоят на частотах n·f₀; нулевая амплитуда означает отсутствующую гармонику."
      });
    root.querySelector("[data-fourier-note]").textContent = `Среднее за период: x_DC = ${low} + (1 − ${low}) × ${duty.toString().replace(".",",")} = ${series.dc.toFixed(2).replace(".",",")}. На частоте 0 кГц амплитуда равна |x_DC| = ${Math.abs(series.dc).toFixed(2).replace(".",",")}. Число добавленных гармоник: ${count}.`;
  }
  function drawSpectra() {
    const rate = Number(root.querySelector('[name="bitRate"]').value);
    root.querySelector("[data-rate]").textContent = `${rate} кбит/с; Tб = ${(1/rate).toFixed(3).replace(".",",")} мс`;
    const signals = practiceSignals(rate);
    const spectra = ["ask","fsk","psk"].map(name=>[name,averagedPowerSpectrum(signals[name])]);
    root.querySelector(".ia-spectrum-plots").innerHTML = spectra.map(([name,estimate])=>
      `<div class="ia-modulation-card">${timePlot(name,signals[name],rate)}${spectrumPlot(name,estimate)}</div>`).join("");
    root.querySelector("[data-method]").textContent = `Частота дискретизации ${(SAMPLE_RATE_KHZ/1000).toFixed(1).replace(".",",")} МГц. Относительная мощность: ${spectra[0][1].windows} перекрывающихся окон БПФ по ${PRACTICE_FFT_SIZE} отсчётов (${(PRACTICE_FFT_SIZE/SAMPLE_RATE_KHZ).toFixed(2).replace(".",",")} мс на окно), частотный шаг ${spectra[0][1].stepKhz.toFixed(2).replace(".",",")} кГц. Неровности конечной оценки возможны; сравнивайте устойчивую форму, а не отдельные зубцы.`;
  }
  root.addEventListener("change", event => {
    if (["harmonics","low","duty"].includes(event.target.name)) drawFourier();
  });
  root.addEventListener("input", event => { if (event.target.name === "bitRate") drawSpectra(); });
  if (root.querySelector(".ia-fourier-plots")) drawFourier();
  if (root.querySelector(".ia-spectrum-plots")) drawSpectra();
}
for (const root of document.querySelectorAll("[data-impulse-ask]")) mount(root);
