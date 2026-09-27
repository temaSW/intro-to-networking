import {bottleneckDefaults, bottleneckPresets, calculateBottleneck} from "./bottleneck-model.js";

const fields = [
  ["users", "Активных пользователей N", "чел.", 1, 100, 1],
  ["demand", "Запрос одного пользователя r", "Мбит/с", 0, 100, 1],
  ["access", "Ёмкость доступа", "Мбит/с", 10, 2000, 10],
  ["aggregation", "Ёмкость агрегации", "Мбит/с", 10, 2000, 10],
  ["transport", "Ёмкость транспорта", "Мбит/с", 10, 2000, 10],
];

function mount(root) {
  root.classList.add("bottleneck-widget");
  root.innerHTML = `<div class="interactive-controls bottleneck-actions">
    <label>Сценарий <select data-preset>
      <option value="small">Несколько пользователей</option>
      <option value="crowd">Много пользователей</option>
      <option value="transport">Транспорт ограничивает</option>
    </select></label>
    <button type="button" data-reset>Сбросить</button>
  </div><div class="interactive-controls bottleneck-controls"></div>
  <div class="bottleneck-summary" aria-live="polite"></div>
  <div class="bottleneck-segments"></div>
  <p class="interactive-note">Упрощённая агрегатная модель: все N пользователей предлагают одинаковую скорость r и проходят все три общих сегмента. Ёмкости заданы для группы целиком. Это не модель планировщика 5G или TCP; накладные расходы и конкурирующий трафик не учтены.</p>`;
  const controls = root.querySelector(".bottleneck-controls");
  for (const [key, label, unit, min, max, step] of fields) {
    const wrap = document.createElement("label");
    wrap.textContent = label;
    const output = document.createElement("output");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(bottleneckDefaults[key]);
    slider.dataset.field = key;
    slider.setAttribute("aria-label", `${label}, ${unit}`);
    wrap.append(output, slider);
    controls.append(wrap);
  }
  const preset = root.querySelector("[data-preset]");
  const sliders = Object.fromEntries([...root.querySelectorAll("[data-field]")].map(input => [input.dataset.field, input]));
  const formatter = new Intl.NumberFormat("ru-RU", {maximumFractionDigits: 1});
  const format = number => formatter.format(number);
  function update() {
    const params = Object.fromEntries(Object.entries(sliders).map(([key, input]) => [key, Number(input.value)]));
    for (const [key, , unit] of fields) sliders[key].previousElementSibling.textContent = `${format(params[key])} ${unit}`;
    const result = calculateBottleneck(params);
    root.querySelector(".bottleneck-summary").textContent = `Предлагаемая нагрузка: ${format(result.offered)} Мбит/с. Оценочная суммарная скорость: ${format(result.delivered)} Мбит/с. Оценка на пользователя при равном разделении: ${format(result.perUser)} Мбит/с. ${result.offered > result.capacityLimit ? "Ограничивает" : "Потенциально ограничит при росте нагрузки"}: ${result.segments.filter(s => result.limiting.includes(s.key)).map(s => s.label.toLowerCase()).join(" и ")}.`;
    const container = root.querySelector(".bottleneck-segments");
    container.replaceChildren();
    for (const segment of result.segments) {
      const card = document.createElement("div");
      card.className = `bottleneck-segment${result.limiting.includes(segment.key) ? " is-limiting" : ""}`;
      const heading = document.createElement("strong");
      heading.textContent = `${segment.label} — ${format(segment.capacity)} Мбит/с`;
      const meter = document.createElement("progress");
      meter.max = 100;
      meter.value = Math.min(100, segment.utilization * 100);
      meter.setAttribute("aria-label", `Загрузка: ${segment.label}`);
      const note = document.createElement("span");
      note.textContent = `Предлагаемая загрузка ${format(segment.utilization * 100)} %${segment.utilization > 1 ? " — спрос выше ёмкости" : ""}${result.limiting.includes(segment.key) ? " · наименьшая ёмкость" : ""}`;
      card.append(heading, meter, note);
      container.append(card);
    }
  }
  function apply(values) {
    for (const [key, value] of Object.entries(values)) sliders[key].value = String(value);
    update();
  }
  root.addEventListener("input", event => {
    if (event.target.matches("[data-field]")) {
      preset.value = "";
      update();
    }
  });
  preset.addEventListener("change", () => apply(bottleneckPresets[preset.value]));
  root.querySelector("[data-reset]").addEventListener("click", () => {preset.value = "small"; apply(bottleneckDefaults);});
  update();
}

document.querySelectorAll("[data-bottleneck-interactive]").forEach(mount);
