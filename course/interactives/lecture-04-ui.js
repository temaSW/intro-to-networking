import {allocateGrid, simulateConstellation} from "./lecture-04-model.js";

const users = ["Алиса", "Боб", "Кира", "Дима"];
const colors = ["#087e8b", "#c26b1a", "#628c24", "#7b59a6"];
const clean = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function constellationSvg(result) {
  const all = [...result.ideal, ...result.points.map(point => point.received)];
  const extent = Math.max(1.25, ...all.map(point => Math.max(Math.abs(point.x), Math.abs(point.y)))) * 1.08;
  const position = value => 240 + 205 * value / extent;
  const ideal = result.ideal.map(point => `<circle cx="${position(point.x)}" cy="${position(-point.y)}" r="4" fill="#087e8b"/>`).join("");
  const received = result.points.map(point => `<circle cx="${position(point.received.x)}" cy="${position(-point.received.y)}" r="2.5" fill="${point.error ? "#c0392b" : "#d58939"}" fill-opacity=".65"/>`).join("");
  return `<svg viewBox="0 0 480 480" role="img" aria-label="Идеальные и принятые точки созвездия"><rect x="0" y="0" width="480" height="480" fill="var(--surface)"/><line x1="20" y1="240" x2="460" y2="240" stroke="var(--line)"/><line x1="240" y1="20" x2="240" y2="460" stroke="var(--line)"/>${received}${ideal}<text x="450" y="232" fill="var(--muted)">I</text><text x="247" y="28" fill="var(--muted)">Q</text></svg>`;
}

function mountConstellation(root) {
  root.innerHTML = `<div class="interactive-controls"><label>Модуляция <select name="order"><option value="4">QPSK</option><option value="16">16-QAM</option><option value="64">64-QAM</option><option value="256">256-QAM</option></select></label><label>Сигнал/шум <input name="snr" type="range" min="0" max="30" value="14"><output name="snr-value">14 дБ</output></label><label>Число символов <select name="count"><option>100</option><option selected>400</option><option>1000</option></select></label><button type="button" name="repeat">Новая передача</button></div><div class="interactive-output"><div class="interactive-plot"></div><div class="interactive-metrics" aria-live="polite"></div></div>`;
  let seed = 42;
  const draw = () => {
    const order = clean(root.querySelector('[name="order"]').value);
    const snr = clean(root.querySelector('[name="snr"]').value);
    const count = clean(root.querySelector('[name="count"]').value);
    const result = simulateConstellation(order, snr, count, seed);
    root.querySelector('[name="snr-value"]').textContent = `${snr} дБ`;
    root.querySelector(".interactive-plot").innerHTML = constellationSvg(result);
    root.querySelector(".interactive-metrics").innerHTML = `<p><strong>${Math.log2(order)}</strong> бит/символ</p><p>Ошибочных символов: <strong>${result.symbolErrors} / ${count}</strong></p><p>Ошибочных битов: <strong>${result.bitErrors} / ${result.transmittedBits}</strong></p><p class="interactive-note">Синие точки — переданные состояния; оранжевые — принятые, красные — ошибочно распознанные. Модель: квадратная QAM и гауссовский шум.</p>`;
  };
  root.addEventListener("input", draw);
  root.addEventListener("change", draw);
  root.querySelector('[name="repeat"]').addEventListener("click", () => {seed++; draw();});
  draw();
}

function mountGrid(root) {
  root.innerHTML = `<div class="interactive-controls"><label>Распределение <select name="mode"><option value="static">Поровну заранее</option><option value="dynamic">По текущей потребности</option></select></label>${users.map((user, i) => `<label>${user}: нужно клеток <input name="demand-${i}" type="range" min="0" max="48" value="${[28, 5, 14, 0][i]}"><output name="demand-value-${i}"></output></label>`).join("")}</div><div class="interactive-output"><div class="interactive-grid" role="img"></div><div class="interactive-metrics" aria-live="polite"></div></div>`;
  const draw = () => {
    const demands = users.map((_, i) => clean(root.querySelector(`[name="demand-${i}"]`).value));
    const mode = root.querySelector('[name="mode"]').value;
    const result = allocateGrid(demands, mode);
    const grid = root.querySelector(".interactive-grid");
    grid.innerHTML = result.cells.map(user => `<span class="grid-cell" style="${user >= 0 ? `--cell-color:${colors[user]}` : ""}" title="${user >= 0 ? users[user] : "Не используется"}">${user >= 0 ? users[user][0] : "·"}</span>`).join("");
    grid.setAttribute("aria-label", `Сетка из 48 клеток. Использовано ${48 - result.unused}, не использовано ${result.unused}.`);
    users.forEach((_, i) => {root.querySelector(`[name="demand-value-${i}"]`).textContent = demands[i];});
    root.querySelector(".interactive-metrics").innerHTML = `<p>Использовано: <strong>${48 - result.unused} / 48</strong> клеток</p><p>Пустых клеток: <strong>${result.unused}</strong></p>${users.map((user, i) => `<p><span class="user-swatch" style="background:${colors[i]}"></span>${user}: <strong>${result.served[i]} / ${demands[i]}</strong>, осталось ${result.remaining[i]}</p>`).join("")}<p class="interactive-note">Каждая клетка может обслужить одну единицу спроса только одного пользователя.</p>`;
  };
  root.addEventListener("input", draw);
  root.addEventListener("change", draw);
  draw();
}

function berSvg(rows, selected) {
  const left = 75, right = 735, top = 25, bottom = 370;
  const x = snr => left + (snr + 4) / 23 * (right - left);
  const y = ber => top + (-Math.log10(ber)) / 5 * (bottom - top);
  const palette = ["#087e8b", "#c26b1a", "#628c24", "#7b59a6", "#bc4f61"];
  let chart = `<svg viewBox="0 0 760 430" role="img" aria-label="Измеренная вероятность ошибки бита после декодирования в зависимости от отношения сигнал/шум"><rect width="760" height="430" fill="var(--surface)"/>`;
  for (const snr of [-4, 0, 4, 8, 12, 16, 19]) {
    chart += `<line x1="${x(snr)}" y1="${top}" x2="${x(snr)}" y2="${bottom}" stroke="var(--line)"/><text x="${x(snr)}" y="395" text-anchor="middle" fill="var(--muted)">${snr}</text>`;
  }
  for (let decade = 0; decade <= 5; decade++) {
    const value = 10 ** -decade;
    chart += `<line x1="${left}" y1="${y(value)}" x2="${right}" y2="${y(value)}" stroke="var(--line)"/><text x="${left-9}" y="${y(value)+5}" text-anchor="end" fill="var(--muted)">10<tspan dy="-5" font-size="11">${-decade}</tspan></text>`;
  }
  for (const scheme of selected) {
    const points = rows.filter(row => row.scheme === scheme && row.bit_errors > 0);
    const color = palette[scheme - 1];
    chart += `<polyline points="${points.map(row => `${x(row.snr_db).toFixed(1)},${y(row.ber).toFixed(1)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>`;
    for (const row of points) chart += `<circle cx="${x(row.snr_db).toFixed(1)}" cy="${y(row.ber).toFixed(1)}" r="4" fill="${color}"><title>${row.modulation}, R=${row.code_rate}: ${row.bit_errors} ошибок на ${row.information_bits} бит, SNR=${row.snr_db} дБ</title></circle>`;
  }
  chart += `<text x="405" y="424" text-anchor="middle" fill="var(--ink)">Отношение сигнал/шум, дБ</text><text x="17" y="200" transform="rotate(-90 17 200)" text-anchor="middle" fill="var(--ink)">BER после декодирования</text></svg>`;
  return chart;
}

async function mountBer(root) {
  root.textContent = "Загрузка результатов моделирования…";
  try {
    const response = await fetch(new URL("../data/lecture-04/nr-ber-awgn.csv", import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const lines = (await response.text()).trim().split(/\r?\n/).slice(1);
    const rows = lines.map(line => {
      const [scheme, modulation, code_rate, snr_db, bit_errors, information_bits, ber] = line.split(",");
      return {scheme: +scheme, modulation, code_rate: +code_rate, snr_db: +snr_db, bit_errors: +bit_errors, information_bits: +information_bits, ber: +ber};
    });
    const labels = ["QPSK · 1/2", "QPSK · 3/4", "16-QAM · 1/2", "16-QAM · 3/4", "64-QAM · 3/4"];
    const palette = ["#087e8b", "#c26b1a", "#628c24", "#7b59a6", "#bc4f61"];
    root.innerHTML = `<div class="ber-controls" role="group" aria-label="Показать кривые">${labels.map((label, i) => `<label><input type="checkbox" value="${i+1}" ${i < 4 ? "checked" : ""}><span class="user-swatch" style="background:${palette[i]}"></span>${label}</label>`).join("")}</div><div class="ber-plot"></div><p class="interactive-note">Точки — результаты моделирования. При нуле обнаруженных ошибок точка на логарифмическом графике не показана.</p>`;
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
  if (kind === "grid") mountGrid(root);
  if (kind === "ber") mountBer(root);
}
