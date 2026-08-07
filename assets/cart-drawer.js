class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  setHeaderCartIconAccessibility() {
    document.querySelectorAll('#cart-icon-bubble, .tg-header-desktop__cart').forEach((cartLink) => {
      cartLink.setAttribute('role', 'button');
      cartLink.setAttribute('aria-haspopup', 'dialog');
      cartLink.addEventListener('click', (event) => {
        event.preventDefault();
        this.open(cartLink);
      });
      cartLink.addEventListener('keydown', (event) => {
        if (event.code.toUpperCase() === 'SPACE') {
          event.preventDefault();
          this.open(cartLink);
        }
      });
    });
  }

  open(triggeredBy) {
    this.initializeTgCartDrawer();
    if (this.classList.contains('active')) return;
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active');
    });

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true },
    );

    document.body.classList.add('overflow-hidden');

    // cart-drawer-items is a CartItems subclass that extends createViewEventElement.
    // Its `view-event-trigger="manual"` skips auto-dispatch on connect; we fire
    // it here when the drawer opens, with `context: 'dialog'` from the payload attribute.
    this.querySelector('cart-drawer-items')?.dispatchViewEvent();
  }

  close() {
    this.classList.remove('active');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  initializeTgCartDrawer() {
    window.TgCartAddons?.syncDrawer();

    const urgency = this.querySelector('[data-tg-cart-urgency]');
    if (!urgency) {
      window.clearInterval(this.tgCartDrawerUrgencyTimer);
      this.tgCartDrawerUrgencyTimer = null;
      return;
    }

    const countdownValue = urgency.querySelector('[data-tg-cart-urgency-value]');
    if (!countdownValue) return;

    const minutes = Math.max(1, Number(urgency.dataset.tgCartUrgencyMinutes) || 50);
    const storageKey = `tg-cart-drawer-urgency-${window.location.host}`;
    let expiresAt;

    try {
      expiresAt = Number(window.sessionStorage.getItem(storageKey));
      if (!expiresAt || expiresAt <= Date.now()) {
        expiresAt = Date.now() + minutes * 60 * 1000;
        window.sessionStorage.setItem(storageKey, String(expiresAt));
      }
    } catch {
      expiresAt = Date.now() + minutes * 60 * 1000;
    }

    const updateCountdown = () => {
      const remainingSeconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      const remainingMinutes = Math.floor(remainingSeconds / 60);
      const seconds = String(remainingSeconds % 60).padStart(2, '0');
      countdownValue.textContent = `${remainingMinutes}:${seconds}`;

      if (remainingSeconds === 0) {
        window.clearInterval(this.tgCartDrawerUrgencyTimer);
        this.tgCartDrawerUrgencyTimer = null;
      }
    };

    window.clearInterval(this.tgCartDrawerUrgencyTimer);
    updateCountdown();
    if (this.tgCartDrawerUrgencyTimer !== null) {
      this.tgCartDrawerUrgencyTimer = window.setInterval(updateCountdown, 1000);
    }
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  renderContents(parsedState) {
    // `is-empty` lives on the custom element, not on its inner panel. Leaving it
    // behind after an AJAX add hides the drawer header through the base stylesheet.
    this.classList.remove('is-empty');
    this.productId = parsedState.id;
    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
    });
    this.initializeTgCartDrawer();

    setTimeout(() => {
      this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
      this.open();
    });
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    const sections = [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];

    const cartFooter = document.getElementById('main-cart-footer');
    if (cartFooter?.dataset.id) {
      sections.push({
        id: cartFooter.dataset.id,
        selector: '.tg-cart-summary__blocks',
      });
    }

    return sections;
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    const sections = [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];

    const cartFooter = document.getElementById('main-cart-footer');
    if (cartFooter?.dataset.id) {
      sections.push({
        id: 'main-cart-footer',
        section: cartFooter.dataset.id,
        selector: '.tg-cart-summary__blocks',
      });
    }

    return sections;
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
