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
    let count = event?.cartData?.item_count;
    // Add-to-cart responses contain rendered sections rather than item_count.
    if (!Number.isFinite(count) && event?.cartData?.sections?.['cart-icon-bubble']) {
      const fragment = new DOMParser().parseFromString(event.cartData.sections['cart-icon-bubble'], 'text/html');
      const bubble = fragment.querySelector('.cart-count-bubble');
      const value = bubble?.querySelector('[aria-hidden="true"]')?.textContent;
      count = bubble ? (value ? Number(value.trim()) : 100) : 0;
    }
    if (!Number.isFinite(count)) return;
    if (this.cartCount) {
      this.cartCount.textContent = count > 0 && count < 100 ? String(count) : '';
      this.cartCount.hidden = count === 0;
    }
    if (this.cartCountLabel) this.cartCountLabel.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
  }
}

if (!customElements.get('tg-header-desktop')) {
  customElements.define('tg-header-desktop', TgHeaderDesktop);
}
