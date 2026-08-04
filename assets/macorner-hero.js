class MacornerHero extends HTMLElement {
  connectedCallback() {
    this.slides = [...this.querySelectorAll('[data-hero-slide]')];
    this.dots = [...this.querySelectorAll('[data-hero-dot]')];
    this.index = 0;
    this.interval = null;

    this.querySelector('[data-hero-previous]')?.addEventListener('click', () => this.show(this.index - 1));
    this.querySelector('[data-hero-next]')?.addEventListener('click', () => this.show(this.index + 1));
    this.dots.forEach((dot) => dot.addEventListener('click', () => this.show(Number(dot.dataset.heroDot))));
    this.addEventListener('mouseenter', () => this.stop());
    this.addEventListener('mouseleave', () => this.start());
    this.addEventListener('focusin', () => this.stop());
    this.addEventListener('focusout', () => this.start());
    this.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') this.show(this.index - 1);
      if (event.key === 'ArrowRight') this.show(this.index + 1);
    });
    // Touch swipe (primary path for mobile — more reliable than pointer capture)
    this.touchStartX = null;
    this.touchStartY = null;
    this.addEventListener(
      'touchstart',
      (event) => {
        if (event.target.closest('a, button')) return;
        this.touchStartX = event.touches[0].clientX;
        this.touchStartY = event.touches[0].clientY;
        this.stop();
      },
      { passive: true }
    );
    this.addEventListener(
      'touchend',
      (event) => {
        if (this.touchStartX === null) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - this.touchStartX;
        const dy = touch.clientY - this.touchStartY;
        // horizontal swipe only (ignore vertical scrolls)
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          this.show(this.index + (dx < 0 ? 1 : -1));
        }
        this.touchStartX = null;
        this.touchStartY = null;
        this.start();
      },
      { passive: true }
    );

    // Pointer drag (desktop mouse)
    this.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') return; // handled by touch events
      if (!event.isPrimary) return;
      if (event.target.closest('a, button')) return;
      this.pointerStart = event.clientX;
      this.setPointerCapture(event.pointerId);
      this.stop();
    });
    this.addEventListener('pointerup', (event) => {
      if (this.pointerStart === null || this.pointerStart === undefined) return;
      const distance = event.clientX - this.pointerStart;
      if (Math.abs(distance) > 45) this.show(this.index + (distance < 0 ? 1 : -1));
      if (this.hasPointerCapture(event.pointerId)) this.releasePointerCapture(event.pointerId);
      this.pointerStart = null;
      this.start();
    });
    this.addEventListener('pointercancel', () => {
      this.pointerStart = null;
      this.start();
    });
    this.show(0);
    this.start();
  }

  disconnectedCallback() {
    this.stop();
  }

  show(index) {
    this.index = (index + this.slides.length) % this.slides.length;
    this.slides.forEach((slide, slideIndex) => {
      const active = slideIndex === this.index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    this.dots.forEach((dot, dotIndex) => dot.setAttribute('aria-current', String(dotIndex === this.index)));
  }

  start() {
    if (this.dataset.autoplay !== 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.stop();
    this.interval = window.setInterval(() => this.show(this.index + 1), 7000);
  }

  stop() {
    window.clearInterval(this.interval);
    this.interval = null;
  }
}

customElements.define('hero-carousel', MacornerHero);
