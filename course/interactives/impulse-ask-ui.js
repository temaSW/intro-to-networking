import {SAMPLE_RATE_KHZ, PRACTICE_VARIANTS, averagedPowerSpectrum, practiceSignals, periodicPulseFourier, translatedToneSpectrum} from "./impulse-ask-model.js";

const decimal = value => String(value).replace(".", ",");

function mountVariant(root) {
  const select = root.querySelector("select");
  select.innerHTML = PRACTICE_VARIANTS.map((_, i) => `<option value="${i}">Вариант ${i + 1}</option>`).join("");
  function show() {
    const v = PRACTICE_VARIANTS[Number(select.value)];
    root.querySelector(".ia-variant-values").innerHTML = Object.entries({
      "L": v.low, "D": `${v.duty * 100}%`, "Rb1": `${v.rate1} кбит/с`,
      "Rb2": `${v.rate2} кбит/с`, "Bкан": `${v.channelBand} кГц`,
      "fc": `${v.carrier} кГц`, "fср": `${v.cutoff} кГц`, "Bф": `0–${v.cutoff} кГц`,
    }).map(([key, value]) => `<div><span>${key}</span><strong>${decimal(value)}</strong></div>`).join("");
  }
  select.addEventListener("change", show);
  show();
}

function plot(title, points, {xMax, yMin, yMax, xLabel, yLabel, ticks, stems = false, marks = [], tickOffset = 0, tickLabel, note = "", reference = [], average = null, bitGuides = [], cutoff = null, rejected = [], band = null}) {
  const l = 60, r = 940, t = 26, b = 274;
  const x = value => l + value / xMax * (r-l);
  const y = value => b - (value-yMin) / (yMax-yMin) * (b-t);
  const grid = ticks.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="${t}" y2="${b}" class="ia-grid"/><text x="${x(v)}" y="297" text-anchor="middle">${tickLabel ? tickLabel(v) : v+tickOffset}</text>`).join("");
  const path = data => data.map(([f,a],i) => `${i ? "L" : "M"}${x(f).toFixed(1)},${y(a).toFixed(1)}`).join(" ");
  const shade = bitGuides.map((bit,i) => `<rect x="${x(i*xMax/bitGuides.length)}" y="${t}" width="${(r-l)/bitGuides.length}" height="${b-t}" class="ia-bit-shade ${bit ? "ia-bit-one" : ""}"/><text x="${x((i+.5)*xMax/bitGuides.length)}" y="19" text-anchor="middle">${bit}</text>`).join("");
  const guide = average === null ? "" : `<line x1="${l}" x2="${r}" y1="${y(average)}" y2="${y(average)}" class="ia-average"/><text x="${r-8}" y="${y(average)-7}" text-anchor="end">DC = ${average.toFixed(2).replace(".",",")}</text>`;
  const background = reference.length ? `<path d="${path(reference)}" class="ia-reference"/>` : "";
  const stopband = cutoff === null ? "" : `<rect x="${x(cutoff)}" y="${t}" width="${r-x(cutoff)}" height="${b-t}" class="ia-stopband"/><line x1="${x(cutoff)}" x2="${x(cutoff)}" y1="${t}" y2="${b}" class="ia-cutoff"/><text x="${x(cutoff)-7}" y="47" text-anchor="end">fср = ${cutoff} кГц</text>`;
  const bandShade = band === null ? "" : `<rect x="${l}" y="${t}" width="${x(50-band)-l}" height="${b-t}" class="ia-outside-band"/><rect x="${x(50+band)}" y="${t}" width="${r-x(50+band)}" height="${b-t}" class="ia-outside-band"/><line x1="${x(50-band)}" x2="${x(50-band)}" y1="${t}" y2="${b}" class="ia-cutoff"/><line x1="${x(50+band)}" x2="${x(50+band)}" y1="${t}" y2="${b}" class="ia-cutoff"/>`;
  const removed = rejected.map(([f,a]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${b}" y2="${y(a)}" class="ia-rejected-stem"/>`).join("");
  const trace = stems ? points.map(([f,a]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${b}" y2="${y(a)}" class="ia-stem ${f === 0 ? "ia-dc-stem" : ""}"/>`).join("")
    : `<path d="${path(points)}" class="ia-line"/>`;
  const markers = marks.map(([f,label]) => `<line x1="${x(f)}" x2="${x(f)}" y1="${t}" y2="${b}" class="ia-marker"/><text x="${x(f)+6}" y="47">${label}</text>`).join("");
  return `<figure class="ia-figure"><figcaption>${title}</figcaption><svg viewBox="0 0 970 330" role="img" aria-label="${title}: ${xLabel}, ${yLabel}"><rect x="${l}" y="${t}" width="${r-l}" height="${b-t}" class="ia-paper"/>${shade}${grid}${stopband}${bandShade}<line x1="${l}" x2="${r}" y1="${b}" y2="${b}" class="ia-axis"/>${background}${guide}${removed}${trace}${markers}<text x="500" y="326" text-anchor="middle">${xLabel}</text><text x="14" y="150" text-anchor="middle" transform="rotate(-90 14 150)">${yLabel}</text></svg>${note ? `<p class="ia-plot-note">${note}</p>` : ""}</figure>`;
}

function spectrumPlot(name, estimate, band) {
  const {power, stepKhz} = estimate;
  const first = Math.ceil(50 / stepKhz), last = Math.floor(150 / stepKhz);
  let peak = 0;
  for (let i = first; i <= last; i++) peak = Math.max(peak, power[i]);
  const points = [];
  for (let i = first; i <= last; i++) points.push([i*stepKhz-50, Math.max(-55, 10*Math.log10(Math.max(power[i]/peak, 1e-8)))]);
  const titles = {ask:"ASK: спектр", fsk:"FSK: спектр", psk:"BPSK: спектр"};
  const marks = name === "fsk" ? [[32,"f₀"],[68,"f₁"]] : [[50,"fc"]];
  return plot(titles[name], points, {xMax:100,yMin:-55,yMax:0,xLabel:"Частота, кГц",yLabel:"Мощность, дБ",ticks:[0,25,50,75,100],tickOffset:50,marks,band,
    note:`Незатенённая полоса канала: ${100-band}–${100+band} кГц. Затенённые области недоступны.`});
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

function translationPlots(carrierKhz, cutoffKhz, stageName) {
  const {baseband, translated, passed, rejected, recovered, timeMs, basebandTime, translatedTime, passedTime, recoveredTime} = translatedToneSpectrum(carrierKhz, cutoffKhz);
  const points = lines => lines.map(line => [line.frequencyKhz, line.amplitude]);
  const timePlot = (title, values, reference = [], note = "") => plot(title, timeMs.map((t, i) => [t, values[i]]), {
    xMax:.2, yMin:-2.3, yMax:2.3, xLabel:"Время, мс", yLabel:"Амплитуда",
    ticks:[0,.05,.1,.15,.2], tickLabel:value=>value.toFixed(2).replace(".", ","),
    reference:reference.map((value, i) => [timeMs[i], value]), note,
  });
  const stage = (time, spectrum) => `<div class="ia-translation-card">${time}${spectrum}</div>`;
  const common = {xMax:125, yMin:0, yMax:.55, xLabel:"Частота, кГц", yLabel:"Амплитуда", ticks:[0,25,50,75,100,125], stems:true};
  const original = stage(timePlot("Исходный сигнал во времени", basebandTime), plot("Исходный спектр", points(baseband), {
    xMax:25, yMin:0, yMax:1.1, xLabel:"Частота, кГц", yLabel:"Амплитуда", ticks:[0,5,10,15,20,25], stems:true,
  }));
  const lineTable = (filtered = false) => `<div class="ia-line-table-wrap"><table class="ia-line-table"><caption>${filtered ? "Линии после фильтра" : "Линии после переноса"}</caption><thead><tr><th>Исходная, кГц</th><th>Боковая</th><th>Частота, кГц</th><th>Амплитуда</th>${filtered ? "<th>Фильтр</th>" : ""}</tr></thead><tbody>${baseband.flatMap(tone => [-1,1].map(sign => {
    const frequency = carrierKhz + sign * tone.frequencyKhz;
    const passedLine = frequency <= cutoffKhz;
    return `<tr><td>${tone.frequencyKhz}</td><td>${sign < 0 ? "нижняя" : "верхняя"}</td><td>${frequency}</td><td>${decimal(tone.amplitude / 2)}</td>${filtered ? `<td>${passedLine ? "прошла" : "отброшена"}</td>` : ""}</tr>`;
  })).join("")}</tbody></table></div>`;
  if (stageName === "translated") return original + stage(timePlot("На несущей до фильтра: сигнал во времени", translatedTime),
    plot("На несущей до фильтра: спектр", points(translated), common)) + lineTable();
  if (stageName === "filtered") return stage(timePlot("На несущей после фильтра: сигнал во времени", passedTime, translatedTime),
    plot("На несущей после фильтра: спектр", points(passed), {
      ...common, cutoff:cutoffKhz, rejected:points(rejected),
      note:"Фильтр пропускает сплошные составляющие; пунктир показывает отсечённые.",
    })) + lineTable(true);
  const recoveryTable = `<div class="ia-line-table-wrap"><table class="ia-line-table"><caption>Амплитуды после обратного переноса</caption><thead><tr><th>Частота, кГц</th><th>Исходная</th><th>Восстановленная</th><th>Коэффициент</th></tr></thead><tbody>${baseband.map((tone, i) => `<tr><td>${tone.frequencyKhz}</td><td>${decimal(tone.amplitude)}</td><td>${decimal(recovered[i].amplitude)}</td><td>${decimal(recovered[i].amplitude / tone.amplitude)}</td></tr>`).join("")}</tbody></table></div>`;
  return original + stage(timePlot("После переноса на ноль и ФНЧ: сигнал во времени", recoveredTime, basebandTime,
      "Пунктир — исходный сигнал для сравнения."),
    plot("После переноса на ноль и ФНЧ: спектр", points(recovered), {
      xMax:25, yMin:0, yMax:1.1, xLabel:"Частота, кГц", yLabel:"Амплитуда",
      ticks:[0,5,10,15,20,25], stems:true,
      note:"Умножение на 2 cos(2πfct) и ФНЧ 25 кГц.",
    })) + recoveryTable;
}

function mount(root) {
  const kind = root.dataset.impulseAsk;
  const controls = {
    fourier: `<label>Нижний уровень L <select name="low"><option value="-1">−1</option><option value="0">0</option></select></label><label>Доля высокого уровня D <select name="duty"><option value="0.25">25%</option><option value="0.5">50%</option><option value="0.75">75%</option></select></label><label>Гармоники до N <select name="harmonics"><option value="1">1</option><option value="3">3</option><option value="5">5</option><option value="9">9</option><option value="19">19</option></select></label>`,
    modulation: `<label>Битовая скорость <input name="rate" type="range" min="5" max="25" step="5"><output data-rate></output></label><label>Полоса канала Bкан от несущей в каждую сторону <input name="channelBand" type="range" min="5" max="50" step="1" value="15"><output data-channel-band></output></label>`,
    translation: `<label>Частота несущей <input name="carrier" type="range" min="40" max="100" step="5"><output data-carrier></output></label>${root.dataset.stage === "translated" ? "" : `<label>Граница ФНЧ <input name="cutoff" type="range" min="40" max="125" step="5"><output data-cutoff></output></label>`}`,
  };
  root.innerHTML = `<section class="ia-section"><div class="ia-controls">${controls[kind]}</div><button type="button" class="ia-check">Запустить симуляцию</button><div class="ia-result" hidden></div></section>`;
  for (const input of root.querySelectorAll("[name]")) {
    if (root.dataset[input.name] !== undefined) input.value = root.dataset[input.name];
  }
  const result = root.querySelector(".ia-result");
  const read = name => Number(root.querySelector(`[name="${name}"]`)?.value ?? root.dataset[name]);
  function updateValues() {
    if (kind === "modulation") {
      root.querySelector("[data-rate]").textContent = `${read("rate")} кбит/с`;
      root.querySelector("[data-channel-band]").textContent = `±${read("channelBand")} кГц`;
    }
    if (kind === "translation") {
      root.querySelector("[data-carrier]").textContent = `${read("carrier")} кГц`;
      if (root.querySelector("[data-cutoff]")) root.querySelector("[data-cutoff]").textContent = `${read("cutoff")} кГц`;
    }
  }
  function drawFourier() {
    const series = periodicPulseFourier(read("harmonics"), read("low"), read("duty"));
    result.innerHTML = plot("Один сигнал: идеальная форма и сумма гармоник",series.time.map((t,i)=>[t,series.values[i]]),{
      xMax:1,yMin:-1.5,yMax:1.5,xLabel:"Время, мс",yLabel:"Уровень",ticks:[0,.25,.5,.75,1],
      reference:series.time.map((t,i)=>[t,series.ideal[i]]),average:series.dc,
      note:"Пунктир — идеальная форма; сплошная кривая — частичная сумма ряда."
    }) + plot("Амплитуды составляющих",series.lines.map(line=>[line.frequencyKhz,line.amplitude]),{
      xMax:40,yMin:0,yMax:1.4,xLabel:"Частота, кГц",yLabel:"Амплитуда",ticks:[0,10,20,30,40],stems:true,
      note:"Номер гармоники = частота / 2 кГц. Амплитуда DC на графике показана по модулю."
    });
  }
  function drawSpectra() {
    const rate = read("rate"), band = read("channelBand");
    const signals = practiceSignals(rate);
    const spectra = ["ask","fsk","psk"].map(name=>[name,averagedPowerSpectrum(signals[name])]);
    result.innerHTML = `<p class="ia-readout">Tб = ${decimal((1/rate).toFixed(3))} мс</p>` + spectra.map(([name,estimate])=>
      `<div class="ia-modulation-card">${timePlot(name,signals[name],rate)}${spectrumPlot(name,estimate,band)}</div>`).join("");
  }
  function drawTranslation() {
    result.innerHTML = translationPlots(read("carrier"), read("cutoff"), root.dataset.stage);
  }
  root.addEventListener("input", event => {
    if (event.target.matches("[name]")) {
      result.hidden = true;
      result.innerHTML = "";
      updateValues();
    }
  });
  root.addEventListener("change", event => {
    if (event.target.matches("[name]")) {
      result.hidden = true;
      result.innerHTML = "";
      updateValues();
    }
  });
  root.querySelector(".ia-check").addEventListener("click", () => {
    if (kind === "fourier") drawFourier();
    if (kind === "modulation") drawSpectra();
    if (kind === "translation") drawTranslation();
    result.hidden = false;
  });
  updateValues();
}
for (const root of document.querySelectorAll("[data-practice-variant]")) mountVariant(root);
for (const root of document.querySelectorAll("[data-impulse-ask]")) mount(root);
