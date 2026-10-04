// Closeread owns scroll position; the scenes interpolate between lecture states.
document.addEventListener('DOMContentLoaded', () => {
  mountSequence('[data-route-map]', 'routeStage', ['access', 'access-node', 'transport', 'destination'], ['subscriber', 'server']);
  mountSequence('[data-pcm-scene]', 'sequenceStage', ['sample', 'compress', 'quantize', 'code', 'line'], ['signal']);

  const keying = document.querySelector('[data-keying-figure]');
  if (keying) {
    const triggers = [...keying.closest('.keying-closeread').querySelectorAll('.new-trigger[data-stage]')];
    const mode = keying.querySelector('.keying-mode');
    const step = keying.querySelector('[data-scene-step]');
    observeStages(triggers, (stage) => {
      keying.dataset.stage = stage;
      mode.textContent = stage === 'all' ? 'ASK · FSK · PSK' : stage.toUpperCase();
      step.textContent = String(Math.max(0, ['ask', 'fsk', 'psk'].indexOf(stage) + 1)).padStart(2, '0');
    });
  }

  function mountSequence(selector, attribute, order, endpoints) {
    const scene = document.querySelector(selector);
    if (!scene) return;
    const nodes = [...scene.querySelectorAll(`[data-${attribute.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}]`)];
    const triggers = [...scene.closest('.course-closeread').querySelectorAll('.new-trigger[data-stage]')];
    const step = scene.querySelector('[data-scene-step]');
    const total = order.length + 1;

    function showStage(stage) {
      const overview = stage === 'all';
      const position = order.indexOf(stage);
      scene.dataset.stage = stage;
      for (const item of nodes) {
        const name = item.dataset[attribute];
        const revealed = overview || endpoints.includes(name) || (position >= 0 && order.includes(name) && order.indexOf(name) <= position);
        item.classList.toggle('is-current', name === stage);
        item.classList.toggle('is-revealed', revealed);
      }
      scene.style.setProperty('--route-progress', overview ? '100%' : `${Math.max(0, position + 1) / total * 100}%`);
      step.textContent = String(overview ? total : Math.max(0, position + 1)).padStart(2, '0');
    }

    showStage('question');
    observeStages(triggers, showStage);
  }

  function observeStages(triggers, onStage) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onStage(entry.target.dataset.stage);
      }
    }, { rootMargin: '-49% 0px -49% 0px' });
    triggers.forEach((trigger) => observer.observe(trigger));
  }
});
