/* Diari offline support and video streaming.
   - Keeps the app itself on the device so it opens fast and offline.
   - Streams videos from Google Drive: the video player asks for stream/<file id>, and this adds the
     Google sign-in and passes the video through piece by piece, so playback starts at once.
   Your journal data is never stored here; it comes from Google Drive. */
var CACHE = 'diari-v12';
var SHELL = ['./', 'index.html', 'app.js', 'store.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/icon-180.png'];
var DRIVE = 'https://www.googleapis.com/drive/v3/files/';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* ---------- Google sign-in for streaming (kept in memory only) ---------- */
var TOKEN = '', TOKEN_EXP = 0;
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'token') { TOKEN = d.token || ''; TOKEN_EXP = d.exp || 0; }
});

// This helper can be stopped and restarted by the phone at any time, so ask an open Diari window if needed.
function token() {
  if (TOKEN && TOKEN_EXP - Date.now() > 30e3) return Promise.resolve(TOKEN);
  return self.clients.matchAll({ type: 'window' }).then(function (wins) {
    if (!wins.length) return '';
    return new Promise(function (res) {
      var ch = new MessageChannel(), done = false;
      ch.port1.onmessage = function (ev) {
        done = true;
        var d = ev.data || {};
        if (d.token) { TOKEN = d.token; TOKEN_EXP = d.exp || 0; }
        res(d.token || '');
      };
      wins[0].postMessage({ type: 'need-token' }, [ch.port2]);
      setTimeout(function () { if (!done) res(''); }, 3000);
    });
  });
}

var sizes = {};
function sizeOf(id, t) {
  if (sizes[id]) return Promise.resolve(sizes[id]);
  return fetch(DRIVE + encodeURIComponent(id) + '?fields=size', { headers: { Authorization: 'Bearer ' + t } })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (j) { sizes[id] = Number(j.size) || 0; return sizes[id]; }, function () { return 0; });
}

function stream(req, id, knownSize) {
  if (knownSize) sizes[id] = knownSize;
  return token().then(function (t) {
    if (!t) return new Response('Diari is not signed in.', { status: 401 });
    var headers = { Authorization: 'Bearer ' + t };
    var range = req.headers.get('Range');
    if (range) headers.Range = range;
    return fetch(DRIVE + encodeURIComponent(id) + '?alt=media', { headers: headers }).then(function (res) {
      if (res.status !== 200 && res.status !== 206) return res;
      var h = new Headers();
      h.set('Content-Type', res.headers.get('Content-Type') || 'video/mp4');
      h.set('Accept-Ranges', 'bytes');
      var len = res.headers.get('Content-Length');
      if (len) h.set('Content-Length', len);
      if (res.status !== 206) return new Response(res.body, { status: 200, headers: h });
      // The video player needs Content-Range to know which piece this is.
      var cr = res.headers.get('Content-Range');
      var fixed = cr ? Promise.resolve(cr) : sizeOf(id, t).then(function (total) {
        var start = Number((/bytes=(\d+)-/.exec(range || '') || [0, 0])[1]);
        return len && total ? 'bytes ' + start + '-' + (start + Number(len) - 1) + '/' + total : '';
      });
      return fixed.then(function (v) {
        if (v) h.set('Content-Range', v);
        return new Response(res.body, { status: 206, headers: h });
      });
    });
  }).catch(function () { return new Response('The video could not be loaded.', { status: 502 }); });
}

self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;     // Google and Claude requests go straight through

  var m = /\/stream\/([A-Za-z0-9_-]{10,})$/.exec(url.pathname);
  if (m) { e.respondWith(stream(req, m[1], Number(url.searchParams.get('s')) || 0)); return; }

  // App files: use the newest copy when online (quickly), otherwise the saved copy.
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
