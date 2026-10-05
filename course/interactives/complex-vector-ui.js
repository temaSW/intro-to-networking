import {complexVector} from "./complex-vector-model.js";

const format = value => (Math.abs(value) < 0.0005 ? 0 : value)
  .toLocaleString("ru-RU", {maximumFractionDigits: 2});

function mount(root) {
  root.innerHTML = `<div class="interactive-controls">
    <label>Модуль множителя <output data-modulus-output></output>
      <input data-modulus type="range" min="0" max="2" step="0.1" value="1"></label>
    <label>Угол множителя <output data-angle-output></output>
      <input data-angle type="range" min="-180" max="180" step="5" value="45"></label>
    </div>
    <div class="cn-chart"></div>
    <p data-readout aria-live="polite"></p>
    <p class="interactive-note">Пунктир: исходный вектор z₁ = 1. Сплошная стрелка: результат z₂ = kz₁. Тонкие линии — проекции результата.</p>`;
  const modulus = root.querySelector("[data-modulus]");
  const angle = root.querySelector("[data-angle]");
  const draw = () => {
    const vector = complexVector(Number(modulus.value), Number(angle.value));
    const x = 180 + 60 * vector.real;
    const y = 160 - 60 * vector.imaginary;
    const head = vector.modulus === 0 ? "" : `<path class="cn-head" d="M0 0 L-10 -5 L-10 5 Z" transform="translate(${x} ${y}) rotate(${-Number(angle.value)})"/>`;
    const label = `Результат: модуль ${format(vector.modulus)}, ${vector.angleDegrees === null ? "аргумент не определён" : `аргумент ${vector.angleDegrees}°`}, действительная часть ${format(vector.real)}, мнимая часть ${format(vector.imaginary)}.`;
    root.querySelector("[data-modulus-output]").textContent = format(vector.modulus);
    root.querySelector("[data-angle-output]").textContent = `${angle.value}°`;
    root.querySelector("[data-readout]").textContent = label;
    root.querySelector(".cn-chart").innerHTML = `<svg viewBox="0 0 360 330" role="img" aria-label="${label}">
      <circle cx="180" cy="160" r="60" class="cn-guide"/>
      <circle cx="180" cy="160" r="120" class="cn-guide"/>
      <line x1="25" y1="160" x2="335" y2="160" class="cn-axis"/>
      <line x1="180" y1="305" x2="180" y2="15" class="cn-axis"/>
      <path d="M335 160 l-8 -4 v8 z M180 15 l-4 8 h8 z" class="cn-axis-head"/>
      <path d="M${x} 160 V${y} H180" class="cn-guide"/>
      <path d="M180 160 H240" class="cn-reference"/>
      <path d="M180 160 L${x} ${y}" class="cn-vector"/>${head}
      <circle cx="${x}" cy="${y}" r="4" class="cn-head"/>
      <text x="310" y="184">Re</text><text x="192" y="25">Im</text>
      <text x="160" y="183">0</text><text x="240" y="183" text-anchor="middle">1</text>
      <text x="300" y="183" text-anchor="middle">2</text>
    </svg>`;
  };
  modulus.addEventListener("input", draw);
  angle.addEventListener("input", draw);
  draw();
}

document.querySelectorAll("[data-complex-vector]").forEach(mount);
