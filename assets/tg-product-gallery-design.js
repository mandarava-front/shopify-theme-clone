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
  const galleries = new Map();
  const enhance = () => {
    galleries.forEach((cleanup, gallery) => {
      if (!gallery.isConnected) {
        cleanup();
        galleries.delete(gallery);
      }
    });
    document.querySelectorAll('.tg-product-design #tee-gallery').forEach((gallery) => {
      if (galleries.has(gallery)) return;
      let frame;
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(sync);
      };
      const resizeObserver = new ResizeObserver(schedule);
      let observed = new Set();
      const fitMockups = () => {
        const slider = gallery.querySelector('.tee-slider');
        const mockups = Array.from(gallery.querySelectorAll('.tee-slide .tee-mockup'));
        const targets = new Set(slider ? [slider, ...mockups] : []);
        observed.forEach((element) => {
          if (!targets.has(element)) resizeObserver.unobserve(element);
        });
        targets.forEach((element) => {
          if (!observed.has(element)) resizeObserver.observe(element);
        });
        observed = targets;
        if (!slider) return;

        // TeeInBlue sizes its positioned artwork layers from the whole gallery,
        // including our desktop thumbnail column. Fit the complete mockup to
        // the actual slide without changing the app's artwork coordinates.
        const bounds = slider.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const updates = mockups.map((mockup) => {
          const style = getComputedStyle(mockup);
          const width = parseFloat(style.width);
          const height = parseFloat(style.height);
          return { mockup, scale: width > 0 && height > 0
            ? String(Math.min(bounds.width / width, bounds.height / height)) : null };
        });
        updates.forEach(({ mockup, scale }) => {
          // Keep our value off the inline style the app replaces when a
          // mockup loads or changes. The composition inherits it from its item.
          const item = mockup.parentElement;
          if (scale && item.style.getPropertyValue('--tg-mockup-scale') !== scale) {
            item.style.setProperty('--tg-mockup-scale', scale);
          }
        });
      };
      const sync = () => {
        frame = null;
        fitMockups();
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
      const observer = new MutationObserver((mutations) => {
        // Recheck app updates as well as resizes; ignore our own variable
        // writes on the parent and the slider's animation styles.
        if (mutations.some((mutation) => mutation.attributeName !== 'style' || mutation.target.matches('.tee-mockup'))) schedule();
      });
      observer.observe(gallery, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style'] });
      galleries.set(gallery, () => {
        observer.disconnect();
        resizeObserver.disconnect();
        cancelAnimationFrame(frame);
      });
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
