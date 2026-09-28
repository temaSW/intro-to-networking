import {
  SAMPLE_RATE_KHZ, FFT_SIZE, sinc, pulseSpectrum, rectangularPulse, periodicPulse,
  bitWaveform, carrier, ook, addSignals, spectrum, bandpass, mainLobeOverlap,
} from "./impulse-ask-model.js";

const stages = [
  ["Импульс", "Что изменится в спектре, если сделать импульс вдвое короче?", "Станет шире: первый нуль уйдёт к большей частоте."],
  ["Повторение", "Если увеличить T вдвое, что изменится: огибающая или расстояние между линиями?", "Расстояние между гармониками уменьшится вдвое; огибающая определяется τ."],
  ["Биты", "У двух последовательностей с одинаковой Rb обязательно одинаковый спектр?", "Нет. Смените набор битов: конечные фрагменты имеют разный спектр."],
  ["Полосовой канал", "Пройдёт ли текущий сигнал около нуля через канал 90…110 кГц?", "Нет. Его основные составляющие находятся около нуля."],
  ["Несущая", "Содержит ли чистая синусоида вашу последовательность битов?", "Нет. В несущей пока нет зависимости от битов."],
  ["ASK / OOK", "Что меняет fc: положение или характерную ширину спектра?", "fc перемещает спектр; ширина зависит прежде всего от Rb и формы импульса. Это описывает S(f) = A/2 [M(f−fc) + M(f+fc)]."],
  ["Попади в канал", "Почему нельзя поместить слишком широкий сигнал в узкий канал одним сдвигом fc?", "Сдвиг меняет положение, но не ширину. Отсечённые частоты искажают сигнал."],
  ["Два пользователя", "Как разделить две передачи в частотном ресурсе?", "Разнесите несущие так, чтобы основные области их спектров не перекрывались."],
];
const guidance = [
  "Меняйте τ и A. Сравните ширину спектра и его уровень.",
  "Сравните расстояние между гармониками с формой их огибающей.",
  "Смените биты и скорость. Все графики относятся к одному фрагменту.",
  "Сравните расположение baseband и разрешённой полосы.",
  "Меняйте fc и найдите спектральную линию чистой несущей.",
  "Следите одновременно за данными, несущей, OOK и двумя спектрами.",
  "Поместите спектр в канал и сравните форму сигнала до и после него.",
  "Изменяйте fc₂ и биты второго передатчика, наблюдая общий ресурс.",
];
const presets = ["1011100010", "11111111", "10101010", "10000001", "10111001"];
const numeric = (name, label, min, max, step, value, unit) =>
  `<label>${label}<input name="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output data-for="${name}"></output><small>${unit}</small></label>`;
const sequence = (name, label, value) => `<label>${label}<input name="${name}" type="text" inputmode="numeric" pattern="[01]{1,16}" maxlength="16" value="${value}" aria-describedby="${name}-hint"><small id="${name}-hint">От 1 до 16 нулей и единиц</small></label>`;

function plot(title, series, xMax, xLabel, yLabel, options = {}) {
  const w = 760, h = 260, left = 60, right = 740, top = 18, bottom = 214;
  const x = value => left + Math.max(0, Math.min(1, value / xMax)) * (right - left);
  const yMin = options.yMin || 0, yMax = options.yMax || 1;
  const y = value => bottom - Math.max(0, Math.min(1, (value - yMin) / (yMax - yMin))) * (bottom - top);
  const grid = [0, .25, .5, .75, 1].map(fraction => {
    const at = left + fraction * (right - left);
    const label = (fraction * xMax).toFixed(xMax < 5 ? 2 : 0).replace(/\.00$/, "");
    return `<line x1="${at}" x2="${at}" y1="${top}" y2="${bottom}" class="ia-grid"/><text x="${at}" y="234" text-anchor="middle">${label}</text>`;
  }).join("");
  const channel = options.channel ? `<rect x="${left}" y="${top}" width="${Math.max(0,x(options.channel[0])-left)}" height="${bottom-top}" class="ia-outside"/><rect x="${x(options.channel[0])}" y="${top}" width="${Math.max(0, x(options.channel[1]) - x(options.channel[0]))}" height="${bottom-top}" class="ia-channel"/><rect x="${x(options.channel[1])}" y="${top}" width="${Math.max(0,right-x(options.channel[1]))}" height="${bottom-top}" class="ia-outside"/>` : "";
  const lines = series.map(item => {
    const stride = Math.max(1, Math.ceil(item.values.length / 2000));
    let path = "";
    for (let i = 0; i < item.values.length; i += stride) {
      const px = x(i * (item.step || xMax / (item.values.length - 1)));
      const py = y(item.values[i]);
      path += `${path ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
    }
    return `<path d="${path}" class="ia-line ${item.className || ""}"/>`;
  }).join("");
  const stems = (options.stems || []).map(point => `<line x1="${x(point.x)}" x2="${x(point.x)}" y1="${bottom}" y2="${y(point.y)}" class="ia-stem"/>`).join("");
  const marker = options.marker === undefined ? "" : `<line x1="${x(options.marker)}" x2="${x(options.marker)}" y1="${top}" y2="${bottom}" class="ia-marker"/><text x="${Math.min(right-4,x(options.marker)+5)}" y="33" text-anchor="end">${options.markerLabel || ""}</text>`;
  const legend = series.length > 1 ? `<div class="ia-legend">${series.map(item => `<span class="${item.className || ""}">${item.label}</span>`).join("")}</div>` : "";
  return `<figure class="ia-figure"><figcaption>${title}</figcaption><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}; ${xLabel}"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" class="ia-paper"/>${channel}${grid}<line x1="${left}" x2="${right}" y1="${bottom}" y2="${bottom}" class="ia-axis"/>${lines}${stems}${marker}<text x="${(left+right)/2}" y="256" text-anchor="middle">${xLabel}</text><text x="10" y="130" transform="rotate(-90 10 130)" text-anchor="middle">${yLabel}</text></svg>${legend}</figure>`;
}

function timeSeries(signal, spanMs, label, className = "") {
  const count = Math.min(signal.length, Math.floor(spanMs * SAMPLE_RATE_KHZ));
  return {values: Array.from(signal.slice(0, count)), step: 1 / SAMPLE_RATE_KHZ, label, className};
}
function positiveTime(signal, spanMs, label, className = "") {
  const count = Math.min(signal.length, Math.floor(spanMs * SAMPLE_RATE_KHZ));
  return {values: Array.from(signal.slice(0, count)), step: 1 / SAMPLE_RATE_KHZ, label, className};
}
function spectralSeries(signal, maxKhz, label, className = "", referencePeak = null) {
  const current = spectrum(signal);
  const count = Math.ceil(maxKhz / current.stepKhz) + 1;
  const values = Array.from(current.magnitude.slice(0, count));
  const peak = referencePeak || Math.max(...values, 1e-9);
  return {values: values.map(value => value / peak), step: current.stepKhz, label, className};
}
function cleanBits(value) { return /^[01]{1,16}$/.test(value) ? value : null; }

function mount(root) {
  root.innerHTML = `<div class="ia-shell"><nav class="ia-steps" aria-label="Этапы практики">${stages.map((s,i) => `<button type="button" data-stage="${i+1}">${i+1}. ${s[0]}</button>`).join("")}</nav><div class="ia-workspace"><section class="ia-left"><h2 class="ia-title"></h2><p class="ia-intro"></p><div class="ia-controls"></div><div class="ia-question"></div><div class="ia-summary" aria-live="polite"></div><div class="ia-actions"><button type="button" data-action="previous">Назад</button><button type="button" data-action="next">Следующий этап</button></div></section><section class="ia-plots" aria-label="Синхронные графики"></section></div></div>`;
  const state = {stage: 1, amplitude: 1, tau: .2, period: .6, bits: presets[0], bits2: "10000001", rb: 10, duty: 1, fc: 100, fc2: 140, channelCenter: 100, bandwidth: 30};
  const control = name => root.querySelector(`[name="${name}"]`);
  const controls = () => {
    const s = state.stage;
    let html = numeric("amplitude", "Амплитуда A", .5, 2, .1, state.amplitude, "отн. ед.") + numeric("tau", "Длительность τ", .05, .5, .01, state.tau, "мс");
    if (s >= 2 && s <= 2) html += `<label>Режим<select name="pulseMode"><option value="periodic">Периодическая последовательность</option><option value="single">Одиночный импульс</option></select></label>` + numeric("period", "Период T", .55, 2, .05, state.period, "мс");
    if (s >= 3) {
      html = `<label>Пример битов<select name="preset">${presets.map(p => `<option value="${p}" ${p===state.bits ? "selected" : ""}>${p}</option>`).join("")}<option value="custom">Свой набор</option></select></label>` + sequence("bits", "Биты первого передатчика", state.bits) + numeric("rb", "Скорость Rb", 5, 25, 1, state.rb, "кбит/с");
      if (s >= 6) html += numeric("duty", "Доля импульса", .5, 1, .05, state.duty, "часть бита");
      if (s >= 5) html += numeric("fc", "Несущая fc₁", 60, 180, 1, state.fc, "кГц");
      if (s >= 7) html += numeric("channelCenter", "Центр канала", 75, 175, 1, state.channelCenter, "кГц") + numeric("bandwidth", "Полоса B", 10, 50, 1, state.bandwidth, "кГц");
      if (s >= 8) html += sequence("bits2", "Биты второго передатчика", state.bits2) + numeric("fc2", "Несущая fc₂", 60, 180, 1, state.fc2, "кГц");
    }
    root.querySelector(".ia-controls").innerHTML = html;
    for (const input of root.querySelectorAll('.ia-controls input[type="range"]')) {
      root.querySelector(`[data-for="${input.name}"]`).textContent = `${Number(input.value).toLocaleString("ru-RU")} ${input.nextElementSibling.nextElementSibling?.textContent || ""}`;
    }
  };
  const render = () => {
    const s = state.stage;
    root.querySelector(".ia-title").textContent = `${s}. ${stages[s-1][0]}`;
    root.querySelector(".ia-intro").textContent = guidance[s-1];
    root.querySelectorAll(".ia-steps button").forEach(button => { button.classList.toggle("active", Number(button.dataset.stage) === s); button.setAttribute("aria-current", Number(button.dataset.stage) === s ? "step" : "false"); });
    root.querySelector('[data-action="previous"]').disabled = s === 1;
    root.querySelector('[data-action="next"]').disabled = s === 8;
    controls();
    const question = root.querySelector(".ia-question");
    question.innerHTML = `<strong>Предскажи → измени → наблюдай → объясни</strong><p>${stages[s-1][1]}</p>${s===1 ? '<div class="ia-choices"><label><input type="radio" name="prediction" value="narrow"> Станет уже</label><label><input type="radio" name="prediction" value="wide"> Станет шире</label><label><input type="radio" name="prediction" value="amplitude"> Изменится только амплитуда</label><label><input type="radio" name="prediction" value="same"> Почти не изменится</label></div>' : ""}<details><summary>Проверить объяснение после опыта</summary><p>${stages[s-1][2]}</p></details>`;
    draw();
  };
  const draw = () => {
    const s = state.stage, plots = root.querySelector(".ia-plots"), summary = root.querySelector(".ia-summary");
    if (s <= 2) {
      const pulse = s === 2 && control("pulseMode")?.value === "periodic" ? periodicPulse(state.tau, state.period, state.amplitude) : rectangularPulse(state.amplitude, state.tau);
      const span = s === 1 ? 1 : 3;
      const time = plot("Сигнал во времени", [positiveTime(pulse, span, "x(t)")], span, "Время, мс", "Амплитуда", {yMax: 2.2});
      const firstNull = 1 / state.tau;
      const freqs = Array.from({length: 481}, (_, i) => i / 10);
      const envelope = freqs.map(f => pulseSpectrum(f, state.tau, state.amplitude) / state.tau);
      const stems = s === 2 && control("pulseMode")?.value === "periodic" ? Array.from({length: Math.floor(48 * state.period) + 1}, (_, n) => ({x: n / state.period, y: state.amplitude * Math.abs(sinc(n * state.tau / state.period))})) : [];
      const spectral = plot(s === 2 ? "Спектральная огибающая и гармоники" : "Аналитический |X(f)|, масштаб τ", [{values: envelope, step: .1, label: "Огибающая"}], 48, "Частота, кГц", "|X|/τ", {yMax: 2.2, stems, marker: firstNull, markerLabel: "первый нуль"});
      plots.innerHTML = time + spectral;
      summary.textContent = `τ = ${state.tau.toLocaleString("ru-RU")} мс; первый нуль f₀ = 1/τ ≈ ${firstNull.toFixed(1)} кГц.${s === 2 ? ` Расстояние гармоник Δf = 1/T ≈ ${(1/state.period).toFixed(2)} кГц.` : " Спектр продолжается за первым нулём: расстояние до него — лишь одна характеристика ширины."}`;
      return;
    }
    const base = bitWaveform(state.bits, state.rb, s >= 6 ? state.duty : 1);
    const bitSpan = Math.min(3, state.bits.length / state.rb);
    const baseTime = plot(`Биты ${state.bits} → baseband m(t)`, [positiveTime(base, bitSpan, "m(t)")], bitSpan, "Время, мс", "Уровень", {yMax: 1.1});
    const baseSpec = plot("Спектр показанного конечного фрагмента m(t)", [spectralSeries(base, 70, "Baseband")], 70, "Частота, кГц", "Отн. |M|", {channel: s === 4 ? [90, 110] : undefined});
    if (s <= 4) {
      plots.innerHTML = baseTime + (s === 4 ? plot("Полосовой канал 90…110 кГц и baseband", [spectralSeries(base, 220, "Baseband")], 220, "Частота, кГц", "Отн. |M|", {channel: [90,110]}) : baseSpec);
      summary.textContent = `Rb = ${state.rb} кбит/с; Tb = ${(1/state.rb).toFixed(3)} мс. ${s===4 ? "Выделенная полоса канала находится далеко от основных составляющих baseband." : "Это спектр показанного конечного фрагмента, а не PSD бесконечного случайного процесса."}`;
      return;
    }
    const tone = carrier(state.fc);
    const toneTime = plot("Чистая несущая c(t)", [timeSeries(tone, .12, "c(t)")], .12, "Время, мс", "Амплитуда", {yMin: -1.1, yMax: 1.1});
    const toneSpec = plot("Спектральная линия несущей", [spectralSeries(tone, 220, "Несущая")], 220, "Частота, кГц", "Отн. |C|", {marker: state.fc, markerLabel: "fc"});
    if (s === 5) {
      plots.innerHTML = baseTime + toneTime + toneSpec;
      summary.textContent = `fc = ${state.fc} кГц. Чистая несущая не содержит битовой последовательности.`;
      return;
    }
    const signal = ook(base, state.fc, state.amplitude);
    const signalTime = plot("ASK/OOK перед каналом", [timeSeries(signal, bitSpan, "s(t)")], bitSpan, "Время, мс", "Амплитуда", {yMin: -1.1, yMax: 1.1});
    const channel = [state.channelCenter-state.bandwidth/2, state.channelCenter+state.bandwidth/2];
    const askSpec = spectralSeries(signal, 220, "ASK/OOK", "ia-first");
    const secondBase = s === 8 ? bitWaveform(state.bits2, state.rb, state.duty) : null;
    const second = s === 8 ? ook(secondBase, state.fc2, state.amplitude) : null;
    const output = s >= 7 ? bandpass(signal, state.channelCenter, state.bandwidth) : null;
    const originalPeak = Math.max(...spectrum(signal).magnitude.slice(0, Math.ceil(220 * FFT_SIZE / SAMPLE_RATE_KHZ)+1));
    const specSeries = second ? [askSpec, spectralSeries(second, 220, "Передатчик 2", "ia-second")] : output ? [askSpec, spectralSeries(output, 220, "После фильтра", "ia-filtered", originalPeak)] : [askSpec];
    const spectrumPlot = plot(s >= 7 ? "ASK и полоса канала" : "Перенос спектра ASK по частоте", specSeries, 220, "Частота, кГц", "Отн. |S|", {channel: s>=7 ? channel : undefined, marker: state.fc, markerLabel: "fc₁"});
    let html = baseTime + toneTime + signalTime + baseSpec + spectrumPlot;
    if (s >= 7) {
      html += plot("После идеального полосового канала (IFFT)", [timeSeries(output, bitSpan, "После канала")], bitSpan, "Время, мс", "Амплитуда", {yMin: -1.1, yMax: 1.1});
    }
    if (second) {
      html += plot("ASK второго передатчика", [timeSeries(second, bitSpan, "Передатчик 2")], bitSpan, "Время, мс", "Амплитуда", {yMin: -1.1, yMax: 1.1});
      html += plot("Сумма двух передач во времени", [timeSeries(addSignals(signal, second), bitSpan, "Сумма")], bitSpan, "Время, мс", "Амплитуда", {yMin: -2.1, yMax: 2.1});
    }
    plots.innerHTML = html;
    const estimate = (state.rb / state.duty).toFixed(1);
    summary.innerHTML = `OOK — частный случай бинарной ASK: <strong>s(t) = A·m(t)·cos(2πfc t)</strong>. fc₁ = ${state.fc} кГц; оценка расстояния до первого нуля ≈ ${estimate} кГц. ${s>=7 ? `Канал: ${channel[0].toFixed(1)}…${channel[1].toFixed(1)} кГц. Резкая отсечка спектра может вызвать «звон» во времени.` : ""}${second ? ` Основные области ${mainLobeOverlap(state.fc,state.fc2,state.rb,state.duty) ? "перекрываются" : "разнесены"}.` : ""}`;
  };
  root.addEventListener("input", event => {
    const target = event.target;
    if (target.type === "range") {
      state[target.name] = Number(target.value);
      if (target.name === "tau" && state.period <= state.tau) state.period = Math.min(2, state.tau + .1);
      target.nextElementSibling.textContent = `${Number(target.value).toLocaleString("ru-RU")} ${target.nextElementSibling.nextElementSibling?.textContent || ""}`;
      draw();
    } else if (target.name === "bits" || target.name === "bits2") {
      const bits = cleanBits(target.value);
      target.setCustomValidity(bits ? "" : "Введите от 1 до 16 нулей и единиц");
      if (bits) { state[target.name] = bits; draw(); }
    }
  });
  root.addEventListener("change", event => {
    if (event.target.name === "preset" && event.target.value !== "custom") {
      state.bits = event.target.value; control("bits").value = state.bits; draw();
    }
    if (event.target.name === "pulseMode") draw();
  });
  root.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.stage) state.stage = Number(button.dataset.stage);
    else if (button.dataset.action === "previous") state.stage--;
    else if (button.dataset.action === "next") state.stage++;
    else return;
    render();
    root.scrollIntoView({block: "start", behavior: "smooth"});
  });
  render();
}

for (const root of document.querySelectorAll("[data-impulse-ask]")) mount(root);
