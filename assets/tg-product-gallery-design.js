/* Pagination enhances the existing media-gallery rather than duplicating its state. */
if (!customElements.get('tg-gallery-pagination')) {
  customElements.define('tg-gallery-pagination', class extends HTMLElement {
    connectedCallback() {
      if (!this.closest('.tg-product-design')) return;
      this.controller = new AbortController();
      this.gallery = this.closest('media-gallery');
      this.viewer = this.gallery.querySelector('[id^="GalleryViewer"]');
      this.list = this.viewer?.querySelector('[id^="Slider-Gallery"]');
      if (!this.list) return;
      this.addEventListener('click', (event) => {
        const button = event.target.closest('[data-gallery-target]');
        if (button) this.gallery.setActiveMedia?.(button.dataset.galleryTarget, false);
      }, { signal: this.controller.signal });
      this.viewer.addEventListener('slideChanged', (event) => {
        const id = event.detail.currentElement?.dataset.mediaId;
        if (id) this.syncCurrent(id);
      }, { signal: this.controller.signal });
      this.observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.type === 'childList')) this.render();
        else this.syncCurrent();
      });
      this.observer.observe(this.list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'data-media-id'] });
      this.thumbList = this.gallery.querySelector('[id^="Slider-Thumbnails"]');
      if (this.thumbList) {
        this.thumbObserver = new MutationObserver(() => this.revealThumbnail());
        this.thumbObserver.observe(this.thumbList, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
      }
      this.render();
    }

    disconnectedCallback() {
      this.controller?.abort();
      this.observer?.disconnect();
      this.thumbObserver?.disconnect();
    }

    render() {
      const slides = Array.from(this.list.children).filter((slide) => slide.dataset.mediaId && !slide.hasAttribute('data-slider-loop-clone'));
      const key = slides.map((slide) => slide.dataset.mediaId).join('|');
      if (key !== this.renderKey) {
        this.renderKey = key;
        this.replaceChildren(...slides.map((slide, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'tg-gallery-dot';
          button.dataset.galleryTarget = slide.dataset.mediaId;
          button.setAttribute('aria-controls', this.viewer.id);
          const thumbnail = this.gallery.querySelector(`[data-target="${CSS.escape(slide.dataset.mediaId)}"] button`);
          const slideLabel = slide.querySelector('.product__media-toggle .visually-hidden')?.textContent.trim();
          button.setAttribute('aria-label', thumbnail?.getAttribute('aria-label') || slideLabel || String(index + 1));
          return button;
        }));
      }
      this.hidden = slides.length < 2;
      this.syncCurrent();
    }

    syncCurrent(mediaId) {
      const current = mediaId || this.list.querySelector('.is-active:not([data-slider-loop-clone])')?.dataset.mediaId;
      this.querySelectorAll('button').forEach((button) => {
        const active = button.dataset.galleryTarget === current;
        if (active) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
    }

    revealThumbnail() {
      if (!window.matchMedia('(min-width: 990px)').matches) return;
      const active = this.thumbList.querySelector('[aria-current]')?.closest('li');
      if (!active) return;
      const listRect = this.thumbList.getBoundingClientRect();
      const itemRect = active.getBoundingClientRect();
      if (itemRect.top < listRect.top) this.thumbList.scrollTop += itemRect.top - listRect.top;
      else if (itemRect.bottom > listRect.bottom) this.thumbList.scrollTop += itemRect.bottom - listRect.bottom;
    }
  });
}

// TeeInBlue thumbnails keep their original click listeners. Expose these same
// elements as keyboard controls when their mobile presentation becomes dots.
(() => {
  const galleries = new WeakSet();
  const enhance = () => {
    document.querySelectorAll('.tg-product-design #tee-gallery').forEach((gallery) => {
      if (galleries.has(gallery)) return;
      galleries.add(gallery);
      let frame;
      const sync = () => {
        frame = null;
        const thumbnails = Array.from(gallery.querySelectorAll('.tee-thumbnail'));
        const container = gallery.querySelector('.tee-thumbnails');
        if (container) container.dataset.tgSingle = String(thumbnails.length < 2);
        thumbnails.forEach((thumbnail, index) => {
          thumbnail.setAttribute('role', 'button');
          thumbnail.tabIndex = 0;
          thumbnail.setAttribute('aria-label', `${thumbnail.querySelector('img')?.alt || document.title} ${index + 1}`);
          if (thumbnail.classList.contains('tee-thumbnail--active')) thumbnail.setAttribute('aria-current', 'true');
          else thumbnail.removeAttribute('aria-current');
        });
        const active = gallery.querySelector('.tee-thumbnail--active');
        if (container && active && window.matchMedia('(min-width: 990px)').matches) {
          const trackRect = container.getBoundingClientRect();
          const rect = active.getBoundingClientRect();
          if (rect.top < trackRect.top) container.scrollTop += rect.top - trackRect.top;
          else if (rect.bottom > trackRect.bottom) container.scrollTop += rect.bottom - trackRect.bottom;
        }
      };
      const observer = new MutationObserver(() => {
        if (!gallery.isConnected) { observer.disconnect(); return; }
        if (!frame) frame = requestAnimationFrame(sync);
      });
      observer.observe(gallery, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      gallery.addEventListener('keydown', (event) => {
        const thumbnail = event.target.closest('.tee-thumbnail');
        if (thumbnail && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          thumbnail.click();
        }
      });
      sync();
    });
  };
  enhance();
  new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
})();

/* Keep the gallery below the visible sticky header, including announcements
   above it and headers which hide when scrolling down. */
(() => {
  let frame;
  let header;
  const observer = new ResizeObserver(schedule);
  function update() {
    frame = null;
    const current = document.querySelector('.section-header');
    if (header !== current) {
      observer.disconnect();
      header = current;
      if (header) observer.observe(header);
    }
    const position = header && getComputedStyle(header).position;
    const bottom = position === 'sticky' || position === 'fixed'
      ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const offset = `${Math.ceil(bottom) + 16}px`;
    document.querySelectorAll('.tg-product-design').forEach(root => {
      if (root.style.getPropertyValue('--tg-product-sticky-offset') !== offset) {
        root.style.setProperty('--tg-product-sticky-offset', offset);
      }
    });
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  document.addEventListener('shopify:section:load', schedule);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('transitionend', event => {
    if (header?.contains(event.target)) schedule();
  });
  update();
})();
