(() => {
  const footerSelector = '[data-mc-accordion-footer]';

  function initializeFooter(footer) {
    if (footer.dataset.mcAccordionFooterInitialized === 'true') return;

    const groups = [...footer.querySelectorAll('[data-mc-accordion-footer-group]')];
    const keepsOneOpen = footer.dataset.mcAccordionSingleOpen === 'true';
    const desktopMediaQuery = window.matchMedia('(min-width: 990px)');
    let openStatesBeforeDesktop = null;

    function closeOtherGroups(activeGroup) {
      if (desktopMediaQuery.matches || !keepsOneOpen || !activeGroup.open) return;

      groups.forEach((group) => {
        if (group !== activeGroup && group.open) group.removeAttribute('open');
      });
    }

    function syncGroupsForViewport() {
      if (desktopMediaQuery.matches) {
        openStatesBeforeDesktop = groups.map((group) => group.open);
        groups.forEach((group) => {
          group.open = true;
        });
        return;
      }

      if (!openStatesBeforeDesktop) return;

      groups.forEach((group, index) => {
        group.open = openStatesBeforeDesktop[index];
      });
      openStatesBeforeDesktop = null;
    }

    groups.forEach((group) => {
      group.addEventListener('toggle', () => closeOtherGroups(group));
      group.querySelector('summary')?.addEventListener('click', (event) => {
        if (desktopMediaQuery.matches) event.preventDefault();
      });
    });

    const defaultOpenGroup = groups.find((group) => group.open);
    if (defaultOpenGroup) closeOtherGroups(defaultOpenGroup);

    syncGroupsForViewport();
    desktopMediaQuery.addEventListener('change', syncGroupsForViewport);

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
