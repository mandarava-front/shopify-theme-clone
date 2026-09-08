/**
 * Recent search history for the predictive search idle panel.
 *
 * Stores terms in localStorage and renders them inside <tg-recent-searches>,
 * which is emitted by snippets/tg-search-panel.liquid. Terms are recorded when a
 * search form is submitted, when a predictive result is clicked, or when a
 * popular term is picked.
 */

const TG_RECENT_KEY = 'tg:recent-searches';
const TG_RECENT_MAX = 8;

function tgReadRecent() {
  try {
    const stored = JSON.parse(localStorage.getItem(TG_RECENT_KEY));
    return Array.isArray(stored) ? stored.filter((term) => typeof term === 'string' && term.trim()) : [];
  } catch (error) {
    // Private browsing or corrupted payload - degrade to no history.
    return [];
  }
}

function tgWriteRecent(terms) {
  try {
    localStorage.setItem(TG_RECENT_KEY, JSON.stringify(terms.slice(0, TG_RECENT_MAX)));
  } catch (error) {
    // Storage unavailable or full - history simply won't persist.
  }
  tgRefreshRecentElements();
}

function tgAddRecent(rawTerm) {
  const term = (rawTerm || '').trim().replace(/\s+/g, ' ');
  if (!term) return;

  const existing = tgReadRecent().filter((stored) => stored.toLowerCase() !== term.toLowerCase());
  tgWriteRecent([term, ...existing]);
}

function tgRemoveRecent(term) {
  tgWriteRecent(tgReadRecent().filter((stored) => stored.toLowerCase() !== term.toLowerCase()));
}

function tgRefreshRecentElements() {
  document.querySelectorAll('tg-recent-searches').forEach((element) => element.render());
}

class TgRecentSearches extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('[data-recent-list]');
    this.clearButton = this.querySelector('[data-recent-clear]');

    this.clearButton?.addEventListener('click', (event) => {
      event.preventDefault();
      tgWriteRecent([]);
    });

    this.list?.addEventListener('click', (event) => {
      const removeButton = event.target.closest('[data-recent-remove]');
      if (!removeButton) return;

      event.preventDefault();
      // Keep focus in the field so the dropdown doesn't collapse on removal.
      const input = this.closest('predictive-search')?.querySelector('input[type="search"]');
      tgRemoveRecent(removeButton.dataset.recentRemove);
      input?.focus();
    });

    this.render();
  }

  get limit() {
    return parseInt(this.dataset.recentLimit, 10) || TG_RECENT_MAX;
  }

  render() {
    if (!this.list) return;

    const terms = tgReadRecent().slice(0, this.limit);
    this.hidden = terms.length === 0;
    if (!terms.length) {
      this.list.innerHTML = '';
      return;
    }

    const searchUrl = this.dataset.searchUrl || '/search';
    const removeLabel = this.dataset.removeLabel || 'Remove';

    this.list.innerHTML = terms
      .map((term) => {
        const safeTerm = tgEscapeHtml(term);
        const href = `${searchUrl}?q=${encodeURIComponent(term)}&options%5Bprefix%5D=last`;

        return `
          <li class="tg-search-idle__item tg-search-idle__item--recent" role="option" aria-selected="false">
            <a class="tg-search-idle__link focus-inset" href="${href}">
              <span class="svg-wrapper" aria-hidden="true">${tgRecentIcon()}</span>
              <span class="tg-search-idle__label">${safeTerm}</span>
            </a>
            <button
              type="button"
              class="tg-search-idle__remove"
              data-recent-remove="${safeTerm}"
              aria-label="${tgEscapeHtml(`${removeLabel}: ${term}`)}"
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </li>
        `;
      })
      .join('');
  }
}

function tgEscapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML.replace(/"/g, '&quot;');
}

function tgRecentIcon() {
  return '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="10" cy="10" r="7.25"/><path d="M10 6v4.25l3 1.75" stroke-linecap="round"/></svg>';
}

customElements.define('tg-recent-searches', TgRecentSearches);

// Record the term whenever a search actually happens.
document.addEventListener(
  'submit',
  (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    const input = form.querySelector('input[type="search"][name="q"]');
    if (input) tgAddRecent(input.value);
  },
  // Capture, because PredictiveSearch.onFormSubmit may preventDefault.
  true
);

document.addEventListener('click', (event) => {
  const idleLink = event.target.closest('.tg-search-idle__link');
  if (idleLink) {
    tgAddRecent(idleLink.querySelector('.tg-search-idle__label')?.textContent || idleLink.textContent);
    return;
  }

  const resultItem = event.target.closest('.predictive-search__item');
  if (!resultItem) return;

  // Suggested queries record their own text; product/article hits record what was typed.
  const queryText = resultItem.querySelector('.predictive-search__item-query-result')?.getAttribute('aria-label');
  if (queryText) {
    tgAddRecent(queryText);
    return;
  }

  const input = resultItem.closest('predictive-search')?.querySelector('input[type="search"]');
  if (input) tgAddRecent(input.value);
});
