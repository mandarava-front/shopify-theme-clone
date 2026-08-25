(() => {
  const componentName = 'order-tracking';
  const defaultStrings = Object.freeze({
    submit: 'TRACK ORDER',
    loading: 'CHECKING ORDER...',
    invalidOrder: 'Enter your order number.',
    invalidEmail: 'Enter a valid email address.',
    notFound: 'We could not find an order matching that number and email address. Check your details and try again.',
    noShipment: 'Your order was found, but tracking is not available yet. We will email you when it ships.',
    rateLimited: 'There have been too many requests. Wait a moment, then try again.',
    unavailable: 'We cannot retrieve tracking details right now. Please try again later.',
    timeout: 'The request took too long. Check your connection and try again.',
    tryAgain: 'Try again',
    backToSearch: 'Back to search',
    contactSupport: 'Contact support',
    order: 'Order ID',
    carrier: 'Carrier',
    carrierUnknown: 'Carrier unavailable',
    trackingId: 'Tracking ID',
    copy: 'Copy',
    copied: 'Copied',
    updated: 'Updated',
    activity: 'Shipment activity',
    activityUpdate: 'Tracking update',
    latest: 'Latest',
    noActivity: 'Tracking events will appear here when the carrier provides them.',
    viewCarrier: 'View carrier site',
  });

  if (customElements.get(componentName)) return;

  class OrderTracking extends HTMLElement {
    connectedCallback() {
      if (this.initialized) return;

      this.initialized = true;
      this.requestId = 0;
      this.copyTimers = new Set();
      this.config = this.readConfig();
      this.formCard = this.querySelector('.tg-order-tracking__form-card');
      this.form = this.querySelector('[data-tracking-form]');
      this.orderInput = this.querySelector('[name="orderNumber"]');
      this.emailInput = this.querySelector('[name="email"]');
      this.submitButton = this.querySelector('[data-submit-button]');
      this.submitLabel = this.querySelector('[data-submit-label]');
      this.submitSpinner = this.querySelector('[data-submit-spinner]');
      this.formStatus = this.querySelector('[data-form-status]');
      this.formError = this.querySelector('[data-form-error]');
      this.results = this.querySelector('[data-tracking-results]');

      if (!this.form || !this.config) return;

      this.onSubmit = this.handleSubmit.bind(this);
      this.onFieldBlur = this.handleFieldBlur.bind(this);
      this.form.addEventListener('submit', this.onSubmit);
      this.orderInput?.addEventListener('blur', this.onFieldBlur);
      this.emailInput?.addEventListener('blur', this.onFieldBlur);
    }

    disconnectedCallback() {
      this.controller?.abort();
      this.form?.removeEventListener('submit', this.onSubmit);
      this.orderInput?.removeEventListener('blur', this.onFieldBlur);
      this.emailInput?.removeEventListener('blur', this.onFieldBlur);
      this.copyTimers?.forEach((timer) => window.clearTimeout(timer));
      this.copyTimers?.clear();
    }

    readConfig() {
      const configElement = this.querySelector('[data-tracking-config]');

      if (!configElement) return null;

      try {
        const config = JSON.parse(configElement.textContent);
        return {
          ...config,
          strings: {
            ...defaultStrings,
            submit: config.submitLabel || defaultStrings.submit,
          },
        };
      } catch (error) {
        console.error('Order tracking configuration is invalid.', error);
        return null;
      }
    }

    handleFieldBlur(event) {
      const field = event.currentTarget;

      if (field === this.orderInput && field.value.trim()) {
        this.clearFieldError('orderNumber');
      }

      if (field === this.emailInput && this.isValidEmail(field.value.trim())) {
        this.clearFieldError('email');
      }
    }

    async handleSubmit(event) {
      event.preventDefault();

      if (!this.config.endpoint) return;

      const values = this.validateForm();
      if (!values) return;

      const requestId = ++this.requestId;
      this.controller?.abort();
      this.controller = new AbortController();
      this.clearError();
      this.clearResults();
      this.setLoading(true);

      let timedOut = false;
      const timeout = window.setTimeout(() => {
        timedOut = true;
        this.controller?.abort();
      }, 15000);

      try {
        const endpoint = new URL(this.config.endpoint, window.location.origin);
        endpoint.searchParams.set('orderNumber', values.orderNumber);
        endpoint.searchParams.set('email', values.email);

        const response = await fetch(endpoint, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
          signal: this.controller.signal,
        });

        const payload = await this.readResponse(response);

        if (requestId !== this.requestId) return;

        if (!response.ok || payload?.success !== true || !payload.data) {
          throw new OrderTrackingError(this.getResponseErrorCode(response, payload));
        }

        const trackingData = this.normalizeTrackingData(payload.data);
        if (trackingData.shipments.length === 0) {
          throw new OrderTrackingError('NO_SHIPMENT');
        }

        this.renderResults(trackingData, values.orderNumber);
      } catch (error) {
        if (requestId !== this.requestId || !this.isConnected) return;

        const errorCode = timedOut
          ? 'TIMEOUT'
          : error instanceof OrderTrackingError
            ? error.code
            : error?.name === 'AbortError'
              ? 'UPSTREAM_UNAVAILABLE'
              : 'UPSTREAM_UNAVAILABLE';

        this.renderError(errorCode);
      } finally {
        window.clearTimeout(timeout);

        if (requestId === this.requestId && this.isConnected) {
          this.setLoading(false);
        }
      }
    }

    async readResponse(response) {
      const responseText = await response.text();

      if (!responseText) return null;

      try {
        return JSON.parse(responseText);
      } catch (_error) {
        throw new OrderTrackingError('UPSTREAM_UNAVAILABLE');
      }
    }

    getResponseErrorCode(response, payload) {
      const suppliedCode = payload?.error?.code;

      if (typeof suppliedCode === 'string' && suppliedCode.trim()) {
        const code = suppliedCode.trim().toUpperCase();
        const aliases = {
          INVALID_REQUEST: 'INVALID_INPUT',
          ORDER_NOT_FOUND: 'NOT_FOUND',
          INTERNAL_ERROR: 'UPSTREAM_UNAVAILABLE',
          UPSTREAM_ERROR: 'UPSTREAM_UNAVAILABLE',
        };

        return aliases[code] || code;
      }

      if (response.status === 404) return 'NOT_FOUND';
      if (response.status === 429) return 'RATE_LIMITED';
      if (response.status === 400 || response.status === 422) return 'INVALID_INPUT';

      return 'UPSTREAM_UNAVAILABLE';
    }

    normalizeTrackingData(data) {
      if (Array.isArray(data.shipments)) return data;

      const trackingNumber = this.textValue(data.trackingNumber);
      if (!trackingNumber || data.queryStatus === 'no_tracking_number') {
        return { ...data, shipments: [] };
      }

      const details = Array.isArray(data.details) ? data.details : [];
      return {
        ...data,
        shipments: [
          {
            trackingNumber,
            carrier: data.carrier,
            status: {
              code: data.statusCode,
              label: data.statusLabel,
            },
            updatedAt: data.lastUpdateTime,
            events: details.map((detail) => ({
              occurredAt: detail?.time,
              description: detail?.description,
              location: detail?.location,
              statusCode: detail?.statusCode,
              status: detail?.statusLabel,
            })),
          },
        ],
      };
    }

    validateForm() {
      this.clearFieldError('orderNumber');
      this.clearFieldError('email');

      const orderNumber = this.orderInput?.value.trim() || '';
      const email = this.emailInput?.value.trim().toLowerCase() || '';
      let firstInvalidField = null;

      if (!orderNumber) {
        this.setFieldError('orderNumber', this.config.strings.invalidOrder);
        firstInvalidField = this.orderInput;
      }

      if (!this.isValidEmail(email)) {
        this.setFieldError('email', this.config.strings.invalidEmail);
        firstInvalidField ||= this.emailInput;
      }

      if (firstInvalidField) {
        firstInvalidField.focus();
        return null;
      }

      this.orderInput.value = orderNumber;
      this.emailInput.value = email;

      return { orderNumber, email };
    }

    isValidEmail(value) {
      if (!value || !this.emailInput) return false;

      const previousValue = this.emailInput.value;
      this.emailInput.value = value;
      const valid = this.emailInput.validity.valid;
      this.emailInput.value = previousValue;

      return valid;
    }

    setFieldError(fieldName, message) {
      const input = fieldName === 'email' ? this.emailInput : this.orderInput;
      const error = this.querySelector(`[data-field-error="${fieldName}"]`);

      if (!input || !error) return;

      input.setAttribute('aria-invalid', 'true');
      error.textContent = message;
      error.hidden = false;
    }

    clearFieldError(fieldName) {
      const input = fieldName === 'email' ? this.emailInput : this.orderInput;
      const error = this.querySelector(`[data-field-error="${fieldName}"]`);

      input?.removeAttribute('aria-invalid');

      if (error) {
        error.textContent = '';
        error.hidden = true;
      }
    }

    setLoading(isLoading) {
      if (!this.submitButton || !this.submitLabel || !this.submitSpinner) return;

      this.submitButton.disabled = isLoading || !this.config.endpoint;
      this.submitButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
      this.submitLabel.textContent = isLoading ? this.config.strings.loading : this.config.strings.submit;
      this.submitSpinner.hidden = !isLoading;
      this.formStatus.textContent = isLoading ? this.config.strings.loading : '';
    }

    renderError(code) {
      if (!this.formError) return;

      const message = this.getErrorMessage(code);
      const content = this.createElement('div', 'tg-order-tracking__error-content');
      content.appendChild(this.createElement('p', '', message));

      const actions = this.createElement('div', 'tg-order-tracking__error-actions');
      const retry = this.createElement('button', 'tg-order-tracking__error-action', this.config.strings.tryAgain);
      retry.type = 'button';
      retry.addEventListener('click', () => {
        this.clearError();

        if (code === 'NOT_FOUND' || code === 'INVALID_INPUT') {
          this.orderInput?.focus();
        } else {
          this.form?.requestSubmit();
        }
      });
      actions.appendChild(retry);

      const contactUrl = this.safeUrl(this.config.contactUrl, true);
      if (contactUrl) {
        const contact = this.createElement('a', 'tg-order-tracking__error-action', this.config.strings.contactSupport);
        contact.href = contactUrl;
        actions.appendChild(contact);
      }

      content.appendChild(actions);
      this.formError.replaceChildren(content);
      this.formError.hidden = false;
      this.formError.focus();
    }

    getErrorMessage(code) {
      const messages = {
        INVALID_INPUT: this.config.strings.invalidOrder,
        NOT_FOUND: this.config.strings.notFound,
        NO_SHIPMENT: this.config.strings.noShipment,
        RATE_LIMITED: this.config.strings.rateLimited,
        TIMEOUT: this.config.strings.timeout,
        UPSTREAM_UNAVAILABLE: this.config.strings.unavailable,
      };

      return messages[code] || this.config.strings.unavailable;
    }

    clearError() {
      if (!this.formError) return;

      this.formError.hidden = true;
      this.formError.replaceChildren();
    }

    clearResults() {
      if (!this.results) return;

      this.results.hidden = true;
      this.results.replaceChildren();
    }

    showSearchForm() {
      this.clearResults();
      this.clearError();
      this.formStatus.textContent = '';

      if (this.formCard) {
        this.formCard.hidden = false;
      }

      this.orderInput?.focus();
    }

    renderResults(data, submittedOrderNumber) {
      if (!this.results) return;

      const shipments = data.shipments.filter((shipment) => shipment && typeof shipment === 'object');
      if (shipments.length === 0) throw new OrderTrackingError('NO_SHIPMENT');

      const orderNumber = this.textValue(data.orderNumber) || submittedOrderNumber;
      const shipment = shipments[0];
      const card = this.createElement('article', 'tg-order-tracking__card tg-order-tracking__result-card');
      const details = this.createElement('div', 'tg-order-tracking__result-details');

      card.append(this.createResultSidebar(orderNumber, shipment), details);
      details.appendChild(this.createActivity(shipment.events));

      this.results.replaceChildren(card);
      if (this.formCard) {
        this.formCard.hidden = true;
      }
      this.results.hidden = false;
      this.formStatus.textContent = '';
      this.results.focus();
    }

    createResultSidebar(orderNumber, shipment) {
      const sidebar = this.createElement('aside', 'tg-order-tracking__result-sidebar');
      const backButton = this.createElement('button', 'tg-order-tracking__back');
      const backIcon = this.createElement('span', 'tg-order-tracking__back-icon');
      backButton.type = 'button';
      backIcon.setAttribute('aria-hidden', 'true');
      backIcon.appendChild(this.cloneIcon('arrow'));
      backButton.append(backIcon, this.createElement('span', '', this.config.strings.backToSearch));
      backButton.addEventListener('click', () => this.showSearchForm());

      const carrier = this.getCarrierName(shipment);
      const trackingNumber = this.textValue(shipment.trackingNumber);
      const metadata = this.createElement('div', 'tg-order-tracking__result-meta');
      const orderField = this.createElement('div', 'tg-order-tracking__summary-field');
      const carrierField = this.createElement('div', 'tg-order-tracking__summary-field');

      orderField.append(
        this.createElement('p', 'tg-order-tracking__eyebrow', this.config.strings.order),
        this.createElement('h2', 'tg-order-tracking__order-number', orderNumber),
      );
      carrierField.append(
        this.createElement('p', 'tg-order-tracking__eyebrow', this.config.strings.carrier),
        this.createElement('p', 'tg-order-tracking__carrier', carrier),
      );
      metadata.append(orderField, carrierField);

      if (trackingNumber) {
        metadata.appendChild(this.createTrackingRow(trackingNumber));
      }

      const updatedAt = this.textValue(shipment.updatedAt) || this.getLatestEventDate(shipment.events);
      if (updatedAt) {
        metadata.appendChild(
          this.createElement(
            'p',
            'tg-order-tracking__updated',
            `${this.config.strings.updated}: ${this.formatDate(updatedAt)}`,
          ),
        );
      }

      sidebar.append(backButton, metadata);

      const trackingUrl = this.safeUrl(shipment.trackingUrl);
      if (trackingUrl) {
        const carrierLink = this.createElement(
          'a',
          'tg-order-tracking__carrier-link',
          this.config.strings.viewCarrier,
        );
        carrierLink.href = trackingUrl;
        carrierLink.target = '_blank';
        carrierLink.rel = 'noopener noreferrer';
        carrierLink.appendChild(this.cloneIcon('arrow'));
        sidebar.appendChild(carrierLink);
      }

      return sidebar;
    }

    createTrackingRow(trackingNumber) {
      const row = this.createElement('div', 'tg-order-tracking__tracking-row');
      const value = this.createElement('div', 'tg-order-tracking__tracking-value');
      row.appendChild(this.createElement('span', 'tg-order-tracking__meta-label', this.config.strings.trackingId));

      const copyButton = this.createElement('button', 'tg-order-tracking__copy');
      copyButton.type = 'button';
      copyButton.setAttribute('aria-label', `${this.config.strings.copy} ${trackingNumber}`);
      copyButton.title = this.config.strings.copy;
      copyButton.appendChild(this.cloneIcon('copy'));
      copyButton.addEventListener('click', async () => {
        const copied = await this.copyText(trackingNumber);
        if (!copied) return;

        copyButton.replaceChildren(this.cloneIcon('check'));
        copyButton.setAttribute('aria-label', `${this.config.strings.copied}: ${trackingNumber}`);
        copyButton.title = this.config.strings.copied;

        const timer = window.setTimeout(() => {
          copyButton.replaceChildren(this.cloneIcon('copy'));
          copyButton.setAttribute('aria-label', `${this.config.strings.copy} ${trackingNumber}`);
          copyButton.title = this.config.strings.copy;
          this.copyTimers.delete(timer);
        }, 3000);
        this.copyTimers.add(timer);
      });

      value.append(this.createElement('span', 'tg-order-tracking__tracking-number', trackingNumber), copyButton);
      row.appendChild(value);
      return row;
    }

    createActivity(events) {
      const section = this.createElement('section', 'tg-order-tracking__activity');
      section.appendChild(this.createElement('h3', 'tg-order-tracking__section-heading', this.config.strings.activity));
      const sortedEvents = this.sortEvents(events);

      if (sortedEvents.length === 0) {
        section.appendChild(
          this.createElement('p', 'tg-order-tracking__empty-activity', this.config.strings.noActivity),
        );
        return section;
      }

      const list = this.createElement('ol', 'tg-order-tracking__activity-list');
      sortedEvents.forEach((event, index) => {
        const item = this.createElement('li', 'tg-order-tracking__event');
        const marker = this.createElement('span', 'tg-order-tracking__event-marker');
        marker.setAttribute('aria-hidden', 'true');
        const content = this.createElement('div', 'tg-order-tracking__event-content');
        const topLine = this.createElement('div', 'tg-order-tracking__event-topline');
        const description =
          this.textValue(event.description) || this.textValue(event.status) || this.config.strings.activityUpdate;
        topLine.appendChild(this.createElement('p', 'tg-order-tracking__event-description', description));

        if (index === 0) {
          topLine.appendChild(this.createElement('span', 'tg-order-tracking__latest', this.config.strings.latest));
        }

        content.appendChild(topLine);
        const location = this.textValue(event.location);
        const occurredAt = this.textValue(event.occurredAt);

        if (location) {
          content.appendChild(this.createElement('p', 'tg-order-tracking__event-location', location));
        }

        if (occurredAt) {
          const time = this.createElement('time', 'tg-order-tracking__event-time', this.formatDate(occurredAt));
          time.dateTime = occurredAt;
          content.appendChild(time);
        }

        item.append(marker, content);
        list.appendChild(item);
      });
      section.appendChild(list);

      return section;
    }

    sortEvents(events) {
      if (!Array.isArray(events)) return [];

      return events
        .filter((event) => event && typeof event === 'object')
        .map((event, index) => ({ event, index, time: Date.parse(event.occurredAt) }))
        .sort((a, b) => {
          if (Number.isNaN(a.time) && Number.isNaN(b.time)) return a.index - b.index;
          if (Number.isNaN(a.time)) return 1;
          if (Number.isNaN(b.time)) return -1;
          return b.time - a.time;
        })
        .map(({ event }) => event);
    }

    getLatestEventDate(events) {
      return this.textValue(this.sortEvents(events)[0]?.occurredAt);
    }

    getCarrierName(shipment) {
      if (typeof shipment.carrier === 'string') return shipment.carrier;

      return (
        this.textValue(shipment.carrier?.name) ||
        this.textValue(shipment.carrierName) ||
        this.config.strings.carrierUnknown
      );
    }

    formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;

      try {
        return new Intl.DateTimeFormat(this.config.locale || undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(date);
      } catch (_error) {
        return date.toLocaleString();
      }
    }

    async copyText(value) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(value);
          return true;
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        textarea.remove();
        return copied;
      } catch (_error) {
        return false;
      }
    }

    safeUrl(value, allowRelative = false) {
      const stringValue = this.textValue(value);
      if (!stringValue) return '';

      try {
        const url = new URL(stringValue, window.location.origin);
        if (!['http:', 'https:'].includes(url.protocol)) return '';
        if (!allowRelative && url.origin === window.location.origin && !stringValue.startsWith('http')) return url.href;
        return url.href;
      } catch (_error) {
        return '';
      }
    }

    textValue(value) {
      return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
    }

    createElement(tagName, className = '', text = '') {
      const element = document.createElement(tagName);
      if (className) element.className = className;
      if (text !== '') element.textContent = text;
      return element;
    }

    cloneIcon(name) {
      const template = this.querySelector(`[data-icon-template="${name}"]`);
      return template ? template.content.cloneNode(true) : document.createDocumentFragment();
    }

  }

  class OrderTrackingError extends Error {
    constructor(code) {
      super(code);
      this.name = 'OrderTrackingError';
      this.code = code;
    }
  }

  customElements.define(componentName, OrderTracking);
})();
