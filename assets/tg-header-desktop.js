class TgHeaderDesktop extends HTMLElement {
  connectedCallback() {
    this.announcement = this.querySelector('[data-tg-announcement]');
    this.announcementClose = this.querySelector('[data-tg-announcement-close]');
    this.searchOpen = this.querySelector('[data-tg-search-open]');
    this.searchForm = this.querySelector('[data-tg-search-form]');
    this.searchInput = this.querySelector('[data-tg-search-input]');
    this.searchClose = this.querySelector('[data-tg-search-close]');
    this.cartCount = this.querySelector('[data-tg-cart-count]');
    this.cartCountLabel = this.querySelector('[data-tg-cart-count-label]');

    this.onAnnouncementClose = this.closeAnnouncement.bind(this);
    this.onSearchOpen = this.openSearch.bind(this);
    this.onSearchClose = this.closeSearch.bind(this);
    this.onKeydown = this.handleKeydown.bind(this);
    this.onCartUpdate = this.updateCartCount.bind(this);

    this.restoreAnnouncement();
    this.announcementClose?.addEventListener('click', this.onAnnouncementClose);
    this.searchOpen?.addEventListener('click', this.onSearchOpen);
    this.searchClose?.addEventListener('click', this.onSearchClose);
    this.addEventListener('keydown', this.onKeydown);

    if (typeof subscribe === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
      this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, this.onCartUpdate);
    }
  }

  disconnectedCallback() {
    this.announcementClose?.removeEventListener('click', this.onAnnouncementClose);
    this.searchOpen?.removeEventListener('click', this.onSearchOpen);
    this.searchClose?.removeEventListener('click', this.onSearchClose);
    this.removeEventListener('keydown', this.onKeydown);
    this.cartUpdateUnsubscriber?.();
  }

  restoreAnnouncement() {
    if (!this.announcement || this.dataset.announcementDismissible !== 'true') return;

    try {
      if (window.sessionStorage.getItem(this.dataset.announcementKey) === 'hidden') {
        this.announcement.hidden = true;
      }
    } catch (error) {
      // Browsers can disable storage; dismissal still works for the current DOM.
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

  openSearch() {
    if (!this.searchForm) return;
    this.searchForm.hidden = false;
    this.searchOpen?.setAttribute('aria-expanded', 'true');
    this.searchInput?.focus();
  }

  closeSearch() {
    if (!this.searchForm) return;
    this.searchForm.hidden = true;
    this.searchOpen?.setAttribute('aria-expanded', 'false');
    this.searchOpen?.focus();
  }

  handleKeydown(event) {
    if (event.key === 'Escape' && this.searchForm && !this.searchForm.hidden) {
      event.preventDefault();
      this.closeSearch();
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
