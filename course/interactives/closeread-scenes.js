// Closeread owns the sticky layout; this adapter highlights the relevant diagram step.
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.course-closeread');
  const map = section?.querySelector('[data-route-map]');
  if (map) {
    const stages = [...map.querySelectorAll('[data-route-stage]')];
    const token = map.querySelector('.route-map-token');
    const triggers = [...section.querySelectorAll('.new-trigger[data-stage]')];

    function showStage(stage) {
      const overview = stage === 'all';
      map.dataset.stage = stage;
      for (const item of stages) {
        const current = item.dataset.routeStage === stage;
        item.classList.toggle('is-current', current);
        item.classList.toggle('is-muted', !overview && !current);
        if (current) item.append(token);
      }
      token.hidden = overview;
    }

    showStage('all');
    observeStages(triggers, showStage);
  }

  const keying = document.querySelector('[data-keying-figure]');
  if (keying) {
    const triggers = [...keying.closest('.keying-closeread').querySelectorAll('.new-trigger[data-stage]')];
    observeStages(triggers, (stage) => { keying.dataset.stage = stage; });
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
