import {SAMPLE_RATE_KHZ, averagedPowerSpectrum, practiceSignals, periodicPulseFourier} from "./impulse-ask-model.js";

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
  const titles = {ask:"ASK: спектр", fsk:"FSK: спектр", psk:"BPSK: спектр"};
  const marks = name === "fsk" ? [[32,"f₀"],[68,"f₁"]] : [[50,"fc"]];
  return plot(titles[name], points, {xMax:100,yMin:-55,yMax:0,xLabel:"Частота, кГц",yLabel:"Мощность, дБ",ticks:[0,25,50,75,100],tickOffset:50,marks});
}

function timePlot(name, signal, bitRateKbps) {
  const spanMs = 3 / bitRateKbps;
  const count = Math.ceil(spanMs * SAMPLE_RATE_KHZ);
  const points = Array.from({length: count}, (_, i) => [i / SAMPLE_RATE_KHZ, signal[i]]);
  return plot(`${name.toUpperCase()}: три бита во времени`, points, {
    xMax:spanMs, yMin:-1.2, yMax:1.2, xLabel:"Время, мс", yLabel:"Амплитуда",
    ticks:[0, 1/bitRateKbps, 2/bitRateKbps, spanMs],
    tickLabel:value=>value.toFixed(2).replace(".",","),
    bitGuides:[1,0,1],
  });
}

function mount(root) {
  root.innerHTML = `<section class="ia-section"><div class="ia-controls"><label>Нижний уровень L <select name="low"><option value="-1">−1</option><option value="0">0</option></select></label><label>Доля высокого уровня D <select name="duty"><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.75">75%</option></select></label><label>Гармоники до N <select name="harmonics"><option value="1">1</option><option value="3">3</option><option value="5">5</option><option value="9">9</option><option value="19">19</option></select></label></div><div class="ia-fourier-plots"></div></section>
  <section class="ia-section"><div class="ia-controls"><label>Битовая скорость <input name="bitRate" type="range" min="5" max="25" step="5" value="10"><output data-rate>10 кбит/с</output></label></div><div class="ia-spectrum-plots"></div></section>`;
  if (root.dataset.impulseAsk === "fourier") root.querySelectorAll(".ia-section")[1].remove();
  if (root.dataset.impulseAsk === "modulation") root.querySelectorAll(".ia-section")[0].remove();
  for (const name of ["low", "duty", "harmonics", "bitRate"]) {
    const input = root.querySelector(`[name="${name}"]`);
    if (input && root.dataset[name] !== undefined) input.value = root.dataset[name];
  }
  function drawFourier() {
    const count = Number(root.querySelector('[name="harmonics"]').value);
    const low = Number(root.querySelector('[name="low"]').value);
    const duty = Number(root.querySelector('[name="duty"]').value);
    const series = periodicPulseFourier(count, low, duty);
    root.querySelector(".ia-fourier-plots").innerHTML =
      plot("Один сигнал: идеальная форма и сумма гармоник",series.time.map((t,i)=>[t,series.values[i]]),{
        xMax:1,yMin:-1.5,yMax:1.5,xLabel:"Время, мс",yLabel:"Уровень",ticks:[0,.25,.5,.75,1],
        reference:series.time.map((t,i)=>[t,series.ideal[i]]),average:series.dc,
        note:"Пунктир — идеальная форма; сплошная кривая — частичная сумма ряда."
      }) +
      plot("Амплитуды составляющих",series.lines.map(line=>[line.frequencyKhz,line.amplitude]),{
        xMax:40,yMin:0,yMax:1.4,xLabel:"Частота, кГц",yLabel:"Амплитуда",ticks:[0,10,20,30,40],stems:true,
        note:"Сравните высоты и положения линий при разных параметрах."
      });
  }
  function drawSpectra() {
    const rate = Number(root.querySelector('[name="bitRate"]').value);
    root.querySelector("[data-rate]").textContent = `${rate} кбит/с; Tб = ${(1/rate).toFixed(3).replace(".",",")} мс`;
    const signals = practiceSignals(rate);
    const spectra = ["ask","fsk","psk"].map(name=>[name,averagedPowerSpectrum(signals[name])]);
    root.querySelector(".ia-spectrum-plots").innerHTML = spectra.map(([name,estimate])=>
      `<div class="ia-modulation-card">${timePlot(name,signals[name],rate)}${spectrumPlot(name,estimate)}</div>`).join("");
  }
  root.addEventListener("change", event => {
    if (["harmonics","low","duty"].includes(event.target.name)) drawFourier();
  });
  root.addEventListener("input", event => { if (event.target.name === "bitRate") drawSpectra(); });
  if (root.querySelector(".ia-fourier-plots")) drawFourier();
  if (root.querySelector(".ia-spectrum-plots")) drawSpectra();
}
for (const root of document.querySelectorAll("[data-impulse-ask]")) mount(root);
