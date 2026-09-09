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

// TeeInBlue mounts its customization controls outside Shopify's product form.
// Its own add-to-cart action creates the customization and submits the line
// item with the generated properties. When the plugin action area is visually
// hidden, route the visible theme button through that flow instead of
// submitting the base variant without its customization metadata.
class TgTeeInBlueCartBridge {
  constructor() {
    this.pendingForm = null;
    this.pendingButton = null;
    this.customizationStarted = false;
    this.validationTimer = null;
    this.fallbackTimer = null;

    this.onClick = this.onClick.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.onCustomizationStarted = this.onCustomizationStarted.bind(this);
    this.reset = this.reset.bind(this);

    document.addEventListener('click', this.onClick, true);
    document.addEventListener('submit', this.onSubmit, true);
    document.addEventListener('teeinblue-event-before-customization-created', this.onCustomizationStarted);
    document.addEventListener('teeinblue-event-after-cart-added', this.reset);
    document.addEventListener('teeinblue-event-error', this.reset);
  }

  getContext(event) {
    let form;
    let button;

    if (event.type === 'submit') {
      form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches('form[data-type="add-to-cart-form"]')) return null;
      if (event.submitter?.closest?.('.shopify-payment-button')) return null;
      button = event.submitter?.matches?.('button.product-form__submit[type="submit"]')
        ? event.submitter
        : form.querySelector('button.product-form__submit[type="submit"]');
    } else {
      button = event.target.closest?.('button.product-form__submit[type="submit"]');
      form = button?.form;
    }

    const productRoot = form?.closest('product-info[data-product-id]');
    const campaign = window.teeinblueCampaign;
    if (!button || !productRoot || !productRoot.contains(button)) return null;
    if (campaign?.isTeeInBlueProduct !== true) return null;
    if (campaign.productId && String(campaign.productId) !== productRoot.dataset.productId) return null;

    const customizationForm = productRoot.querySelector('#tee-artwork-form');
    const pluginButton = customizationForm?.querySelector('#teeAtcButton');
    if (!customizationForm || !pluginButton) return null;

    return { form, button, pluginButton, customizationForm };
  }

  preventThemeSubmit(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  syncQuantity(form, customizationForm) {
    const themeQuantity = Number(new FormData(form).get('quantity')) || 1;
    const pluginQuantity = customizationForm.querySelector('.tee-quantity-input');
    if (!pluginQuantity || Number(pluginQuantity.value) === themeQuantity) return;

    pluginQuantity.value = String(themeQuantity);
    pluginQuantity.dispatchEvent(new Event('input', { bubbles: true }));
    pluginQuantity.dispatchEvent(new Event('change', { bubbles: true }));
  }

  setButtonLoading(button, loading) {
    if (!button) return;

    if (loading) {
      if (button.getAttribute('aria-disabled') === 'true') return;
      button.dataset.tgTeeinbluePending = 'true';
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('loading');
      button.querySelector('.loading__spinner')?.classList.remove('hidden');
      return;
    }

    if (button.dataset.tgTeeinbluePending !== 'true') return;
    delete button.dataset.tgTeeinbluePending;
    button.removeAttribute('aria-disabled');
    button.classList.remove('loading');
    button.querySelector('.loading__spinner')?.classList.add('hidden');
  }

  begin(context, event) {
    this.preventThemeSubmit(event);
    this.pendingForm = context.form;
    this.pendingButton = context.button;
    this.customizationStarted = false;
    this.setButtonLoading(context.button, true);

    window.clearTimeout(this.validationTimer);
    window.clearTimeout(this.fallbackTimer);
    this.fallbackTimer = window.setTimeout(this.reset, 60_000);

    try {
      this.syncQuantity(context.form, context.customizationForm);
      context.pluginButton.click();

      // Validation failures do not consistently emit a public TeeInBlue error
      // event. A valid submission emits BEFORE_CUSTOMIZATION_CREATED first.
      this.validationTimer = window.setTimeout(() => {
        if (this.pendingForm === context.form && !this.customizationStarted) this.reset();
      }, 500);
    } catch (error) {
      console.error('[TeeInBlue] Unable to start customization-aware add to cart', error);
      this.reset();
    }
  }

  onClick(event) {
    const context = this.getContext(event);
    if (!context) return;

    if (this.pendingForm) {
      this.preventThemeSubmit(event);
      return;
    }

    if (context.button.disabled || context.button.getAttribute('aria-disabled') === 'true') return;
    this.begin(context, event);
  }

  onSubmit(event) {
    const context = this.getContext(event);
    if (!context) return;

    if (this.pendingForm) {
      this.preventThemeSubmit(event);
      return;
    }

    this.begin(context, event);
  }

  onCustomizationStarted() {
    if (!this.pendingForm) return;
    this.customizationStarted = true;
    window.clearTimeout(this.validationTimer);
  }

  reset() {
    this.setButtonLoading(this.pendingButton, false);
    this.pendingForm = null;
    this.pendingButton = null;
    this.customizationStarted = false;
    window.clearTimeout(this.validationTimer);
    window.clearTimeout(this.fallbackTimer);
  }
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

const TG_SIZE_CHART_NATIVE_GROUP_SELECTOR = 'variant-selects .product-form__input';
const TG_SIZE_CHART_TEEINBLUE_GROUP_SELECTOR = '#tee-artwork-form .tee-option';

class TgSizeChart {
  constructor(root) {
    this.root = root;
    this.modalId = root.dataset.tgSizeChartModalId;
    this.label = root.dataset.tgSizeChartLabel || 'Size Chart';
    this.optionNames = new Set(
      (root.dataset.tgSizeChartOptionNames || 'Size,尺码,尺寸')
        .split(/[,，]/)
        .map((name) => this.normalize(name))
        .filter(Boolean)
    );
    this.animationFrame = null;
    this.scheduleSync = this.scheduleSync.bind(this);
    this.observer = new MutationObserver(this.scheduleSync);
    this.observer.observe(root, { childList: true, subtree: true, characterData: true });
    this.sync();
  }

  normalize(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  getNativeOptionName(group) {
    const namedControl = group.querySelector('[data-option-name]');
    if (namedControl?.dataset.optionName) return namedControl.dataset.optionName;

    const selectName = group.querySelector('select[name^="options["]')?.getAttribute('name') || '';
    return selectName.match(/^options\[(.*)]$/)?.[1] || '';
  }

  getTeeInBlueOptionName(group) {
    return group.querySelector('.tee-option__title')?.textContent || '';
  }

  createButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tg-size-chart__button link';
    button.dataset.tgSizeChartOpener = 'true';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', this.modalId);
    button.textContent = this.label;
    button.addEventListener('click', () => {
      const modal = document.getElementById(this.modalId);
      if (typeof modal?.show === 'function') modal.show(button);
    });
    return button;
  }

  syncGroup(group, optionName, title) {
    const existingButton = group.querySelector('[data-tg-size-chart-opener]');
    const isSizeOption = this.optionNames.has(this.normalize(optionName));

    if (!isSizeOption || !title) {
      existingButton?.remove();
      group.classList.remove('tg-size-chart-option');
      return;
    }

    group.classList.add('tg-size-chart-option');
    const button = existingButton || this.createButton();
    if (title.tagName === 'LEGEND') {
      if (button.parentElement !== title) title.appendChild(button);
    } else if (title.nextElementSibling !== button) {
      title.insertAdjacentElement('afterend', button);
    }
  }

  sync() {
    this.root.querySelectorAll(TG_SIZE_CHART_NATIVE_GROUP_SELECTOR).forEach((group) => {
      this.syncGroup(group, this.getNativeOptionName(group), group.querySelector('.form__label'));
    });

    this.root.querySelectorAll(TG_SIZE_CHART_TEEINBLUE_GROUP_SELECTOR).forEach((group) => {
      this.syncGroup(group, this.getTeeInBlueOptionName(group), group.querySelector('.tee-option__title'));
    });
  }

  scheduleSync() {
    if (this.animationFrame) return;
    this.animationFrame = window.requestAnimationFrame(() => {
      this.animationFrame = null;
      this.sync();
    });
  }

  destroy() {
    this.observer.disconnect();
    if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
    document.getElementById(this.modalId)?.remove();
  }
}

function bindTgSizeCharts(container = document) {
  const roots = [];
  if (container.matches?.('product-info[data-tg-size-chart]')) roots.push(container);
  roots.push(...container.querySelectorAll('product-info[data-tg-size-chart]'));

  roots.forEach((root) => {
    if (root.tgSizeChart) return;
    root.tgSizeChart = new TgSizeChart(root);
  });
}

document.addEventListener('click', releaseTgCustomilyFollow, true);
document.addEventListener('click', trackTgCustomilyInteraction, true);
document.addEventListener('change', trackTgCustomilyInteraction, true);

document.addEventListener('DOMContentLoaded', () => {
  bindTgProductAddOnForms();
  bindTgCustomilyPreviewSync();
  bindTgSizeCharts();
  window.TgTeeInBlueCartBridge ||= new TgTeeInBlueCartBridge();
});

document.addEventListener('shopify:section:load', (event) => {
  bindTgProductAddOnForms(event.target);
  bindTgCustomilyPreviewSync(event.target);
  bindTgSizeCharts(event.target);
});

document.addEventListener('shopify:section:unload', (event) => {
  event.target.querySelectorAll('product-info[data-tg-size-chart]').forEach((root) => {
    root.tgSizeChart?.destroy();
  });
});
