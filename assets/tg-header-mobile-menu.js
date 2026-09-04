(() => {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-tg-menu-accordion-toggle]');
    if (!trigger) return;

    const panelId = trigger.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', String(!isExpanded));
    panel.hidden = isExpanded;
  });
})();
