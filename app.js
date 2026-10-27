/* Diari: the app screens. Storage and Google sign-in are in store.js. */
(function () {
'use strict';

// Refuse to run inside another site's frame (protects against click tricks).
if (window.top !== window.self) { document.documentElement.innerHTML = ''; return; }

/* ================================================================ */
/* Setup                                                            */
/* ================================================================ */
var APP_NAME = 'Diari';
var APP_VERSION = 'v25';
var MEDIA_TAG = 'Journal attachment';
var LIVE = true;
var Store = window.DiariStore, Auth = Store.Auth;

var S = { entries: [], view: 'timeline', query: '', cal: '', calDay: '', calPicked: false, rootUrl: '', aiTitles: '', loaded: false, openId: null };

var $ = function (s, el) { return (el || document).querySelector(s); };
var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function pad(n) { return String(n).padStart(2, '0'); }
function rid(n) { var a = 'abcdefghijkmnpqrstuvwxyz23456789', s = ''; for (var i = 0; i < (n || 4); i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

var SV = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
var I = {
  list: '<svg ' + SV + '><path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/></svg>',
  cal: '<svg ' + SV + '><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  media: '<svg ' + SV + '><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-4.5-4.5L5 21"/></svg>',
  plus: '<svg ' + SV + ' stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg ' + SV + '><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>',
  folder: '<svg ' + SV + '><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>',
  back: '<svg ' + SV + ' stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg ' + SV + ' stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  edit: '<svg ' + SV + '><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg ' + SV + '><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  chevL: '<svg ' + SV + ' stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  chevR: '<svg ' + SV + ' stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
  addMedia: '<svg ' + SV + '><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
  image: '<svg ' + SV + '><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.8"/><path d="m21 15-4.5-4.5L5 21"/></svg>',
  x: '<svg ' + SV + ' stroke-width="2.4"><path d="M17 7 7 17M7 7l10 10"/></svg>',
  ext: '<svg ' + SV + '><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4"/></svg>',
  spark: '<svg ' + SV + '><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>'
};

/* ================================================================ */
/* Dates                                                            */
/* ================================================================ */
var DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function parseD(s) { return new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13) || 0, +s.slice(14, 16) || 0); }
function localStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function todayKey() { return localStr(new Date()).slice(0, 10); }
function fmtTime(s) { var H = +s.slice(11, 13), M = s.slice(14, 16); return (H % 12 || 12) + ':' + M + (H >= 12 ? ' pm' : ' am'); }
function fmtLong(s) { var d = parseD(s); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
function fmtDayMonth(s) { var d = parseD(s); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; }
function monthName(ym) { return MON[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }
function fmtDur(sec) { sec = Math.round(sec || 0); if (!sec) return ''; return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function fmtSize(b) { return b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB'; }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

/* ================================================================ */
/* Back button (Android) and stacked screens                        */
/* ================================================================ */
// Each open screen registers a close function. In the installed app, one history
// entry guards the stack so the phone's Back button closes the top screen first.
var Nav = {
  stack: [], armed: false, skip: 0,
  push: function (close) { this.stack.push(close); this.arm(); },
  arm: function () {
    if (this.armed) return;
    try { history.pushState({ diari: Date.now() }, ''); this.armed = true; } catch (e) {}
  },
  pop: function () {
    var c = this.stack.pop(); if (c) c();
    if (!this.stack.length && this.armed) { this.armed = false; this.skip++; history.back(); }   // remove the guard entry
  },
  onBack: function () {
    if (this.skip) { this.skip--; return; }
    this.armed = false;
    var c = this.stack.pop(); if (c) c();
    if (this.stack.length) this.arm();
  }
};
window.addEventListener('popstate', function () { Nav.onBack(); });

function lockScroll() {
  var any = $$('.sheet.open').length || $('.lb') || $('.dlg-wrap');
  document.documentElement.classList.toggle('locked', !!any);
}

/* ================================================================ */
/* Toast and dialogs                                                */
/* ================================================================ */
var toastTimer;
function toast(msg, ms) {
  var t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 3200);
}
function errText(err) {
  var m = err && (err.message || err) || '';
  m = String(m).replace(/^(Exception|Error):\s*/i, '');
  return m || 'Something went wrong. Please try again.';
}

function confirmDlg(o) {
  return new Promise(function (resolve) {
    var result = false;
    var w = el('<div class="dlg-wrap" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><div class="dlg">' +
      '<h2 id="dlg-t">' + esc(o.title) + '</h2>' + (o.text ? '<p>' + esc(o.text) + '</p>' : '') +
      '<div class="dlg-acts"><button class="btn ghost" data-no>' + esc(o.cancel || 'Cancel') + '</button>' +
      '<button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-ok>' + esc(o.ok || 'OK') + '</button></div></div></div>');
    document.body.appendChild(w); lockScroll();
    Nav.push(function () { w.remove(); lockScroll(); resolve(result); });
    $('[data-ok]', w).onclick = function () { result = true; Nav.pop(); };
    $('[data-no]', w).onclick = function () { Nav.pop(); };
    w.addEventListener('click', function (ev) { if (ev.target === w) Nav.pop(); });
    $('[data-no]', w).focus();
  });
}

/* ================================================================ */
/* Storage: Google Drive, see store.js                              */
/* ================================================================ */
var API = Store;

// A Google sign-in runs out after an hour: keep what is being written, sign in again without any
// screens, and come back to the same place (the editor, or the entry that was open).
function reauth(resume) {
  if (ED) { saveDraft(); lsSet('diari-reopen', { id: ED.isNew ? '' : ED.id, at: Date.now() }); }
  else if (resume) lsSet('diari-reopen', { id: resume.id || '', day: resume.day || '', at: Date.now() });
  if (S.openId) lsSet('diari-reopen-view', { id: S.openId, at: Date.now() });
  toast('Signing in to Google again…', 8000);
  setTimeout(function () { Auth.signIn(true); }, 400);
}
function fail(err, ms) {
  if (err && err.expired) { reauth(); return; }
  toast(errText(err), ms || 5000);
}
/* Background saving: an entry shows at once and is kept on this device until Google Drive has it. */
var Outbox = {
  items: [], busy: false, waiting: false, timer: 0, tries: 0,
  load: function () { this.items = (lsGet('diari-outbox') || []).filter(function (x) { return x && x.rec && x.rec.id; }); },
  persist: function () { if (this.items.length) lsSet('diari-outbox', this.items); else lsDel('diari-outbox'); },
  has: function (id) { return this.items.some(function (x) { return x.rec.id === id; }); },
  sending: function (id) { return this.busy && this.items[0] && this.items[0].rec.id === id; },
  add: function (rec) {
    var self = this;
    var i = -1;
    this.items.forEach(function (x, k) { if (x.rec.id === rec.id && !(k === 0 && self.busy)) i = k; });
    if (i >= 0) this.items[i] = { rec: rec, at: Date.now() }; else this.items.push({ rec: rec, at: Date.now() });
    this.persist(); this.run();
  },
  drop: function (id) {
    var gone = null, self = this;
    this.items = this.items.filter(function (x, k) { if (x.rec.id === id && !(k === 0 && self.busy)) { gone = x; return false; } return true; });
    this.persist();
    return gone;
  },
  /** Shows entries that are still waiting to reach Google Drive. */
  overlay: function () {
    this.items.forEach(function (x) { upsert(shownRec(x.rec)); });
  },
  run: function () {
    var self = this;
    clearTimeout(this.timer);
    if (this.busy || !this.items.length) return;
    if (!navigator.onLine) { this.waiting = true; refreshPending(); return; }
    // Signing in again leaves the page, so never while photos are still going up (UpQ calls this again when they are done).
    if (!Auth.valid(30e3)) { this.waiting = true; refreshPending(); if (!ED && !UpQ.busy()) reauth(); return; }
    this.busy = true; this.waiting = false; refreshPending();
    var item = this.items[0];
    API.save(item.rec).then(function (saved) {
      var note = saved._note;
      saved = normEntry(saved);
      self.items.shift(); self.persist(); self.busy = false; self.tries = 0;
      if (saved && !self.has(saved.id)) upsert(saved);
      refreshPending();
      if (note) toast(note, 7000);
      else if (!self.items.length) toast('Saved to Google Drive');
      self.run();
    }).catch(function (err) {
      self.busy = false; self.waiting = true; refreshPending();
      if (err && err.expired) { if (!ED && !UpQ.busy()) reauth(); return; }
      self.tries++;
      if (self.tries === 1 || self.tries % 5 === 0) toast(errText(err) + ' Diari keeps it on this device and tries again.', 6000);
      self.timer = setTimeout(function () { self.run(); }, Math.min(120e3, 15e3 * self.tries));
    });
  }
};
window.addEventListener('online', function () { Outbox.run(); });
document.addEventListener('visibilitychange', function () { if (!document.hidden) Outbox.run(); });

/** What an entry waiting to upload looks like on screen (its title is a stand-in until Claude names it). */
function shownRec(rec) {
  var prev = byId(rec.id);
  var e = normEntry(Object.assign({}, rec, { created: prev ? prev.created : new Date().toISOString(), updated: '', fileId: prev ? prev.fileId : '' }));
  if (!e) return rec;
  if (!e.title) { e.title = Store.basicTitle(rec); e.autoTitle = true; }
  e.pending = true;
  return e;
}

function pendingText() { return Outbox.busy ? 'Saving…' : 'Waiting to upload'; }
function refreshPending() {
  var waiting = {};
  Outbox.items.forEach(function (x) { waiting[x.rec.id] = 1; });
  S.entries.forEach(function (e) { if (e.pending && !waiting[e.id]) delete e.pending; });
  if (S.loaded) render();
  if (S.openId) { var cur = byId(S.openId); if (cur) fillEntry(cur); }
}

// Makes sure the Google sign-in has enough time left before starting something. Writing only needs
// a few minutes (Diari keeps the entry on the device and saves it when it can); uploads need more.
function fresh(minutes, resume) {
  if (Auth.valid((minutes || 20) * 60e3) || !navigator.onLine) return true;
  reauth(resume);
  return false;
}
var RENEW_AT = 30 * 60e3;   // renew the Google sign-in quietly when the app opens or comes back with less than this left
document.addEventListener('visibilitychange', function () {
  if (document.hidden || !S.loaded || ED || !navigator.onLine || !Auth.email || Auth.silentFailed || Auth.valid(RENEW_AT)) return;
  if (Outbox.busy || !Copies.idle() || Uploads.any() || UpQ.busy() || $('.lb')) return;          // never in the middle of something
  reauth();
});


// One shared loader so the same photo or video is only downloaded once.
var Loader = {
  m: {}, originals: [],
  get: function (id, persist) {
    var e = this.m[id], self = this;
    if (e) return e;
    e = { prog: 0, subs: [], p: null };
    e.p = API.load(id, function (f) { e.prog = f; e.subs.forEach(function (fn) { fn(f); }); }, persist)
      .then(function (url) { e.url = url; e.prog = 1; return url; })
      .catch(function (err) { delete self.m[id]; throw err; });
    self.m[id] = e;
    if (!persist && LIVE) {
      self.originals.push(id);
      while (self.originals.length > 8) {
        var old = self.originals.shift(), oe = self.m[old];
        if (oe && oe.url && !document.querySelector('[src="' + oe.url + '"]')) { URL.revokeObjectURL(oe.url); delete self.m[old]; }
      }
    }
    return e;
  }
};

var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function (ents) {
  ents.forEach(function (en) { if (en.isIntersecting) { io.unobserve(en.target); fillImg(en.target); } });
}, { rootMargin: '400px 0px' }) : null;

function fillImg(img) {
  var id = img.getAttribute('data-mid');
  if (!id || img.getAttribute('data-done')) return;
  img.setAttribute('data-done', '1');
  Loader.get(id, img.getAttribute('data-full') !== '1').p.then(function (u) {
    img.onload = function () { img.classList.add('in'); };
    img.src = u;
    if (img.complete) img.classList.add('in');
  }).catch(function () { img.removeAttribute('data-mid'); });
}
function observeImgs(root) {
  $$('img[data-mid]:not([data-done])', root).forEach(function (img) { if (io) io.observe(img); else fillImg(img); });
}
/** The small picture for a photo or video; a photo without previews shows the original. */
function thumbTag(m, big) {
  var id = big ? (m.preview || m.thumb) : (m.thumb || m.preview);
  if (id) return imgTag(id);
  return m.type === 'photo' ? imgTag(m.id, true) : imgTag('');
}
function imgTag(id, full) {
  if (!id) return '<span class="ph-icon">' + I.image + '</span>';
  return '<img class="mimg" alt="" data-mid="' + esc(id) + '"' + (full ? ' data-full="1"' : '') + '>';
}

/* ================================================================ */
/* Photo and video processing (before upload)                       */
/* ================================================================ */
/* ---------- Making previews ----------
   Phone cameras take very large photos. Drawing one at full size fails on many Android phones: the
   graphics chip cannot hold it, and the result is empty or solid black. So previews are drawn on a
   canvas kept in ordinary memory (willReadFrequently), decoded at small size where possible, and any
   result that is empty or all black is thrown away and the next method is tried. */
var PhotoLog = [];          // what happened to recent photos, shown in Settings
function logPhoto(x) { PhotoLog.push(x); if (PhotoLog.length > 20) PhotoLog.shift(); lsSet('diari-photolog', PhotoLog); }

function canvas2d(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var x = null;
  try { x = c.getContext('2d', { willReadFrequently: true }); } catch (e) {}
  return { c: c, x: x || c.getContext('2d') };
}

/** 'ok', 'empty' (nothing drawn) or 'black'. */
function looks(c, x) {
  try {
    var top = 0, alpha = 0;
    for (var i = 1; i <= 6; i++) for (var j = 1; j <= 6; j++) {
      var d = x.getImageData(Math.floor(c.width * i / 7), Math.floor(c.height * j / 7), 1, 1).data;
      alpha = Math.max(alpha, d[3]); top = Math.max(top, d[0], d[1], d[2]);
    }
    return alpha === 0 ? 'empty' : top < 10 ? 'black' : 'ok';
  } catch (e) { return 'ok'; }
}

/** Draws src at w×h; resolves { blob, look }. */
function toJpeg(src, w, h, q) {
  var k = canvas2d(w, h);
  try { k.x.drawImage(src, 0, 0, w, h); } catch (e) { return Promise.resolve({ blob: null, look: 'error' }); }
  var look = looks(k.c, k.x);
  if (look === 'empty') return Promise.resolve({ blob: null, look: look });
  return new Promise(function (res) {
    try { k.c.toBlob(function (b) { res({ blob: b, look: look }); }, 'image/jpeg', q); } catch (e) { res({ blob: null, look: 'error' }); }
  });
}

function fit(w, h, max) {
  var s = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

// Video frames.
function scaled(src, max, q) {
  var sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  if (!sw || !sh) return Promise.resolve(null);
  var d = fit(sw, sh, max);
  return toJpeg(src, d[0], d[1], q).then(function (r) { return r.look === 'ok' ? r.blob : null; });
}

function loadImg(blob) {
  return new Promise(function (res, rej) {
    var img = new Image(), u = URL.createObjectURL(blob);
    img.onload = function () { URL.revokeObjectURL(u); res(img); };
    img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('This photo format cannot be read here.')); };
    img.src = u;
  });
}

/** Tries each way of reading the photo until one gives a real picture. log collects what happened. */
function photoJpeg(file, w, h, max, q, log) {
  var d = fit(w, h, max);
  var ways = [
    ['small', function () { return createImageBitmap(file, { resizeWidth: d[0], resizeHeight: d[1], resizeQuality: 'high', imageOrientation: 'from-image' }); }],
    ['img', function () { return loadImg(file); }],
    ['full', function () { return createImageBitmap(file, { imageOrientation: 'from-image' }); }]
  ];
  var i = 0;
  function next() {
    if (i >= ways.length) return Promise.resolve(null);           // no good preview: the original photo is shown instead
    var way = ways[i++];
    return Promise.resolve().then(way[1]).then(function (src) {
      return toJpeg(src, d[0], d[1], q).then(function (r) {
        if (src.close) src.close();
        log.push(way[0] + ':' + r.look);
        if (r.look === 'ok') return r.blob;
        return next();
      });
    }, function (e) { log.push(way[0] + ':failed'); return next(); });
  }
  return next();
}

function photoInfo(file) {
  var entry = { at: new Date().toISOString(), name: String(file.name || '').slice(-40), type: file.type || '?', mb: Math.round((file.size || 0) / 1e5) / 10, steps: [] };
  return loadImg(file).then(function (img) {
    var w = img.naturalWidth, h = img.naturalHeight;
    entry.size = w + '×' + h;
    return photoJpeg(file, w, h, 480, 0.74, entry.steps).then(function (thumb) {
      return photoJpeg(file, w, h, 1600, 0.84, entry.steps).then(function (preview) {
        entry.result = thumb ? 'ok' : 'no preview';
        logPhoto(entry);
        return { w: w, h: h, thumb: thumb, preview: preview };
      });
    });
  }).catch(function (e) { entry.result = 'unreadable: ' + errText(e); logPhoto(entry); return {}; });
}

function videoInfo(file) {
  return new Promise(function (resolve) {
    var v = document.createElement('video'), u = URL.createObjectURL(file), done = false;
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    function finish(out) {
      if (done) return; done = true;
      URL.revokeObjectURL(u); v.removeAttribute('src'); try { v.load(); } catch (e) {}
      resolve(out);
    }
    v.onloadedmetadata = function () {
      var d = isFinite(v.duration) ? v.duration : 0;
      if (!v.videoWidth) { finish({ dur: d }); return; }
      v.currentTime = Math.min(1, d / 4 || 0.1);
    };
    var tries = 0;
    v.onseeked = function () {
      setTimeout(function () {
        Promise.all([scaled(v, 480, 0.74), scaled(v, 1280, 0.82)]).then(function (b) {
          if (!b[0] && tries++ < 2) { v.currentTime = Math.min((v.duration || 1) * 0.5, v.currentTime + 0.5); return; }   // frame not ready yet
          finish({ w: v.videoWidth, h: v.videoHeight, dur: isFinite(v.duration) ? v.duration : 0, thumb: b[0], preview: b[1] });
        }).catch(function () { finish({ dur: v.duration }); });
      }, 120);
    };
    v.onerror = function () { finish({}); };
    setTimeout(function () { finish({}); }, 10000);
    v.src = u;
  });
}

/* ================================================================ */
/* Markdown (small, safe subset)                                    */
/* ================================================================ */
function inlineMd(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}
function md(src) {
  var lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  var out = '', para = [], list = null;
  function flushPara() { if (para.length) { out += '<p>' + para.map(inlineMd).join('<br>') + '</p>'; para = []; } }
  function flushList() { if (list) { out += '<' + list.t + '>' + list.items.map(function (i) { return '<li>' + inlineMd(i) + '</li>'; }).join('') + '</' + list.t + '>'; list = null; } }
  lines.forEach(function (l) {
    var m;
    if (!l.trim()) { flushPara(); flushList(); return; }
    if ((m = l.match(/^(#{1,3})\s+(.*)$/))) { flushPara(); flushList(); var n = m[1].length + 1; out += '<h' + n + '>' + inlineMd(m[2]) + '</h' + n + '>'; return; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { flushPara(); if (!list || list.t !== 'ul') { flushList(); list = { t: 'ul', items: [] }; } list.items.push(m[1]); return; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.t !== 'ol') { flushList(); list = { t: 'ol', items: [] }; } list.items.push(m[1]); return; }
    if ((m = l.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out += '<blockquote>' + inlineMd(m[1]) + '</blockquote>'; return; }
    flushList(); para.push(l);
  });
  flushPara(); flushList();
  return out;
}
function plain(src) {
  return String(src || '').replace(/^#{1,3}\s+/gm, '').replace(/^\s*[-*•]\s+/gm, '').replace(/^>\s?/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
}
function words(s) { var t = plain(s); return t ? t.split(' ').length : 0; }



/* ================================================================ */
/* Data helpers                                                     */
/* ================================================================ */
function byId(id) { for (var i = 0; i < S.entries.length; i++) if (S.entries[i].id === id) return S.entries[i]; return null; }
function sortEntries() { S.entries.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.created < b.created ? 1 : -1); }); }
function upsert(rec) { var i = S.entries.findIndex(function (e) { return e.id === rec.id; }); if (i >= 0) S.entries[i] = rec; else S.entries.push(rec); sortEntries(); cacheIndex(); }
function cacheIndex() { if (LIVE) lsSet('diari-index', S.entries); }
// Checks every entry before it is shown, so a damaged index or cache is skipped instead of breaking the page.
var DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, ID_RE = /^[A-Za-z0-9_-]{6,48}$/, FILE_RE = /^[A-Za-z0-9_-]{10,}$/;
function normEntry(e) {
  if (!e || !ID_RE.test(String(e.id)) || !DATE_RE.test(String(e.date))) return null;
  var n = function (v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  var fid = function (v) { return v && FILE_RE.test(String(v)) ? String(v) : ''; };
  return {
    id: String(e.id), date: String(e.date),
    title: String(e.title || ''), body: String(e.body || ''),
    titleAuto: e.titleAuto === true ? true : e.titleAuto === false ? false : undefined,
    tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
    media: (Array.isArray(e.media) ? e.media : []).filter(function (m) { return m && fid(m.id); }).map(function (m) {
      return { id: fid(m.id), type: m.type === 'video' ? 'video' : 'photo', name: String(m.name || ''), mime: String(m.mime || ''),
        size: n(m.size), w: n(m.w), h: n(m.h), dur: n(m.dur), thumb: fid(m.thumb), preview: fid(m.preview), play: fid(m.play), fp: String(m.fp || '') };
    }),
    created: String(e.created || ''), updated: String(e.updated || ''), fileId: fid(e.fileId)
  };
}
function normList(list) { return (Array.isArray(list) ? list : []).map(normEntry).filter(Boolean); }
function matches(e, q) {
  if (q.charAt(0) === '#') { var t = q.slice(1); return e.tags.some(function (x) { return x.toLowerCase().indexOf(t) === 0; }); }
  return (e.title + ' ' + e.body + ' ' + e.tags.join(' ')).toLowerCase().indexOf(q) >= 0;
}
function counts(list) {
  var c = { entries: list.length, photos: 0, videos: 0, words: 0, days: {} };
  list.forEach(function (e) { e.media.forEach(function (m) { if (m.type === 'video') c.videos++; else c.photos++; }); c.words += words(e.body); c.days[e.date.slice(0, 10)] = 1; });
  c.dayCount = Object.keys(c.days).length;
  return c;
}

/* ================================================================ */
/* Views                                                            */
/* ================================================================ */
var view = $('#view');

function setView(v) {
  if (v !== S.view) S.calPicked = false;
  S.view = v;
  $$('.tab').forEach(function (t) { if (t.getAttribute('data-view') === v) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  render();
  window.scrollTo(0, 0);
}

function fabDay() { return S.view === 'calendar' && S.calPicked && S.calDay && S.calDay !== todayKey() ? S.calDay : ''; }
function paintFab() {
  var f = $('#fab'), d = fabDay();
  if (!f) return;
  var want = d ? 'day:' + d : 'plain';
  if (f.getAttribute('data-mode') === want) return;
  f.setAttribute('data-mode', want);
  f.classList.toggle('withday', !!d);
  if (d) { var x = parseD(d + 'T00:00'); f.innerHTML = I.plus + '<span>' + x.getDate() + ' ' + MON[x.getMonth()].slice(0, 3) + '</span>'; }
  else f.innerHTML = I.plus;
  f.setAttribute('aria-label', d ? 'New entry for ' + fmtDayMonth(d + 'T00:00') : 'New entry');
}

function render() {
  paintFab();
  if (!S.loaded) return;
  if (S.view === 'calendar') renderCalendar();
  else if (S.view === 'media') renderMedia();
  else renderTimeline();
  observeImgs(view);
}

function cardHTML(e, sameDay) {
  var d = parseD(e.date), m0 = e.media[0];
  var ex = plain(e.body).slice(0, 220);
  var thumb = '';
  if (m0) {
    thumb = '<div class="c-thumb">' + thumbTag(m0) +
      (m0.type === 'video' ? '<span class="badge">' + I.play + fmtDur(m0.dur) + '</span>' : '') +
      (e.media.length > 1 ? '<span class="cnt">' + e.media.length + '</span>' : '') + '</div>';
  }
  var meta = [fmtTime(e.date)];
  var tagHtml = e.tags.slice(0, 3).map(function (t) { return '<span class="tg">#' + esc(t) + '</span>'; }).join(' ');
  var mc = counts([e]);
  if (mc.photos) meta.push(plural(mc.photos, 'photo'));
  if (mc.videos) meta.push(plural(mc.videos, 'video'));
  if (e.pending) meta.push('<b class="pend">' + pendingText() + '</b>');
  if (Copies.has(e.id)) meta.push('<b class="pend" data-copy="' + esc(e.id) + '">Preparing video…</b>');
  if (Uploads.count(e.id)) meta.push('<b class="pend">' + Uploads.text(e.id) + '</b>');
  return '<button class="card' + (sameDay ? ' same-day' : '') + (e.date.slice(0, 10) === todayKey() ? ' is-today' : '') + (e.id === S.flashId ? ' justsaved' : '') + '" data-open="' + esc(e.id) + '">' +
    '<span class="dt" aria-hidden="true"><span class="dw">' + DOW[d.getDay()].slice(0, 3) + '</span><span class="dn">' + d.getDate() + '</span></span>' +
    '<span style="min-width:0;display:block">' +
      (e.title ? '<span class="c-title">' + esc(e.title) + '</span>' : '') +
      (ex ? '<span class="c-ex">' + esc(ex) + '</span>' : '') +
      '<span class="c-meta">' + meta.map(function (x) { return '<span>' + x + '</span>'; }).join('') + (tagHtml ? '<span>' + tagHtml + '</span>' : '') + '</span>' +
    '</span>' + thumb + '</button>';
}

function listHTML(list) {
  var html = '', curMonth = '', prevDay = '', monthCounts = {};
  list.forEach(function (e) { var k = e.date.slice(0, 7); monthCounts[k] = (monthCounts[k] || 0) + 1; });
  list.forEach(function (e) {
    var k = e.date.slice(0, 7), day = e.date.slice(0, 10);
    if (k !== curMonth) {
      curMonth = k; prevDay = '';
      html += '<div class="month"><h2>' + monthName(k) + '</h2><span>' + plural(monthCounts[k], 'entry', 'entries') + '</span></div>';
    }
    html += cardHTML(e, day === prevDay);
    prevDay = day;
  });
  return html;
}

function renderTimeline() {
  var q = S.query.trim().toLowerCase();
  var list = q ? S.entries.filter(function (e) { return matches(e, q); }) : S.entries;
  var html = '';
  if (!S.entries.length) {
    html = '<div class="empty"><h2>Start your journal</h2><p>Write about today and add photos or videos. Everything is saved to your Google Drive.</p>' +
      '<button class="btn primary" data-new>' + I.plus + 'Write your first entry</button></div>';
    view.innerHTML = html; return;
  }
  if (q) {
    html += '<p class="results">' + plural(list.length, 'entry', 'entries') + ' match “' + esc(S.query.trim()) + '”</p>';
  } else {
    var c = counts(S.entries);
    html += '<div class="stats"><span><b>' + c.entries + '</b> ' + (c.entries === 1 ? 'entry' : 'entries') + '</span>' +
      '<span><b>' + c.dayCount + '</b> ' + (c.dayCount === 1 ? 'day' : 'days') + '</span>' +
      '<span><b>' + c.photos + '</b> ' + (c.photos === 1 ? 'photo' : 'photos') + '</span>' +
      '<span><b>' + c.videos + '</b> ' + (c.videos === 1 ? 'video' : 'videos') + '</span></div>';
    html += otdHTML();
    if (Install.ev && !lsGet('diari-install-hidden')) {
      html += '<div class="install"><div><b>Install Diari on this device</b><span>Opens full screen from your home screen, like any app.</span></div>' +
        '<button class="btn primary" data-install>Install</button><button class="icon-btn" data-install-hide aria-label="Hide">' + I.x + '</button></div>';
    }
  }
  html += listHTML(list);
  view.innerHTML = html;
}

function otdHTML() {
  var t = todayKey(), md5 = t.slice(5), y = +t.slice(0, 4);
  var hits = S.entries.filter(function (e) { return e.date.slice(5, 10) === md5 && +e.date.slice(0, 4) < y; });
  if (!hits.length) return '';
  var e = hits[0], ago = y - +e.date.slice(0, 4), m0 = e.media[0];
  return '<button class="otd" data-open="' + esc(e.id) + '">' +
    (m0 ? '<span class="ph">' + thumbTag(m0) + '</span>' : '') +
    '<div><div class="k">On this day · ' + plural(ago, 'year') + ' ago</div><div class="t">' + esc(e.title || plain(e.body).slice(0, 60) || 'Untitled') + '</div>' +
    '<div class="s">' + esc(fmtLong(e.date)) + (hits.length > 1 ? ' · and ' + (hits.length - 1) + ' more' : '') + '</div></div></button>';
}

function renderCalendar() {
  if (!S.cal) S.cal = todayKey().slice(0, 7);
  var y = +S.cal.slice(0, 4), mo = +S.cal.slice(5, 7);
  var first = new Date(y, mo - 1, 1), days = new Date(y, mo, 0).getDate(), off = (first.getDay() + 6) % 7;
  var byDay = {};
  S.entries.forEach(function (e) { if (e.date.slice(0, 7) === S.cal) (byDay[e.date.slice(0, 10)] = byDay[e.date.slice(0, 10)] || []).push(e); });
  var tk = todayKey();
  if (!S.calDay || S.calDay.slice(0, 7) !== S.cal) {
    var keys = Object.keys(byDay).sort();
    S.calDay = tk.slice(0, 7) === S.cal ? tk : (keys.length ? keys[keys.length - 1] : S.cal + '-01');
  }
  var html = '<div class="cal-head"><h2>' + monthName(S.cal) + '</h2><span class="spacer"></span>' +
    '<button class="icon-btn" data-cal="-1" aria-label="Previous month">' + I.chevL + '</button>' +
    (S.cal !== tk.slice(0, 7) ? '<button class="btn ghost" data-cal="0">Today</button>' : '') +
    '<button class="icon-btn" data-cal="1" aria-label="Next month">' + I.chevR + '</button></div>';
  html += '<div class="cal" role="grid">';
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d) { html += '<div class="dow">' + d + '</div>'; });
  for (var i = 0; i < off; i++) html += '<span class="day blank" aria-hidden="true"></span>';
  for (var d = 1; d <= days; d++) {
    var key = S.cal + '-' + pad(d), list = byDay[key] || [];
    var withMedia = null;
    list.forEach(function (e) { if (!withMedia && e.media[0] && e.media[0].thumb) withMedia = e.media[0]; });
    var cls = 'day' + (list.length ? ' has' : '') + (withMedia ? ' photo' : '') + (key === tk ? ' today' : '') + (key === S.calDay ? ' sel' : '');
    var dots = list.length ? '<span class="dot">' + list.slice(0, 3).map(function () { return '<i></i>'; }).join('') + '</span>' : '';
    html += '<button class="' + cls + '" data-day="' + key + '" aria-label="' + esc(fmtDayMonth(key + 'T00:00')) + ', ' + plural(list.length, 'entry', 'entries') + '"' + (key === S.calDay ? ' aria-pressed="true"' : '') + '>' +
      (withMedia ? imgTag(withMedia.thumb) : '') + '<span class="n">' + d + '</span>' + dots + '</button>';
  }
  html += '</div>';
  var sel = (byDay[S.calDay] || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  html += '<div class="day-list"><h3>' + esc(fmtDayMonth(S.calDay + 'T00:00')) + '</h3>';
  if (sel.length) html += sel.map(function (e, i) { return cardHTML(e, false); }).join('');
  else html += '<p class="none">No entry on this day. Tap + to write one.</p>';
  html += '</div>';
  view.innerHTML = html;
}

function allMedia() {
  var out = [];
  S.entries.forEach(function (e) { e.media.forEach(function (m) { out.push(Object.assign({}, m, { entryId: e.id, date: e.date, title: e.title })); }); });
  return out;
}

function renderMedia() {
  var items = allMedia();
  if (!items.length) {
    view.innerHTML = '<div class="empty"><h2>No photos or videos yet</h2><p>Photos and videos you add to entries show up here, newest first.</p></div>';
    return;
  }
  var html = '', cur = '', groups = {};
  items.forEach(function (m) { var k = m.date.slice(0, 7); groups[k] = groups[k] || { p: 0, v: 0 }; if (m.type === 'video') groups[k].v++; else groups[k].p++; });
  items.forEach(function (m, i) {
    var k = m.date.slice(0, 7);
    if (k !== cur) {
      if (cur) html += '</div>';
      cur = k;
      var g = groups[k], bits = [];
      if (g.p) bits.push(plural(g.p, 'photo')); if (g.v) bits.push(plural(g.v, 'video'));
      html += '<div class="month"><h2>' + monthName(k) + '</h2><span>' + bits.join(' · ') + '</span></div><div class="mgrid">';
    }
    html += '<button class="mt" data-mi="' + i + '" aria-label="' + (m.type === 'video' ? 'Video' : 'Photo') + ' from ' + esc(fmtLong(m.date)) + '">' + thumbTag(m) +
      (m.type === 'video' ? '<span class="badge">' + I.play + fmtDur(m.dur) + '</span>' : '') + '</button>';
  });
  html += '</div>';
  view.innerHTML = html;
}

/* ================================================================ */
/* Sheets                                                           */
/* ================================================================ */
function openSheet(sh, onClose) {
  sh.classList.add('open'); lockScroll();
  $('.sheet-body', sh).scrollTop = 0;
  Nav.push(function () { sh.classList.remove('open'); lockScroll(); if (onClose) onClose(); });
}

/* ---------- entry view ---------- */
var entrySheet = $('#sheet-entry');

/** Every photo and video, however many: the first one large, the rest in full rows of two or three. */
function galleryHTML(e) {
  var ms = e.media, n = ms.length;
  if (!n) return '';
  var shown = ms, cls = [];
  if (n === 2) cls = ms.some(function (m) { return m.type === 'video'; }) ? ['hero', 'hero'] : ['half', 'half'];
  else {
    cls.push('hero');
    var r = n - 1, halves = r % 3 === 0 ? 0 : r % 3 === 2 ? 2 : 4;   // so that every row is full
    for (var i = 0; i < r; i++) cls.push(i < halves ? 'half' : 'third');
  }
  return '<div class="gal">' + shown.map(function (m, i) {
    var c = cls[i], ar = '';
    if (c === 'hero') {
      var ratio = m.w && m.h ? Math.max(0.8, Math.min(1.78, m.w / m.h)) : 4 / 3;
      ar = ' style="--ar:' + ratio.toFixed(3) + '"';
    }
    var big = c === 'hero' || c === 'half';
    var label = (m.type === 'video' ? 'Play video' : 'Open photo') + (m.dur ? ', ' + fmtDur(m.dur) : '');
    return '<div class="gi ' + c + '" role="button" tabindex="0" data-gi="' + i + '" aria-label="' + label + '"' + ar + '>' +
      thumbTag(m, big) +
      (m.type === 'video' ? '<span class="play">' + I.play + '</span><span class="badge">' + fmtDur(m.dur) + '</span>' : '') + '</div>';
  }).join('') + '</div>';
}

function entryHTML(e) {
  var c = counts([e]), foot = [plural(c.words, 'word')];
  if (c.photos) foot.push(plural(c.photos, 'photo'));
  if (c.videos) foot.push(plural(c.videos, 'video'));
  return '<p class="ev-date">' + esc(fmtLong(e.date)) + ' · ' + fmtTime(e.date) + '</p>' +
    (e.title ? '<h1 class="ev-title">' + esc(e.title) + '</h1>' : '<div style="height:14px"></div>') +
    galleryHTML(e) +
    '<div class="prose">' + md(e.body) + '</div>' +
    (e.tags.length ? '<div class="tags">' + e.tags.map(function (t) { return '<button class="chip" data-tag="' + esc(t) + '">#' + esc(t) + '</button>'; }).join('') + '</div>' : '') +
    '<div class="ev-foot"><span>' + foot.join(' · ') + '</span>' + (e.pending ? '<b class="pend">' + pendingText() + '</b>' : '') + (Copies.has(e.id) ? '<b class="pend" data-copy="' + esc(e.id) + '">Preparing video…</b>' : '') +
    (Uploads.count(e.id) ? '<b class="pend">' + Uploads.text(e.id) + '</b>' : '') + '</div>';
}

function openEntry(id) {
  var e = byId(id);
  if (!e) return;
  S.openId = id;
  fillEntry(e);
  if (!entrySheet.classList.contains('open')) openSheet(entrySheet, function () { S.openId = null; stopVideos(entrySheet); });
}

function fillEntry(e) {
  var box = $('#entry-in');
  stopVideos(box);
  box.innerHTML = entryHTML(e);
  observeImgs(box);
  // Warm up the first video so it starts right away when tapped.
  var hero = e.media[0];
  var slow = navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || ''));
  if (hero && hero.type === 'video' && !Stream.ok() && (!hero.size || hero.size < 60e6) && !slow) Loader.get(hero.id, false);
}

function stopVideos(root) { $$('video', root).forEach(function (v) { try { v.pause(); } catch (e) {} }); }

function ringEl() {
  var C = 2 * Math.PI * 26;
  var r = el('<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="bgc" cx="32" cy="32" r="26"/><circle class="fgc" cx="32" cy="32" r="26" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/><text x="32" y="32"></text></svg>');
  r.set = function (f) { $('.fgc', r).setAttribute('stroke-dashoffset', String(C * (1 - (f || 0)))); $('text', r).textContent = Math.round((f || 0) * 100) + '%'; };
  r.set(0);
  return r;
}

/* ---------- Playback copies: a smaller 720p version of each video, made on this device ----------
   Phone videos carry 15-50 Mbit/s, more than mobile data can stream smoothly. The copy carries about
   2.5 Mbit/s. The original stays untouched in Drive; Diari plays the copy. */
var Copy = {
  lib: null,
  supported: function () { return !!(window.VideoEncoder && window.VideoDecoder && window.OffscreenCanvas); },
  /** Worth a copy: bigger than 720p, or more than 5 Mbit/s. */
  needed: function (m) {
    if (!m || m.type !== 'video' || m.play) return false;
    var rate = m.dur && m.size ? m.size * 8 / m.dur : 0;
    return Math.max(m.w || 0, m.h || 0) > 1300 || rate > 5e6 || (!m.w && (m.size || 0) > 15e6);
  },
  load: function () {
    if (window.Mediabunny) return Promise.resolve(window.Mediabunny);
    if (Copy.lib) return Copy.lib;
    Copy.lib = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'vendor/mediabunny.min.js';
      sc.onload = function () { if (window.Mediabunny) res(window.Mediabunny); else rej(new Error('The video tools did not load.')); };
      sc.onerror = function () { Copy.lib = null; rej(new Error('The video tools did not load. Check your connection.')); };
      document.head.appendChild(sc);
    });
    return Copy.lib;
  },
  /** Resolves a smaller MP4 Blob. */
  make: function (blob, onProg) {
    return Copy.load().then(function (MB) {
      return Promise.all([
        MB.getFirstEncodableVideoCodec(['avc', 'vp9'], { width: 1280, height: 720 }),
        MB.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000 })
      ]).then(function (codecs) {
        if (!codecs[0]) throw new Error('This device cannot make video copies.');
        var output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
        return MB.Conversion.init({
          input: new MB.Input({ source: new MB.BlobSource(blob), formats: MB.ALL_FORMATS }),
          output: output,
          video: function (track) {
            var o = { codec: codecs[0], bitrate: 2500000, keyFrameInterval: 2, forceTranscode: true };
            if (Math.max(track.displayWidth, track.displayHeight) > 1280) {
              if (track.displayWidth >= track.displayHeight) o.width = 1280; else o.height = 1280;
            }
            return o;
          },
          audio: codecs[1] ? { codec: codecs[1] } : { discard: true }
        }).then(function (conv) {
          // Losing the picture is never acceptable; losing the sound only when we asked to drop it (no audio encoder).
          var lost = conv.discardedTracks.filter(function (d) { return codecs[1] || (d.track && d.track.type === 'video'); });
          if (!conv.isValid || lost.length) throw new Error('This video cannot be copied on this device.');
          conv.onProgress = function (pr) { if (onProg) onProg(pr); };
          return conv.execute().then(function () { return new Blob([output.target.buffer], { type: 'video/mp4' }); });
        });
      });
    });
  }
};

/* One copy at a time, in the background; the entry shows "Preparing video" until it is attached. */
var Copies = {
  queue: [], busy: false, active: {}, current: null, prog: 0, timer: 0,
  has: function (entryId) { return !!this.active[entryId]; },
  /** Already waiting or being made, so tapping again never makes a second copy. */
  queued: function (mediaId) {
    return !!(this.current && this.current.mediaId === mediaId) || this.queue.some(function (j) { return j.mediaId === mediaId; });
  },
  idle: function () { return !this.busy && !this.queue.length; },
  add: function (job) {
    if (this.queued(job.mediaId)) return false;
    this.queue.push(job);
    this.active[job.entryId] = (this.active[job.entryId] || 0) + 1;
    refreshPending(); this.run();
    return true;
  },
  paint: function (entryId, pr) {
    this.prog = pr;
    $$('[data-copy="' + entryId + '"]').forEach(function (x) { x.textContent = 'Preparing video ' + Math.round(pr * 100) + '%'; });
  },
  run: function () {
    var self = this;
    clearTimeout(this.timer);
    if (this.busy || !this.queue.length) return;
    // After the uploads, so they get the phone's full attention (UpQ starts this again when they are done).
    if (UpQ.busy()) return;
    // A copy takes a few minutes; start only with enough sign-in time left (otherwise sign in again first).
    if (!Auth.valid(10 * 60e3)) {
      if (this.queue.some(function (j) { return j.fromFix; })) lsSet('diari-copyresume', { at: Date.now() });   // carry on after signing in
      if (!ED && navigator.onLine && !Uploads.any()) reauth();
      this.timer = setTimeout(function () { self.run(); }, 30e3); return;
    }
    var job = this.queue.shift();
    this.busy = true; this.current = job; this.prog = 0; Awake.check();
    var again = false;
    var finish = function () {
      self.busy = false; self.current = null; Awake.check();
      if (!again && !--self.active[job.entryId]) delete self.active[job.entryId];
      refreshPending();
      if (!again && job.done) job.done(job);
      if (again) self.timer = setTimeout(function () { self.run(); }, 30e3); else self.run();
    };
    // Made meanwhile (on the other device, or by an earlier tap): nothing to do.
    if (job.fromFix) {
      var e = byId(job.entryId), m = e && e.media.filter(function (x) { return x.id === job.mediaId; })[0];
      if (!m || m.play) { job.ok = !!m; job.skipped = true; Promise.resolve().then(finish); return; }
    }
    var getFile = job.file ? Promise.resolve(job.file) : API.blob(job.mediaId);
    getFile.then(function (file) {
      return Copy.make(file, function (pr) { self.paint(job.entryId, pr); if (job.onProg) job.onProg(pr); });
    }).then(function (blob) {
      return API.target(job.date).then(function (tgt) {
        return API.upload(blob, { name: job.name + '.play.mp4', folderId: tgt.previewId, mime: 'video/mp4' });
      });
    }).then(function (playId) { attachPlay(job, playId); job.ok = true; }, function (err) {
      job.err = errText(err);
      try { console.warn('Diari video copy:', job.err, err); } catch (e) {}
      if (err && err.expired) { again = true; self.queue.unshift(job); if (job.fromFix) lsSet('diari-copyresume', { at: Date.now() }); if (!ED && !UpQ.busy()) reauth(); }
    }).then(function () {
      if (!again) CopyLog.note(job);
      finish();
    });
  }
};

/* What happened to the last copy, shown in Settings so it is easy to tell whether it worked. */
var CopyLog = {
  note: function (job) {
    if (job.skipped) return;
    lsSet('diari-copylast', { ok: !!job.ok, err: job.ok ? '' : (job.err || 'unknown problem'), at: Date.now() });
  },
  last: function () { return lsGet('diari-copylast'); }
};

/** Moves extra copies to the trash (for example from tapping the button more than once). */
function tidyCopies() {
  if (!Copies.idle()) return Promise.resolve({ removed: 0 });
  var keep = [];
  var add = function (list) { (list || []).forEach(function (m) { if (m && m.play) keep.push(m.play); }); };
  S.entries.forEach(function (e) { add(e.media); });
  Outbox.items.forEach(function (x) { add(x.rec.media); });
  if (ED) add(ED.media);
  return API.tidyCopies(keep).catch(function (err) { if (err && err.expired) throw err; return { removed: 0 }; });
}

function attachPlay(job, playId) {
  if (!job.fromFix && ED && ED.id === job.entryId) {
    var em = ED.media.filter(function (x) { return x.id === job.mediaId; })[0];
    if (em) { if (em.play && em.play !== playId) dropCopy(em.play); em.play = playId; saveDraft(); return; }
  }
  var e = byId(job.entryId);
  var has = e && e.media.some(function (x) { return x.id === job.mediaId; });
  if (!has) { dropCopy(playId); return; }
  var rec = {
    id: e.id, date: e.date, title: e.autoTitle ? '' : e.title, titleAuto: e.autoTitle ? undefined : e.titleAuto, body: e.body, tags: e.tags.slice(),
    media: e.media.map(function (x) {
      var o = pickMedia(x);
      if (x.id === job.mediaId) { if (o.play && o.play !== playId) dropCopy(o.play); o.play = playId; }
      return o;
    })
  };
  var shown = shownRec(rec);
  if (!e.autoTitle) { shown.title = e.title; shown.autoTitle = false; }
  upsert(shown);
  Outbox.add(rec);
}

function dropCopy(id) { API.discard([{ id: '', thumb: '', preview: '', play: id }]).catch(function () {}); }

function playId(m) { return m.play && !m.noPlay ? m.play : m.id; }

/* ---------- Videos stream through Diari's offline helper (sw.js), so they start at once ---------- */
var Stream = {
  ok: function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller) && Auth.valid(60e3); },
  url: function (m) { var id = playId(m); return 'stream/' + encodeURIComponent(id) + (id === m.id && m.size ? '?s=' + Math.round(m.size) : ''); },
  sendToken: function () {
    var c = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (c && Auth.valid(30e3)) c.postMessage({ type: 'token', token: Auth.token, exp: Auth.exp });
  }
};
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'need-token' && e.ports && e.ports[0]) {
      e.ports[0].postMessage(Auth.valid(30e3) ? { token: Auth.token, exp: Auth.exp } : {});
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', function () { Stream.sendToken(); });
}

function spinner() { return el('<span class="vspin" role="status" aria-label="Loading video"></span>'); }

/** A video element that plays from the stream; calls fallback() if streaming does not work. */
function streamVideo(m, poster, fallback) {
  var v = document.createElement('video');
  v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
  if (poster) v.poster = poster;
  var started = false;
  v.addEventListener('loadeddata', function () { started = true; v.dispatchEvent(new Event('diari-ready')); });
  v.addEventListener('error', function () { if (!started) fallback(); else videoFailFor(v, m); }, { once: true });
  v.src = Stream.url(m);
  return v;
}
function videoFailFor(v, m) { var box = v.parentNode; if (box) videoFail(box, m); }

function playInline(tile, m) {
  if (tile.classList.contains('playing') || tile.classList.contains('loading')) return;
  if (Stream.ok()) {
    var playBtnS = $('.play', tile); if (playBtnS) playBtnS.hidden = true;
    var posterS = $('img', tile);
    var spin = spinner();
    tile.classList.add('playing');
    var v = streamVideo(m, posterS && posterS.src, function () {
      v.remove(); spin.remove(); tile.classList.remove('playing');
      if (playBtnS) playBtnS.hidden = false;
      if (m.play && !m.noPlay) { m.noPlay = true; playInline(tile, m); return; }   // copy didn't play: use the original
      downloadAndPlay(tile, m);                                                      // streaming didn't work: download it
    });
    v.addEventListener('diari-ready', function () { spin.remove(); });
    $$('.badge', tile).forEach(function (b) { b.remove(); });
    tile.appendChild(v); tile.appendChild(spin);
    v.play().catch(function () {});
    return;
  }
  downloadAndPlay(tile, m);
}

function downloadAndPlay(tile, m) {
  tile.classList.add('loading');
  var playBtn = $('.play', tile); if (playBtn) playBtn.hidden = true;
  var ring = ringEl(); tile.appendChild(ring);
  var ent = Loader.get(playId(m), false);
  var sub = function (f) { ring.set(f); };
  ent.subs.push(sub); ring.set(ent.prog);
  ent.p.then(function (url) {
    ent.subs = ent.subs.filter(function (s) { return s !== sub; });
    ring.remove(); tile.classList.remove('loading'); tile.classList.add('playing');
    var poster = $('img', tile);
    var v = document.createElement('video');
    v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
    if (poster && poster.src) v.poster = poster.src;
    v.src = url;
    $$('.badge', tile).forEach(function (b) { b.remove(); });
    tile.appendChild(v);
    v.play().catch(function () {});
    v.addEventListener('error', function () { videoFail(tile, m); });
  }).catch(function (err) {
    ring.remove(); tile.classList.remove('loading'); if (playBtn) playBtn.hidden = false;
    fail(err);
  });
}

function videoFail(container, m) {
  var link = LIVE ? ' <a href="https://drive.google.com/file/d/' + esc(m.id) + '/view" target="_blank" rel="noopener">Open it in Google Drive</a>, which converts it for playback.' : '';
  toast('This browser cannot play this video format.', 5000);
  if (link) {
    var note = el('<div class="lb-msg" style="position:absolute;inset:0;display:grid;place-items:center;background:rgba(0,0,0,.75);color:#fff">' +
      '<span>This browser cannot play this video format (often HEVC).' + link + '</span></div>');
    container.appendChild(note);
  }
}

entrySheet.addEventListener('click', function (ev) {
  var act = ev.target.closest('[data-act]');
  if (act) {
    var a = act.getAttribute('data-act');
    if (a === 'close') Nav.pop();
    else if (a === 'edit') {
      if (Uploads.count(S.openId)) { toast('Photos are still uploading to this entry. You can edit it when they are done.', 4500); return; }
      if (fresh(3, { id: S.openId })) openEditor(S.openId);
    }
    else if (a === 'delete') deleteEntry(S.openId);
    return;
  }
  var tag = ev.target.closest('[data-tag]');
  if (tag) { Nav.pop(); showSearch('#' + tag.getAttribute('data-tag')); return; }
  var gi = ev.target.closest('[data-gi]');
  if (gi) openGalleryItem(gi);
});
entrySheet.addEventListener('keydown', function (ev) {
  var gi = ev.target.closest && ev.target.closest('[data-gi]');
  if (gi && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openGalleryItem(gi); }
});

function openGalleryItem(gi) {
  var e = byId(S.openId); if (!e) return;
  var i = +gi.getAttribute('data-gi'), m = e.media[i];
  if (m.type === 'video' && gi.classList.contains('hero')) { playInline(gi, m); return; }
  if (gi.classList.contains('playing')) return;
  openLightbox(e.media.map(function (x) { return Object.assign({}, x, { entryId: e.id, date: e.date, title: e.title }); }), i, false);
}

function deleteEntry(id) {
  var e = byId(id); if (!e) return;
  if (Outbox.sending(id)) { toast('This entry is still saving. Try again in a moment.'); return; }
  confirmDlg({
    title: 'Delete this entry?',
    text: LIVE ? 'The text, photos and videos move to your Google Drive trash. You can restore them from there for 30 days.' : 'This removes the sample entry from the preview.',
    ok: 'Delete', danger: true
  }).then(function (yes) {
    if (!yes) return;
    var queued = Outbox.drop(id);
    API.remove(id).then(function () {
      if (queued) API.discard(queued.rec.media.map(pickIds)).catch(function () {});
      S.entries = S.entries.filter(function (x) { return x.id !== id; }); cacheIndex();
      if (S.openId === id) Nav.pop();
      render(); toast('Entry deleted');
    }).catch(function (err) { fail(err); });
  });
}

/* ---------- lightbox ---------- */
function openLightbox(items, index, fromMedia) {
  var i = index;
  var lb = el('<div class="lb" role="dialog" aria-modal="true" aria-label="Photos and videos">' +
    '<div class="lb-bar"><button class="icon-btn" data-x aria-label="Close">' + I.close + '</button><span class="lb-count"></span><span class="spacer"></span>' +
    (fromMedia ? '<button class="lb-go" data-go>View entry</button>' : '') + '</div>' +
    '<div class="lb-stage"></div>' +
    '<button class="lb-arrow prev" aria-label="Previous">' + I.chevL + '</button><button class="lb-arrow next" aria-label="Next">' + I.chevR + '</button>' +
    '<div class="lb-cap"></div></div>');
  var stage = $('.lb-stage', lb);
  document.body.appendChild(lb); lockScroll();

  function show() {
    var m = items[i];
    stopVideos(stage); stage.innerHTML = '';
    Z = { s: 1, x: 0, y: 0, img: null, m: m, hi: false };
    stage.classList.toggle('zoomable', m.type === 'photo'); lb.classList.remove('zoomed');
    $('.lb-count', lb).textContent = items.length > 1 ? (i + 1) + ' / ' + items.length : '';
    $('.lb-cap', lb).textContent = fmtLong(m.date) + (m.title ? ' · ' + m.title : '');
    $('.prev', lb).hidden = i === 0; $('.next', lb).hidden = i === items.length - 1;
    if (m.type === 'photo') {
      var img = document.createElement('img'); img.alt = m.title || 'Photo'; img.draggable = false;
      var want = m.preview || m.id;
      stage.appendChild(img); Z.img = img;
      Loader.get(want, !!m.preview).p.then(function (u) { if (items[i] === m) img.src = u; })
        .catch(function (err) { if (items[i] === m) stage.innerHTML = '<div class="lb-msg">' + esc(errText(err)) + '</div>'; });
      img.onerror = function () {
        if (items[i] !== m) return;
        stage.innerHTML = '<div class="lb-msg">This photo format cannot be shown in the browser.' +
          (LIVE ? ' <a href="https://drive.google.com/file/d/' + esc(m.id) + '/view" target="_blank" rel="noopener">Open it in Google Drive</a>.' : '') + '</div>';
      };
    } else if (Stream.ok() && !m.noStream) {
      var pid = m.preview || m.thumb;
      var sp = spinner();
      var sv = streamVideo(m, '', function () {
        if (items[i] !== m) return;
        if (m.play && !m.noPlay) m.noPlay = true; else m.noStream = true;   // try the original, then downloading
        show();
      });
      sv.autoplay = true;
      sv.addEventListener('diari-ready', function () { sp.remove(); });
      sv.addEventListener('error', function () {}, { once: true });
      stage.appendChild(sv); stage.appendChild(sp);
      if (pid) Loader.get(pid, true).p.then(function (u) { if (!sv.currentTime) sv.poster = u; }).catch(function () {});
      sv.play().catch(function () {});
    } else {
      var posterId = m.preview || m.thumb;
      var ring = ringEl(); stage.appendChild(ring);
      var posterP = posterId ? Loader.get(posterId, true).p.catch(function () { return ''; }) : Promise.resolve('');
      var ent = Loader.get(playId(m), false);
      var sub = function (f) { ring.set(f); };
      ent.subs.push(sub); ring.set(ent.prog);
      Promise.all([ent.p, posterP]).then(function (r) {
        ent.subs = ent.subs.filter(function (s) { return s !== sub; });
        if (items[i] !== m) return;
        stage.innerHTML = '';
        var v = document.createElement('video');
        v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.autoplay = true;
        if (r[1]) v.poster = r[1];
        v.src = r[0];
        v.addEventListener('error', function () {
          stage.innerHTML = '<div class="lb-msg">This browser cannot play this video format (often HEVC).' +
            (LIVE ? ' <a href="https://drive.google.com/file/d/' + esc(m.id) + '/view" target="_blank" rel="noopener">Open it in Google Drive</a>, which converts it for playback.' : '') + '</div>';
        });
        stage.appendChild(v);
        v.play().catch(function () {});
      }).catch(function (err) { if (items[i] === m) stage.innerHTML = '<div class="lb-msg">' + esc(errText(err)) + '</div>'; });
    }
  }
  function go(d) { var n = i + d; if (n < 0 || n >= items.length) return; i = n; show(); }
  function key(ev) {
    if (ev.key === 'ArrowLeft') go(-1);
    else if (ev.key === 'ArrowRight') go(1);
    else if (Z.img && (ev.key === '+' || ev.key === '=')) zoomAt({ x: 0, y: 0 }, Z.s * 1.5, true);
    else if (Z.img && ev.key === '-') zoomAt({ x: 0, y: 0 }, Z.s / 1.5 < 1.25 ? 1 : Z.s / 1.5, true);
  }
  $('[data-x]', lb).onclick = function () { Nav.pop(); };
  $('.prev', lb).onclick = function () { go(-1); };
  $('.next', lb).onclick = function () { go(1); };
  var goBtn = $('[data-go]', lb);
  if (goBtn) goBtn.onclick = function () { var id = items[i].entryId; Nav.pop(); openEntry(id); };

  /* Zoom for photos: pinch or double-tap on a phone, mouse wheel or double-click on a PC.
     Zoomed in, one finger (or the mouse) moves the photo; zoomed out, a swipe goes to the next one. */
  var Z = { s: 1, x: 0, y: 0, img: null, m: null, hi: false }, MAX = 6;
  function box() {
    var r = stage.getBoundingClientRect();
    var nw = (Z.img && Z.img.naturalWidth) || r.width, nh = (Z.img && Z.img.naturalHeight) || r.height;
    var a = nw / nh, cw = Math.min(r.width, r.height * a);
    return { r: r, cw: cw, ch: cw / a };
  }
  function at(cx, cy) { var r = stage.getBoundingClientRect(); return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 }; }
  function paint(anim) {
    if (!Z.img) return;
    var b = box(), mx = Math.max(0, (b.cw * Z.s - b.r.width) / 2), my = Math.max(0, (b.ch * Z.s - b.r.height) / 2);
    Z.x = Math.max(-mx, Math.min(mx, Z.x)); Z.y = Math.max(-my, Math.min(my, Z.y));
    Z.img.style.transition = anim ? 'transform .22s ease' : 'none';
    Z.img.style.transform = Z.s > 1 ? 'translate(' + Z.x + 'px,' + Z.y + 'px) scale(' + Z.s + ')' : '';
    lb.classList.toggle('zoomed', Z.s > 1.01);
    if (Z.s > 1.5) sharpen();
  }
  function zoomAt(p, s, anim) {
    s = Math.max(1, Math.min(MAX, s));
    var qx = (p.x - Z.x) / Z.s, qy = (p.y - Z.y) / Z.s;
    Z.s = s; Z.x = s === 1 ? 0 : p.x - qx * s; Z.y = s === 1 ? 0 : p.y - qy * s;
    paint(anim);
  }
  function toggleZoom(cx, cy) { if (Z.s > 1.01) zoomAt({ x: 0, y: 0 }, 1, true); else zoomAt(at(cx, cy), 2.5, true); }
  // The preview is 1600 px; when zooming in, swap in the full-size original so details stay sharp.
  function sharpen() {
    var m = Z.m, img = Z.img;
    if (Z.hi || !m || !m.preview || !LIVE || !/^image\/(jpeg|png|webp|gif)$/i.test(m.mime || '')) return;
    Z.hi = true;
    Loader.get(m.id, false).p.then(function (u) {
      var pre = new Image();
      pre.onload = function () { if (Z.img === img) img.src = u; };
      pre.src = u;
    }).catch(function () {});
  }

  var pts = {}, G = null, lastTap = { t: 0, x: 0, y: 0 }, lastType = '';
  function ids() { return Object.keys(pts); }
  function begin() {
    var k = ids(), was = G;
    if (k.length >= 2) {
      var a = pts[k[0]], b = pts[k[1]];
      G = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: Z.s, x0: Z.x, y0: Z.y, m0: at((a.x + b.x) / 2, (a.y + b.y) / 2), pinched: true };
    } else if (k.length === 1) {
      var p = pts[k[0]];
      G = { pinch: false, sx: p.x, sy: p.y, x0: Z.x, y0: Z.y, moved: false, mouse: p.mouse, pinched: !!(was && was.pinched) };
    } else G = null;
  }
  stage.addEventListener('pointerdown', function (ev) {
    lastType = ev.pointerType;
    if (ev.pointerType === 'mouse' && (ev.button !== 0 || !Z.img || Z.s <= 1.01)) return;   // a mouse only drags a zoomed photo
    pts[ev.pointerId] = { x: ev.clientX, y: ev.clientY, mouse: ev.pointerType === 'mouse' };
    if (Z.img) { try { stage.setPointerCapture(ev.pointerId); } catch (e) {} }
    begin();
  });
  stage.addEventListener('pointermove', function (ev) {
    var p = pts[ev.pointerId];
    if (!p || !G) return;
    p.x = ev.clientX; p.y = ev.clientY;
    if (!Z.img) return;
    if (G.pinch) {
      var k = ids(), a = pts[k[0]], b = pts[k[1]];
      var s = Math.max(1, Math.min(MAX, G.s0 * Math.hypot(a.x - b.x, a.y - b.y) / G.d0));
      var m = at((a.x + b.x) / 2, (a.y + b.y) / 2), qx = (G.m0.x - G.x0) / G.s0, qy = (G.m0.y - G.y0) / G.s0;
      Z.s = s; Z.x = m.x - qx * s; Z.y = m.y - qy * s;
      paint(false);
    } else {
      var dx = p.x - G.sx, dy = p.y - G.sy;
      if (Math.abs(dx) + Math.abs(dy) > 8) G.moved = true;
      if (Z.s > 1.01) { Z.x = G.x0 + dx; Z.y = G.y0 + dy; paint(false); }
    }
  });
  function end(ev) {
    var p = pts[ev.pointerId];
    if (!p) return;
    delete pts[ev.pointerId];
    var g = G;
    if (ids().length) { begin(); return; }            // one finger still down after a pinch: carry on moving
    G = null;
    if (Z.s > 1 && Z.s <= 1.05) zoomAt({ x: 0, y: 0 }, 1, true);   // nearly zoomed out: settle at the normal size
    if (!g || g.pinch || ev.type !== 'pointerup') return;
    var dx = p.x - g.sx, dy = p.y - g.sy;
    if (!g.moved && !g.pinched && !g.mouse && Z.img) {            // a tap: two in a row zoom in or out
      var now = Date.now();
      if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) { lastTap.t = 0; toggleZoom(p.x, p.y); }
      else lastTap = { t: now, x: p.x, y: p.y };
      return;
    }
    if (Z.s <= 1.01 && !g.pinched && !g.mouse && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  }
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('dblclick', function (ev) { if (Z.img && lastType === 'mouse') toggleZoom(ev.clientX, ev.clientY); });   // touch double-taps are handled above
  stage.addEventListener('wheel', function (ev) {
    if (!Z.img) return;
    ev.preventDefault();
    zoomAt(at(ev.clientX, ev.clientY), Z.s * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018)), false);
  }, { passive: false });
  function fit() { paint(false); }
  window.addEventListener('resize', fit);
  document.addEventListener('keydown', key);
  Nav.push(function () { stopVideos(lb); document.removeEventListener('keydown', key); window.removeEventListener('resize', fit); lb.remove(); lockScroll(); });
  show();
  $('[data-x]', lb).focus();
}

/* ---------- settings ---------- */
var BILLING_URL = 'https://platform.claude.com/settings/billing', creditCheckedAt = 0;
function usd(v) { return v < 0.01 ? 'less than US$0.01' : 'about US$' + v.toFixed(2); }
/** Claude does not let apps read the credit balance: link to where it is shown, and say what Diari has used. */
function creditHTML() {
  var u = API.claudeUse(), low = API.creditLow();
  var spent = !u.n ? 'Diari has not used Claude on this device this month.'
    : 'This month on this device, Claude wrote ' + plural(u.n, 'title') + (u.unpriced && !u.usd ? '.' : ', costing ' + usd(u.usd) + '.');
  return '<div class="credit" id="credit">' +
    (low ? '<p class="credit-low"><b>Your Claude credit has run out.</b> New entries get their first sentence as the title until you top up.</p>' : '') +
    '<p class="muted">Your balance is shown on the Claude Console billing page (Claude does not share it with apps). Top up there, or turn on auto-reload so it never runs out.</p>' +
    '<p><a class="btn soft" href="' + BILLING_URL + '" target="_blank" rel="noopener">' + I.ext + 'Check balance and top up</a></p>' +
    '<p class="muted credit-use">' + esc(spent) + '</p></div>';
}
function openSettings() {
  var c = counts(S.entries), box = $('#settings-in');
  var untitled = S.entries.filter(function (e) { return !e.title; }).length;
  var standalone = window.matchMedia && matchMedia('(display-mode: standalone)').matches;
  box.innerHTML = '<h2>Where your journal is saved</h2>' +
    '<p>Each entry is a Markdown file in your Google Drive, sorted into year and month folders. Photos and videos are kept as the original files.</p>' +
    '<div class="path">My Drive › Journal › 2026 › 10 › <i>2026-10-08 1642 Title.md</i><br>My Drive › Journal › Media › 2026 › 10 › <i>your photos and videos</i></div>' +
    (S.rootUrl ? '<p style="margin-top:12px"><a class="btn soft" href="' + esc(S.rootUrl) + '" target="_blank" rel="noopener">' + I.folder + 'Open the Journal folder</a></p>' : '') +
    '<h3>So far</h3><div class="kv">' +
      '<div><b>' + c.entries + '</b><span>entries</span></div><div><b>' + c.dayCount + '</b><span>days written</span></div>' +
      '<div><b>' + c.photos + '</b><span>photos</span></div><div><b>' + c.videos + '</b><span>videos</span></div></div>' +
    '<h3>Automatic titles</h3>' +
    (S.aiTitles
      ? '<p><span class="pill on"><i></i>AI titles on · Claude</span></p><p class="muted">When you leave the title empty, Claude writes one from your entry text. Entries with only photos or videos are named by the time of day.</p>' +
        '<button class="btn ghost" id="btn-key-remove">Remove Claude key</button>'
      : '<p><span class="pill off"><i></i>First-sentence titles</span></p><p class="muted">When you leave the title empty, the first sentence of your entry becomes the title. For titles written by Claude, paste your Claude API key. It is saved in your Journal folder in Google Drive, so your phone and PC both use it.</p>' +
        '<div class="key-row"><label class="sr" for="claude-key">Claude API key</label><input id="claude-key" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">' +
        '<button class="btn primary" id="btn-key-save">Save key</button></div>') +
    (untitled ? '<p style="margin-top:12px"><button class="btn soft" id="btn-titles">' + I.spark + 'Add titles to ' + plural(untitled, 'untitled entry', 'untitled entries') + '</button></p>' : '') +
    (S.aiTitles ? '<h3>Claude credit</h3>' + creditHTML() : '') +
    '<h3>Install</h3>' +
    (standalone ? '<p class="muted">Diari is installed on this device.</p>'
      : (Install.ev ? '<p><button class="btn primary" id="btn-install">Install Diari</button></p><p class="muted">Adds Diari to your home screen and app list. It opens full screen, like any other app.</p>'
        : '<p class="muted">In Chrome, open the ⋮ menu and tap <b>Install app</b> (or <b>Add to Home screen</b>). On a PC, click the install icon at the right of the address bar.</p>')) +

    '<h3>Account</h3><p>' + (Auth.email ? 'Signed in as <b>' + esc(Auth.email) + '</b>' : 'Signed in with Google') + '</p>' +
    '<button class="btn ghost" id="btn-signout">Sign out on this device</button>' +
    '<h3>Videos</h3><p class="muted">Short clips start almost at once. Long videos download first, so they take a moment. If a Samsung phone records in “High efficiency video”, some PC browsers cannot play it; turn that off in Camera settings for the best results.</p>' +
    '<details class="trouble" id="trouble"><summary>Troubleshooting</summary>' +
      '<p class="muted">If an entry is missing from the list (for example after saving on two devices at the same moment), rebuild the list from the entry files in Drive.</p>' +
      '<button class="btn soft" id="btn-rebuild">Rebuild from Drive files</button>' +
      '<p class="muted" style="margin-top:16px">If photos show as black squares, make their previews again from the original photos.</p>' +
      '<button class="btn soft" id="btn-previews">Fix black photo previews</button>' +
      '<pre class="plog" id="photo-log" hidden></pre>' +
      (Copy.supported() ? '<p class="muted" style="margin-top:16px">Videos stop and start on mobile data? Make a smaller 720p copy for smooth playback. The originals stay in your Drive. Best done on Wi-Fi: each original is downloaded once.</p>' +
        '<button class="btn soft" id="btn-copies">' + copyLabel() + '</button><p class="copy-status" id="copy-status">' + esc(copyStatus()) + '</p>' : '') +
      '<p class="muted" style="margin-top:16px">See which photos carry a location from the camera (read from the original photos in your Drive; nothing is changed).</p>' +
      '<button class="btn soft" id="btn-locs">Check photo locations</button><div class="loc-log" id="loc-log" hidden></div>' +
    '</details>' +
    '<p class="muted" style="margin-top:28px;font-size:12px">Diari ' + APP_VERSION + '</p>';

  var bt = $('#btn-titles', box);
  if (bt) bt.onclick = function () {
    var b = this; b.disabled = true; b.textContent = 'Adding titles…';
    API.titleAll().then(function (r) {
      S.entries = normList(r.index.entries); sortEntries(); cacheIndex(); render();
      if (r.note) toast(r.note, 7000);
      else toast('Added ' + plural(r.count, 'title') + (r.left ? '. ' + r.left + ' left; tap again to continue.' : ''), 4500);
      if (r.left) { b.disabled = false; b.innerHTML = I.spark + 'Add titles to ' + plural(r.left, 'untitled entry', 'untitled entries'); }
      else b.remove();
    }).catch(function (err) {
      fail(err);
      b.disabled = false; b.innerHTML = I.spark + 'Add titles to ' + plural(untitled, 'untitled entry', 'untitled entries');
    });
  };
  if (S.aiTitles && API.creditLow() && Date.now() - creditCheckedAt > 60e3) {   // topped up since? (a one-word request)
    creditCheckedAt = Date.now();
    API.checkCredit().then(function (ok) {
      if (!ok) return;
      toast('Your Claude credit is back. Claude writes the titles again.', 5000);
      var c = $('#credit'); if (c) c.outerHTML = creditHTML();
    }).catch(function () {});
  }
  var ks = $('#btn-key-save', box);
  if (ks) ks.onclick = function () {
    var b = this, v = $('#claude-key', box).value.trim();
    if (!/^sk-ant-/.test(v)) { toast('That does not look like a Claude API key. It starts with sk-ant-.'); return; }
    b.disabled = true; b.textContent = 'Checking…';
    API.setClaudeKey(v).then(function (p) { S.aiTitles = p; toast('Claude key saved. AI titles are on.'); openSettings(); })
      .catch(function (err) { fail(err); b.disabled = false; b.textContent = 'Save key'; });
  };
  var kr = $('#btn-key-remove', box);
  if (kr) kr.onclick = function () {
    confirmDlg({ title: 'Remove the Claude key?', text: 'Titles will use the first sentence of each entry instead.', ok: 'Remove', danger: true }).then(function (yes) {
      if (!yes) return;
      API.setClaudeKey('').then(function () { S.aiTitles = ''; toast('Claude key removed'); openSettings(); }).catch(fail);
    });
  };
  var ib = $('#btn-install', box);
  if (ib) ib.onclick = function () { Install.prompt(); };
  $('#btn-rebuild', box).onclick = function () {
    var b = this; b.disabled = true; b.textContent = 'Rebuilding…';
    API.rebuild().then(function (idx) {
      S.entries = normList(idx.entries); sortEntries(); cacheIndex(); render();
      toast('Rebuilt: ' + plural(S.entries.length, 'entry', 'entries'));
    }).catch(fail)
      .then(function () { b.disabled = false; b.textContent = 'Rebuild from Drive files'; });
  };
  $('#btn-previews', box).onclick = function () {
    var b = this; b.disabled = true;
    PhotoLog = [];
    fixPreviews(function (n, total) { b.textContent = 'Checking ' + n + ' of ' + total + '…'; }).then(function (r) {
      var msg = r.fixed ? 'Fixed ' + plural(r.fixed, 'photo preview') + '. Saving to Google Drive…'
        : r.failed ? 'Could not make new previews on this device.' : 'All ' + plural(r.checked, 'photo preview') + ' look fine.';
      if (r.failed && r.fixed) msg += ' ' + r.failed + ' could not be fixed.';
      toast(msg, 6000);
      showPhotoLog();
    }).catch(fail).then(function () { b.disabled = false; b.textContent = 'Fix black photo previews'; });
  };
  var bc = $('#btn-copies', box);
  if (bc) { bc.disabled = !!CopyRun; bc.onclick = startCopies; }
  $('#btn-locs', box).onclick = checkLocations;
  $('#btn-signout', box).onclick = function () {
    confirmDlg({ title: 'Sign out on this device?', text: 'Your journal stays in Google Drive. The copy saved on this device is removed.', ok: 'Sign out', danger: true }).then(function (yes) {
      if (!yes) return;
      Promise.all([API.signOut(), Pend.clear()]).then(function () { location.replace(location.pathname); });
    });
  };
  if (!$('#sheet-settings').classList.contains('open')) openSheet($('#sheet-settings'));
}

function showPhotoLog() {
  var box = $('#photo-log'); if (!box) return;
  var log = PhotoLog.length ? PhotoLog : (lsGet('diari-photolog') || []);
  if (!log.length) { box.hidden = true; return; }
  var gl = '';
  try { var g = document.createElement('canvas').getContext('webgl'); gl = g ? g.getParameter(g.MAX_TEXTURE_SIZE) : 'none'; } catch (e) { gl = '?'; }
  box.textContent = 'Diari ' + APP_VERSION + ' · graphics limit ' + gl + ' px\n' + log.slice(-8).map(function (x) {
    return (x.name || 'photo') + ' · ' + x.type + ' · ' + (x.size || '?') + ' · ' + x.mb + ' MB → ' + x.result + (x.steps.length ? ' (' + x.steps.join(', ') + ')' : '');
  }).join('\n');
  box.hidden = false;
}

/* "Make videos play smoothly": one run at a time; the button and the line under it show how far it is. */
var CopyRun = null;          // { total, n, made, failed, err } while copies are being made from Settings
function copyLabel() {
  if (CopyRun) return 'Video ' + Math.min(CopyRun.n + 1, CopyRun.total) + ' of ' + CopyRun.total + ' · ' + (Copies.busy ? (Copies.prog > 0 ? Math.round(Copies.prog * 100) + '%' : 'downloading…') : 'starting…');
  var need = videosNeedingCopy().length;
  return 'Make videos play smoothly' + (need ? ' (' + need + ')' : '');
}
function copyStatus() {
  if (CopyRun) return 'Working on it. Keep Diari open until it finishes.';
  var need = videosNeedingCopy().length, last = CopyLog.last();
  if (!need) return S.entries.some(function (e) { return e.media.some(function (m) { return m.type === 'video'; }); }) ? 'Done. All videos are ready to play smoothly.' : '';
  var s = plural(need, 'video') + (need === 1 ? ' does' : ' do') + ' not have a smooth copy yet.';
  if (last && !last.ok) s += ' Last try: ' + last.err;
  return s;
}
function paintCopyUI() {
  var b = $('#btn-copies'), st = $('#copy-status');
  if (b) { b.textContent = copyLabel(); b.disabled = !!CopyRun; }
  if (st) st.textContent = copyStatus();
}
function startCopies() {
  if (CopyRun) return;
  var todo = videosNeedingCopy().filter(function (t) { return !Copies.queued(t.m.id); });
  if (!todo.length) {
    if (!Copies.idle()) { toast('Already making the smooth copy. Keep Diari open until it finishes.'); return; }
    toast('Checking…');
    tidyCopies().then(function (r) {
      toast('All videos already play smoothly.' + (r.removed ? ' Moved ' + plural(r.removed, 'extra copy', 'extra copies') + ' to the trash.' : ''), 6000);
    }, fail);
    return;
  }
  var run = CopyRun = { total: todo.length, n: 0, made: 0, failed: 0, err: '' };
  todo.forEach(function (t) {
    Copies.add({ entryId: t.e.id, mediaId: t.m.id, name: t.e.date.slice(0, 10) + ' ' + (t.m.name || 'video'), date: t.e.date, fromFix: true,
      onProg: paintCopyUI,
      done: function (job) {
        run.n++; if (job.ok) run.made++; else { run.failed++; run.err = job.err; }
        if (run.n < run.total) { paintCopyUI(); return; }
        CopyRun = null; paintCopyUI();
        var msg = run.made ? 'Made ' + plural(run.made, 'smooth copy', 'smooth copies') + (run.failed ? '. ' + run.failed + ' could not be made: ' + run.err : '.')
          : 'Could not make the copies: ' + (run.err || 'unknown problem');
        tidyCopies().then(function (r) {
          toast(msg + (r.removed ? ' Moved ' + plural(r.removed, 'extra copy', 'extra copies') + ' to the trash.' : ''), 7000);
          paintCopyUI();
        }, function () { toast(msg, 7000); });
      } });
  });
  paintCopyUI();
}

/* ---------- Photo locations: read the GPS tag a camera writes into a photo (EXIF), if it is still there ---------- */
function exifGps(buf) {
  var v = new DataView(buf), n = v.byteLength;
  if (n < 4 || v.getUint16(0) !== 0xFFD8) return { kind: 'other' };
  var p = 2;
  while (p + 4 <= n) {
    if (v.getUint8(p) !== 0xFF) break;
    var mk = v.getUint8(p + 1);
    if (mk === 0xD9 || mk === 0xDA) break;
    var len = v.getUint16(p + 2);
    if (mk === 0xE1 && p + 10 <= n && v.getUint32(p + 4) === 0x45786966 && v.getUint16(p + 8) === 0) {
      try { return { kind: 'jpeg', gps: tiffGps(v, p + 10, Math.min(n, p + 2 + len)) }; } catch (e) { return { kind: 'jpeg', gps: null }; }
    }
    p += 2 + len;
  }
  return { kind: 'jpeg', gps: null };
}
function tiffGps(v, t, end) {
  var le = v.getUint16(t) === 0x4949;
  var ok = function (o, k) { return t + o + k <= end; };
  var u16 = function (o) { if (!ok(o, 2)) throw 0; return v.getUint16(t + o, le); };
  var u32 = function (o) { if (!ok(o, 4)) throw 0; return v.getUint32(t + o, le); };
  var ifd = u32(4), gpsAt = 0, cnt = u16(ifd);
  for (var i = 0; i < cnt && i < 200; i++) { var e = ifd + 2 + i * 12; if (u16(e) === 0x8825) { gpsAt = u32(e + 8); break; } }
  if (!gpsAt) return null;
  var g = {}, gc = u16(gpsAt);
  for (var k = 0; k < gc && k < 64; k++) {
    var ge = gpsAt + 2 + k * 12, tag = u16(ge), type = u16(ge + 2), count = u32(ge + 4);
    if (tag === 1 || tag === 3) g[tag] = String.fromCharCode(v.getUint8(t + ge + 8));
    if ((tag === 2 || tag === 4) && type === 5 && count === 3) {
      var o = u32(ge + 8), x = 0;
      for (var q = 0; q < 3; q++) { var num = u32(o + q * 8), den = u32(o + q * 8 + 4); x += (den ? num / den : 0) / Math.pow(60, q); }
      g[tag] = x;
    }
  }
  if (g[2] == null || g[4] == null || (!g[2] && !g[4])) return null;       // 0,0 means it was wiped
  return { lat: g[2] * (g[1] === 'S' ? -1 : 1), lng: g[4] * (g[3] === 'W' ? -1 : 1) };
}
function checkLocations() {
  var b = this, log = $('#loc-log');
  var list = [];
  S.entries.forEach(function (e) { e.media.forEach(function (m) { if (m.type === 'photo') list.push({ e: e, m: m }); }); });
  if (!list.length) { toast('No photos in your journal yet.'); return; }
  b.disabled = true;
  var done = 0, out = new Array(list.length), i = 0;
  function one(x) {
    var heic = /hei[cf]/i.test(x.m.mime || '') || /\.hei[cf]$/i.test(x.m.name || '');
    if (heic) return Promise.resolve({ st: 'heic' });
    return API.readStart(x.m.id, 131072).then(function (buf) {
      var r = exifGps(buf);
      return r.kind !== 'jpeg' ? { st: 'none' } : r.gps ? { st: 'gps', gps: r.gps } : { st: 'none' };
    }, function (err) { if (err && err.expired) throw err; return { st: 'err' }; });
  }
  function worker() {
    if (i >= list.length) return Promise.resolve();
    var k = i++;
    return one(list[k]).then(function (r) { out[k] = r; done++; b.textContent = 'Checking ' + done + ' of ' + list.length + '…'; }).then(worker);
  }
  Promise.all([worker(), worker(), worker(), worker()]).then(function () {
    var have = out.filter(function (r) { return r.st === 'gps'; }).length;
    var heic = out.filter(function (r) { return r.st === 'heic'; }).length;
    var rows = list.map(function (x, k) {
      var r = out[k], where = r.st === 'gps' ? '<a href="https://www.google.com/maps?q=' + r.gps.lat.toFixed(5) + ',' + r.gps.lng.toFixed(5) + '" target="_blank" rel="noopener">' + r.gps.lat.toFixed(4) + ', ' + r.gps.lng.toFixed(4) + '</a>'
        : r.st === 'heic' ? 'HEIC photo: not checked' : r.st === 'err' ? 'could not be read' : 'no location';
      return '<li><b>' + esc(fmtDayMonth(x.e.date)) + '</b> · ' + esc(x.e.title || x.m.name || 'Photo') + '<br><span>' + where + '</span></li>';
    });
    log.innerHTML = '<p><b>' + have + ' of ' + plural(list.length, 'photo') + '</b> ' + (have === 1 ? 'has' : 'have') + ' a location.' +
      (heic ? ' ' + heic + ' HEIC ' + (heic === 1 ? 'photo was' : 'photos were') + ' not checked.' : '') +
      (have < list.length - heic ? ' A photo has no location when the camera\'s location setting was off, or when the phone removed it while sharing the photo.' : '') + '</p><ul>' + rows.join('') + '</ul>';
    log.hidden = false;
  }).catch(fail).then(function () { b.disabled = false; b.textContent = 'Check photo locations'; });
}

function videosNeedingCopy() {
  var out = [];
  S.entries.forEach(function (e) { if (!e.pending) e.media.forEach(function (m) { if (Copy.needed(m)) out.push({ e: e, m: m }); }); });
  return out;
}

/* Remaking photo previews that came out black (made before the fix in October 2026). */
function isBlack(blob) {
  return createImageBitmap(blob, { resizeWidth: 16, resizeHeight: 16 }).then(function (bm) {
    var k = canvas2d(16, 16), x = k.x;
    x.drawImage(bm, 0, 0); if (bm.close) bm.close();
    var d = x.getImageData(0, 0, 16, 16).data, top = 0;
    for (var i = 0; i < d.length; i += 4) top = Math.max(top, d[i], d[i + 1], d[i + 2]);
    return top < 10;
  }).catch(function () { return false; });
}

function fixPreviews(onProg) {
  var todo = [];
  S.entries.forEach(function (e) {
    if (e.pending) return;
    e.media.forEach(function (m, k) { if (m.type === 'photo') todo.push({ e: e, k: k }); });
  });
  var changed = {}, old = [], n = 0, fixed = 0, failed = 0, chain = Promise.resolve();
  todo.forEach(function (t) {
    chain = chain.then(function () {
      n++; if (onProg) onProg(n, todo.length);
      var m = t.e.media[t.k];
      var bad = m.thumb ? API.blob(m.thumb).then(isBlack, function (err) { if (err.expired) throw err; return true; }) : Promise.resolve(true);
      return bad.then(function (isBad) {
        if (!isBad) return;
        return API.blob(m.id).then(function (b) { b.name = m.name; return photoInfo(b); }).then(function (info) {
          if (!info.thumb) { failed++; return; }             // can't read this photo here; it shows the original instead
          return API.target(t.e.date).then(function (tgt) {
            var base = t.e.date.slice(0, 10) + ' ' + (m.name || 'photo.jpg');
            return Promise.all([
              API.upload(info.thumb, { name: base + '.thumb.jpg', folderId: tgt.previewId, mime: 'image/jpeg' }),
              info.preview ? API.upload(info.preview, { name: base + '.preview.jpg', folderId: tgt.previewId, mime: 'image/jpeg' }) : ''
            ]);
          }).then(function (ids) {
            var e = changed[t.e.id] || (changed[t.e.id] = Object.assign({}, t.e, { media: t.e.media.slice() }));
            old.push({ id: '', thumb: m.thumb || '', preview: m.preview || '' });
            e.media[t.k] = Object.assign({}, m, { thumb: ids[0], preview: ids[1] || '', w: info.w || m.w, h: info.h || m.h });
            fixed++;
          });
        });
      });
    });
  });
  return chain.then(function () {
    Object.keys(changed).forEach(function (id) {
      var e = changed[id];
      var rec = { id: e.id, date: e.date, title: e.title, titleAuto: e.titleAuto, body: e.body, tags: e.tags.slice(), media: e.media.map(pickMedia) };
      upsert(Object.assign(shownRec(rec), { title: e.title, autoTitle: false }));
      Outbox.add(rec);
    });
    if (old.length) API.discard(old).catch(function () {});
    render();
    return { fixed: fixed, failed: failed, checked: todo.length };
  });
}

// "Install app" prompt from Chrome, kept until the person asks for it.
var Install = {
  ev: null,
  prompt: function () {
    if (!Install.ev) return;
    Install.ev.prompt();
    Install.ev.userChoice.then(function () { Install.ev = null; render(); if ($('#sheet-settings').classList.contains('open')) openSettings(); });
  }
};
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); Install.ev = e; render(); });
window.addEventListener('appinstalled', function () { Install.ev = null; render(); toast('Diari is installed'); });

$('#sheet-settings').addEventListener('click', function (ev) { if (ev.target.closest('[data-act="close"]')) Nav.pop(); });

/* ================================================================ */
/* Editor                                                           */
/* ================================================================ */
var edSheet = $('#sheet-editor');
var ED = null;

/* Photos and videos go up three at a time. Their previews are made one at a time (a big photo needs a lot
   of the phone's memory), and each upload is started in Google Drive as soon as it is added, so a long
   batch keeps going even after the Google sign-in runs out. */
var UpQ = {
  list: [], active: 0, later: 0, MAX: 3,
  add: function (m) { if (this.list.indexOf(m) < 0) this.list.push(m); this.pump(); Awake.check(); },
  busy: function () { return this.active > 0 || this.list.length > 0 || this.later > 0; },
  pump: function () {
    var self = this;
    while (this.active < this.MAX && this.list.length) {
      var m = this.list.shift();
      this.active++;
      processUpload(m).catch(function () {}).then(function () {
        self.active--; self.pump();
        if (!self.busy()) { Outbox.run(); Copies.run(); Awake.check(); }
      });
    }
  },
  /** The connection dropped: try this one again in a while. */
  retryLater: function (m, ms) {
    var self = this; this.later++;
    setTimeout(function () { API.whenOnline().then(function () { self.later--; self.add(m); }); }, ms);
  }
};
window.addEventListener('offline', function () { if (UpQ.busy()) toast('No connection. Uploads carry on when you are back online.', 5000); });

/* Keeps the screen on while photos and videos upload or a video copy is made: with the screen off,
   the phone pauses Diari and nothing moves. */
var Awake = {
  lock: null, asking: false,
  want: function () { return UpQ.busy() || Copies.busy; },
  check: function () {
    var self = this;
    if (!this.want()) { if (this.lock) { var l = this.lock; this.lock = null; l.release().catch(function () {}); } return; }
    if (this.lock || this.asking || document.hidden || !navigator.wakeLock) return;
    this.asking = true;
    navigator.wakeLock.request('screen').then(function (l) {
      self.asking = false; self.lock = l;
      l.addEventListener('release', function () { if (self.lock === l) self.lock = null; });
      if (!self.want()) self.check();
    }, function () { self.asking = false; });
  }
};
document.addEventListener('visibilitychange', function () { if (!document.hidden) Awake.check(); });

/* Photos and videos not yet in Google Drive are kept on this device (in the browser's storage) until
   they are. If Diari is closed, or the phone stops it, they carry on the next time it opens. */
var Pend = (function () {
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('diari-uploads', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('u', { keyPath: 'key' }); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = r.onblocked = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  /** Runs fn(store) in one transaction; resolves with what fn returns (an IDBRequest's result), or null if it failed. */
  function run(mode, fn) {
    return db().then(function (d) {
      if (!d) return null;
      return new Promise(function (res) {
        try {
          var t = d.transaction('u', mode), q = fn(t.objectStore('u'));
          t.oncomplete = function () { res(q && 'result' in q ? q.result : true); };
          t.onerror = t.onabort = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); res(null); };
        } catch (e) { res(null); }
      });
    });
  }
  return {
    keep: function (m, ed) {
      return run('readwrite', function (st) {
        return st.put({ key: m.key, edId: ed.id, saved: false, type: m.type, name: m.name, mime: m.mime, size: m.size, fp: m.fp || '',
          date: edDate(ed), file: m.file, sess: null, got: {}, fails: 0, at: Date.now() });
      });
    },
    patch: function (key, fields) {
      return run('readwrite', function (st) {
        var g = st.get(key);
        g.onsuccess = function () { if (g.result) st.put(Object.assign(g.result, fields)); };
        return null;
      });
    },
    drop: function (key) { return run('readwrite', function (st) { return st.delete(key); }); },
    all: function () { return run('readonly', function (st) { return st.getAll(); }).then(function (l) { return l || []; }); },
    clear: function () { return run('readwrite', function (st) { return st.clear(); }); }
  };
})();

/** A kept upload, ready to carry on. */
function fromKept(r, ed) {
  return { key: r.key, type: r.type, name: r.name, mime: r.mime, size: r.size, fp: r.fp, file: r.file, pos: r.pos,
    sess: r.sess ? Promise.resolve(r.sess) : null, got: Object.assign({}, r.got || {}), fails: r.fails || 0,
    status: 'queued', prog: 0, isNew: true, ed: ed, kept: true };
}

/** At start: uploads of saved entries that did not finish carry on. Resolves with how many, per entry. */
function resumeUploads() {
  return Pend.all().then(function (list) {
    var draft = lsGet('diari-draft'), eds = {}, n = 0, per = {};
    list.sort(function (a, b) { return (a.pos || 0) - (b.pos || 0) || a.at - b.at; }).forEach(function (r) {
      if (!r.file || Date.now() - r.at > 14 * 864e5) { Pend.drop(r.key); return; }
      if (!r.saved) { if (!draft || draft.id !== r.edId) Pend.drop(r.key); return; }      // the unsaved entry it belonged to is gone
      var e = byId(r.entryId);
      if (!e) { Pend.drop(r.key); return; }                                             // the entry was deleted
      if (e.media.some(function (x) { return x.fp && x.fp === r.fp; })) { Pend.drop(r.key); return; }   // it made it after all
      var ed = eds[r.entryId] || (eds[r.entryId] = { id: r.entryId, saved: true, savedDate: r.savedDate || e.date, media: [], resumed: true });
      var m = fromKept(r, ed);
      ed.media.push(m); Uploads.add(ed.id, m); UpQ.add(m);
      n++; per[ed.id] = (per[ed.id] || 0) + 1;
    });
    if (n) toast('Carrying on with ' + plural(n, 'photo or video', 'photos and videos') + ' that had not finished uploading.', 5000);
    return per;
  });
}

/** Opening the unsaved entry again: its photos and videos that were still uploading come back and carry on. */
function restoreKept(ed) {
  Pend.all().then(function (list) {
    if (ED !== ed) return;
    var add = list.filter(function (r) {
      if (r.saved || r.edId !== ed.id || !r.file) return false;
      if (ed.media.some(function (m) { return m.fp && m.fp === r.fp && m.status === 'done'; })) { Pend.drop(r.key); return false; }   // it made it after all
      return !ed.media.some(function (m) { return m.key === r.key; });
    });
    if (!add.length) return;
    add.sort(function (a, b) { return a.at - b.at; }).forEach(function (r) { var m = fromKept(r, ed); ed.media.push(m); UpQ.add(m); });
    renderTray(); updateSave();
  });
}

/** At most four uploads are started in Google Drive at the same time. */
var Gate = {
  n: 0, q: [], MAX: 4,
  run: function (fn) {
    var self = this;
    return new Promise(function (res, rej) {
      self.q.push(function () { self.n++; Promise.resolve().then(fn).then(res, rej).then(function () { self.n--; self.next(); }); });
      self.next();
    });
  },
  next: function () { while (this.n < this.MAX && this.q.length) this.q.shift()(); }
};

/** Starts the uploads for one photo or video (the original and its two previews). */
function startSessions(m) {
  var p = Gate.run(function () {
    if (gone(m)) return Promise.reject(new Error('removed'));
    var date = edDate(m.ed), name = date.slice(0, 10) + ' ' + m.name;
    return API.target(date).then(function (tgt) {
      return Promise.all([
        API.startUpload({ name: name, folderId: tgt.folderId, mime: m.mime || (m.file && m.file.type) || '' }, m.size),
        API.startUpload({ name: name + '.thumb.jpg', folderId: tgt.previewId, mime: 'image/jpeg' }),
        API.startUpload({ name: name + '.preview.jpg', folderId: tgt.previewId, mime: 'image/jpeg' })
      ]);
    }).then(function (l) { return { orig: l[0], thumb: l[1], preview: l[2] }; });
  });
  p.then(function (s) { Pend.patch(m.key, { sess: s }); }, function () { if (m.sess === p) m.sess = null; });   // a failed start: the next try starts again
  return p;
}

/** Resolves with p, or with fallback if p takes longer than ms. */
function within(p, ms, fallback) {
  return new Promise(function (res) {
    var t = setTimeout(function () { res(fallback); }, ms);
    p.then(function (v) { clearTimeout(t); res(v); }, function () { clearTimeout(t); res(fallback); });
  });
}

var prepLock = Promise.resolve();
/** Size and previews, made once per photo or video and one at a time. */
function prepOnce(m) {
  if (m.info) return Promise.resolve(m.info);
  var p = prepLock.then(function () {
    if (m.info) return m.info;
    if (gone(m)) return {};
    // A photo that cannot be read in time is saved without previews (the original is shown instead).
    return within(m.type === 'video' ? videoInfo(m.file) : photoInfo(m.file), 45e3, {});
  }).then(function (v) { m.info = v; return v; });
  prepLock = p.catch(function () {});
  return p;
}

/** Removed from the entry, or the entry was closed without saving. */
function gone(m) { var ed = m.ed; return !ed || m.cancelled || ed.media.indexOf(m) < 0 || (ED !== ed && !ed.saved); }
function discardGot(m) {
  var g = m.got || {};
  if (g.id || g.thumb || g.preview) API.discard([{ id: g.id || '', thumb: g.thumb || '', preview: g.preview || '' }]).catch(function () {});
  m.got = {};
}

function edSnapshot() {
  return JSON.stringify({ d: $('#ed-date').value, t: $('#ed-title').value, b: $('#ed-body').value, g: ED.tags, m: ED.media.map(function (m) { return m.key; }) });
}

function openEditor(id, presetDay) {
  var ex = id ? byId(id) : null;
  var now = new Date();
  var date = ex ? ex.date : (presetDay ? presetDay + 'T' + pad(now.getHours()) + ':' + pad(now.getMinutes()) : localStr(now));
  ED = {
    id: ex ? ex.id : date.replace(/[-T:]/g, '').slice(0, 12) + '-' + rid(4),
    isNew: !ex, force: false,
    tags: ex ? ex.tags.slice() : [],
    media: ex ? ex.media.map(function (m) { return Object.assign({}, m, { key: rid(8), status: 'done', prog: 1 }); }) : []
  };
  $('#ed-heading').textContent = ex ? 'Edit entry' : 'New entry';
  $('#ed-date').value = date;
  $('#ed-title').value = ex && !ex.autoTitle ? ex.title : '';
  // A title Claude wrote (or one from before Diari kept track) is rewritten when the text changes.
  ED.origTitle = ex && !ex.autoTitle ? ex.title : '';
  ED.titleAuto = !!ED.origTitle && ex.titleAuto !== false;
  ED.suggested = '';
  ED.baseBody = ex ? ex.body.replace(/\s+$/, '') : '';
  ED.baseMedia = ex ? ex.media.map(function (m) { return m.id; }).join(',') : '';
  $('#ed-body').value = ex ? ex.body : '';
  ED.base = edSnapshot();                // what "no changes" looks like

  var draft = lsGet('diari-draft');
  if (draft && draft.for === (ex ? ex.id : 'new') && Date.now() - draft.at < 14 * 864e5) {
    if (!ex) ED.id = draft.id || ED.id;
    $('#ed-date').value = presetDay && !ex ? presetDay + (draft.date || date).slice(10) : (draft.date || date); $('#ed-title').value = draft.title || ''; $('#ed-body').value = draft.body || '';
    ED.tags = draft.tags || ED.tags;
    ED.media = (draft.media || []).map(function (m) { return Object.assign({}, m, { key: rid(8), status: 'done', prog: 1, isNew: !!m.isNew }); });
    setTimeout(function () { toast('Restored your unsaved changes'); }, 350);
  }
  toggleCal(false); BodySel = null; paintTitleHint();
  renderTray(); renderTags(); updateHint(); updateSave(); autoGrow();
  restoreKept(ED);
  openSheet(edSheet);
  Nav.stack.pop();                       // replace the plain close with the "unsaved changes" check
  Nav.stack.push(editorBack);
  // Focus the text straight away, while the tap still counts as a tap, so Android opens the keyboard
  // (and voice tools like Wispr Flow show their button) without a second tap.
  if (!ex) {
    try { $('#ed-body').focus({ preventScroll: true }); } catch (e) {}
    setTimeout(function () { if (document.activeElement !== $('#ed-body')) $('#ed-body').focus(); }, 320);
  }
}

function edDirty() { return ED && (edSnapshot() !== ED.base || ED.media.some(function (m) { return m.status !== 'done'; })); }

function editorBack() {
  if (!ED) return;
  if (ED.force || !edDirty()) { closeEditor(); return; }
  Nav.push(editorBack);
  confirmDlg({ title: 'Discard changes?', text: 'What you wrote and any photos or videos added just now will be removed.', ok: 'Discard', cancel: 'Keep editing', danger: true })
    .then(function (yes) {
      if (!yes) return;
      var fresh = ED.media.filter(function (m) { return m.isNew; });
      fresh.forEach(function (m) { m.cancelled = true; Pend.drop(m.key); });
      var done = fresh.filter(function (m) { return m.status === 'done'; }).map(pickIds);
      API.discard(done).catch(function () {});
      lsDel('diari-draft');
      ED.force = true; Nav.pop();
    });
}

function closeEditor() {
  edSheet.classList.remove('open'); lockScroll();
  $('#ed-title').blur(); $('#ed-body').blur();
  ED = null;
}

function pickIds(m) { return { id: m.id, thumb: m.thumb || '', preview: m.preview || '', play: m.play || '' }; }
function pickMedia(m) { return { id: m.id, type: m.type, name: m.name, mime: m.mime, size: m.size, w: m.w || 0, h: m.h || 0, dur: m.dur || 0, thumb: m.thumb || '', preview: m.preview || '', play: m.play || '', fp: m.fp || '' }; }

function saveDraft() {
  if (!ED) return;
  if (!edDirty()) { lsDel('diari-draft'); return; }
  lsSet('diari-draft', {
    for: ED.isNew ? 'new' : ED.id, id: ED.id, at: Date.now(),
    date: $('#ed-date').value, title: $('#ed-title').value, body: $('#ed-body').value, tags: ED.tags,
    media: ED.media.filter(function (m) { return m.status === 'done'; }).map(function (m) { var o = pickMedia(m); o.isNew = !!m.isNew; return o; })
  });
}
var draftTimer;
function queueDraft() { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 600); }

/* ---------- Date and time of an entry: Diari's own picker, so a tap on a day is all it takes (no "Set") ---------- */
var EdCal = { y: 0, m: 0 };
function whenValue() { return $('#ed-date').value || localStr(new Date()); }
function setWhen(v) { $('#ed-date').value = v; updateHint(); queueDraft(); }
function paintWhen() {
  var v = whenValue(), d = parseD(v);
  $('#ed-day').textContent = DOW[d.getDay()].slice(0, 3) + ' ' + d.getDate() + ' ' + MON[d.getMonth()].slice(0, 3) + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  if (document.activeElement !== $('#ed-time')) $('#ed-time').value = v.slice(11, 16);
  if (!$('#ed-cal').hidden) paintCal();
}
function dayStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function shiftDay(n) {
  var v = whenValue(), d = parseD(v.slice(0, 10));
  d.setDate(d.getDate() + n);
  setWhen(dayStr(d) + 'T' + v.slice(11, 16));
}
function paintCal() {
  var sel = whenValue().slice(0, 10), today = todayKey();
  var first = new Date(EdCal.y, EdCal.m, 1), lead = (first.getDay() + 6) % 7, days = new Date(EdCal.y, EdCal.m + 1, 0).getDate();
  var h = '<div class="dcal-head"><button type="button" class="icon-btn" data-cmon="-1" aria-label="Previous month">' + I.chevL + '</button>' +
    '<b>' + MON[EdCal.m] + ' ' + EdCal.y + '</b><button type="button" class="icon-btn" data-cmon="1" aria-label="Next month">' + I.chevR + '</button></div>' +
    '<div class="dcal-quick"><button type="button" data-dquick="0">Today</button><button type="button" data-dquick="-1">Yesterday</button></div>' +
    '<div class="dcal-grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (w) { return '<span>' + w.toUpperCase() + '</span>'; }).join('');
  for (var i = 0; i < lead; i++) h += '<i></i>';
  for (var n = 1; n <= days; n++) {
    var k = EdCal.y + '-' + pad(EdCal.m + 1) + '-' + pad(n);
    h += '<button type="button" data-dday="' + k + '" class="' + (k === sel ? 'sel' : '') + (k === today ? ' today' : '') + '" aria-label="' + fmtLong(k) + '"' + (k === sel ? ' aria-pressed="true"' : '') + '>' + n + '</button>';
  }
  $('#ed-cal').innerHTML = h + '</div>';
}
function toggleCal(open) {
  var cal = $('#ed-cal');
  if (open == null) open = cal.hidden;
  if (open) { var d = parseD(whenValue()); EdCal.y = d.getFullYear(); EdCal.m = d.getMonth(); paintCal(); }
  cal.hidden = !open;
  $('#ed-day').setAttribute('aria-expanded', open ? 'true' : 'false');
}
// After the date is picked, go straight back to the text, cursor where it was (or at the end), keyboard up.
var BodySel = null;
$('#ed-body').addEventListener('blur', function () { BodySel = [this.selectionStart, this.selectionEnd]; });
function backToText() {
  var t = $('#ed-body');
  if (!ED || !t) return;
  if (document.activeElement === t) { requestAnimationFrame(function () { showCaret(t); }); return; }   // still typing: leave the cursor be
  try {
    t.focus({ preventScroll: true });
    var n = t.value.length, s = BodySel && BodySel[1] <= n ? BodySel : [n, n];
    t.setSelectionRange(s[0], s[1]);
  } catch (e) {}
  requestAnimationFrame(function () { showCaret(t); });
}
(function () {
  $$('.when-step').forEach(function (b) { b.innerHTML = b.getAttribute('data-dstep') === '-1' ? I.chevL : I.chevR; });
  // The ‹ › buttons don't take the focus, so the keyboard stays up while stepping through days.
  $$('.when-step').forEach(function (b) { b.addEventListener('mousedown', function (ev) { ev.preventDefault(); }); });
  $('.ed-meta').addEventListener('click', function (ev) {
    var t = ev.target, x;
    if ((x = t.closest('[data-dstep]'))) { shiftDay(+x.getAttribute('data-dstep')); backToText(); return; }
    if (t.closest('#ed-day')) { toggleCal(); return; }
    if ((x = t.closest('[data-cmon]'))) { EdCal.m += +x.getAttribute('data-cmon'); if (EdCal.m < 0) { EdCal.m = 11; EdCal.y--; } if (EdCal.m > 11) { EdCal.m = 0; EdCal.y++; } paintCal(); return; }
    if ((x = t.closest('[data-dquick]'))) { var d = new Date(); d.setDate(d.getDate() + +x.getAttribute('data-dquick')); setWhen(dayStr(d) + 'T' + whenValue().slice(11, 16)); toggleCal(false); backToText(); return; }
    if ((x = t.closest('[data-dday]'))) { setWhen(x.getAttribute('data-dday') + 'T' + whenValue().slice(11, 16)); toggleCal(false); backToText(); return; }
  });
  $('#ed-time').addEventListener('change', function () { if (/^\d{2}:\d{2}/.test(this.value)) { setWhen(whenValue().slice(0, 10) + 'T' + this.value.slice(0, 5)); backToText(); } });
})();

function updateHint() {
  paintWhen();
  var d = $('#ed-date').value || localStr(new Date());
  $('#ed-hint').textContent = LIVE ? 'Saves to Google Drive › Journal › ' + d.slice(0, 4) + ' › ' + d.slice(5, 7) : 'Preview only. Entries here are not saved anywhere.';
}

function updateSave() {
  if (!ED) return;
  var b = $('#ed-save');
  if (b.getAttribute('data-saving')) return;
  b.disabled = false;
  b.textContent = 'Save';
}

function autoGrow() {
  // Measuring briefly shrinks the text box; keep the scroll position so the text doesn't jump behind the keyboard.
  var t = $('#ed-body'), sb = t.closest('.sheet-body'), st = sb ? sb.scrollTop : 0;
  t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 200) + 'px';
  if (sb) sb.scrollTop = st;
}

/* ---------- The on-screen keyboard ----------
   Sheets (like the editor) are sized to the part of the screen the keyboard leaves free, so the end of the text
   can always be scrolled into view. After the phone is locked and unlocked, Android can bring the keyboard back
   without making room for it, so on leaving Diari the keyboard is put away, and on return the cursor comes back. */
function fitViewport() {
  var vv = window.visualViewport, de = document.documentElement;
  if (!vv || Math.abs(vv.scale - 1) > 0.01) { de.style.removeProperty('--vvh'); de.style.removeProperty('--vvt'); return; }
  de.style.setProperty('--vvh', Math.round(vv.height) + 'px');
  de.style.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
}
// Where the cursor sits inside a text box, measured with an invisible copy of it.
function caretY(t) {
  var cs = getComputedStyle(t), m = document.createElement('div');
  ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'paddingTop', 'paddingLeft', 'paddingRight', 'tabSize'].forEach(function (k) { m.style[k] = cs[k]; });
  m.style.cssText += ';position:absolute;visibility:hidden;left:-9999px;top:0;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:content-box';
  m.style.width = (t.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) + 'px';
  m.textContent = t.value.slice(0, t.selectionEnd == null ? t.value.length : t.selectionEnd);
  var mark = document.createElement('span'); mark.textContent = '\u200b'; m.appendChild(mark);
  document.body.appendChild(m);
  var y = mark.offsetTop + mark.offsetHeight;
  m.remove();
  return y;
}
// Scrolls the sheet so the cursor (or the field) is above the keyboard.
function showCaret(el) {
  var sb = el && el.closest && el.closest('.sheet-body');
  if (!sb) return;
  var top = el.getBoundingClientRect().top - sb.getBoundingClientRect().top + sb.scrollTop;
  var y = top + (el.tagName === 'TEXTAREA' ? caretY(el) : el.offsetHeight);
  var view = sb.clientHeight;
  if (y > sb.scrollTop + view - 40) sb.scrollTop = y - view + 96;
  else if (y < sb.scrollTop + 40) sb.scrollTop = Math.max(0, y - 120);
}
function editingField() {
  var a = document.activeElement;
  return ED && a && edSheet.contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search)$/.test(a.type || 'text'))) ? a : null;
}
if (window.visualViewport) {
  visualViewport.addEventListener('resize', function () {
    fitViewport();
    var f = editingField(); if (f) requestAnimationFrame(function () { showCaret(f); });
  });
  visualViewport.addEventListener('scroll', fitViewport);
}
window.addEventListener('resize', fitViewport);
fitViewport();

var Resume = null;
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    var f = editingField();
    if (f) { Resume = { el: f, start: f.selectionStart, end: f.selectionEnd }; saveDraft(); f.blur(); }
    return;
  }
  fitViewport();
  var r = Resume; Resume = null;
  if (!r || !ED || !edSheet.contains(r.el)) return;
  showCaret(r.el);
  setTimeout(function () {
    if (!ED || document.hidden || !edSheet.contains(r.el)) return;
    try { r.el.focus({ preventScroll: true }); r.el.setSelectionRange(r.start, r.end); } catch (e) {}
    fitViewport(); showCaret(r.el);
  }, 350);
});

function tileHTML(m) {
  var img = m.localThumb ? '<img alt="" loading="lazy" decoding="async" src="' + esc(m.localThumb) + '">' : (m.thumb ? '<img alt="" class="mimg" data-mid="' + esc(m.thumb) + '">' : '<span class="ph-icon">' + I.image + '</span>');
  var bar = /^(queued|prep|uploading|wait)$/.test(m.status) ? '<span class="bar"><i style="width:' + Math.round((m.prog || 0) * 100) + '%"></i></span>' : '';
  var note = m.status === 'queued' ? '<span class="tnote">Waiting</span>' : m.status === 'wait' ? '<span class="tnote">Retrying…</span>' : '';
  if (note) bar += note;
  var err = m.status === 'error' ? '<button class="retry" data-retry="' + m.key + '">Upload failed. Tap to retry</button>' : '';
  var badge = m.type === 'video' && m.status === 'done' ? '<span class="badge">' + I.play + fmtDur(m.dur) + '</span>' : '';
  return '<div class="tile ' + (m.status || 'done') + '" data-key="' + m.key + '">' + img + bar + badge + err +
    '<button class="rm" data-rm="' + m.key + '" aria-label="Remove ' + (m.type === 'video' ? 'video' : 'photo') + '">' + I.x + '</button></div>';
}

function renderTray() {
  var tray = $('#ed-tray');
  tray.innerHTML = ED.media.map(tileHTML).join('') +
    '<button class="add-tile" data-add>' + I.addMedia + '<span>Photos &amp; videos</span></button>';
  observeImgs(tray);
}
function renderTile(m) {
  if (!ED || ED.media.indexOf(m) < 0) return;
  var t = $('.tile[data-key="' + m.key + '"]');
  if (t) { var n = el(tileHTML(m)); t.replaceWith(n); observeImgs(n); }
}
function setProg(m, f) {
  m.prog = f;
  var t = $('.tile[data-key="' + m.key + '"] .bar i');
  if (t) t.style.width = Math.round(f * 100) + '%';
}

function renderTags() {
  var box = $('#ed-tags'), input = $('#ed-tag-in');
  $$('.chip', box).forEach(function (c) { c.remove(); });
  ED.tags.forEach(function (t, i) {
    box.insertBefore(el('<button class="chip" data-untag="' + i + '" aria-label="Remove tag ' + esc(t) + '">#' + esc(t) + I.x + '</button>'), input);
  });
}
function addTag(raw) {
  raw.split(',').forEach(function (p) {
    var t = p.replace(/^#+/, '').trim().slice(0, 40);
    if (t && !ED.tags.some(function (x) { return x.toLowerCase() === t.toLowerCase(); })) ED.tags.push(t);
  });
  renderTags(); queueDraft();
}

function kindOf(f) {
  if (/^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp|mkv)$/i.test(f.name)) return 'video';
  return 'photo';
}

function retryUpload(m) {
  m.ed = ED; m.status = 'queued'; m.prog = 0; m.tries = 0; renderTile(m); updateSave();
  if (!m.sess) m.sess = startSessions(m);
  UpQ.add(m);
}

/** A fingerprint of a photo or video: its size and a hash of its first and last 64 KB. */
function fingerprint(f) {
  var n = f.size, k = 65536;
  var part = n <= 2 * k ? f : new Blob([f.slice(0, k), f.slice(n - k)]);
  return Promise.resolve().then(function () { return part.arrayBuffer(); })
    .then(function (b) { return crypto.subtle.digest('SHA-256', b); })
    .then(function (h) { return 'v1:' + n + ':' + Array.prototype.map.call(new Uint8Array(h).slice(0, 16), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); })
    .catch(function () { return ''; });
}
/** The same photo or video? By fingerprint; for ones added before Diari kept fingerprints, by name and size. */
function sameMedia(a, b) {
  if (a.fp && b.fp) return a.fp === b.fp;
  return !!a.name && a.name === b.name && a.size > 0 && Math.round(a.size) === Math.round(b.size);
}
/** The first other entry that already has this photo or video. */
function journalHas(c, exceptId) {
  for (var i = 0; i < S.entries.length; i++) {
    var e = S.entries[i];
    if (e.id !== exceptId && e.media.some(function (m) { return sameMedia(m, c); })) return e;
  }
  return null;
}
function countKinds(list) {
  var p = list.filter(function (x) { return x.type === 'photo'; }).length, v = list.length - p;
  return [p ? plural(p, 'photo') : '', v ? plural(v, 'video') : ''].filter(Boolean).join(' and ');
}

/** Adds picked photos and videos, leaving out any already in this entry, and asking about any already in another entry. */
function addFiles(files) {
  var ed = ED, list = Array.prototype.slice.call(files);
  if (!ed || !list.length) return;
  Promise.all(list.map(fingerprint)).then(function (fps) {
    if (ED !== ed) return;
    var take = [], here = [], elsewhere = [], where = [];
    list.forEach(function (f, i) {
      var c = { f: f, name: f.name || '', size: f.size, fp: fps[i], type: kindOf(f) };
      var had = ed.media.filter(function (m) { return !m.cancelled && sameMedia(m, c); })[0];
      if (had && had.status === 'error' && had.file) { retryUpload(had); return; }      // picked again after it failed: try again
      if (had || take.concat(elsewhere).some(function (x) { return sameMedia(x, c); })) { here.push(c); return; }
      var e = journalHas(c, ed.id);
      if (e) { elsewhere.push(c); if (where.indexOf(e) < 0) where.push(e); } else take.push(c);
    });
    if (here.length) toast((here.length === 1 ? 'This ' + here[0].type + ' is' : countKinds(here) + ' are') + ' already in this entry, so ' + (here.length === 1 ? 'it was' : 'they were') + ' not added again.', 5000);
    if (!elsewhere.length) return take;
    var first = where[0], one = elsewhere.length === 1;
    var text = (one ? 'This ' + elsewhere[0].type + ' is' : countKinds(elsewhere) + ' are') + ' already in “' + first.title + '” (' + fmtDayMonth(first.date) + ')' +
      (where.length > 1 ? ' and ' + plural(where.length - 1, 'other entry', 'other entries') : '') + '. Add ' + (one ? 'it' : 'them') + ' to this entry too?';
    return confirmDlg({ title: 'Already in your journal', text: text, ok: one ? 'Add again' : 'Add them again', cancel: 'Skip' }).then(function (yes) {
      return yes ? take.concat(elsewhere).sort(function (a, b) { return list.indexOf(a.f) - list.indexOf(b.f); }) : take;
    });
  }).then(function (take) {
    if (!take || !take.length || ED !== ed) return;
    take.forEach(function (c) {
      var f = c.f;
      var m = { key: rid(8), type: c.type, name: f.name || (c.type === 'video' ? 'video.mp4' : 'photo.jpg'), mime: f.type || '', size: f.size, fp: c.fp, status: 'queued', prog: 0, file: f, isNew: true, ed: ed };
      if (m.type === 'photo') m.localThumb = URL.createObjectURL(f);
      if (m.type === 'video' && f.size > 500e6) toast('Large video (' + fmtSize(f.size) + '). Uploading will take a while.', 4500);
      ed.media.push(m);
      Pend.keep(m, ed);                   // kept on this device until it is in Drive
      m.sess = startSessions(m);          // now, while the Google sign-in is fresh
      UpQ.add(m);
    });
    renderTray(); updateSave(); queueDraft();
    var tray = $('#ed-tray'); tray.scrollLeft = tray.scrollWidth;
  });
}

/** The entry's date: from the editor while it is open, or as saved (uploads carry on after Save). */
function edDate(ed) { return ed.savedDate || (ED === ed && $('#ed-date').value) || localStr(new Date()); }

function processUpload(m) {
  var ed = m.ed;
  if (gone(m)) return Promise.resolve();
  if (!m.info) { m.status = 'prep'; m.prog = Math.max(m.prog || 0, 0.02); renderTile(m); updateSave(); }
  var got = m.got = m.got || {};
  return prepOnce(m).then(function (v) {
    if (gone(m)) return null;
    if (m.status !== 'uploading') {
      m.w = v.w || 0; m.h = v.h || 0; m.dur = v.dur || 0;
      if (v.thumb && !m.ownThumb) { if (m.localThumb) URL.revokeObjectURL(m.localThumb); m.localThumb = URL.createObjectURL(v.thumb); m.ownThumb = true; }
      if (m.type === 'video' && !v.w && !m.warned) { m.warned = true; toast('This video may not play in every browser. It will still be saved.', 5000); }
      m.status = 'uploading'; renderTile(m); updateSave();
    }
    return m.sess || (m.sess = startSessions(m));
  }).then(function (s) {
    if (!s || gone(m)) return null;
    // The original and its two small previews upload at the same time; parts already sent are not sent again.
    var info = m.info;
    var up = function (k, blob, loc, prog) {
      if (got[k]) return Promise.resolve(got[k]);
      if (!blob) return Promise.resolve('');
      return API.send(loc, blob, prog, m.kept).then(function (id) { got[k] = id; Pend.patch(m.key, { got: Object.assign({}, got) }); return id; });
    };
    return Promise.all([
      up('id', m.file, s.orig, function (f) { setProg(m, 0.04 + f * 0.92); }),
      up('thumb', info.thumb, s.thumb),
      up('preview', info.preview, s.preview)
    ]);
  }).then(function (ids) {
    if (!ids || gone(m)) { discardGot(m); return; }
    m.id = ids[0]; m.thumb = ids[1]; m.preview = ids[2];
    m.status = 'done'; m.prog = 1; m.info = null; m.sess = null;
    var file = m.file;
    delete m.file;
    if (ed.saved && ED !== ed) attachUpload(ed, m);              // saved already: add it to the entry
    else { renderTile(m); updateSave(); saveDraft(); }
    Pend.drop(m.key);
    if (m.type === 'video' && Copy.supported() && Copy.needed(m)) {
      Copies.add({ entryId: ed.id, mediaId: m.id, file: file, name: edDate(ed).slice(0, 10) + ' ' + m.name, date: edDate(ed) });
    }
  }).catch(function (err) {
    if (gone(m)) { discardGot(m); return; }
    if (err && err.restart) m.sess = null;                         // Drive forgot the upload: start it again
    // A dropped connection: try again by itself a few times before asking.
    if (err && !err.expired && (err.net || err.restart) && (m.tries = (m.tries || 0) + 1) <= 3) {
      m.status = 'wait'; renderTile(m);
      UpQ.retryLater(m, 8e3 * m.tries * (window.DIARI_TIME || 1));
      return;
    }
    if (ed.saved && ED !== ed && (m.fails = (m.fails || 0) + 1) < 3) {       // keep it on the device and try again next time
      m.status = 'error'; Uploads.done(ed.id, m); Pend.patch(m.key, { fails: m.fails });
      var en = byId(ed.id);
      toast((m.type === 'video' ? 'A video' : 'A photo') + ' for “' + (en ? en.title : 'your entry') + '” could not be uploaded yet: ' + errText(err) + ' Diari tries again the next time it opens.', 8000);
      return;
    }
    discardGot(m); m.sess = null; Pend.drop(m.key);
    if (ed.saved && ED !== ed) {
      m.status = 'error';
      Uploads.done(ed.id, m);
      var e = byId(ed.id);
      toast((m.type === 'video' ? 'A video' : 'A photo') + ' for “' + (e ? e.title : 'your entry') + '” could not be uploaded: ' + errText(err) + ' Open the entry and add it again.', 9000);
      return;
    }
    if (ED !== ed) return;
    m.status = 'error'; m.err = errText(err); renderTile(m); updateSave();
    if (err && err.expired) { toast('Your Google sign-in expired. Save your text, then add this photo or video again.', 7000); return; }
    toast(m.err, 5000);
  });
}

/* Photos and videos still uploading when Save was tapped: they carry on, and join the entry when done. */
var Uploads = {
  n: {},                    // entry id -> { photo: count, video: count }
  add: function (id, m) { var x = this.n[id] = this.n[id] || { photo: 0, video: 0 }; x[m.type]++; this.keep(); },
  done: function (id, m) {
    var x = this.n[id]; if (!x) return;
    if (x[m.type]) x[m.type]--;
    if (!x.photo && !x.video) delete this.n[id];
    this.keep(); refreshPending();
  },
  count: function (id) { var x = this.n[id]; return x ? x.photo + x.video : 0; },
  any: function () { return Object.keys(this.n).length > 0; },
  text: function (id) {
    var x = this.n[id], parts = [];
    if (x.photo) parts.push(plural(x.photo, 'photo'));
    if (x.video) parts.push(plural(x.video, 'video'));
    return 'Uploading ' + parts.join(', ') + '…';
  },
  // Kept on the device so that, if Diari is closed before they finish, it can say so next time.
  keep: function () { if (this.any()) lsSet('diari-uploading', { n: this.n, at: Date.now() }); else lsDel('diari-uploading'); },
  /** What was still uploading when Diari was last closed (read once, at start). */
  take: function () { var x = lsGet('diari-uploading'); lsDel('diari-uploading'); return x; },
  /** Says which of those could not carry on (resumed: how many did, per entry). */
  leftover: function (x, resumed) {
    if (!x || !x.n || Date.now() - x.at > 14 * 864e5) return;
    resumed = resumed || {};
    Object.keys(x.n).forEach(function (id) {
      var c = x.n[id] || {}, e = byId(id), lost = (c.photo || 0) + (c.video || 0) - (resumed[id] || 0), parts = [];
      if (lost <= 0) return;
      if (resumed[id]) parts.push(plural(lost, 'photo or video', 'photos and videos'));
      else { if (c.photo) parts.push(plural(c.photo, 'photo')); if (c.video) parts.push(plural(c.video, 'video')); }
      toast(parts.join(' and ') + ' for “' + (e ? e.title : 'an entry') + '” did not finish uploading because Diari was closed. Open the entry and add ' + (lost === 1 ? 'it' : 'them') + ' again.', 10000);
    });
  }
};
window.addEventListener('beforeunload', function (ev) {
  if (Uploads.any()) { ev.preventDefault(); ev.returnValue = ''; }   // the browser asks "Leave site?"
});

function attachUpload(ed, m) {
  var e = byId(ed.id);
  if (!e) { Uploads.done(ed.id, m); API.discard([pickIds(m)]).catch(function () {}); return; }      // entry deleted meanwhile
  var have = {}, media;
  e.media.forEach(function (x) { have[x.id] = x; });
  if (ed.resumed) {
    // Carried on after Diari was closed: back in the place it had in the entry.
    media = e.media.map(pickMedia);
    if (!have[m.id]) media.splice(Math.min(m.pos >= 0 ? m.pos : media.length, media.length), 0, pickMedia(m));
  } else {
    // Keep the order the photos were added in the editor.
    media = ed.media.filter(function (x) { return x.status === 'done' && x.id && !x.cancelled; })
      .map(function (x) { return pickMedia(have[x.id] || x); });
    e.media.forEach(function (x) { if (!media.some(function (y) { return y.id === x.id; })) media.push(pickMedia(x)); });
  }
  var rec = { id: e.id, date: e.date, title: e.autoTitle ? '' : e.title, titleAuto: e.autoTitle ? undefined : e.titleAuto, body: e.body, tags: e.tags.slice(), media: media };
  var shown = shownRec(rec);
  if (!e.autoTitle) { shown.title = e.title; shown.autoTitle = false; }
  upsert(shown);
  Outbox.add(rec);
  Uploads.done(ed.id, m);
}

function saveEditor() {
  if (!ED) return;
  var b = $('#ed-save');
  var going = ED.media.filter(function (m) { return /^(queued|prep|uploading|wait)$/.test(m.status); });
  var failed = ED.media.filter(function (m) { return m.status === 'error'; }).length;
  if (failed) { toast(plural(failed, 'upload') + ' failed. Tap it to retry, or remove it.', 4500); return; }
  var typed = $('#ed-title').value.trim(), titleAuto = false, keepShown = '';
  if (!typed) titleAuto = true;                                     // Claude writes one
  else if (ED.titleAuto && typed === ED.origTitle) {
    var body0 = $('#ed-body').value.replace(/\s+$/, '');
    var media0 = ED.media.filter(function (m) { return m.status === 'done' && m.id; }).map(function (m) { return m.id; }).join(',');
    if (body0 !== ED.baseBody || media0 !== ED.baseMedia) { typed = ''; keepShown = ED.origTitle; }   // text changed: a fresh title
    titleAuto = true;
  } else if (ED.suggested && typed === ED.suggested) titleAuto = true;
  var rec = {
    id: ED.id,
    date: $('#ed-date').value || localStr(new Date()),
    title: typed,
    titleAuto: titleAuto,
    body: $('#ed-body').value.replace(/\s+$/, ''),
    tags: ED.tags.slice(),
    media: ED.media.filter(function (m) { return m.status === 'done' && m.id; }).map(pickMedia)
  };
  if (!rec.title && !rec.body.trim() && !rec.media.length && !going.length) { toast('Write something or add a photo first.'); return; }
  var wasNew = ED.isNew;
  // Photos still uploading carry on in the background and join the entry when done.
  if (going.length) {
    ED.saved = true; ED.savedDate = rec.date;
    going.forEach(function (m) { Uploads.add(rec.id, m); Pend.patch(m.key, { saved: true, entryId: rec.id, pos: ED.media.indexOf(m), savedDate: rec.date }); });
    toast('Saved. ' + (going.length === 1 ? 'The photo keeps' : 'Photos keep') + ' uploading in the background. If you close Diari, ' + (going.length === 1 ? 'it carries' : 'they carry') + ' on when you open it again.', 5000);
  }
  // Show it straight away; Google Drive gets it in the background.
  var shown = shownRec(rec);
  if (keepShown) shown.title = keepShown;            // the old title until Claude's new one arrives
  upsert(shown);
  Outbox.add(rec);
  lsDel('diari-draft');
  ED.force = true; Nav.pop();                                          // close the editor
  if (entrySheet.classList.contains('open')) Nav.pop();               // and the entry it was opened from
  S.calPicked = false;
  setView('timeline');                                                // back to the timeline, the entry highlighted
  justSaved(rec.id);
}

// Briefly tints the entry just saved in the timeline, and scrolls to it if it is out of view.
var flashTimer;
function justSaved(id) {
  S.flashId = id; render();
  clearTimeout(flashTimer);
  flashTimer = setTimeout(function () { S.flashId = ''; $$('.card.justsaved').forEach(function (c) { c.classList.remove('justsaved'); }); }, 2500);
  requestAnimationFrame(function () {
    var c = $('.card[data-open="' + id + '"]');
    if (!c) return;
    var r = c.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 140) c.scrollIntoView({ block: 'center' });
  });
}

edSheet.addEventListener('click', function (ev) {
  var t = ev.target;
  var act = t.closest('[data-act]');
  if (act) { var a = act.getAttribute('data-act'); if (a === 'cancel') Nav.pop(); else if (a === 'save') saveEditor(); return; }
  if (t.closest('[data-add]')) { if (fresh(5)) $('#ed-file').click(); return; }
  var rm = t.closest('[data-rm]');
  if (rm) {
    var key = rm.getAttribute('data-rm'), m = ED.media.find(function (x) { return x.key === key; });
    if (!m) return;
    ED.media.splice(ED.media.indexOf(m), 1);
    if (m.isNew) { m.cancelled = true; Pend.drop(m.key); if (m.status === 'done') API.discard([pickIds(m)]).catch(function () {}); }
    renderTray(); updateSave(); queueDraft();
    return;
  }
  var rt = t.closest('[data-retry]');
  if (rt) {
    var mk = ED.media.find(function (x) { return x.key === rt.getAttribute('data-retry'); });
    if (mk && mk.file) retryUpload(mk);
    return;
  }
  var ut = t.closest('[data-untag]');
  if (ut) { ED.tags.splice(+ut.getAttribute('data-untag'), 1); renderTags(); queueDraft(); $('#ed-tag-in').focus(); }
});
$('#ed-suggest').addEventListener('click', function () {
  if (!ED) return;
  var btn = this, body = $('#ed-body').value;
  var media = ED.media.filter(function (m) { return m.status === 'done'; }).map(function (m) { return m.type; });
  if (!body.trim() && !media.length) { toast('Write something first, then tap Suggest.'); $('#ed-body').focus(); return; }
  btn.disabled = true; btn.classList.add('busy');
  API.suggest({ body: body, date: $('#ed-date').value || localStr(new Date()), tags: ED.tags.slice(), media: media })
    .then(function (r) {
      if (!ED) return;
      $('#ed-title').value = r.title || ''; ED.suggested = r.title || ''; paintTitleHint(); queueDraft();
      if (r.note) toast(r.note, 7000);
    })
    .catch(function (err) { fail(err); })
    .then(function () { btn.disabled = false; btn.classList.remove('busy'); });
});
$('#ed-file').addEventListener('change', function () { if (this.files && this.files.length && ED) addFiles(this.files); this.value = ''; });
$('#ed-body').addEventListener('input', function () { autoGrow(); queueDraft(); });
$('#ed-title').addEventListener('input', function () { queueDraft(); paintTitleHint(); });
function paintTitleHint() {
  var h = $('#ed-title-hint'); if (!h) return;
  h.hidden = !(ED && ED.titleAuto && ED.origTitle && $('#ed-title').value.trim() === ED.origTitle);
}
$('#ed-title').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); $('#ed-body').focus(); } });
$('#ed-date').addEventListener('change', function () { updateHint(); queueDraft(); });
$('#ed-tag-in').addEventListener('keydown', function (ev) {
  var inp = this;
  if (ev.key === 'Enter' || ev.key === ',') { ev.preventDefault(); if (inp.value.trim()) { addTag(inp.value); inp.value = ''; } }
  else if (ev.key === 'Backspace' && !inp.value && ED.tags.length) { ED.tags.pop(); renderTags(); queueDraft(); }
});
$('#ed-tag-in').addEventListener('blur', function () { if (this.value.trim() && ED) { addTag(this.value); this.value = ''; } });
edSheet.addEventListener('keydown', function (ev) { if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') { ev.preventDefault(); saveEditor(); } });

/* ================================================================ */
/* Shell wiring                                                     */
/* ================================================================ */
function showSearch(q) {
  var box = $('#search'), btn = $('#btn-search');
  box.hidden = false; btn.setAttribute('aria-expanded', 'true');
  if (q != null) { $('#q').value = q; S.query = q; }
  if (S.view !== 'timeline') setView('timeline'); else render();
  if (q == null) $('#q').focus();
}
function hideSearch() {
  $('#search').hidden = true; $('#btn-search').setAttribute('aria-expanded', 'false');
  $('#q').value = ''; S.query = ''; render();
}

function wireShell() {
  $('#btn-search').innerHTML = I.search;
  $('#btn-settings').innerHTML = I.folder;
  $('#search-ico').innerHTML = I.search;
  $('#fab').innerHTML = I.plus;
  $('#ed-suggest').innerHTML = I.spark + '<span>Suggest</span>';
  $$('[data-ico]').forEach(function (s) { s.outerHTML = I[s.getAttribute('data-ico')]; });
  $('[data-act="close"]', entrySheet).innerHTML = I.back;
  $('[data-act="edit"]', entrySheet).innerHTML = I.edit + 'Edit';
  $('[data-act="delete"]', entrySheet).innerHTML = I.trash;
  $('[data-act="close"]', $('#sheet-settings')).innerHTML = I.back;
  var n = new Date();
  $('#today').textContent = DOW[n.getDay()].slice(0, 3) + ' ' + n.getDate() + ' ' + MON[n.getMonth()].slice(0, 3);
  $('#brand').textContent = APP_NAME;

  $('#btn-search').onclick = function () { if ($('#search').hidden) showSearch(); else hideSearch(); };
  $('#q').addEventListener('input', function () { S.query = this.value; if (S.view !== 'timeline') setView('timeline'); else { render(); } });
  $('#btn-settings').onclick = openSettings;
  // On the calendar, + writes for the day picked there.
  $('#fab').onclick = function () { var d = fabDay(); if (fresh(3, { id: '', day: d })) openEditor(null, d || undefined); };
  $$('.tab').forEach(function (t) { t.onclick = function () { setView(t.getAttribute('data-view')); }; });

  view.addEventListener('click', function (ev) {
    var t = ev.target;
    var o = t.closest('[data-open]'); if (o) { openEntry(o.getAttribute('data-open')); return; }
    if (t.closest('[data-new]')) { if (fresh(3, { id: '' })) openEditor(null); return; }
    var no = t.closest('[data-new-on]'); if (no) { var nd = no.getAttribute('data-new-on'); if (fresh(3, { id: '', day: nd })) openEditor(null, nd); return; }
    var c = t.closest('[data-cal]');
    if (c) {
      var d = +c.getAttribute('data-cal');
      if (!d) S.cal = todayKey().slice(0, 7);
      else { var y = +S.cal.slice(0, 4), mo = +S.cal.slice(5, 7) - 1 + d; var nd = new Date(y, mo, 1); S.cal = nd.getFullYear() + '-' + pad(nd.getMonth() + 1); }
      S.calDay = ''; S.calPicked = false; render(); return;
    }
    var day = t.closest('[data-day]'); if (day) { S.calDay = day.getAttribute('data-day'); S.calPicked = true; render(); return; }
    var mi = t.closest('[data-mi]'); if (mi) { openLightbox(allMedia(), +mi.getAttribute('data-mi'), true); return; }
    if (t.closest('[data-install]')) { Install.prompt(); return; }
    if (t.closest('[data-install-hide]')) { lsSet('diari-install-hidden', 1); render(); return; }
    if (t.closest('[data-signin]')) { Auth.signIn(false); return; }
    if (t.closest('[data-move]')) { if (Auth.full && Auth.valid(10 * 60e3)) runMove(); else Auth.signIn(false, 'move'); return; }
    var fr = t.closest('[data-fresh]');
    if (fr) {
      fr.disabled = true; fr.textContent = 'Setting up…';
      API.createJournal().then(boot).catch(function (err) { fr.disabled = false; fr.textContent = 'Start a new journal'; fail(err); });
      return;
    }
  });

  window.addEventListener('scroll', function () { $('#top').classList.toggle('scrolled', window.scrollY > 4); }, { passive: true });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && Nav.stack.length) { ev.preventDefault(); Nav.pop(); }
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveDraft(); });
}

function bootError(err) {
  view.innerHTML = '<div class="err-box"><h2>Couldn’t open your journal</h2><p>' + esc(errText(err)) + '</p><button class="btn primary" id="btn-retry">Try again</button></div>';
  $('#btn-retry').onclick = boot;
}

var AUTH_ERRORS = {
  access_denied: 'You chose not to allow access. Diari needs your Google Drive to save your journal.',
  drive_not_granted: 'Diari needs permission to save files in your Google Drive. Sign in again and allow it.',
  full_not_granted: 'To move your earlier journal, allow access to your whole Google Drive when Google asks. Diari gives it up again as soon as the move is done.',
  interaction_required: '', login_required: '', consent_required: ''
};
var MARK = '<img class="signin-mark" src="icons/icon-192.png" alt="" width="84" height="84">';

function fullScreen(html) {
  $('#fab').hidden = true;
  document.body.classList.add('signed-out');
  view.innerHTML = '<div class="signin">' + MARK + html + '</div>';
}

/** First run on this Google account: move an earlier journal in, or start a new one. */
function showSetup(resume, msg) {
  fullScreen(resume
    ? '<h2>Finish moving your journal</h2>' +
      '<p>Moving your earlier journal stopped before it finished. Continue now; entries already moved are not copied twice.</p>' +
      (msg ? '<p class="signin-err">' + esc(msg) + '</p>' : '') +
      '<button class="btn primary" data-move>Continue moving</button>'
    : '<h2>Set up your journal</h2>' +
      '<p>Diari keeps your journal in a Journal folder in your Google Drive, and only sees the files it creates there.</p>' +
      (msg ? '<p class="signin-err">' + esc(msg) + '</p>' : '') +
      '<button class="btn primary" data-fresh>Start my journal</button>' +
      '<p class="signin-note">Used the earlier Apps Script version of Diari? <button class="linkish" data-move>Move that journal in</button>. Google asks once for access to your whole Drive; Diari copies your entries, photos and videos in, renames the old folder to “Journal - old copy”, then gives that access up.</p>');
}

/** Runs right after Google gave full Drive access for the move. */
function runMove() {
  fullScreen('<h2>Moving your journal…</h2><p id="move-prog">Looking for your earlier journal…</p><p class="signin-note">Keep Diari open until this finishes.</p>');
  API.moveEarlier(function (n, total) {
    var p = $('#move-prog');
    if (p) p.textContent = total ? 'Copied ' + n + ' of ' + plural(total, 'entry', 'entries') : 'No entries to move.';
  }).then(function (r) {
    return Auth.revoke().then(function () {
      fullScreen('<h2>' + (r.none ? 'No earlier journal found' : 'Your journal is moved') + '</h2>' +
        '<p>' + (r.none ? (r.existed ? 'Your journal is unchanged.' : 'Diari started a new Journal folder for you.')
          : plural(r.count, 'entry is', 'entries are') + ' in your new Journal folder. The old folder is now called “Journal - old copy”. Delete it in Google Drive once you have checked that everything is here.') + '</p>' +
        '<p>Diari has given up access to the rest of your Drive. Sign in once more to finish.</p>' +
        '<button class="btn primary" data-signin>Sign in to finish</button>');
    });
  }).catch(function (err) {
    if (err && err.expired) { Auth.signIn(false, 'move'); return; }
    fullScreen('<h2>The move stopped</h2><p class="signin-err">' + esc(errText(err)) + '</p>' +
      '<p>Nothing is lost. Entries already moved stay moved, and the rest continue when you try again.</p>' +
      '<button class="btn primary" data-move>Try again</button>');
  });
}

function showSignIn(msg) {
  $('#fab').hidden = true;
  document.body.classList.add('signed-out');
  view.innerHTML = '<div class="signin">' + MARK +
    '<h2>Your journal, kept in your Google Drive</h2>' +
    '<p>Write about your day, add photos and videos, and find it all again by date, tag or word. Entries are saved as files in a Journal folder in your own Google Drive, and Diari can only see the files it creates there.</p>' +
    (msg ? '<p class="signin-err">' + esc(msg) + '</p>' : '') +
    '<button class="btn primary" data-signin>Sign in with Google</button></div>';
}

function boot() {
  Auth.init();
  // "New entry" shortcut from the home screen icon
  if (/[?&]new=1/.test(location.search)) { history.replaceState(null, '', location.pathname); lsSet('diari-reopen', { id: '', at: Date.now() }); }
  var cached = lsGet('diari-index');
  var hasCache = !!(cached && cached.length);
  var keepGoing = false;
  if (!Auth.valid(RENEW_AT)) {
    if (!navigator.onLine && hasCache) {
      document.body.classList.remove('signed-out'); $('#fab').hidden = false;
      Outbox.load();
      S.entries = normList(cached); sortEntries(); Outbox.overlay(); S.loaded = true; render();
      toast('You are offline. Showing the copy saved on this device.', 5000);
      return;
    }
    var err = Auth.error;
    // Signed in before: get a new Google sign-in without any screens, then come straight back.
    if (Auth.email && !err) { view.innerHTML = '<p class="results" style="text-align:center;margin-top:40px">Signing in…</p>'; Auth.signIn(true); return; }
    // A quiet renewal did not work, but the current sign-in still has a few minutes: carry on with it.
    if (!(Auth.silentFailed && Auth.valid(3 * 60e3))) { showSignIn(err in AUTH_ERRORS ? AUTH_ERRORS[err] : err); return; }
    keepGoing = true;
  }
  // Came back from allowing full Drive access: move the earlier journal now.
  if (Auth.full) { runMove(); return; }
  var authMsg = keepGoing ? '' : Auth.error ? (Auth.error in AUTH_ERRORS ? AUTH_ERRORS[Auth.error] : Auth.error) : '';
  $('#fab').hidden = false;
  document.body.classList.remove('signed-out');
  Stream.sendToken();
  Outbox.load();
  if (hasCache) { S.entries = normList(cached); sortEntries(); Outbox.overlay(); S.loaded = true; render(); }
  else view.innerHTML = '<div style="height:44px"></div>' + '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  API.boot().then(function (r) {
    if (r.setup || r.moveUnfinished) { showSetup(!!r.moveUnfinished, authMsg); return; }
    if (authMsg) toast(authMsg, 7000);
    S.entries = normList(r.index.entries); sortEntries(); Outbox.overlay();
    S.rootUrl = /^https:\/\/drive\.google\.com\//.test(r.rootUrl || '') ? r.rootUrl : ''; S.aiTitles = r.aiTitles || ''; S.loaded = true; cacheIndex(); render();
    Outbox.run();
    var left = Uploads.take();
    resumeUploads().then(function (per) { Uploads.leftover(left, per); });
    var rv = lsGet('diari-reopen-view'), re = lsGet('diari-reopen');
    lsDel('diari-reopen-view'); lsDel('diari-reopen');
    if (rv && Date.now() - rv.at < 30 * 60e3 && byId(rv.id)) openEntry(rv.id);
    if (re && Date.now() - re.at < 30 * 60e3 && (!re.id || byId(re.id))) openEditor(re.id || null, re.day || undefined);
    var cr = lsGet('diari-copyresume');
    if (cr) { lsDel('diari-copyresume'); if (Date.now() - cr.at < 30 * 60e3 && Copy.supported()) startCopies(); }
  }).catch(function (err) {
    if (err && err.expired) { reauth(); return; }
    if (S.loaded) toast('Couldn’t refresh from Google Drive. Showing the copy on this device.', 5000);
    else bootError(err);
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}

wireShell();
boot();
})();
