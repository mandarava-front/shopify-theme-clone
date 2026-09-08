class PredictiveSearch extends SearchForm {
  constructor() {
    super();
    this.cachedResults = {};
    this.cachedSearchCounts = {};
    this.predictiveSearchResults = this.querySelector('[data-predictive-search]');
    // tg custom: idle panel (popular + recent searches) shown while the input is empty.
    // It lives outside [data-predictive-search] because renderSearchResults() overwrites that container.
    this.idlePanel = this.querySelector('[data-tg-search-idle]');
    this.allPredictiveSearchInstances = document.querySelectorAll('predictive-search');
    this.isOpen = false;
    this.abortController = new AbortController();
    this.searchCountAbortController = new AbortController();
    this.searchTerm = '';

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.input.form.addEventListener('submit', this.onFormSubmit.bind(this));

    this.input.addEventListener('focus', this.onFocus.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.addEventListener('keyup', this.onKeyup.bind(this));
    this.addEventListener('keydown', this.onKeydown.bind(this));
  }

  getQuery() {
    return this.input.value.trim();
  }

  onChange() {
    super.onChange();
    const newSearchTerm = this.getQuery();
    if (!this.searchTerm || !newSearchTerm.startsWith(this.searchTerm)) {
      // Remove the results when they are no longer relevant for the new search term
      // so they don't show up when the dropdown opens again
      this.querySelector('#predictive-search-results-groups-wrapper')?.remove();
    }

    // Update the term asap, don't wait for the predictive search query to finish loading
    this.updateSearchForTerm(this.searchTerm, newSearchTerm);

    this.searchTerm = newSearchTerm;

    if (!this.searchTerm.length) {
      this.close(true);
      // tg custom: fall back to the idle panel rather than closing outright,
      // so clearing the input reveals popular/recent terms again.
      this.openIdle();
      return;
    }

    this.removeAttribute('idle'); // tg custom
    this.getSearchResults(this.searchTerm);
  }

  onFormSubmit(event) {
    if (!this.getQuery().length || this.querySelector('[aria-selected="true"] a')) event.preventDefault();
  }

  onFormReset(event) {
    super.onFormReset(event);
    if (super.shouldResetForm()) {
      this.searchTerm = '';
      this.abortController.abort();
      this.abortController = new AbortController();
      this.searchCountAbortController.abort();
      this.searchCountAbortController = new AbortController();
      this.closeResults(true);
      // tg custom: SearchForm.onFormReset refocuses the input, so show the idle panel.
      this.openIdle();
    }
  }

  onFocus() {
    const currentSearchTerm = this.getQuery();

    // tg custom: an empty input opens the idle panel instead of doing nothing.
    if (!currentSearchTerm.length) {
      this.openIdle();
      return;
    }

    if (this.searchTerm !== currentSearchTerm) {
      // Search term was changed from other search input, treat it as a user change
      this.onChange();
    } else if (this.getAttribute('results') === 'true') {
      this.open();
    } else {
      this.getSearchResults(this.searchTerm);
    }
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onKeyup(event) {
    // tg custom: emptying the query via keyboard falls back to the idle panel.
    if (!this.getQuery().length) {
      this.close(true);
      this.openIdle();
    }
    event.preventDefault();

    switch (event.code) {
      case 'ArrowUp':
        this.switchOption('up');
        break;
      case 'ArrowDown':
        this.switchOption('down');
        break;
      case 'Enter':
        this.selectOption();
        break;
    }
  }

  onKeydown(event) {
    // Prevent the cursor from moving in the input when using the up and down arrow keys
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      event.preventDefault();
    }
  }

  updateSearchForTerm(previousTerm, newTerm) {
    const searchForTextElement = this.querySelector('[data-predictive-search-search-for-text]');
    const currentButtonText = searchForTextElement?.innerText;
    if (!currentButtonText || !previousTerm) return;

    // tg custom: escape regex metacharacters and bail out when the term isn't in the
    // button text. Upstream called .length on a null match, which threw for terms
    // containing characters like "(" or for labels that don't embed the term at all.
    const escapedTerm = previousTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = currentButtonText.match(new RegExp(escapedTerm, 'g'));
    if (!matches) return;

    if (matches.length > 1) {
      // The new term matches part of the button text and not just the search term, do not replace to avoid mistakes
      return;
    }

    searchForTextElement.innerText = currentButtonText.replace(previousTerm, newTerm);
  }

  switchOption(direction) {
    if (!this.getAttribute('open')) return;

    const moveUp = direction === 'up';
    const selectedElement = this.querySelector('[aria-selected="true"]');

    // Filter out hidden elements (duplicated page and article resources) thanks
    // to this https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
    const allVisibleElements = Array.from(
      this.querySelectorAll('li, button.predictive-search__item, a.predictive-search__item')
    ).filter(
      (element) => element.offsetParent !== null
    );
    let activeElementIndex = 0;

    if (moveUp && !selectedElement) return;

    let selectedElementIndex = -1;
    let i = 0;

    while (selectedElementIndex === -1 && i <= allVisibleElements.length) {
      if (allVisibleElements[i] === selectedElement) {
        selectedElementIndex = i;
      }
      i++;
    }

    this.statusElement.textContent = '';

    if (!moveUp && selectedElement) {
      activeElementIndex = selectedElementIndex === allVisibleElements.length - 1 ? 0 : selectedElementIndex + 1;
    } else if (moveUp) {
      activeElementIndex = selectedElementIndex === 0 ? allVisibleElements.length - 1 : selectedElementIndex - 1;
    }

    if (activeElementIndex === selectedElementIndex) return;

    const activeElement = allVisibleElements[activeElementIndex];

    activeElement.setAttribute('aria-selected', true);
    if (selectedElement) selectedElement.setAttribute('aria-selected', false);

    this.input.setAttribute('aria-activedescendant', activeElement.id);
  }

  selectOption() {
    const selectedOption = this.querySelector('[aria-selected="true"] a, button[aria-selected="true"]');

    if (selectedOption) selectedOption.click();
  }

  getSearchResults(searchTerm) {
    const queryKey = searchTerm.replace(' ', '-').toLowerCase();
    this.searchCountAbortController.abort();
    this.searchCountAbortController = new AbortController();
    this.setLiveRegionLoadingState();

    if (this.cachedResults[queryKey]) {
      this.renderSearchResults(this.cachedResults[queryKey]);
      const searchDeferred = this.dispatchSearchUpdateEvent(searchTerm);
      searchDeferred?.resolve({ totalCount: this.getTotalResultCount() });
      return;
    }

    const searchDeferred = this.dispatchSearchUpdateEvent(searchTerm);

    // tg custom: request resource types/limits explicitly so the panel layout is predictable.
    const searchParams = new URLSearchParams({
      q: searchTerm,
      'resources[type]': 'query,collection,product,article,page',
      'resources[limit]': '6',
      'resources[options][unavailable_products]': 'last',
      section_id: 'predictive-search',
    });

    fetch(`${routes.predictive_search_url}?${searchParams}`, {
      signal: this.abortController.signal,
    })
      .then((response) => {
        if (!response.ok) {
          var error = new Error(response.status);
          this.close();
          throw error;
        }

        return response.text();
      })
      .then((text) => {
        const resultsMarkup = new DOMParser()
          .parseFromString(text, 'text/html')
          .querySelector('#shopify-section-predictive-search').innerHTML;
        // Save bandwidth keeping the cache in all instances synced
        this.allPredictiveSearchInstances.forEach((predictiveSearchInstance) => {
          predictiveSearchInstance.cachedResults[queryKey] = resultsMarkup;
        });
        this.renderSearchResults(resultsMarkup);

        searchDeferred?.resolve({ totalCount: this.getTotalResultCount() });
      })
      .catch((error) => {
        if (error?.code === 20) {
          // Code 20 means the call was aborted
          searchDeferred?.reject(error);
          return;
        }
        searchDeferred?.reject(error);
        this.close();
        throw error;
      });
  }

  getTotalResultCount() {
    return parseInt(this.predictiveSearchResults.querySelector('[data-total-results]')?.dataset.totalResults) || 0;
  }

  dispatchSearchUpdateEvent(query) {
    const { SearchUpdateEvent } = window.StandardEvents || {};
    if (!SearchUpdateEvent) return null;

    const deferred = SearchUpdateEvent.createPromise();
    this.dispatchEvent(
      new SearchUpdateEvent({
        search: { query },
        promise: deferred.promise,
      })
    );
    return deferred;
  }

  setLiveRegionLoadingState() {
    this.statusElement = this.statusElement || this.querySelector('.predictive-search-status');
    this.loadingText = this.loadingText || this.getAttribute('data-loading-text');

    this.setLiveRegionText(this.loadingText);
    this.predictiveSearchResults.hidden = false;
    this.querySelectorAll('.predictive-search__loading-state').forEach((loadingState) => {
      loadingState.hidden = false;
    });
    this.setAttribute('loading', true);
  }

  setLiveRegionText(statusText) {
    this.statusElement.setAttribute('aria-hidden', 'false');
    this.statusElement.textContent = statusText;

    setTimeout(() => {
      this.statusElement.setAttribute('aria-hidden', 'true');
    }, 1000);
  }

  renderSearchResults(resultsMarkup) {
    this.predictiveSearchResults.innerHTML = resultsMarkup;
    this.removeAttribute('idle'); // tg custom: results supersede the idle panel
    this.setAttribute('results', true);
    this.updateViewAllCount();

    this.setLiveRegionResults();
    this.open();
  }

  updateViewAllCount() {
    const viewAllLink = this.predictiveSearchResults.querySelector('[data-tg-view-all-results]');
    const viewAllLabel = viewAllLink?.querySelector('[data-tg-view-all-label]');
    if (!viewAllLink || !viewAllLabel) return;

    const searchUrl = viewAllLink.href;
    const cachedLabel = this.cachedSearchCounts[searchUrl];
    if (cachedLabel) {
      viewAllLabel.textContent = cachedLabel;
      return;
    }

    const countUrl = new URL(searchUrl);
    countUrl.searchParams.set('section_id', 'tg-search-count');

    fetch(countUrl, { signal: this.searchCountAbortController.signal })
      .then((response) => {
        if (!response.ok) throw new Error(response.status);
        return response.text();
      })
      .then((text) => {
        const countElement = new DOMParser()
          .parseFromString(text, 'text/html')
          .querySelector('[data-tg-search-result-count]');
        const exactLabel = countElement?.textContent.trim();
        if (!exactLabel) return;

        this.allPredictiveSearchInstances.forEach((predictiveSearchInstance) => {
          predictiveSearchInstance.cachedSearchCounts[searchUrl] = exactLabel;
        });

        const currentLink = this.predictiveSearchResults.querySelector('[data-tg-view-all-results]');
        if (currentLink?.href === searchUrl) {
          currentLink.querySelector('[data-tg-view-all-label]').textContent = exactLabel;
        }
      })
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Unable to load the full search result count.', error);
      });
  }

  setLiveRegionResults() {
    this.querySelectorAll('.predictive-search__loading-state').forEach((loadingState) => {
      loadingState.hidden = true;
    });
    this.removeAttribute('loading');
    this.setLiveRegionText(this.querySelector('[data-predictive-search-live-region-count-value]').textContent);
  }

  getResultsMaxHeight() {
    this.resultsMaxHeight =
      window.innerHeight - document.querySelector('.section-header')?.getBoundingClientRect().bottom;
    return this.resultsMaxHeight;
  }

  open() {
    this.predictiveSearchResults.hidden = false;
    this.predictiveSearchResults.style.maxHeight = this.resultsMaxHeight || `${this.getResultsMaxHeight()}px`;
    this.setAttribute('open', true);
    this.input.setAttribute('aria-expanded', true);
    this.isOpen = true;
  }

  // tg custom: does the idle panel currently hold anything worth showing?
  // The recent-searches element stays [hidden] until it has history, and the
  // popular group is only rendered when the header has merchandised terms.
  hasIdleContent() {
    if (!this.idlePanel) return false;
    return !!this.idlePanel.querySelector('.tg-search-idle__group:not([hidden]) .tg-search-idle__item');
  }

  // tg custom: show the popular/recent panel (empty-query state).
  openIdle() {
    if (!this.hasIdleContent()) return;

    this.setAttribute('idle', true);
    this.setAttribute('open', true);
    this.input.setAttribute('aria-expanded', true);
    this.isOpen = true;
  }

  close(clearSearchTerm = false) {
    this.closeResults(clearSearchTerm);
    this.removeAttribute('idle'); // tg custom
    this.isOpen = false;
  }

  closeResults(clearSearchTerm = false) {
    if (clearSearchTerm) {
      this.input.value = '';
      this.removeAttribute('results');
    }
    const selected = this.querySelector('[aria-selected="true"]');

    if (selected) selected.setAttribute('aria-selected', false);

    this.input.setAttribute('aria-activedescendant', '');
    this.querySelectorAll('.predictive-search__loading-state').forEach((loadingState) => {
      loadingState.hidden = true;
    });
    this.predictiveSearchResults.hidden = true;
    this.removeAttribute('loading');
    this.removeAttribute('open');
    this.input.setAttribute('aria-expanded', false);
    this.resultsMaxHeight = false;
    this.predictiveSearchResults.removeAttribute('style');
  }
}

customElements.define('predictive-search', PredictiveSearch);
