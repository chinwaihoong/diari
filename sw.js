/* Diari offline support: keeps the app itself on the device so it opens fast and offline.
   Your journal data is never stored here; it comes from Google Drive. */
var CACHE = 'diari-v7';
var SHELL = ['./', 'index.html', 'app.js', 'store.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/icon-180.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// App files: use the newest copy when online (quickly), otherwise the saved copy.
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;     // Google and Claude requests go straight through
  e.respondWith(caches.open(CACHE).then(function (cache) {
    var net = fetch(req, { cache: 'no-cache' }).then(function (res) {
      if (res.ok) cache.put(req.mode === 'navigate' ? './' : req, res.clone());
      return res;
    });
    var timeout = new Promise(function (res) { setTimeout(res, 2500); });
    return Promise.race([net.catch(function () { return null; }), timeout]).then(function (res) {
      return res || cache.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true }).then(function (hit) { return hit || net; });
    });
  }));
});
