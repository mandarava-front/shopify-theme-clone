if (!customElements.get('tg-collection-controls')) {
  class TgCollectionControls extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;

      this.initialized = true;
      this.onClick = this.onClick.bind(this);
      this.onMobileSortChange = this.onMobileSortChange.bind(this);
      this.addEventListener('click', this.onClick);
      this.observeActiveFilters();

      this.mobileDisclosure = this.collectionComponent?.querySelector('.mobile-facets__disclosure');
      this.mobileDisclosure?.addEventListener('change', this.onMobileSortChange);
      this.mobileDisclosure?.addEventListener('toggle', () => {
        if (!this.mobileDisclosure.open) {
          this.querySelectorAll('[data-tg-collection-filter], [data-tg-collection-sort]').forEach((button) => {
            button.setAttribute('aria-expanded', 'false');
          });
        }
      });
    }

    disconnectedCallback() {
      this.filterObserver?.disconnect();
      this.mobileDisclosure?.removeEventListener('change', this.onMobileSortChange);
    }

    get collectionComponent() {
      return this.closest('collection-component');
    }

    observeActiveFilters() {
      const source = this.collectionComponent?.querySelector('.active-facets-mobile');
      const target = this.querySelector('[data-tg-collection-filter-count]');
      if (!source || !target) return;

      const syncFilterCount = () => {
        const count = source.querySelectorAll('.active-facets__button').length;
        target.hidden = count === 0;
        target.textContent = count || '';
      };

      syncFilterCount();
      this.filterObserver = new MutationObserver(syncFilterCount);
      this.filterObserver.observe(source, { childList: true, subtree: true });
    }

    openMobileFacets(mode) {
      if (!this.mobileDisclosure) return;

      this.mobileDisclosure.dataset.tgMobileFacetsMode = mode;
      this.mobileDisclosure.querySelectorAll('[data-tg-mobile-facets-heading]').forEach((heading) => {
        heading.textContent = this.querySelector(`[data-tg-collection-${mode}]`)?.dataset.tgMobileFacetsLabel || '';
      });
      this.querySelectorAll('[data-tg-collection-filter], [data-tg-collection-sort]').forEach((button) => {
        button.setAttribute('aria-expanded', button.matches(`[data-tg-collection-${mode}]`) ? 'true' : 'false');
      });

      if (!this.mobileDisclosure.open) {
        this.mobileDisclosure.querySelector('.mobile-facets__open-wrapper')?.click();
      }

      if (mode === 'sort') {
        window.setTimeout(() => {
          this.collectionComponent
            ?.querySelector('.mobile-facets__sort-radio:checked, .mobile-facets__sort-radio')
            ?.focus();
        }, 120);
      }
    }

    onMobileSortChange(event) {
      if (!event.target.matches('.mobile-facets__sort-radio')) return;

      const sortButton = this.querySelector('[data-tg-collection-sort]');
      const selectedLabel = event.target.closest('.mobile-facets__sort-option')?.textContent.trim();
      const sortButtonLabel = sortButton?.querySelector('span:not(.svg-wrapper)');

      if (selectedLabel && sortButtonLabel) sortButtonLabel.textContent = selectedLabel;

      this.mobileDisclosure?.closest('menu-drawer')?.closeMenuDrawer(event, sortButton);
    }

    onClick(event) {
      const filterButton = event.target.closest('[data-tg-collection-filter]');
      const sortButton = event.target.closest('[data-tg-collection-sort]');

      if (filterButton) this.openMobileFacets('filter');
      if (sortButton) this.openMobileFacets('sort');
    }
  }

  customElements.define('tg-collection-controls', TgCollectionControls);
}
