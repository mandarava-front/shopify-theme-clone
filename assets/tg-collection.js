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

if (!customElements.get('tg-collection-sort')) {
  class TgCollectionSort extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;

      this.initialized = true;
      this.details = this.querySelector('details');
      this.trigger = this.querySelector('.tg-collection__sort-trigger');
      this.valueInput = this.querySelector('input[name="sort_by"]');
      this.onClick = this.onClick.bind(this);
      this.onToggle = this.onToggle.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this);

      this.addEventListener('click', this.onClick);
      this.addEventListener('keydown', this.onKeyDown);
      this.details?.addEventListener('toggle', this.onToggle);
      document.addEventListener('pointerdown', this.onDocumentPointerDown);
      this.onToggle();
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.onClick);
      this.removeEventListener('keydown', this.onKeyDown);
      this.details?.removeEventListener('toggle', this.onToggle);
      document.removeEventListener('pointerdown', this.onDocumentPointerDown);
      this.initialized = false;
    }

    onClick(event) {
      const option = event.target.closest('[data-tg-collection-sort-option]');
      if (!option || !this.contains(option)) return;

      const value = option.dataset.tgCollectionSortOption;
      if (!value || !this.valueInput) return;

      event.preventDefault();
      this.valueInput.value = value;
      this.querySelectorAll('[data-tg-collection-sort-option]').forEach((sortOption) => {
        sortOption.setAttribute('aria-selected', String(sortOption === option));
      });
      this.trigger.querySelector('span')?.replaceChildren(option.textContent.trim());
      this.details.open = false;
      this.valueInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    onToggle() {
      this.trigger?.setAttribute('aria-expanded', String(Boolean(this.details?.open)));
    }

    onKeyDown(event) {
      if (event.key !== 'Escape' || !this.details?.open) return;

      this.details.open = false;
      this.trigger?.focus();
    }

    onDocumentPointerDown(event) {
      if (!this.details?.open || this.contains(event.target)) return;
      this.details.open = false;
    }
  }

  customElements.define('tg-collection-sort', TgCollectionSort);
}

if (!customElements.get('tg-collection-price-range')) {
  class TgCollectionPriceRange extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;

      this.initialized = true;
      this.slider = this.querySelector('[data-tg-price-slider]');
      this.minRange = this.querySelector('[data-tg-price-range="min"]');
      this.maxRange = this.querySelector('[data-tg-price-range="max"]');
      this.minInput = this.querySelector('[data-tg-price-input="min"]');
      this.maxInput = this.querySelector('[data-tg-price-input="max"]');
      this.onRangeInput = this.onRangeInput.bind(this);
      this.onTextInput = this.onTextInput.bind(this);

      this.minRange?.addEventListener('input', this.onRangeInput);
      this.maxRange?.addEventListener('input', this.onRangeInput);
      this.minInput?.addEventListener('input', this.onTextInput);
      this.maxInput?.addEventListener('input', this.onTextInput);
      this.sync();
    }

    disconnectedCallback() {
      this.minRange?.removeEventListener('input', this.onRangeInput);
      this.maxRange?.removeEventListener('input', this.onRangeInput);
      this.minInput?.removeEventListener('input', this.onTextInput);
      this.maxInput?.removeEventListener('input', this.onTextInput);
      this.initialized = false;
    }

    onRangeInput(event) {
      const isMin = event.currentTarget === this.minRange;
      const otherRange = isMin ? this.maxRange : this.minRange;
      const value = Number(event.currentTarget.value);
      const otherValue = Number(otherRange?.value);

      if (isMin && value > otherValue) otherRange.value = value;
      if (!isMin && value < otherValue) otherRange.value = value;

      this.syncInputsFromRanges();
      this.sync();
    }

    onTextInput(event) {
      const isMin = event.currentTarget === this.minInput;
      const targetRange = isMin ? this.minRange : this.maxRange;
      if (!targetRange) return;

      if (!event.currentTarget.value.trim()) return;

      const value = Number(event.currentTarget.value.replace(/,/g, ''));
      if (!Number.isFinite(value)) return;

      targetRange.value = Math.min(Math.max(value, Number(targetRange.min)), Number(targetRange.max));
      if (isMin && Number(this.minRange.value) > Number(this.maxRange?.value)) this.maxRange.value = this.minRange.value;
      if (!isMin && Number(this.maxRange.value) < Number(this.minRange?.value)) this.minRange.value = this.maxRange.value;
      this.syncInputsFromRanges();
      this.sync();
    }

    syncInputsFromRanges() {
      if (this.minInput && this.minRange) this.minInput.value = this.minRange.value;
      if (this.maxInput && this.maxRange) this.maxInput.value = this.maxRange.value;
    }

    sync() {
      if (!this.slider || !this.minRange || !this.maxRange) return;

      const max = Number(this.maxRange.max) || 1;
      const minValue = Number(this.minRange.value);
      const maxValue = Number(this.maxRange.value);
      this.slider.style.setProperty('--tg-price-min', `${(minValue / max) * 100}%`);
      this.slider.style.setProperty('--tg-price-max', `${(maxValue / max) * 100}%`);
    }
  }

  customElements.define('tg-collection-price-range', TgCollectionPriceRange);
}
