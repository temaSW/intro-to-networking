import {allocateGrid, simulateCoding, simulateConstellation} from "./lecture-04-model.js";

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

function mountCoding(root) {
  root.innerHTML = `<div class="interactive-controls"><label>Модуляция <select name="order"><option value="4">QPSK</option><option value="16">16-QAM</option><option value="64" selected>64-QAM</option></select></label><label>Сигнал/шум <input name="snr" type="range" min="0" max="25" value="15"><output name="snr-value">15 дБ</output></label><label>Кодовая скорость <select name="rate"><option>5/6</option><option>3/4</option><option>2/3</option><option>1/2</option></select></label><button type="button" name="repeat">Новая передача</button></div><div class="interactive-metrics" aria-live="polite"></div><p class="interactive-note">Учебные короткие коды с проверочными битами и решением по ближайшему кодовому слову. Сравнивайте режимы при одинаковом отношении сигнал/шум.</p>`;
  let seed = 17;
  const draw = () => {
    const order = clean(root.querySelector('[name="order"]').value);
    const snr = clean(root.querySelector('[name="snr"]').value);
    const rate = root.querySelector('[name="rate"]').value;
    const result = simulateCoding(order, snr, rate, 600, seed);
    root.querySelector('[name="snr-value"]').textContent = `${snr} дБ`;
    root.querySelector(".interactive-metrics").innerHTML = `<div class="metric-row"><div><strong>${result.informationBits}</strong><span>информационных битов</span></div><div><strong>${result.codedBits}</strong><span>переданных битов</span></div><div><strong>${result.nominalEfficiency.toFixed(2)}</strong><span>полезных бит/символ</span></div><div><strong>${result.wrongBlocks} / ${result.blocks}</strong><span>блоков с ошибкой</span></div></div><p>После декодирования: <strong>${result.wrongBits}</strong> ошибочных информационных битов.</p>`;
  };
  root.addEventListener("input", draw);
  root.addEventListener("change", draw);
  root.querySelector('[name="repeat"]').addEventListener("click", () => {seed++; draw();});
  draw();
}

for (const root of document.querySelectorAll("[data-lecture-interactive]")) {
  const kind = root.dataset.lectureInteractive;
  if (kind === "constellation") mountConstellation(root);
  if (kind === "grid") mountGrid(root);
  if (kind === "coding") mountCoding(root);
}
