import {FREQUENCY_LIMIT_KHZ, sampleSpectrum} from "./lecture-04-spectrum-model.js";

const durations = [0.25, 0.5, 1, 2, 4];
const names = {ask: "ASK", fsk: "FSK", psk: "PSK"};

function spectrumSvg(mode, duration) {
  const current = sampleSpectrum(mode, duration);
  const reference = sampleSpectrum(mode, 1);
  const left = 72, right = 768, top = 30, bottom = 352;
  const x = frequency => left + (frequency + FREQUENCY_LIMIT_KHZ) / (2 * FREQUENCY_LIMIT_KHZ) * (right - left);
  const y = db => top + (-db) / 45 * (bottom - top);
  const path = samples => samples.map((point, index) => `${index ? "L" : "M"}${x(point.offsetKhz).toFixed(1)},${y(point.db).toFixed(1)}`).join(" ");
  let svg = `<svg viewBox="0 0 800 420" role="img" aria-label="Спектр ${names[mode]} при длительности бита ${duration} мс в сравнении с 1 мс"><rect width="800" height="420" fill="var(--surface)"/>`;
  for (let frequency = -FREQUENCY_LIMIT_KHZ; frequency <= FREQUENCY_LIMIT_KHZ; frequency += 2) {
    svg += `<line x1="${x(frequency)}" y1="${top}" x2="${x(frequency)}" y2="${bottom}" stroke="var(--line)"/><text x="${x(frequency)}" y="376" text-anchor="middle" fill="var(--muted)">${frequency}</text>`;
  }
  for (const db of [0, -10, -20, -30, -40]) {
    svg += `<line x1="${left}" y1="${y(db)}" x2="${right}" y2="${y(db)}" stroke="var(--line)"/><text x="${left - 9}" y="${y(db) + 5}" text-anchor="end" fill="var(--muted)">${db}</text>`;
  }
  svg += `<path d="${path(reference.samples)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="8 6"/><path d="${path(current.samples)}" fill="none" stroke="var(--accent)" stroke-width="3"/>`;
  if (mode === "ask") svg += `<line x1="${x(0)}" y1="${top}" x2="${x(0)}" y2="${y(-17)}" stroke="var(--focus)" stroke-width="4"/><text x="${x(0) + 8}" y="${top + 18}" fill="var(--focus)">несущая</text>`;
  if (mode === "fsk") for (const frequency of [-current.toneShiftKhz, current.toneShiftKhz]) {
    svg += `<circle cx="${x(frequency)}" cy="${top + 6}" r="4" fill="var(--focus)"/>`;
  }
  svg += `<text x="420" y="410" text-anchor="middle" fill="var(--ink)">Частота относительно несущей, кГц</text><text x="19" y="190" text-anchor="middle" transform="rotate(-90 19 190)" fill="var(--ink)">Уровень, дБ</text></svg>`;
  return svg;
}

function mountSpectrum(root) {
  root.innerHTML = `<div class="interactive-controls"><label>Вид манипуляции <select name="spectrum-mode"><option value="ask">ASK</option><option value="fsk">FSK</option><option value="psk">PSK (BPSK)</option></select></label><label>Длительность бита <input name="bit-duration" type="range" min="0" max="4" step="1" value="2"><output name="duration-value">1 мс</output></label></div><div class="spectrum-plot" tabindex="0" aria-label="Спектр сигнала; на узком экране доступна прокрутка"></div><div class="spectrum-summary" aria-live="polite"></div><p class="interactive-note"><span class="spectrum-key spectrum-key-current"></span>Выбранная длительность <span class="spectrum-key spectrum-key-reference"></span>Опорный спектр при 1 мс. Показана нормированная огибающая при прямоугольных битовых импульсах; вертикальная линия ASK обозначает несущую условно.</p>`;
  const draw = () => {
    const mode = root.querySelector('[name="spectrum-mode"]').value;
    const duration = durations[Number(root.querySelector('[name="bit-duration"]').value)];
    const result = sampleSpectrum(mode, duration);
    root.querySelector('[name="duration-value"]').textContent = `${duration.toString().replace(".", ",")} мс`;
    root.querySelector(".spectrum-plot").innerHTML = spectrumSvg(mode, duration);
    root.querySelector(".spectrum-summary").textContent = `Битовая скорость: ${result.bitRate.toLocaleString("ru-RU")} бит/с. Масштаб ширины лепестка: 1/Tб = ${result.lobeScaleKhz.toLocaleString("ru-RU")} кГц. ${mode === "fsk" ? "Частоты FSK фиксированы: ±1 кГц от несущей." : ""}`;
  };
  root.addEventListener("input", draw);
  root.addEventListener("change", draw);
  draw();
}

for (const root of document.querySelectorAll('[data-lecture-interactive="spectrum"]')) mountSpectrum(root);
