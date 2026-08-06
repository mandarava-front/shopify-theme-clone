(() => {
  const initFaqSections = (root = document) => {
    root.querySelectorAll('[data-tg-faq]').forEach((section) => {
      if (section.dataset.tgFaqReady === 'true') return;
      section.dataset.tgFaqReady = 'true';
      section.querySelectorAll('.faq-question-toggle').forEach((toggle) => {
        toggle.addEventListener('click', () => {
          const content = section.querySelector(`#${CSS.escape(toggle.getAttribute('aria-controls'))}`);
          if (!content) return;
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          toggle.setAttribute('aria-expanded', String(!expanded));
          content.classList.toggle('active', !expanded);
          content.hidden = expanded;
        });
      });
    });
  };

  initFaqSections();
  document.addEventListener('shopify:section:load', (event) => initFaqSections(event.target));

  if (!customElements.get('tg-rail')) {
    customElements.define('tg-rail', class extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-tg-track]');
        this.buttons = [...this.querySelectorAll('[data-tg-scroll]')];
        this.buttons.forEach((button) => button.addEventListener('click', () => {
          if (button.getAttribute('aria-disabled') === 'true') return;
          const first = this.track?.firstElementChild;
          const amount = (first?.getBoundingClientRect().width || 280) + 24;
          this.track?.scrollBy({ left: Number(button.dataset.tgScroll) * amount, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }));
        this.buttons.forEach((button) => button.addEventListener('keydown', (event) => {
          if (!['Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          button.click();
        }));
        this.track?.addEventListener('scroll', () => this.updateControls(), { passive: true });
        this.updateControls();
      }
      updateControls() {
        const maxScroll = Math.max((this.track?.scrollWidth || 0) - (this.track?.clientWidth || 0), 0);
        this.buttons.forEach((button) => {
          const direction = Number(button.dataset.tgScroll);
          const currentScroll = this.track?.scrollLeft || 0;
          const disabled = maxScroll <= 1 || (direction < 0 ? currentScroll <= 1 : currentScroll >= maxScroll - 1);
          button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
          button.classList.toggle('swiper-button-disabled', disabled);
        });
      }
    });
  }

  if (!customElements.get('tg-tabs')) {
    customElements.define('tg-tabs', class extends HTMLElement {
      connectedCallback() {
        this.disconnectedCallback();
        this.tabs = [...this.querySelectorAll('[role="tab"], .tabs-nav__item, [data-tg-tab]')];
        this.panels = [...this.querySelectorAll('[role="tabpanel"], product-list, [data-tg-panel]')];
        this.tabIndicator = this.querySelector('.tabs-nav__position');
        this.tabPanels = this.tabs.map((tab, index) => {
          const panelId = tab.getAttribute('aria-controls');
          return (panelId && this.panels.find((panel) => panel.id === panelId)) || this.panels[index];
        });

        if (!this.tabs.length || !this.panels.length) return;

        this.boundTabHandlers = [];
        this.tabs.forEach((tab, index) => {
          const onClick = () => this.select(index);
          const onKeydown = (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + this.tabs.length) % this.tabs.length;
            this.select(next, true);
          };
          tab.addEventListener('click', onClick);
          tab.addEventListener('keydown', onKeydown);
          this.boundTabHandlers.push({ tab, onClick, onKeydown });
        });

        const activeIndex = this.tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true' || tab.getAttribute('aria-expanded') === 'true');
        this.select(activeIndex >= 0 ? activeIndex : 0);
      }
      disconnectedCallback() {
        this.boundTabHandlers?.forEach(({ tab, onClick, onKeydown }) => {
          tab.removeEventListener('click', onClick);
          tab.removeEventListener('keydown', onKeydown);
        });
        this.boundTabHandlers = [];
      }
      select(index, focus = false) {
        if (!this.tabs?.length || index < 0 || index >= this.tabs.length) return;

        this.tabs.forEach((tab, tabIndex) => {
          const active = tabIndex === index;
          if (tab.getAttribute('role') === 'tab' || tab.hasAttribute('aria-selected')) tab.setAttribute('aria-selected', String(active));
          if (tab.classList.contains('tabs-nav__item') || tab.hasAttribute('aria-expanded')) tab.setAttribute('aria-expanded', String(active));
          tab.classList.toggle('is-active', active);
          tab.tabIndex = active ? 0 : -1;
        });

        this.panels.forEach((panel) => {
          panel.hidden = true;
          panel.setAttribute('aria-hidden', 'true');
        });
        if (this.tabPanels[index]) {
          this.tabPanels[index].hidden = false;
          this.tabPanels[index].setAttribute('aria-hidden', 'false');
        }

        requestAnimationFrame(() => this.updateTabIndicator(index));

        if (focus) this.tabs[index].focus();

        const slider = this.tabPanels[index]?.querySelector('slider-component');
        if (slider && typeof slider.resetPages === 'function') {
          requestAnimationFrame(() => slider.resetPages());
        }
      }
      updateTabIndicator(index) {
        const tab = this.tabs?.[index];
        const indicator = this.tabIndicator;
        const track = indicator?.parentElement;
        if (!tab || !indicator || !track) return;

        const trackRect = track.getBoundingClientRect();
        const tabRect = tab.getBoundingClientRect();
        if (!trackRect.width) return;

        indicator.style.setProperty('--scale', String(tabRect.width / trackRect.width));
        indicator.style.setProperty('--translate', `${tabRect.left - trackRect.left}px`);
      }
    });
  }

  if (!customElements.get('tg-video-rail')) {
    customElements.define('tg-video-rail', class extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-tg-track]');
        this.dialog = this.querySelector('dialog');
        this.video = this.dialog?.querySelector('video');
        this.opener = null;
        this.querySelectorAll('[data-tg-scroll]').forEach((button) => button.addEventListener('click', () => {
          const first = this.track?.firstElementChild;
          const amount = (first?.getBoundingClientRect().width || 280) + 24;
          this.track?.scrollBy({ left: Number(button.dataset.tgScroll) * amount, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        }));
        this.querySelectorAll('[data-tg-video]').forEach((button) => button.addEventListener('click', () => this.open(button)));
        this.querySelector('[data-tg-close]')?.addEventListener('click', () => this.close());
        this.dialog?.addEventListener('click', (event) => { if (event.target === this.dialog) this.close(); });
        this.dialog?.addEventListener('close', () => { this.video?.pause(); this.opener?.focus(); });
      }
      open(button) { this.opener = button; this.video.src = button.dataset.tgVideo; this.dialog.showModal(); this.video.play().catch(() => {}); }
      close() { this.dialog?.close(); }
    });
  }
})();
