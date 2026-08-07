(() => {
  const TERMS_ATTRIBUTE = 'tg_shipping_protection_terms_accepted';

  const parseSectionHTML = (html, selector) => {
    if (!html) return null;
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  };

  const getSectionsToRender = () => {
    const sections = [
      { id: 'cart-drawer', selector: '#CartDrawer', target: () => document.getElementById('CartDrawer') },
      { id: 'cart-icon-bubble', selector: '.shopify-section', target: () => document.getElementById('cart-icon-bubble') },
      {
        id: 'cart-live-region-text',
        selector: '.shopify-section',
        target: () => document.getElementById('cart-live-region-text'),
      },
    ];

    const cartItems = document.getElementById('main-cart-items');
    if (cartItems?.dataset.id) {
      sections.push({
        id: cartItems.dataset.id,
        selector: '.js-contents',
        target: () => cartItems.querySelector('.js-contents'),
      });
    }

    const cartFooter = document.getElementById('main-cart-footer');
    if (cartFooter?.dataset.id) {
      sections.push({
        id: cartFooter.dataset.id,
        selector: '.tg-cart-summary__blocks',
        target: () => cartFooter.querySelector('.tg-cart-summary__blocks'),
      });
    }

    return sections.filter((section) => section.target());
  };

  const setCheckoutState = () => {
    const terms = [...document.querySelectorAll('[data-tg-cart-terms]')];
    if (!terms.length) return;

    const accepted = terms.some((term) => term.checked);
    document.querySelectorAll('[data-tg-cart-checkout]').forEach((button) => {
      button.disabled = !accepted;
      button.setAttribute('aria-disabled', String(!accepted));
    });

    document.querySelectorAll('[data-tg-cart-dynamic-checkout]').forEach((container) => {
      container.classList.toggle('is-disabled', !accepted);
      container.toggleAttribute('inert', !accepted);
      container.setAttribute('aria-hidden', String(!accepted));
      container.querySelectorAll('button, input').forEach((control) => {
        control.disabled = !accepted;
      });
    });
  };

  const syncDrawer = () => {
    const template = document.querySelector('[data-tg-cart-drawer-addons-template]');
    const drawer = document.querySelector('cart-drawer');
    if (!template || !drawer) return;

    const progressSlot = drawer.querySelector('[data-tg-cart-drawer-progress-slot]');
    const protectionSlot = drawer.querySelector('[data-tg-cart-drawer-protection-slot]');
    if (!progressSlot && !protectionSlot) return;

    const content = template.content.cloneNode(true);
    const progress = content.querySelector('[data-tg-cart-free-shipping]');
    const protection = content.querySelector('[data-tg-cart-protection]');

    if (progressSlot) progressSlot.replaceChildren(...(progress ? [progress] : []));
    if (protectionSlot) protectionSlot.replaceChildren(...(protection ? [protection] : []));
    setCheckoutState();
  };

  const renderContents = (data) => {
    getSectionsToRender().forEach((section) => {
      const target = section.target();
      const source = parseSectionHTML(data.sections?.[section.id], section.selector);
      if (target && source) target.innerHTML = source.innerHTML;
    });

    const drawer = document.querySelector('cart-drawer');
    if (drawer && typeof data.item_count === 'number') drawer.classList.toggle('is-empty', data.item_count === 0);

    window.TgCartPage?.initTimers(document);
    syncDrawer();
    drawer?.initializeTgCartDrawer?.();
  };

  const showError = (message) => {
    document.querySelectorAll('#cart-errors, #CartDrawer-CartErrors').forEach((container) => {
      container.textContent = message;
    });
  };

  const setLoading = (selector, loading) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.classList.toggle('is-loading', loading);
      element.querySelectorAll('input').forEach((input) => {
        if (loading) {
          input.dataset.tgCartAddonInitiallyDisabled = String(input.disabled);
          input.disabled = true;
        } else if ('tgCartAddonInitiallyDisabled' in input.dataset) {
          input.disabled = input.dataset.tgCartAddonInitiallyDisabled === 'true';
          delete input.dataset.tgCartAddonInitiallyDisabled;
        }
      });
    });
  };

  const requestCartUpdate = async (endpoint, body) => {
    const sections = getSectionsToRender().map((section) => section.id);
    const response = await fetch(endpoint, {
      ...fetchConfig(),
      body: JSON.stringify({ ...body, sections, sections_url: window.location.pathname }),
    });
    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('json') ? await response.json() : null;

    if (!response.ok || !data || data.status || data.errors) {
      throw new Error(data?.description || data?.message || data?.errors || 'Unable to update your cart.');
    }
    return data;
  };

  const updateProtection = async (toggle) => {
    const shouldAdd = toggle.checked;
    const variantId = toggle.dataset.variantId;
    const lineKey = toggle.dataset.lineKey;
    if (!variantId || (!shouldAdd && !lineKey)) {
      toggle.checked = !shouldAdd;
      return;
    }

    setLoading('[data-tg-cart-protection]', true);
    showError('');

    try {
      const data = await requestCartUpdate(
        shouldAdd ? routes.cart_add_url : routes.cart_change_url,
        shouldAdd ? { items: [{ id: variantId, quantity: 1 }] } : { id: lineKey, quantity: 0 }
      );
      renderContents(data);
      if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
        // All cart sections above are already refreshed from this response.
        // Reuse Dawn's cart-items source so cart subscribers do not request them again.
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: data });
      }
    } catch (error) {
      toggle.checked = !shouldAdd;
      showError(error.message || 'Unable to update shipping protection.');
    } finally {
      setLoading('[data-tg-cart-protection]', false);
    }
  };

  const updateTerms = async (term) => {
    const accepted = term.checked;
    document.querySelectorAll('[data-tg-cart-terms]').forEach((input) => {
      input.checked = accepted;
      input.disabled = true;
    });
    setCheckoutState();
    showError('');

    try {
      const data = await requestCartUpdate(routes.cart_update_url, {
        attributes: { [TERMS_ATTRIBUTE]: accepted ? 'true' : '' },
      });
      renderContents(data);
    } catch (error) {
      term.checked = !accepted;
      document.querySelectorAll('[data-tg-cart-terms]').forEach((input) => {
        input.checked = !accepted;
      });
      setCheckoutState();
      showError(error.message || 'Unable to save terms acceptance.');
    } finally {
      document.querySelectorAll('[data-tg-cart-terms]').forEach((input) => {
        input.disabled = false;
      });
    }
  };

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.matches('[data-tg-cart-protection-toggle]')) {
      updateProtection(target);
    } else if (target.matches('[data-tg-cart-terms]')) {
      updateTerms(target);
    }
  });

  window.TgCartAddons = { syncDrawer, setCheckoutState };
  syncDrawer();
  setCheckoutState();
})();
