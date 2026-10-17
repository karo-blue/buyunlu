(function() {
  'use strict';
  if (!/^https?:$/.test(window.location.protocol) || !('serviceWorker' in navigator)) return;
  const scriptURL = new URL(document.currentScript.src);
  window.addEventListener('load', function() {
    const workerURL = new URL('sw.js', scriptURL);
    workerURL.search = scriptURL.search;
    return navigator.serviceWorker.register(workerURL.href, { scope: './', updateViaCache: 'none' })
      .catch(function() { /* Online play still works when offline installation is unavailable. */ });
  });
})();
