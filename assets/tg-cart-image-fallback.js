(() => {
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;

    const fallback = image.dataset.tgCartImageFallback;
    if (!fallback || image.dataset.tgCartImageFailed === 'true') return;

    image.dataset.tgCartImageFailed = 'true';
    image.src = fallback;
  }, true);
})();
