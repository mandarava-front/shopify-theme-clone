class CuszooCollectionTabs extends HTMLElement {
  connectedCallback() {
    this.tabs = Array.from(this.querySelectorAll('[role="tab"]'));
    this.panels = Array.from(this.querySelectorAll('[role="tabpanel"]'));

    this.tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => this.selectTab(index));
      tab.addEventListener('keydown', (event) => this.onKeydown(event, index));
    });
  }

  selectTab(index, focus = false) {
    this.tabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute('aria-selected', selected.toString());
      tab.tabIndex = selected ? 0 : -1;
      this.panels[tabIndex].hidden = !selected;
    });

    if (focus) this.tabs[index].focus();

    const slider = this.panels[index].querySelector('slider-component');
    if (slider && typeof slider.resetPages === 'function') {
      requestAnimationFrame(() => slider.resetPages());
    }
  }

  onKeydown(event, index) {
    let nextIndex;

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % this.tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + this.tabs.length) % this.tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = this.tabs.length - 1;

    if (nextIndex === undefined) return;

    event.preventDefault();
    this.selectTab(nextIndex, true);
  }
}

if (!customElements.get('cuszoo-collection-tabs')) {
  customElements.define('cuszoo-collection-tabs', CuszooCollectionTabs);
}
