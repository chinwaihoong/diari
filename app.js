/* Diari: the app screens. Storage and Google sign-in are in store.js. */
(function () {
'use strict';

// Refuse to run inside another site's frame (protects against click tricks).
if (window.top !== window.self) { document.documentElement.innerHTML = ''; return; }

/* ================================================================ */
/* Setup                                                            */
/* ================================================================ */
var APP_NAME = 'Diari';
var MEDIA_TAG = 'Journal attachment';
var LIVE = true;
var Store = window.DiariStore, Auth = Store.Auth;

var S = { entries: [], view: 'timeline', query: '', cal: '', calDay: '', rootUrl: '', aiTitles: '', loaded: false, openId: null };

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
  google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9h-4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5h-4a12 12 0 0 0 0 11z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>',
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

// A Google sign-in expired: keep what is being written, then sign in again and come back.
function reauth() {
  if (ED) { saveDraft(); lsSet('diari-reopen', { id: ED.isNew ? '' : ED.id, at: Date.now() }); }
  toast('Signing in to Google again…', 8000);
  setTimeout(function () { Auth.signIn(true); }, 400);
}
function fail(err, ms) {
  if (err && err.expired) { reauth(); return; }
  toast(errText(err), ms || 5000);
}
// Makes sure the Google sign-in has enough time left before starting work that uploads.
function fresh(minutes) {
  if (Auth.valid((minutes || 20) * 60e3) || !navigator.onLine) return true;
  reauth();
  return false;
}


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
function imgTag(id, full) {
  if (!id) return '<span class="ph-icon">' + I.image + '</span>';
  return '<img class="mimg" alt="" data-mid="' + esc(id) + '"' + (full ? ' data-full="1"' : '') + '>';
}

/* ================================================================ */
/* Photo and video processing (before upload)                       */
/* ================================================================ */
function scaled(src, max, q) {
  var sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
  if (!sw || !sh) return Promise.resolve(null);
  var s = Math.min(1, max / Math.max(sw, sh));
  var c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(sw * s)); c.height = Math.max(1, Math.round(sh * s));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise(function (res) { try { c.toBlob(function (b) { res(b); }, 'image/jpeg', q); } catch (e) { res(null); } });
}

function photoInfo(file) {
  var load = (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }) : Promise.reject())
    .catch(function () {
      return new Promise(function (res, rej) {
        var img = new Image(), u = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(u); res(img); };
        img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('unreadable')); };
        img.src = u;
      });
    });
  return load.then(function (src) {
    var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
    return Promise.all([scaled(src, 480, 0.74), scaled(src, 1600, 0.84)]).then(function (b) {
      if (src.close) src.close();
      return { w: w, h: h, thumb: b[0], preview: b[1] };
    });
  }).catch(function () { return {}; });
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
    v.onseeked = function () {
      Promise.all([scaled(v, 480, 0.74), scaled(v, 1280, 0.82)]).then(function (b) {
        finish({ w: v.videoWidth, h: v.videoHeight, dur: isFinite(v.duration) ? v.duration : 0, thumb: b[0], preview: b[1] });
      }).catch(function () { finish({ dur: v.duration }); });
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
    tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
    media: (Array.isArray(e.media) ? e.media : []).filter(function (m) { return m && fid(m.id); }).map(function (m) {
      return { id: fid(m.id), type: m.type === 'video' ? 'video' : 'photo', name: String(m.name || ''), mime: String(m.mime || ''),
        size: n(m.size), w: n(m.w), h: n(m.h), dur: n(m.dur), thumb: fid(m.thumb), preview: fid(m.preview) };
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
  S.view = v;
  $$('.tab').forEach(function (t) { if (t.getAttribute('data-view') === v) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current'); });
  render();
  window.scrollTo(0, 0);
}

function render() {
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
    thumb = '<div class="c-thumb">' + imgTag(m0.thumb) +
      (m0.type === 'video' ? '<span class="badge">' + I.play + fmtDur(m0.dur) + '</span>' : '') +
      (e.media.length > 1 ? '<span class="cnt">' + e.media.length + '</span>' : '') + '</div>';
  }
  var meta = [fmtTime(e.date)];
  var tagHtml = e.tags.slice(0, 3).map(function (t) { return '<span class="tg">#' + esc(t) + '</span>'; }).join(' ');
  var mc = counts([e]);
  if (mc.photos) meta.push(plural(mc.photos, 'photo'));
  if (mc.videos) meta.push(plural(mc.videos, 'video'));
  return '<button class="card' + (sameDay ? ' same-day' : '') + (e.date.slice(0, 10) === todayKey() ? ' is-today' : '') + '" data-open="' + esc(e.id) + '">' +
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
    (m0 ? '<span class="ph">' + imgTag(m0.thumb) + '</span>' : '') +
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
  else html += '<p class="none">No entry on this day.</p><button class="btn soft" data-new-on="' + S.calDay + '">' + I.plus + 'Write one for this day</button>';
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
    html += '<button class="mt" data-mi="' + i + '" aria-label="' + (m.type === 'video' ? 'Video' : 'Photo') + ' from ' + esc(fmtLong(m.date)) + '">' + imgTag(m.thumb) +
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

function galleryHTML(e) {
  var ms = e.media, n = ms.length;
  if (!n) return '';
  var shown = ms.slice(0, 7), extra = n - shown.length, cls = [];
  if (n === 2) cls = ms.some(function (m) { return m.type === 'video'; }) ? ['hero', 'hero'] : ['half', 'half'];
  else {
    cls.push('hero');
    var r = shown.length - 1;
    for (var i = 0; i < r; i++) {
      if (r % 3 === 0) cls.push('third');
      else if (r % 2 === 0) cls.push('half');
      else cls.push(i < 2 ? 'half' : 'third');
    }
  }
  return '<div class="gal">' + shown.map(function (m, i) {
    var c = cls[i], ar = '';
    if (c === 'hero') {
      var ratio = m.w && m.h ? Math.max(0.8, Math.min(1.78, m.w / m.h)) : 4 / 3;
      ar = ' style="--ar:' + ratio.toFixed(3) + '"';
    }
    var src = c === 'hero' || c === 'half' ? (m.preview || m.thumb) : (m.thumb || m.preview);
    var label = (m.type === 'video' ? 'Play video' : 'Open photo') + (m.dur ? ', ' + fmtDur(m.dur) : '');
    return '<div class="gi ' + c + '" role="button" tabindex="0" data-gi="' + i + '" aria-label="' + label + '"' + ar + '>' +
      imgTag(src) +
      (m.type === 'video' ? '<span class="play">' + I.play + '</span><span class="badge">' + fmtDur(m.dur) + '</span>' : '') +
      (extra > 0 && i === shown.length - 1 ? '<span class="more">+' + extra + '</span>' : '') + '</div>';
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
    '<div class="ev-foot"><span>' + foot.join(' · ') + '</span>' +
    (LIVE && e.fileId ? '<a href="https://drive.google.com/file/d/' + esc(e.fileId) + '/view" target="_blank" rel="noopener">Open file in Google Drive</a>' : '') + '</div>';
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
  if (hero && hero.type === 'video' && (!hero.size || hero.size < 60e6) && !slow) Loader.get(hero.id, false);
}

function stopVideos(root) { $$('video', root).forEach(function (v) { try { v.pause(); } catch (e) {} }); }

function ringEl() {
  var C = 2 * Math.PI * 26;
  var r = el('<svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle class="bgc" cx="32" cy="32" r="26"/><circle class="fgc" cx="32" cy="32" r="26" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/><text x="32" y="32"></text></svg>');
  r.set = function (f) { $('.fgc', r).setAttribute('stroke-dashoffset', String(C * (1 - (f || 0)))); $('text', r).textContent = Math.round((f || 0) * 100) + '%'; };
  r.set(0);
  return r;
}

function playInline(tile, m) {
  if (tile.classList.contains('playing') || tile.classList.contains('loading')) return;
  tile.classList.add('loading');
  var playBtn = $('.play', tile); if (playBtn) playBtn.hidden = true;
  var ring = ringEl(); tile.appendChild(ring);
  var ent = Loader.get(m.id, false);
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
    else if (a === 'edit') { if (fresh(20)) openEditor(S.openId); }
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
  confirmDlg({
    title: 'Delete this entry?',
    text: LIVE ? 'The text, photos and videos move to your Google Drive trash. You can restore them from there for 30 days.' : 'This removes the sample entry from the preview.',
    ok: 'Delete', danger: true
  }).then(function (yes) {
    if (!yes) return;
    API.remove(id).then(function () {
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
    $('.lb-count', lb).textContent = items.length > 1 ? (i + 1) + ' / ' + items.length : '';
    $('.lb-cap', lb).textContent = fmtLong(m.date) + (m.title ? ' · ' + m.title : '');
    $('.prev', lb).hidden = i === 0; $('.next', lb).hidden = i === items.length - 1;
    if (m.type === 'photo') {
      var img = document.createElement('img'); img.alt = m.title || 'Photo';
      var want = m.preview || m.id;
      stage.appendChild(img);
      Loader.get(want, !!m.preview).p.then(function (u) { if (items[i] === m) img.src = u; })
        .catch(function (err) { if (items[i] === m) stage.innerHTML = '<div class="lb-msg">' + esc(errText(err)) + '</div>'; });
      img.onerror = function () {
        if (items[i] !== m) return;
        stage.innerHTML = '<div class="lb-msg">This photo format cannot be shown in the browser.' +
          (LIVE ? ' <a href="https://drive.google.com/file/d/' + esc(m.id) + '/view" target="_blank" rel="noopener">Open it in Google Drive</a>.' : '') + '</div>';
      };
    } else {
      var posterId = m.preview || m.thumb;
      var ring = ringEl(); stage.appendChild(ring);
      var posterP = posterId ? Loader.get(posterId, true).p.catch(function () { return ''; }) : Promise.resolve('');
      var ent = Loader.get(m.id, false);
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
  }
  $('[data-x]', lb).onclick = function () { Nav.pop(); };
  $('.prev', lb).onclick = function () { go(-1); };
  $('.next', lb).onclick = function () { go(1); };
  var goBtn = $('[data-go]', lb);
  if (goBtn) goBtn.onclick = function () { var id = items[i].entryId; Nav.pop(); openEntry(id); };
  var sx = null, sy = 0;
  stage.addEventListener('pointerdown', function (ev) { if (ev.pointerType !== 'mouse') { sx = ev.clientX; sy = ev.clientY; } });
  stage.addEventListener('pointerup', function (ev) {
    if (sx === null) return;
    var dx = ev.clientX - sx, dy = ev.clientY - sy; sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
  });
  stage.addEventListener('pointercancel', function () { sx = null; });
  document.addEventListener('keydown', key);
  Nav.push(function () { stopVideos(lb); document.removeEventListener('keydown', key); lb.remove(); lockScroll(); });
  show();
  $('[data-x]', lb).focus();
}

/* ---------- settings ---------- */
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
    '<h3>Install</h3>' +
    (standalone ? '<p class="muted">Diari is installed on this device.</p>'
      : (Install.ev ? '<p><button class="btn primary" id="btn-install">Install Diari</button></p><p class="muted">Adds Diari to your home screen and app list. It opens full screen, like any other app.</p>'
        : '<p class="muted">In Chrome, open the ⋮ menu and tap <b>Install app</b> (or <b>Add to Home screen</b>). On a PC, click the install icon at the right of the address bar.</p>')) +
    '<h3>Fix the list</h3><p class="muted">If you edit, move or delete entry files in Google Drive yourself, rebuild the list from the files.</p>' +
    '<button class="btn soft" id="btn-rebuild">Rebuild from Drive files</button>' +
    '<h3>Account</h3><p>' + (Auth.email ? 'Signed in as <b>' + esc(Auth.email) + '</b>' : 'Signed in with Google') + '</p>' +
    '<button class="btn ghost" id="btn-signout">Sign out on this device</button>' +
    '<h3>Videos</h3><p class="muted">Short clips start almost at once. Long videos download first, so they take a moment. If a Samsung phone records in “High efficiency video”, some PC browsers cannot play it; turn that off in Camera settings for the best results.</p>';

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
  $('#btn-signout', box).onclick = function () {
    confirmDlg({ title: 'Sign out on this device?', text: 'Your journal stays in Google Drive. The copy saved on this device is removed.', ok: 'Sign out', danger: true }).then(function (yes) {
      if (!yes) return;
      API.signOut().then(function () { location.replace(location.pathname); });
    });
  };
  if (!$('#sheet-settings').classList.contains('open')) openSheet($('#sheet-settings'));
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
var uploadQueue = Promise.resolve();

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
  $('#ed-title').value = ex ? ex.title : '';
  $('#ed-body').value = ex ? ex.body : '';
  ED.base = edSnapshot();                // what "no changes" looks like

  var draft = lsGet('diari-draft');
  if (draft && draft.for === (ex ? ex.id : 'new') && Date.now() - draft.at < 14 * 864e5) {
    if (!ex) ED.id = draft.id || ED.id;
    $('#ed-date').value = draft.date || date; $('#ed-title').value = draft.title || ''; $('#ed-body').value = draft.body || '';
    ED.tags = draft.tags || ED.tags;
    ED.media = (draft.media || []).map(function (m) { return Object.assign({}, m, { key: rid(8), status: 'done', prog: 1, isNew: !!m.isNew }); });
    setTimeout(function () { toast('Restored your unsaved changes'); }, 350);
  }
  renderTray(); renderTags(); updateHint(); updateSave(); autoGrow();
  openSheet(edSheet);
  Nav.stack.pop();                       // replace the plain close with the "unsaved changes" check
  Nav.stack.push(editorBack);
  if (!ex) setTimeout(function () { $('#ed-body').focus(); }, 320);
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
      fresh.forEach(function (m) { m.cancelled = true; });
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

function pickIds(m) { return { id: m.id, thumb: m.thumb || '', preview: m.preview || '' }; }
function pickMedia(m) { return { id: m.id, type: m.type, name: m.name, mime: m.mime, size: m.size, w: m.w || 0, h: m.h || 0, dur: m.dur || 0, thumb: m.thumb || '', preview: m.preview || '' }; }

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

function updateHint() {
  var d = $('#ed-date').value || localStr(new Date());
  $('#ed-hint').textContent = LIVE ? 'Saves to Google Drive › Journal › ' + d.slice(0, 4) + ' › ' + d.slice(5, 7) : 'Preview only. Entries here are not saved anywhere.';
}

function updateSave() {
  if (!ED) return;
  var busy = ED.media.filter(function (m) { return m.status === 'prep' || m.status === 'uploading'; }).length;
  var b = $('#ed-save');
  if (b.getAttribute('data-saving')) return;
  b.disabled = busy > 0;
  b.textContent = busy ? 'Uploading ' + busy + '…' : 'Save';
}

function autoGrow() { var t = $('#ed-body'); t.style.height = 'auto'; t.style.height = Math.max(t.scrollHeight, 200) + 'px'; }

function tileHTML(m) {
  var img = m.localThumb ? '<img alt="" src="' + esc(m.localThumb) + '">' : (m.thumb ? '<img alt="" class="mimg" data-mid="' + esc(m.thumb) + '">' : '<span class="ph-icon">' + I.image + '</span>');
  var bar = (m.status === 'uploading' || m.status === 'prep') ? '<span class="bar"><i style="width:' + Math.round((m.prog || 0) * 100) + '%"></i></span>' : '';
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

function addFiles(files) {
  Array.prototype.forEach.call(files, function (f) {
    var m = { key: rid(8), type: kindOf(f), name: f.name || (kindOf(f) === 'video' ? 'video.mp4' : 'photo.jpg'), mime: f.type || '', size: f.size, status: 'prep', prog: 0, file: f, isNew: true };
    if (m.type === 'photo') m.localThumb = URL.createObjectURL(f);
    if (m.type === 'video' && f.size > 500e6) toast('Large video (' + fmtSize(f.size) + '). Uploading will take a while.', 4500);
    ED.media.push(m);
    uploadQueue = uploadQueue.then(function () { return processUpload(m); });
  });
  renderTray(); updateSave();
  var tray = $('#ed-tray'); tray.scrollLeft = tray.scrollWidth;
}

function processUpload(m) {
  var ed = ED;
  if (!ed || m.cancelled || ed.media.indexOf(m) < 0) return Promise.resolve();
  m.status = 'prep'; m.prog = 0.02; renderTile(m); updateSave();
  var info;
  return (m.type === 'video' ? videoInfo(m.file) : photoInfo(m.file)).then(function (v) {
    info = v;
    m.w = v.w || 0; m.h = v.h || 0; m.dur = v.dur || 0;
    if (v.thumb) { if (m.localThumb) URL.revokeObjectURL(m.localThumb); m.localThumb = URL.createObjectURL(v.thumb); }
    if (m.type === 'video' && !v.w) toast('This video may not play in every browser. It will still be saved.', 5000);
    m.status = 'uploading'; renderTile(m);
    return API.target(($('#ed-date').value || localStr(new Date())));
  }).then(function (tgt) {
    var name = ($('#ed-date').value || localStr(new Date())).slice(0, 10) + ' ' + m.name;
    return API.upload(m.file, { name: name, folderId: tgt.folderId, mime: m.mime }, function (f) { setProg(m, 0.04 + f * 0.88); })
      .then(function (id) {
        m.id = id;
        return info.thumb ? API.upload(info.thumb, { name: id + '.thumb.jpg', folderId: tgt.previewId, mime: 'image/jpeg' }) : '';
      }).then(function (thumbId) {
        m.thumb = thumbId || ''; setProg(m, 0.96);
        return info.preview ? API.upload(info.preview, { name: m.id + '.preview.jpg', folderId: tgt.previewId, mime: 'image/jpeg' }) : '';
      }).then(function (prevId) { m.preview = prevId || ''; });
  }).then(function () {
    if (m.cancelled || ED !== ed || ed.media.indexOf(m) < 0) { API.discard([pickIds(m)]).catch(function () {}); return; }
    m.status = 'done'; m.prog = 1; delete m.file;
    renderTile(m); updateSave(); saveDraft();
  }).catch(function (err) {
    if (ED !== ed) return;
    m.status = 'error'; m.err = errText(err); renderTile(m); updateSave();
    if (err && err.expired) { toast('Your Google sign-in expired. Save your text, then add this photo or video again.', 7000); return; }
    toast(m.err, 5000);
  });
}

function saveEditor() {
  if (!ED) return;
  var b = $('#ed-save');
  if (ED.media.some(function (m) { return m.status === 'prep' || m.status === 'uploading'; })) { toast('Wait for uploads to finish.'); return; }
  var failed = ED.media.filter(function (m) { return m.status === 'error'; }).length;
  if (failed) { toast(plural(failed, 'upload') + ' failed. Tap it to retry, or remove it.', 4500); return; }
  var rec = {
    id: ED.id,
    date: $('#ed-date').value || localStr(new Date()),
    title: $('#ed-title').value.trim(),
    body: $('#ed-body').value.replace(/\s+$/, ''),
    tags: ED.tags.slice(),
    media: ED.media.filter(function (m) { return m.status === 'done' && m.id; }).map(pickMedia)
  };
  if (!rec.title && !rec.body.trim() && !rec.media.length) { toast('Write something or add a photo first.'); return; }
  b.setAttribute('data-saving', '1'); b.disabled = true; b.textContent = 'Saving…';
  var wasNew = ED.isNew;
  if (!rec.title && rec.body.trim() && S.aiTitles) b.textContent = 'Naming…';
  API.save(rec).then(function (saved) {
    var note = saved._note; delete saved._note;
    saved = normEntry(saved);
    if (!saved) throw new Error('The saved entry came back damaged. Reload the app.');
    upsert(saved); lsDel('diari-draft');
    b.removeAttribute('data-saving');
    ED.force = true; Nav.pop();
    render();
    if (S.openId === saved.id) fillEntry(saved);
    else if (wasNew) setTimeout(function () { openEntry(saved.id); }, 120);
    if (note) toast(note, 7000);
    else toast(LIVE ? 'Saved to Google Drive' : 'Saved in this preview');
  }).catch(function (err) {
    b.removeAttribute('data-saving'); b.disabled = false; b.textContent = 'Save';
    saveDraft();
    if (err && err.expired) { reauth(); return; }
    toast(errText(err) + ' Your writing is kept on this device.', 6000);
  });
}

edSheet.addEventListener('click', function (ev) {
  var t = ev.target;
  var act = t.closest('[data-act]');
  if (act) { var a = act.getAttribute('data-act'); if (a === 'cancel') Nav.pop(); else if (a === 'save') saveEditor(); return; }
  if (t.closest('[data-add]')) { if (fresh(15)) $('#ed-file').click(); return; }
  var rm = t.closest('[data-rm]');
  if (rm) {
    var key = rm.getAttribute('data-rm'), m = ED.media.find(function (x) { return x.key === key; });
    if (!m) return;
    ED.media.splice(ED.media.indexOf(m), 1);
    if (m.isNew) { m.cancelled = true; if (m.status === 'done') API.discard([pickIds(m)]).catch(function () {}); }
    renderTray(); updateSave(); queueDraft();
    return;
  }
  var rt = t.closest('[data-retry]');
  if (rt) {
    var mk = ED.media.find(function (x) { return x.key === rt.getAttribute('data-retry'); });
    if (mk && mk.file) { mk.status = 'prep'; mk.prog = 0; renderTile(mk); updateSave(); uploadQueue = uploadQueue.then(function () { return processUpload(mk); }); }
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
      $('#ed-title').value = r.title || ''; queueDraft();
      if (r.note) toast(r.note, 7000);
    })
    .catch(function (err) { fail(err); })
    .then(function () { btn.disabled = false; btn.classList.remove('busy'); });
});
$('#ed-file').addEventListener('change', function () { if (this.files && this.files.length && ED) addFiles(this.files); this.value = ''; });
$('#ed-body').addEventListener('input', function () { autoGrow(); queueDraft(); });
$('#ed-title').addEventListener('input', queueDraft);
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
  $('#fab').onclick = function () { if (!Auth.valid()) { Auth.signIn(false); return; } if (fresh(20)) openEditor(null); };
  $$('.tab').forEach(function (t) { t.onclick = function () { setView(t.getAttribute('data-view')); }; });

  view.addEventListener('click', function (ev) {
    var t = ev.target;
    var o = t.closest('[data-open]'); if (o) { openEntry(o.getAttribute('data-open')); return; }
    if (t.closest('[data-new]')) { if (fresh(20)) openEditor(null); return; }
    var no = t.closest('[data-new-on]'); if (no) { if (fresh(20)) openEditor(null, no.getAttribute('data-new-on')); return; }
    var c = t.closest('[data-cal]');
    if (c) {
      var d = +c.getAttribute('data-cal');
      if (!d) S.cal = todayKey().slice(0, 7);
      else { var y = +S.cal.slice(0, 4), mo = +S.cal.slice(5, 7) - 1 + d; var nd = new Date(y, mo, 1); S.cal = nd.getFullYear() + '-' + pad(nd.getMonth() + 1); }
      S.calDay = ''; render(); return;
    }
    var day = t.closest('[data-day]'); if (day) { S.calDay = day.getAttribute('data-day'); render(); return; }
    var mi = t.closest('[data-mi]'); if (mi) { openLightbox(allMedia(), +mi.getAttribute('data-mi'), true); return; }
    if (t.closest('[data-install]')) { Install.prompt(); return; }
    if (t.closest('[data-install-hide]')) { lsSet('diari-install-hidden', 1); render(); return; }
    if (t.closest('[data-signin]')) { Auth.signIn(false); return; }
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
  drive_not_granted: 'Diari needs permission to use your Google Drive. Sign in again and tick the Google Drive box.',
  interaction_required: '', login_required: '', consent_required: ''
};

function showSignIn(msg) {
  $('#fab').hidden = true;
  document.body.classList.add('signed-out');
  view.innerHTML = '<div class="signin"><img class="signin-mark" src="icons/icon-192.png" alt="" width="84" height="84">' +
    '<h2>Your journal, kept in your Google Drive</h2>' +
    '<p>Write about your day, add photos and videos, and find it all again by date, tag or word. Entries are saved as files in a Journal folder in your own Google Drive.</p>' +
    (msg ? '<p class="signin-err">' + esc(msg) + '</p>' : '') +
    '<button class="btn primary" data-signin>' + I.google + 'Sign in with Google</button>' +
    '<p class="signin-note">The first time, Google says it hasn’t verified Diari. That is expected for an app you made for yourself: tap <b>Advanced</b>, then <b>Go to Diari</b>.</p></div>';
}

function boot() {
  Auth.init();
  // "New entry" shortcut from the home screen icon
  if (/[?&]new=1/.test(location.search)) { history.replaceState(null, '', location.pathname); lsSet('diari-reopen', { id: '', at: Date.now() }); }
  var cached = lsGet('diari-index');
  var hasCache = !!(cached && cached.length);
  if (!Auth.valid(10 * 60e3)) {
    if (!navigator.onLine && hasCache) {
      document.body.classList.remove('signed-out'); $('#fab').hidden = false;
      S.entries = normList(cached); sortEntries(); S.loaded = true; render();
      toast('You are offline. Showing the copy saved on this device.', 5000);
      return;
    }
    var err = Auth.error;
    // Signed in before: get a new Google sign-in without any screens, then come straight back.
    if (Auth.email && !err) { view.innerHTML = '<p class="results" style="text-align:center;margin-top:40px">Signing in…</p>'; Auth.signIn(true); return; }
    showSignIn(err in AUTH_ERRORS ? AUTH_ERRORS[err] : err);
    return;
  }
  $('#fab').hidden = false;
  document.body.classList.remove('signed-out');
  if (hasCache) { S.entries = normList(cached); sortEntries(); S.loaded = true; render(); }
  else view.innerHTML = '<div style="height:44px"></div>' + '<div class="skel"></div><div class="skel"></div><div class="skel"></div>';
  API.boot().then(function (r) {
    S.entries = normList(r.index.entries); sortEntries();
    S.rootUrl = /^https:\/\/drive\.google\.com\//.test(r.rootUrl || '') ? r.rootUrl : ''; S.aiTitles = r.aiTitles || ''; S.loaded = true; cacheIndex(); render();
    var re = lsGet('diari-reopen');
    if (re) { lsDel('diari-reopen'); if (Date.now() - re.at < 30 * 60e3 && (!re.id || byId(re.id))) openEditor(re.id || null); }
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
