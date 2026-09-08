if (!customElements.get('announcement-marquee')) {
  class AnnouncementMarquee extends HTMLElement {
    connectedCallback() {
      this.isConnectedToPage = true;
      this.track = this.querySelector('.announcement-bar__marquee-track');
      this.sourceGroup = this.querySelector('.announcement-bar__marquee-group');

      if (!this.track || !this.sourceGroup) return;

      this.isVisible = true;
      this.queueRefresh = this.queueRefresh.bind(this);
      this.updatePlayback = this.updatePlayback.bind(this);
      this.viewportMediaQuery = window.matchMedia('(max-width: 749px)');
      this.viewportMediaQuery.addEventListener('change', this.queueRefresh);

      this.resizeObserver = new ResizeObserver(this.queueRefresh);
      this.resizeObserver.observe(this);

      this.intersectionObserver = new IntersectionObserver(([entry]) => {
        this.isVisible = entry.isIntersecting;
        this.updatePlayback();
      });
      this.intersectionObserver.observe(this);

      document.addEventListener('visibilitychange', this.updatePlayback);

      this.refresh();
      document.fonts?.ready.then(this.queueRefresh);
    }

    disconnectedCallback() {
      this.isConnectedToPage = false;
      this.resizeObserver?.disconnect();
      this.intersectionObserver?.disconnect();
      this.viewportMediaQuery?.removeEventListener('change', this.queueRefresh);
      document.removeEventListener('visibilitychange', this.updatePlayback);

      if (this.refreshFrame) cancelAnimationFrame(this.refreshFrame);
    }

    queueRefresh() {
      if (!this.isConnectedToPage) return;
      if (this.refreshFrame) cancelAnimationFrame(this.refreshFrame);

      this.refreshFrame = requestAnimationFrame(() => {
        this.refreshFrame = null;
        this.refresh();
      });
    }

    refresh() {
      this.track.querySelectorAll('[data-marquee-clone]').forEach((clone) => clone.remove());
      this.classList.add('is-ready');

      if (!this.shouldAnimateAtCurrentViewport()) {
        this.style.removeProperty('--tg-announcement-marquee-distance');
        this.style.removeProperty('--tg-announcement-marquee-duration');
        this.updatePlayback();
        return;
      }

      const groupWidth = this.sourceGroup.getBoundingClientRect().width;
      const viewportWidth = this.getBoundingClientRect().width;

      if (!groupWidth || !viewportWidth) return;

      const copiesNeeded = Math.max(2, Math.ceil(viewportWidth / groupWidth) + 2);

      for (let index = 1; index < copiesNeeded; index += 1) {
        const clone = this.sourceGroup.cloneNode(true);
        clone.dataset.marqueeClone = '';
        clone.setAttribute('aria-hidden', 'true');
        clone.setAttribute('inert', '');
        clone.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
        clone.querySelectorAll('a, button, input, select, textarea, [tabindex]').forEach((element) => {
          element.setAttribute('tabindex', '-1');
        });
        this.track.append(clone);
      }

      const pixelsPerSecond = 55;
      const duration = Math.max(groupWidth / pixelsPerSecond, 8);

      this.style.setProperty('--tg-announcement-marquee-distance', `${groupWidth}px`);
      this.style.setProperty('--tg-announcement-marquee-duration', `${duration}s`);
      this.updatePlayback();
    }

    shouldAnimateAtCurrentViewport() {
      const devices = this.dataset.devices || 'mobile';
      const isMobile = this.viewportMediaQuery.matches;

      return devices === 'all' || (devices === 'mobile' && isMobile) || (devices === 'desktop' && !isMobile);
    }

    updatePlayback() {
      this.classList.toggle('is-paused', document.hidden || !this.isVisible);
    }
  }

  customElements.define('announcement-marquee', AnnouncementMarquee);
}
