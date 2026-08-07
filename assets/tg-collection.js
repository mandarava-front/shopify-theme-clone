if (!customElements.get('tg-collection-controls')) {
  class TgCollectionControls extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;

      this.initialized = true;
      this.onClick = this.onClick.bind(this);
      this.onKeydown = this.onKeydown.bind(this);
      this.addEventListener('click', this.onClick);
      document.addEventListener('keydown', this.onKeydown);
      this.observeProductCount();
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.onKeydown);
      this.countObserver?.disconnect();
    }

    get collectionComponent() {
      return this.closest('collection-component');
    }

    get sortSheet() {
      return this.querySelector('.tg-collection__sort-sheet');
    }

    get sortBackdrop() {
      return this.querySelector('.tg-collection__sort-backdrop');
    }

    observeProductCount() {
      const source = this.collectionComponent?.querySelector('#ProductCount');
      const target = this.querySelector('[data-tg-collection-count]');
      if (!source || !target) return;

      const syncCount = () => {
        target.textContent = source.textContent.trim();
      };

      syncCount();
      this.countObserver = new MutationObserver(syncCount);
      this.countObserver.observe(source, { childList: true, characterData: true, subtree: true });
    }

    openFilter() {
      const summary = this.collectionComponent?.querySelector('.mobile-facets__open-wrapper');
      summary?.click();
    }

    openSort() {
      const sortButton = this.querySelector('[data-tg-collection-sort]');
      if (!this.sortSheet || !this.sortBackdrop || !sortButton) return;

      window.clearTimeout(this.closeTimer);
      this.sortSheet.hidden = false;
      this.sortBackdrop.hidden = false;
      window.requestAnimationFrame(() => {
        this.sortSheet.dataset.open = 'true';
        this.sortBackdrop.dataset.open = 'true';
      });
      this.sortSheet.setAttribute('aria-hidden', 'false');
      sortButton.setAttribute('aria-expanded', 'true');
      document.body.classList.add('overflow-hidden-mobile');
      this.sortSheet.querySelector('[data-tg-collection-sort-option][aria-selected="true"], .tg-collection__sort-close')?.focus();
    }

    closeSort() {
      const sortButton = this.querySelector('[data-tg-collection-sort]');
      if (!this.sortSheet || !this.sortBackdrop) return;

      this.sortSheet.dataset.open = 'false';
      this.sortBackdrop.dataset.open = 'false';
      this.sortSheet.setAttribute('aria-hidden', 'true');
      sortButton?.setAttribute('aria-expanded', 'false');
      this.closeTimer = window.setTimeout(() => {
        this.sortSheet.hidden = true;
        this.sortBackdrop.hidden = true;
      }, 280);

      if (!this.collectionComponent?.querySelector('.mobile-facets__disclosure[open]')) {
        document.body.classList.remove('overflow-hidden-mobile');
      }
    }

    chooseSort(value, option) {
      const select = this.collectionComponent?.querySelector('#FacetSortForm select[name="sort_by"]');
      if (!select || select.value === value) {
        this.closeSort();
        return;
      }

      select.value = value;
      this.querySelectorAll('[data-tg-collection-sort-option]').forEach((button) => {
        const selected = button === option;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.querySelector('.tg-collection__sort-check').textContent = selected ? '\u2713' : '';
      });
      select.dispatchEvent(new Event('input', { bubbles: true }));
      this.closeSort();
    }

    onClick(event) {
      const filterButton = event.target.closest('[data-tg-collection-filter]');
      const sortButton = event.target.closest('[data-tg-collection-sort]');
      const closeButton = event.target.closest('[data-tg-collection-sort-close]');
      const sortOption = event.target.closest('[data-tg-collection-sort-option]');

      if (filterButton) this.openFilter();
      if (sortButton) this.openSort();
      if (closeButton) this.closeSort();
      if (sortOption) this.chooseSort(sortOption.dataset.tgCollectionSortOption, sortOption);
    }

    onKeydown(event) {
      if (event.key === 'Escape' && this.sortSheet?.dataset.open === 'true') this.closeSort();
    }
  }

  customElements.define('tg-collection-controls', TgCollectionControls);
}
