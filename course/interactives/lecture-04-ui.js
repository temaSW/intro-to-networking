import {simulateConstellation} from "./lecture-04-model.js";

const clean = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const symbolCount = 10000;

function constellationSvg(result) {
  const all = [...result.ideal, ...result.points.map(point => point.received)];
  const extent = Math.max(1.25, ...all.map(point => Math.max(Math.abs(point.x), Math.abs(point.y)))) * 1.08;
  const position = value => 240 + 205 * value / extent;
  const ideal = result.ideal.map(point => `<circle cx="${position(point.x)}" cy="${position(-point.y)}" r="4" fill="#087e8b"/>`).join("");
  const received = result.points.map(point => `<circle cx="${position(point.received.x)}" cy="${position(-point.received.y)}" r="2.5" fill="${point.error ? "#c0392b" : "#d58939"}" fill-opacity=".65"/>`).join("");
  return `<svg viewBox="0 0 480 480" role="img" aria-label="Идеальные и принятые точки созвездия"><rect x="0" y="0" width="480" height="480" fill="var(--surface)"/><line x1="20" y1="240" x2="460" y2="240" stroke="var(--line)"/><line x1="240" y1="20" x2="240" y2="460" stroke="var(--line)"/>${received}${ideal}<text x="450" y="232" fill="var(--muted)">I</text><text x="247" y="28" fill="var(--muted)">Q</text></svg>`;
}

function mountConstellation(root) {
  root.innerHTML = `<div class="interactive-controls"><label>Модуляция <select name="order"><option value="4">QPSK</option><option value="16">16-QAM</option><option value="64">64-QAM</option><option value="256">256-QAM</option></select></label><label>Сигнал/шум <input name="snr" type="range" min="0" max="30" value="14"><output name="snr-value">14 дБ</output></label><button type="button" name="repeat">Новая передача</button></div><p class="interactive-note">В каждом опыте передаётся 10 000 символов; на рисунке показана часть принятых точек.</p><div class="interactive-output"><div class="interactive-plot"></div><div class="interactive-metrics" aria-live="polite"></div></div>`;
  let seed = 42;
  const draw = () => {
    const order = clean(root.querySelector('[name="order"]').value);
    const snr = clean(root.querySelector('[name="snr"]').value);
    const result = simulateConstellation(order, snr, symbolCount, seed);
    root.querySelector('[name="snr-value"]').textContent = `${snr} дБ`;
    root.querySelector(".interactive-plot").innerHTML = constellationSvg(result);
    root.querySelector(".interactive-metrics").innerHTML = `<p><strong>${Math.log2(order)}</strong> бит/символ</p><p>Ошибочных символов: <strong>${result.symbolErrors} / ${symbolCount}</strong></p><p>Ошибочных битов: <strong>${result.bitErrors} / ${result.transmittedBits}</strong></p><p class="interactive-note">Синие точки — переданные состояния; оранжевые — принятые, красные — ошибочно распознанные. Модель: квадратная QAM и гауссовский шум.</p>`;
  };
  root.addEventListener("input", draw);
  root.addEventListener("change", draw);
  root.querySelector('[name="repeat"]').addEventListener("click", () => {seed++; draw();});
  draw();
}

const berSeries = [
  {id: 1, label: "QPSK · 1/2", color: "#087e8b"},
  {id: 2, label: "QPSK · 3/4", color: "#4e9daa"},
  {id: 3, label: "16-QAM · 1/2", color: "#a75c12"},
  {id: 4, label: "16-QAM · 3/4", color: "#cf8736"},
  {id: 5, label: "64-QAM · 3/4", color: "#7b59a6"},
  {id: 6, label: "QPSK · без кода", color: "#087e8b", uncoded: true},
  {id: 7, label: "16-QAM · без кода", color: "#a75c12", uncoded: true},
  {id: 8, label: "64-QAM · без кода", color: "#7b59a6", uncoded: true},
];

function berSvg(rows, selected) {
  const left = 75, right = 735, top = 25, bottom = 370;
  const x = snr => left + (snr + 4) / 28 * (right - left);
  const y = ber => top + (-Math.log10(ber)) / 6 * (bottom - top);
  let chart = `<svg viewBox="0 0 760 430" role="img" aria-label="Измеренная вероятность ошибки бита в зависимости от SNR: кодированные и некодированные режимы"><rect width="760" height="430" fill="var(--surface)"/>`;
  for (const snr of [-4, 0, 4, 8, 12, 16, 20, 24]) {
    chart += `<line x1="${x(snr)}" y1="${top}" x2="${x(snr)}" y2="${bottom}" stroke="var(--line)"/><text x="${x(snr)}" y="395" text-anchor="middle" fill="var(--muted)">${snr}</text>`;
  }
  for (let decade = 0; decade <= 6; decade++) {
    const value = 10 ** -decade;
    chart += `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="var(--line)"/><text x="${left-9}" y="${y(value)+5}" text-anchor="end" fill="var(--muted)">10<tspan dy="-5" font-size="11">${-decade}</tspan></text>`;
  }
  for (const series of berSeries.filter(item => selected.includes(item.id))) {
    const points = rows.filter(row => row.scheme === series.id && row.bit_errors > 0);
    chart += `<polyline points="${points.map(row => `${x(row.snr_db).toFixed(1)},${y(row.ber).toFixed(1)}`).join(" ")}" fill="none" stroke="${series.color}" stroke-width="3" ${series.uncoded ? 'stroke-dasharray="8 5"' : ""}/>`;
    for (const row of points) chart += `<circle cx="${x(row.snr_db).toFixed(1)}" cy="${y(row.ber).toFixed(1)}" r="${series.uncoded ? 3 : 4}" fill="${series.color}"><title>${series.label}: ${row.bit_errors} ошибок на ${row.information_bits} бит, SNR=${row.snr_db} дБ</title></circle>`;
  }
  chart += `<text x="405" y="424" text-anchor="middle" fill="var(--ink)">SNR, дБ</text><text x="17" y="200" transform="rotate(-90 17 200)" text-anchor="middle" fill="var(--ink)">BER</text></svg>`;
  return chart;
}

async function mountBer(root) {
  root.textContent = "Загрузка результатов моделирования…";
  try {
    const filenames = ["nr-ber-awgn.csv", "uncoded-ber-awgn.csv"];
    const responses = await Promise.all(filenames.map(name => fetch(new URL(`../data/lecture-04/${name}`, import.meta.url))));
    if (responses.some(response => !response.ok)) throw new Error(`HTTP ${responses.find(response => !response.ok).status}`);
    const lines = (await Promise.all(responses.map(response => response.text()))).flatMap(csv => csv.trim().split(/\r?\n/).slice(1));
    const rows = lines.map(line => {
      const [scheme, modulation, code_rate, snr_db, bit_errors, information_bits, ber] = line.split(",");
      return {scheme: +scheme, modulation, code_rate: +code_rate, snr_db: +snr_db, bit_errors: +bit_errors, information_bits: +information_bits, ber: +ber};
    });
    root.innerHTML = `<div class="ber-controls" role="group" aria-label="Показать кривые">${berSeries.map(series => `<label><input type="checkbox" value="${series.id}" ${[1, 6].includes(series.id) ? "checked" : ""}><span class="ber-swatch ${series.uncoded ? "ber-swatch-uncoded" : ""}" style="--curve-color:${series.color}"></span>${series.label}</label>`).join("")}</div><div class="ber-plot"></div><p class="interactive-note">Выберите кривые для сравнения. Сплошные линии — после декодирования LDPC; штриховые — без кодирования. Точки с нулём обнаруженных ошибок не показаны.</p>`;
    const draw = () => {
      const selected = [...root.querySelectorAll('input:checked')].map(input => +input.value);
      root.querySelector(".ber-plot").innerHTML = berSvg(rows, selected);
    };
    root.addEventListener("change", draw);
    draw();
  } catch (error) {
    root.textContent = `Не удалось загрузить результаты моделирования: ${error.message}`;
  }
}

for (const root of document.querySelectorAll("[data-lecture-interactive]")) {
  const kind = root.dataset.lectureInteractive;
  if (kind === "constellation") mountConstellation(root);
  if (kind === "ber") mountBer(root);
}
