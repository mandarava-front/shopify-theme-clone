(() => {
  const timerSelector = '[data-tg-cart-timer]';
  const previewSelector = '[data-tg-cart-preview]';

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  function getExpiry(timer) {
    const duration = Math.max(60, Number(timer.dataset.tgCartTimerSeconds) || 600) * 1000;
    const key = timer.dataset.tgCartTimerKey || 'tg-cart-expiry';
    let expiresAt = 0;

    try {
      expiresAt = Number(window.localStorage.getItem(key)) || 0;
      if (!expiresAt) {
        expiresAt = Date.now() + duration;
        window.localStorage.setItem(key, String(expiresAt));
      }
    } catch (error) {
      expiresAt = Date.now() + duration;
    }

    return expiresAt;
  }

  function startTimer(timer) {
    const value = timer.querySelector('[data-tg-cart-timer-value]');
    const activeMessage = timer.querySelector('[data-tg-cart-timer-message]');
    const expiredMessage = timer.querySelector('[data-tg-cart-timer-expired-message]');
    if (!value || timer.dataset.tgCartTimerInitialized === 'true') return;

    timer.dataset.tgCartTimerInitialized = 'true';
    const expiresAt = getExpiry(timer);

    const render = () => {
      const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      if (seconds === 0) {
        timer.classList.add('tg-cart-expiry--expired');
        timer.dataset.tgCartTimerExpired = 'true';
        if (activeMessage) activeMessage.hidden = true;
        if (expiredMessage) expiredMessage.hidden = false;
        window.clearInterval(timer.tgCartTimerInterval);
        return;
      }

      value.textContent = formatTime(seconds);
    };

    render();
    timer.tgCartTimerInterval = window.setInterval(render, 1000);
  }

  function initTimers(root = document) {
    root.querySelectorAll(timerSelector).forEach(startTimer);
  }

  window.TgCartPage = window.TgCartPage || {};
  window.TgCartPage.initTimers = initTimers;

  function getPreviewDialog() {
    let dialog = document.getElementById('TgCartPreviewDialog');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'TgCartPreviewDialog';
    dialog.className = 'tg-cart-preview-dialog';
    dialog.innerHTML = `
      <div class="tg-cart-preview-dialog__content" role="document">
        <button class="tg-cart-preview-dialog__close" type="button" data-tg-cart-preview-close aria-label="Close preview">
          <svg class="tg-cart-preview-dialog__close-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6 6 18"></path>
          </svg>
        </button>
        <img class="tg-cart-preview-dialog__image" alt="">
      </div>
    `;
    document.body.append(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog || event.target.closest('[data-tg-cart-preview-close]')) dialog.close();
    });
    const image = dialog.querySelector('.tg-cart-preview-dialog__image');
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallback;
      if (!fallback || image.src === fallback) return;
      image.dataset.failed = 'true';
      image.src = fallback;
    });
    return dialog;
  }

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest(previewSelector);
    if (!trigger) return;

    event.preventDefault();
    const imageUrl = trigger.dataset.tgCartPreviewImage;
    if (!imageUrl) return;

    const dialog = getPreviewDialog();
    const image = dialog.querySelector('.tg-cart-preview-dialog__image');
    image.src = imageUrl;
    image.dataset.fallback = trigger.dataset.tgCartPreviewFallback || '';
    image.dataset.failed = 'false';
    image.alt = trigger.dataset.tgCartPreviewAlt || '';

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else window.open(imageUrl, '_blank', 'noopener');
  });

  document.addEventListener('DOMContentLoaded', () => initTimers());
  document.addEventListener('shopify:section:load', (event) => initTimers(event.target));
})();
