class DetailsDisclosure extends HTMLElement {
  constructor() {
    super();
    this.mainDetailsToggle = this.querySelector('details');
    this.content = this.mainDetailsToggle.querySelector('summary').nextElementSibling;

    this.mainDetailsToggle.addEventListener('focusout', this.onFocusOut.bind(this));
    this.mainDetailsToggle.addEventListener('toggle', this.onToggle.bind(this));
  }

  onFocusOut() {
    setTimeout(() => {
      if (!this.contains(document.activeElement)) this.close();
    });
  }

  onToggle() {
    if (!this.animations) this.animations = this.content.getAnimations();

    if (this.mainDetailsToggle.hasAttribute('open')) {
      this.animations.forEach((animation) => animation.play());
    } else {
      this.animations.forEach((animation) => animation.cancel());
    }
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', false);
  }
}

customElements.define('details-disclosure', DetailsDisclosure);

class HeaderMenu extends DetailsDisclosure {
  constructor() {
    super();
    this.header = document.querySelector('.header-wrapper');
    this.closeTimer = null;

    this.addEventListener('mouseenter', () => {
      if (!window.matchMedia('(min-width: 990px) and (hover: hover)').matches) return;
      window.clearTimeout(this.closeTimer);
      this.open();
    });

    this.addEventListener('mouseleave', () => {
      if (!window.matchMedia('(min-width: 990px) and (hover: hover)').matches) return;
      this.closeTimer = window.setTimeout(() => this.close(), 160);
    });

    this.querySelector('.mega-menu__backdrop')?.addEventListener('click', () => this.close());
    this.onDocumentKeyDown = (event) => {
      if (!this.mainDetailsToggle.open) return;
      if (event.key !== 'Escape') return;
      this.close();
      this.mainDetailsToggle.querySelector('summary').focus();
    };
    document.addEventListener('keydown', this.onDocumentKeyDown);
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.onDocumentKeyDown);
  }

  open() {
    document.querySelectorAll('header-menu details[open]').forEach((details) => {
      if (details !== this.mainDetailsToggle) details.removeAttribute('open');
    });
    this.mainDetailsToggle.setAttribute('open', '');
    this.mainDetailsToggle.querySelector('summary').setAttribute('aria-expanded', true);
  }

  onToggle() {
    if (!this.header) return;
    this.header.preventHide = this.mainDetailsToggle.open;
    document.body.classList.toggle('mega-menu-open', Boolean(document.querySelector('header-menu details[open]')));

    if (document.documentElement.style.getPropertyValue('--header-bottom-position-desktop') !== '') return;
    document.documentElement.style.setProperty(
      '--header-bottom-position-desktop',
      `${Math.floor(this.header.getBoundingClientRect().bottom)}px`
    );
  }
}

customElements.define('header-menu', HeaderMenu);
