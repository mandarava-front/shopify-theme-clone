class TgHeaderDesktop extends HTMLElement {
  connectedCallback() {
    this.announcement = this.querySelector('[data-tg-announcement]');
    this.announcementClose = this.querySelector('[data-tg-announcement-close]');
    this.cartCount = this.querySelector('[data-tg-cart-count]');
    this.cartCountLabel = this.querySelector('[data-tg-cart-count-label]');

    this.onAnnouncementClose = this.closeAnnouncement.bind(this);
    this.onCartUpdate = this.updateCartCount.bind(this);

    this.restoreAnnouncement();
    this.announcementClose?.addEventListener('click', this.onAnnouncementClose);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate);
    }
  }

  disconnectedCallback() {
    this.announcementClose?.removeEventListener('click', this.onAnnouncementClose);
    this.cartUpdateUnsubscriber?.();
  }

  restoreAnnouncement() {
    if (!this.announcement || this.dataset.announcementDismissible !== 'true') return;

    try {
      if (window.sessionStorage.getItem(this.dataset.announcementKey) === 'hidden') {
        this.announcement.hidden = true;
      }
    } catch (error) {
      // Storage is optional for this enhancement.
    }
  }

  closeAnnouncement() {
    if (!this.announcement) return;
    this.announcement.hidden = true;

    try {
      window.sessionStorage.setItem(this.dataset.announcementKey, 'hidden');
    } catch (error) {
      // Storage is optional for this enhancement.
    }
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
