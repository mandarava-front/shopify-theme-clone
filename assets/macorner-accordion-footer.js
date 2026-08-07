(() => {
  const footerSelector = '[data-mc-accordion-footer]';

  function initializeFooter(footer) {
    if (footer.dataset.mcAccordionFooterInitialized === 'true') return;

    const groups = [...footer.querySelectorAll('[data-mc-accordion-footer-group]')];
    const keepsOneOpen = footer.dataset.mcAccordionSingleOpen === 'true';

    function closeOtherGroups(activeGroup) {
      if (!keepsOneOpen || !activeGroup.open) return;

      groups.forEach((group) => {
        if (group !== activeGroup && group.open) group.removeAttribute('open');
      });
    }

    groups.forEach((group) => {
      group.addEventListener('toggle', () => closeOtherGroups(group));
    });

    const defaultOpenGroup = groups.find((group) => group.open);
    if (defaultOpenGroup) closeOtherGroups(defaultOpenGroup);

    footer.dataset.mcAccordionFooterInitialized = 'true';
  }

  function initializeFooters(scope = document) {
    if (scope.matches?.(footerSelector)) initializeFooter(scope);
    scope.querySelectorAll?.(footerSelector).forEach(initializeFooter);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeFooters(), { once: true });
  } else {
    initializeFooters();
  }

  document.addEventListener('shopify:section:load', (event) => initializeFooters(event.target));
})();
