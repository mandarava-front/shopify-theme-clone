/**
 * Hands the mobile row search field's term off to the full-screen search overlay.
 *
 * The row field (snippets/tg-header-mobile-search.liquid) does not search as you
 * type. On submit this opens the overlay that the search icon normally opens
 * (snippets/header-search.liquid with mobile_icon_overlay) and lets the
 * predictive search inside it render the results.
 *
 * Falls through to a normal form submit when there is nothing to hand off to -
 * no overlay in the DOM, or predictive search turned off in theme settings - so
 * the field always stays functional.
 */

class TgMobileSearchHandoff extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    this.input = this.querySelector('input[type="search"]');

    this.form?.addEventListener('submit', this.onSubmit.bind(this));
  }

  /**
   * The overlay only counts as a hand-off target when it actually contains a
   * <predictive-search>; with predictive search disabled it has no results
   * panel, so submitting to the search page is the better outcome.
   */
  getOverlay() {
    const overlay = document.querySelector('.header__search--tg-mobile-overlay');
    if (!overlay) return null;

    const summary = overlay.querySelector('summary');
    const predictiveSearch = overlay.querySelector('predictive-search');
    const overlayInput = predictiveSearch?.querySelector('input[type="search"]');
    if (!summary || !overlayInput) return null;

    return { summary, overlayInput };
  }

  onSubmit(event) {
    const term = this.input?.value.trim();
    if (!term) return;

    const target = this.getOverlay();
    if (!target) return;

    event.preventDefault();

    // Set the term first: DetailsModal.open() runs trapFocus, which focuses the
    // overlay input. PredictiveSearch.onFocus() then sees a non-empty value and
    // fetches straight away, so no extra input event is needed and the term
    // isn't searched twice.
    target.overlayInput.value = term;
    target.summary.click();

    // Belt and braces if trapFocus ever targets something else. Focusing an
    // already-focused element is a no-op, so this can't double up the request.
    target.overlayInput.focus();
  }
}

customElements.define('tg-mobile-search-handoff', TgMobileSearchHandoff);
