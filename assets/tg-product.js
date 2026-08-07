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

document.addEventListener('DOMContentLoaded', () => {
  bindTgProductAddOnForms();
});

document.addEventListener('shopify:section:load', (event) => {
  bindTgProductAddOnForms(event.target);
});
