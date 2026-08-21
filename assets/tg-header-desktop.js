class TgHeaderDesktop extends HTMLElement {
  connectedCallback() {
    this.cartCount = this.querySelector('[data-tg-cart-count]');
    this.cartCountLabel = this.querySelector('[data-tg-cart-count-label]');

    this.onCartUpdate = this.updateCartCount.bind(this);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate);
    }
  }

  disconnectedCallback() {
    this.cartUpdateUnsubscriber?.();
  }

  updateCartCount(event) {
    const count = event?.cartData?.item_count;
    if (!Number.isFinite(count)) return;
    if (this.cartCount) this.cartCount.textContent = count < 100 ? String(count) : '';
    if (this.cartCountLabel) this.cartCountLabel.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  }
}

if (!customElements.get('tg-header-desktop')) {
  customElements.define('tg-header-desktop', TgHeaderDesktop);
}
