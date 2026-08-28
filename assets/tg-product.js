class TgProductAddOnCart {
  constructor(form) {
    this.form = form;
    this.productForm = form.closest('product-form');
    this.addOns = [...document.querySelectorAll('[data-tg-addon]')];
    this.onSubmit = this.onSubmit.bind(this);
    this.form.addEventListener('submit', this.onSubmit, true);
  }

  selectedAddOns() {
    return this.addOns.filter((addOn) => addOn.querySelector('[data-tg-addon-toggle]')?.checked);
  }

  async onSubmit(event) {
    if (event.submitter?.closest('.shopify-payment-button')) return;

    const addOns = this.selectedAddOns();
    if (!addOns.length) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const submitButton = this.form.querySelector('[type="submit"]');
    const cart = document.querySelector('cart-notification, cart-drawer');
    const formData = new FormData(this.form);
    const properties = {};
    formData.forEach((value, key) => {
      const match = key.match(/^properties\[(.+)]$/);
      if (match && value) properties[match[1]] = value;
    });

    const items = [
      {
        id: formData.get('id'),
        quantity: Number(formData.get('quantity')) || 1,
        properties,
      },
      ...addOns.map((addOn) => ({ id: addOn.dataset.variantId, quantity: 1 })),
    ];

    submitButton?.setAttribute('aria-disabled', 'true');
    submitButton?.classList.add('loading');
    this.productForm?.handleErrorMessage?.();

    try {
      const payload = { items, sections_url: window.location.pathname };
      if (cart) payload.sections = cart.getSectionsToRender().map((section) => section.id);

      const response = await fetch(routes.cart_add_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.status) throw new Error(data.description || addOns[0].dataset.errorMessage);

      if (cart) {
        cart.setActiveElement?.(document.activeElement);
        cart.renderContents(data);
      } else {
        window.location.assign(routes.cart_url);
        return;
      }

      if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'tg-addon', cartData: data });
      }
    } catch (error) {
      this.productForm?.handleErrorMessage?.(error.message || 'Unable to add items to cart.');
    } finally {
      submitButton?.classList.remove('loading');
      submitButton?.removeAttribute('aria-disabled');
    }
  }
}

function bindTgProductAddOnForms(container = document) {
  container.querySelectorAll('product-form form').forEach((form) => {
    if (form.closest('product-form')?.dataset.tgAddonBound) return;
    form.closest('product-form').dataset.tgAddonBound = 'true';
    new TgProductAddOnCart(form);
  });
}

// Customily renders its live preview onto a canvas mounted inside one of the
// product media slides, then relies on that slide being the one the shopper
// sees. That holds for Dawn's stacked desktop gallery, but this theme turns the
// desktop gallery into a horizontal carousel (see tg-product-page.css), so the
// preview can end up scrolled off-screen and selecting an option appears to do
// nothing. Customily's options live outside <variant-selects>, so none of the
// theme's variant plumbing runs either — bridge the two here by scrolling the
// carousel to whichever slide currently hosts the canvas.
const TG_CUSTOMILY_CANVAS_SELECTOR = '.cl-canvas-container';
const TG_CUSTOMILY_OPTION_SELECTOR = '.customily_option, .customily-swatch, .cl-option-content';
const TG_GALLERY_NAV_SELECTOR = '.slider-button, .thumbnail-list__item button';
const TG_CUSTOMILY_RESPONSE_WINDOW = 2000;
const TG_CUSTOMILY_DEBOUNCE_DELAY = 150;
const TG_CUSTOMILY_POSITION_EPSILON = 4;

const tgCustomilyPreviewSyncers = [];
let tgCustomilyLastInteraction = 0;

class TgCustomilyPreviewSync {
  constructor(gallery) {
    this.gallery = gallery;
    this.timer = null;
    this.syncToPreview = this.syncToPreview.bind(this);

    // The app re-mounts the canvas several times per update while it lays out
    // responsively, so debounce instead of reacting to every mutation.
    new MutationObserver(() => this.schedule()).observe(gallery, { childList: true, subtree: true });
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(this.syncToPreview, TG_CUSTOMILY_DEBOUNCE_DELAY);
  }

  cancel() {
    clearTimeout(this.timer);
  }

  syncToPreview() {
    // Only follow the canvas just after an option was used. Otherwise the app's
    // own responsive re-layouts would yank the carousel away from an image the
    // shopper deliberately navigated to.
    if (performance.now() - tgCustomilyLastInteraction > TG_CUSTOMILY_RESPONSE_WINDOW) return;

    const canvas = this.gallery.querySelector(TG_CUSTOMILY_CANVAS_SELECTOR);
    const slide = canvas?.closest('li[data-media-id]');
    if (!slide) return;

    // The canvas is already on screen. Moving again would fight the shopper, and
    // setActiveMedia also nudges the window's scroll position.
    const slider = slide.parentElement;
    if (Math.abs(slider.scrollLeft - slide.offsetLeft) < TG_CUSTOMILY_POSITION_EPSILON) return;

    // prepend stays false on purpose: reordering the slides would move the first
    // media item, which is what Customily mounts its canvas against.
    this.gallery.setActiveMedia?.(slide.dataset.mediaId, false);
  }
}

// Manual gallery navigation wins over the preview. Closing the follow window
// stops a queued sync from dragging the carousel back to the canvas slide after
// the shopper picked a thumbnail or arrow.
function releaseTgCustomilyFollow(event) {
  if (!event.target.closest?.(TG_GALLERY_NAV_SELECTOR)) return;

  tgCustomilyLastInteraction = 0;
  tgCustomilyPreviewSyncers.forEach((syncer) => syncer.cancel());
}

function trackTgCustomilyInteraction(event) {
  if (!event.target.closest?.(TG_CUSTOMILY_OPTION_SELECTOR)) return;

  tgCustomilyLastInteraction = performance.now();
  // Re-bind first: a product swap replaces the gallery via viewTransition
  // without firing shopify:section:load, so the fresh one is still unbound.
  bindTgCustomilyPreviewSync();
  // Sync even if the app updates the canvas without touching the DOM.
  tgCustomilyPreviewSyncers.forEach((syncer) => syncer.schedule());
}

function bindTgCustomilyPreviewSync(container = document) {
  for (let i = tgCustomilyPreviewSyncers.length - 1; i >= 0; i--) {
    if (!tgCustomilyPreviewSyncers[i].gallery.isConnected) tgCustomilyPreviewSyncers.splice(i, 1);
  }

  container.querySelectorAll('media-gallery').forEach((gallery) => {
    if (gallery.dataset.tgCustomilySync) return;
    gallery.dataset.tgCustomilySync = 'true';
    tgCustomilyPreviewSyncers.push(new TgCustomilyPreviewSync(gallery));
  });
}

document.addEventListener('click', releaseTgCustomilyFollow, true);
document.addEventListener('click', trackTgCustomilyInteraction, true);
document.addEventListener('change', trackTgCustomilyInteraction, true);

document.addEventListener('DOMContentLoaded', () => {
  bindTgProductAddOnForms();
  bindTgCustomilyPreviewSync();
});

document.addEventListener('shopify:section:load', (event) => {
  bindTgProductAddOnForms(event.target);
  bindTgCustomilyPreviewSync(event.target);
});
