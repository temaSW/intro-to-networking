import {modes, rates, parseBer, measuredThresholds, availableModes, bestMode, transmissionTime, linearSnr, capacity, checkNumber} from "./mcs-model.js";
import {berSvg} from "./lecture-04-ui.js";

const fmt = value => Number(value).toLocaleString("ru-RU", {maximumFractionDigits: 3});
const colors = ["--curve-qpsk", "--curve-qpsk-high", "--curve-qam16", "--curve-qam16-high", "--curve-qam64"];
const field = (key, label) => `<label>${label}<input name="${key}" type="text" inputmode="decimal" autocomplete="off"></label>`;
const options = `<option value="">Выберите режим</option><option value="0">Нет допустимого режима</option>${modes.map(m => `<option value="${m.id}">M${m.id}</option>`).join("")}`;

function checker(root, fields, explanation) {
  root.insertAdjacentHTML("beforeend", '<button type="button">Проверить расчёты</button><div class="mcs-feedback" role="status" aria-live="polite"></div>');
  const feedback = root.querySelector(".mcs-feedback");
  root.addEventListener("input", () => { feedback.textContent = ""; root.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute("aria-invalid")); });
  root.querySelector("button").addEventListener("click", () => {
    if (fields.some(f => root.querySelector(`[name="${f.key}"]`).value.trim() === "")) {
      feedback.textContent = "Сначала заполните все поля.";
      return;
    }
    feedback.innerHTML = fields.map(f => {
      const input = root.querySelector(`[name="${f.key}"]`);
      const correct = checkNumber(input.value, f.expected, f.tolerance);
      input.setAttribute("aria-invalid", String(!correct));
      return `<p>${f.label}: ${correct ? "верно" : `проверьте — ${f.hint}`}. Ориентир: <strong>${fmt(f.expected)} ${f.unit ?? ""}</strong>.</p>`;
    }).join("") + `<p>${explanation}</p>`;
  });
}

function mountRates(root) {
  const fields = [];
  root.innerHTML = `<div class="mcs-scroll" tabindex="0" aria-label="Таблица расчётов скоростей, доступна прокрутка"><table><thead><tr><th scope="col">Режим</th><th scope="col">Модуляция</th><th scope="col">Qm</th><th scope="col">Rc</th><th scope="col">Rinf, Мбит/с</th><th scope="col">Ru, Мбит/с</th></tr></thead><tbody>${modes.map(m => {
    const r = rates(m);
    for (const [key, expected, label, hint] of [[`inf${m.id}`, r.information, `M${m.id}: Rinf`, "умножьте 1 Мсимв/с на Qm и Rc"], [`use${m.id}`, r.useful, `M${m.id}: Ru`, "учтите долю ресурса 0,8 после кодирования"]]) fields.push({key, expected, label, hint, unit: "Мбит/с"});
    return `<tr><th scope="row">M${m.id}</th><td>${m.modulation}</td><td>${m.qm}</td><td>${m.rc === .5 ? "1/2" : "3/4"}</td><td><input name="inf${m.id}" inputmode="decimal" aria-label="M${m.id}: Rinf, Мбит/с"></td><td><input name="use${m.id}" inputmode="decimal" aria-label="M${m.id}: Ru, Мбит/с"></td></tr>`;
  }).join("")}</tbody></table></div>`;
  checker(root, fields, "M5 быстрее M1 в 4,5 раза. Число бит на символ — log₂ M, а не M. Здесь ещё не проверена допустимость режима по BER.");
}

function mountBer(root, rows) {
  root.innerHTML = `<div class="ber-controls" role="group" aria-label="Выберите режимы для сравнения">${modes.map((m, i) => `<label><input type="checkbox" value="${m.id}"><span class="ber-swatch" style="--curve-color:var(${colors[i]})"></span>M${m.id} · ${m.modulation} · ${m.rc === .5 ? "1/2" : "3/4"}</label>`).join("")}</div><div class="ber-plot" tabindex="0" aria-label="График BER, доступна локальная прокрутка"></div><p class="interactive-note">Линии соединяют измеренные точки для чтения графика; они не задают точную BER между точками. Точки с нулём зарегистрированных ошибок на логарифмической шкале не показаны.</p>`;
  const draw = () => {
    const selected = [...root.querySelectorAll("input:checked")].map(el => Number(el.value));
    root.querySelector(".ber-plot").innerHTML = berSvg(rows, selected, {threshold: 1e-3});
  };
  root.addEventListener("change", draw);
  draw();
}

function mountThresholds(root, catalog) {
  const fields = catalog.map(m => ({key: `t${m.id}`, expected: m.threshold, tolerance: 0, label: `M${m.id}: первый измеренный SNR`, unit: "дБ", hint: "найдите первый отсчёт с BER ≤ 10⁻³, без интерполяции"}));
  root.innerHTML = `<div class="mcs-fields">${fields.map(f => field(f.key, `${f.label}, дБ`)).join("")}</div>`;
  checker(root, fields, "Это пороги данной моделированной цепочки LDPC + модуляция + AWGN; они не являются официальными порогами MCS 3GPP и не гарантируют BER реальной системы.");
}

function mountSelector(root, catalog) {
  root.innerHTML = `<div class="mcs-fields"><label>SNR, дБ<input name="snr" type="range" min="-4" max="19" step="0.5" value="2"><output>2 дБ</output></label><label>Ваш самый быстрый допустимый режим<select name="choice">${options}</select></label></div><button type="button">Проверить выбор и открыть режимы</button><div class="mcs-result" role="status" aria-live="polite"></div>`;
  const snr = root.querySelector('[name="snr"]'), choice = root.querySelector("select"), result = root.querySelector(".mcs-result");
  root.addEventListener("input", event => {
    result.textContent = "";
    if (event.target === snr) { root.querySelector("output").textContent = `${fmt(snr.value)} дБ`; choice.value = ""; }
  });
  root.querySelector("button").addEventListener("click", () => {
    if (!choice.value) { result.textContent = "Сначала выберите режим самостоятельно."; return; }
    const best = bestMode(catalog, Number(snr.value));
    const allowed = availableModes(catalog, Number(snr.value));
    result.innerHTML = `<p>${Number(choice.value) === (best?.id ?? 0) ? "Выбор верен." : "Пересмотрите выбор: нужна наибольшая скорость среди допустимых режимов."} ${best ? `Оптимален M${best.id}: ${fmt(rates(best).useful)} Мбит/с.` : "Среди M1–M5 нет допустимого режима."}</p><ul>${catalog.map(m => `<li>M${m.id}: ${fmt(rates(m).useful)} Мбит/с; порог ${fmt(m.threshold)} дБ — ${allowed.includes(m) ? "допустим" : "недопустим"} по модели.</li>`).join("")}</ul><p>Ступенчатая модель предполагает монотонное улучшение качества выше первого измеренного порога, в том числе между точками и за последним отсчётом режима. Она не вычисляет BER в этих условиях.</p>`;
  });
}

function mountFile(root, catalog) {
  const fast = bestMode(catalog, 17), slow = bestMode(catalog, 5);
  const fields = [
    {key: "m17", label: "Режим при 17 дБ (номер M)", expected: fast.id, tolerance: 0, hint: "сопоставьте пороги с SNR"},
    {key: "m5", label: "Режим при 5 дБ (номер M)", expected: slow.id, tolerance: 0, hint: "исключите режимы с большим порогом"},
    {key: "r17", label: "Скорость при 17 дБ", expected: rates(fast).useful, unit: "Мбит/с", hint: "используйте ρ = 0,8"},
    {key: "r5", label: "Скорость при 5 дБ", expected: rates(slow).useful, unit: "Мбит/с", hint: "используйте ρ = 0,8"},
    {key: "time17", label: "Время при 17 дБ", expected: transmissionTime(8, rates(fast).useful), unit: "с", hint: "разделите 8 Мбит на скорость"},
    {key: "time5", label: "Время при 5 дБ", expected: transmissionTime(8, rates(slow).useful), unit: "с", hint: "разделите 8 Мбит на скорость"},
    {key: "ratio", label: "Во сколько раз снизилась скорость", expected: rates(fast).useful / rates(slow).useful, hint: "разделите начальную скорость на конечную"},
    {key: "full", label: "Скорость при 5 дБ и ρ = 1", expected: rates(slow, 1).useful, unit: "Мбит/с", hint: "полный ресурс не отменяет кодирование"},
  ];
  root.innerHTML = `<div class="mcs-fields">${fields.map(f => field(f.key, `${f.label}${f.unit ? `, ${f.unit}` : ""}`)).join("")}</div>`;
  checker(root, fields, "При 5 дБ даже весь рассматриваемый ресурс даёт 1,5 Мбит/с: требование 2 Мбит/с недостижимо среди этих пяти режимов. Сохранение M5 нарушает ограничение BER; повторы могут ещё снизить полезную скорость. Время посчитано для целого файла при каждом постоянном SNR, без дополнительных повторов и затрат сверх ρ.");
}

function mountShannon(root) {
  const fields = [3, 7].flatMap(db => [
    {key: `s${db}`, label: `Линейный SNR при ${db} дБ`, expected: linearSnr(db), hint: "используйте 10^(SNRдБ/10), а не деление на 10"},
    {key: `c${db}`, label: `Предел при ${db} дБ`, expected: capacity(2, db), unit: "Мбит/с", hint: "используйте log₂ и B = 2 МГц"},
  ]);
  root.innerHTML = `<div class="mcs-fields">${fields.map(f => field(f.key, `${f.label}${f.unit ? `, ${f.unit}` : ""}`)).join("")}</div>`;
  checker(root, fields, "При 3 дБ предел исключает 5 Мбит/с. При 7 дБ не исключает, но R < C не гарантирует работу данного MCS: нужны подходящие код, приёмник и условия. Здесь SNR -- отношение мощностей в полосе отдельной модели канала. C/B — теоретическая спектральная эффективность в бит/с/Гц.");
}

for (const root of document.querySelectorAll('[data-mcs="rates"]')) mountRates(root);
for (const root of document.querySelectorAll('[data-mcs="shannon"]')) mountShannon(root);
const dataRoots = [...document.querySelectorAll('[data-mcs="ber"], [data-mcs="thresholds"], [data-mcs="selector"], [data-mcs="file"]')];
if (dataRoots.length) {
  dataRoots.forEach(root => {root.textContent = "Загрузка измеренных данных…";});
  try {
    const response = await fetch(new URL("../data/lecture-04/nr-ber-awgn.csv", import.meta.url));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = parseBer(await response.text()), catalog = measuredThresholds(rows);
    const mounts = {ber: root => mountBer(root, rows), thresholds: root => mountThresholds(root, catalog), selector: root => mountSelector(root, catalog), file: root => mountFile(root, catalog)};
    dataRoots.forEach(root => mounts[root.dataset.mcs](root));
  } catch (error) {
    dataRoots.forEach(root => { root.textContent = `Не удалось загрузить данные: ${error.message}. Выполните расчёты на бумаге, используя CSV по ссылке выше.`; });
  }
}
