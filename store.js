/*
 * Diari storage: Google sign-in and Google Drive, straight from the app.
 *
 * Uses the same folder and file format as the Apps Script version, so both can be used:
 *   My Drive/Journal/2026/10/2026-10-08 1642 Title.md   one Markdown file per entry
 *   My Drive/Journal/Media/2026/10/...                  original photos and videos
 *   My Drive/Journal/Media/Previews/...                 small JPEG previews
 *   My Drive/Journal/journal-index.json                 fast list of entries (rebuilt from the .md files any time)
 *   My Drive/Journal/diari-settings.json                app settings (your Claude key for AI titles)
 */
(function () {
'use strict';

var CONFIG = window.DIARI_CONFIG || {};
var SCOPE = 'https://www.googleapis.com/auth/drive';
var DRIVE = 'https://www.googleapis.com/drive/v3';
var UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
var FOLDER = 'application/vnd.google-apps.folder';
var ROOT_NAME = 'Journal', MEDIA_NAME = 'Media', PREVIEWS_NAME = 'Previews';
var INDEX_NAME = 'journal-index.json', SETTINGS_NAME = 'diari-settings.json';
var MEDIA_TAG = 'Journal attachment';            // set on every uploaded file; only these are ever trashed
var ATTACH_MARK = '<!-- journal:attachments -->';
var ID_RE = /^[A-Za-z0-9_-]{10,}$/;

function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
function rnd(n) { var a = new Uint8Array(n || 16); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }

/* ================================================================ */
/* Google sign-in (redirect, so it works in the installed app)      */
/* ================================================================ */
var Auth = {
  token: '', exp: 0, email: '', error: '',

  /** Reads a sign-in result from the address, or the saved one. Call once at start. */
  init: function () {
    var saved = lsGet('diari-auth') || {};
    this.token = saved.token || ''; this.exp = saved.exp || 0; this.email = lsGet('diari-email') || '';
    var h = location.hash.charAt(0) === '#' ? location.hash.slice(1) : '';
    if (!/(^|&)(access_token|error)=/.test(h)) return;
    var p = new URLSearchParams(h), pending = lsGet('diari-auth-state') || {};
    lsDel('diari-auth-state');
    history.replaceState(null, '', location.pathname + location.search);   // take the token out of the address
    if (!pending.state || p.get('state') !== pending.state || Date.now() - pending.at > 10 * 60e3) {
      this.error = 'The sign-in reply did not match. Please sign in again.';
      return;
    }
    if (p.get('error')) { this.error = p.get('error'); this.silentFailed = !!pending.silent; return; }
    var granted = (p.get('scope') || '').split(' ');
    if (granted.indexOf(SCOPE) < 0) { this.error = 'drive_not_granted'; return; }
    this.token = p.get('access_token');
    this.exp = Date.now() + (Number(p.get('expires_in')) || 3600) * 1000;
    lsSet('diari-auth', { token: this.token, exp: this.exp });
  },

  valid: function (marginMs) { return !!this.token && this.exp - Date.now() > (marginMs || 0); },

  /** Leaves the app for Google's sign-in page and comes back. silent: no screens if already allowed. */
  signIn: function (silent) {
    if (!CONFIG.clientId) throw new Error('The app is not set up yet: the Google client ID is missing in config.js.');
    var state = rnd(16);
    lsSet('diari-auth-state', { state: state, silent: !!silent, at: Date.now() });
    var q = {
      client_id: CONFIG.clientId,
      redirect_uri: CONFIG.redirectUri,
      response_type: 'token',
      scope: SCOPE,
      include_granted_scopes: 'true',
      state: state
    };
    if (silent) q.prompt = 'none';
    if (this.email) q.login_hint = this.email;
    location.assign('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(q).toString());
    return new Promise(function () {});        // the page is leaving
  },

  signOut: function () {
    var t = this.token;
    this.token = ''; this.exp = 0;
    lsDel('diari-auth');
    if (t) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(t), { method: 'POST' }).catch(function () {});
  }
};

var Expired = function () { var e = new Error('Your Google sign-in has expired.'); e.expired = true; return e; };

function driveFetch(url, opts) {
  if (!Auth.valid(15e3)) return Promise.reject(Expired());
  opts = opts || {};
  var headers = Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + Auth.token });
  return fetch(url, Object.assign({}, opts, { headers: headers })).then(function (r) {
    if (r.status === 401) { Auth.token = ''; lsDel('diari-auth'); throw Expired(); }
    return r;
  });
}

function driveError(r) {
  return r.text().then(function (t) {
    var msg = '';
    try { var j = JSON.parse(t); msg = j.error && j.error.message || ''; } catch (e) {}
    if (/has not been used|is disabled/i.test(msg)) return 'The Google Drive API is turned off for this app. In Google Cloud, open APIs & Services and enable the Google Drive API.';
    if (r.status === 404) return 'This file is no longer in your Google Drive.';
    if (r.status === 403 && /insufficient|scope/i.test(msg)) return 'Diari is not allowed to use your Google Drive. Sign out, then sign in again and allow access.';
    return 'Google Drive said: ' + (msg || ('error ' + r.status));
  });
}

function dj(url, opts) {
  return driveFetch(url, opts).then(function (r) {
    if (!r.ok) return driveError(r).then(function (m) { throw new Error(m); });
    return r.status === 204 ? {} : r.json();
  });
}

/* ================================================================ */
/* Drive files and folders                                          */
/* ================================================================ */
function qs(o) { return new URLSearchParams(o).toString(); }
function qv(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function list(q, fields) {
  var out = [];
  function page(token) {
    var p = { q: q, fields: 'nextPageToken,files(' + (fields || 'id,name') + ')', pageSize: 1000, orderBy: 'createdTime', spaces: 'drive' };
    if (token) p.pageToken = token;
    return dj(DRIVE + '/files?' + qs(p)).then(function (r) {
      out = out.concat(r.files || []);
      return r.nextPageToken ? page(r.nextPageToken) : out;
    });
  }
  return page('');
}

function findOne(parentId, name, folder) {
  return list("'" + qv(parentId) + "' in parents and name = '" + qv(name) + "' and trashed = false" +
    (folder ? " and mimeType = '" + FOLDER + "'" : " and mimeType != '" + FOLDER + "'")).then(function (f) { return f[0] || null; });
}

var folderCache = {};
function folder(parentId, name) {
  var k = parentId + '/' + name;
  if (folderCache[k]) return folderCache[k];
  folderCache[k] = findOne(parentId, name, true).then(function (f) {
    if (f) return f.id;
    return dj(DRIVE + '/files?fields=id', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, mimeType: FOLDER, parents: [parentId] })
    }).then(function (r) { return r.id; });
  }).catch(function (e) { delete folderCache[k]; throw e; });
  return folderCache[k];
}

function getMeta(id, fields) { return dj(DRIVE + '/files/' + encodeURIComponent(id) + '?fields=' + encodeURIComponent(fields || 'id')); }

function readText(id) {
  return driveFetch(DRIVE + '/files/' + encodeURIComponent(id) + '?alt=media').then(function (r) {
    if (!r.ok) return driveError(r).then(function (m) { throw new Error(m); });
    return r.text();
  });
}

function multipart(meta, text, mime) {
  var b = 'diari' + rnd(8);
  var body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
    '\r\n--' + b + '\r\nContent-Type: ' + mime + '; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--';
  return { body: new Blob([body]), type: 'multipart/related; boundary=' + b };
}

function createFile(parentId, name, text, mime) {
  mime = mime || 'text/plain';
  var mp = multipart({ name: name, parents: [parentId], mimeType: mime }, text, mime);
  return dj(UPLOAD + '/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': mp.type }, body: mp.body });
}

function updateFile(id, text, meta, params, mime) {
  mime = mime || 'text/plain';
  var mp = multipart(meta || {}, text, mime);
  var p = Object.assign({ uploadType: 'multipart', fields: 'id' }, params || {});
  return dj(UPLOAD + '/files/' + encodeURIComponent(id) + '?' + qs(p), { method: 'PATCH', headers: { 'Content-Type': mp.type }, body: mp.body });
}

function trash(id) {
  return dj(DRIVE + '/files/' + encodeURIComponent(id) + '?fields=id', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true })
  });
}

/** Only files this app uploaded (tagged in their description) are ever moved to the trash. */
function trashIfOurs(id) {
  if (!id || !ID_RE.test(String(id))) return Promise.resolve();
  return getMeta(id, 'id,description,trashed').then(function (f) {
    if (String(f.description || '').indexOf(MEDIA_TAG) === 0 && !f.trashed) return trash(id);
  }).catch(function () { /* already gone */ });
}
function trashMedia(m) { return Promise.all([m.id, m.thumb, m.preview].map(trashIfOurs)); }

/* ================================================================ */
/* Journal folder, index and settings                               */
/* ================================================================ */
var rootP = null;
function root() {
  if (rootP) return rootP;
  var saved = lsGet('diari-root');
  var check = saved ? getMeta(saved, 'id,trashed').then(function (f) { return f.trashed ? null : f.id; }).catch(function (e) { if (e.expired) throw e; return null; }) : Promise.resolve(null);
  rootP = check.then(function (id) {
    if (id) return id;
    return getMeta('root', 'id').then(function (r) { return folder(r.id, ROOT_NAME); });
  }).then(function (id) { lsSet('diari-root', id); return id; })
    .catch(function (e) { rootP = null; throw e; });
  return rootP;
}

function readIndex(rootId) {
  return findOne(rootId, INDEX_NAME).then(function (f) {
    if (!f) return null;
    return readText(f.id).then(function (t) {
      var parsed; try { parsed = JSON.parse(t); } catch (e) { return null; }
      if (!parsed || !Array.isArray(parsed.entries)) return null;
      return { version: 1, entries: parsed.entries.map(cleanStored).filter(Boolean), fileId: f.id };
    });
  });
}

function writeIndex(rootId, index) {
  index.entries.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var text = JSON.stringify({ version: 1, updated: new Date().toISOString(), entries: index.entries });
  if (index.fileId) return updateFile(index.fileId, text, {}, null, 'application/json');
  return findOne(rootId, INDEX_NAME).then(function (f) {
    if (f) return updateFile(f.id, text, {}, null, 'application/json');
    return createFile(rootId, INDEX_NAME, text, 'application/json').then(function (r) { index.fileId = r.id; });
  });
}

function rebuildIndex(rootId) {
  var isFolder = "mimeType = '" + FOLDER + "' and trashed = false";
  return list("'" + qv(rootId) + "' in parents and " + isFolder).then(function (years) {
    years = years.filter(function (y) { return /^\d{4}$/.test(y.name); });
    return Promise.all(years.map(function (y) { return list("'" + y.id + "' in parents and " + isFolder); }));
  }).then(function (monthLists) {
    var months = [].concat.apply([], monthLists);
    return Promise.all(months.map(function (m) {
      return list("'" + m.id + "' in parents and trashed = false and mimeType != '" + FOLDER + "'");
    }));
  }).then(function (fileLists) {
    var files = [].concat.apply([], fileLists).filter(function (f) { return /\.md$/i.test(f.name); });
    var out = [], i = 0;
    function worker() {
      if (i >= files.length) return Promise.resolve();
      var f = files[i++];
      return readText(f.id).then(function (t) { var r = fromMarkdown(t, f.id); if (r) out.push(r); })
        .catch(function (e) { if (e.expired) throw e; }).then(worker);
    }
    return Promise.all([worker(), worker(), worker(), worker(), worker()]).then(function () { return out; });
  }).then(function (entries) {
    return findOne(rootId, INDEX_NAME).then(function (f) {
      var index = { version: 1, entries: entries, fileId: f ? f.id : '' };
      return writeIndex(rootId, index).then(function () { return index; });
    });
  });
}

var settingsP = null;
function settings() {
  if (settingsP) return settingsP;
  settingsP = root().then(function (r) { return findOne(r, SETTINGS_NAME); }).then(function (f) {
    if (!f) return { fileId: '', data: {} };
    return readText(f.id).then(function (t) {
      var d = {}; try { d = JSON.parse(t) || {}; } catch (e) {}
      return { fileId: f.id, data: d };
    });
  }).catch(function (e) { settingsP = null; throw e; });
  return settingsP;
}
function saveSettings(patch) {
  return Promise.all([root(), settings()]).then(function (x) {
    var r = x[0], s = x[1];
    Object.keys(patch).forEach(function (k) { if (patch[k] == null || patch[k] === '') delete s.data[k]; else s.data[k] = patch[k]; });
    var text = JSON.stringify(s.data, null, 2);
    var p = s.fileId ? updateFile(s.fileId, text, {}, null, 'application/json')
      : createFile(r, SETTINGS_NAME, text, 'application/json').then(function (res) { s.fileId = res.id; });
    return p.then(function () { return s.data; });
  });
}

/* ================================================================ */
/* Entry files (same format as the Apps Script version)             */
/* ================================================================ */
function okId(v) { return v && ID_RE.test(String(v)) ? String(v) : ''; }

function cleanRec(x) {
  if (!x || !/^[A-Za-z0-9_-]{6,48}$/.test(String(x.id))) throw new Error('This entry has no valid id.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.date))) throw new Error('The entry date is not valid.');
  var num = function (v) { var n = Number(v); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };
  var media = (Array.isArray(x.media) ? x.media : []).filter(function (m) { return m && okId(m.id); }).map(function (m) {
    return {
      id: okId(m.id), type: m.type === 'video' ? 'video' : 'photo',
      name: String(m.name || '').slice(0, 200), mime: String(m.mime || '').slice(0, 100),
      size: num(m.size), w: num(m.w), h: num(m.h), dur: num(m.dur),
      thumb: okId(m.thumb), preview: okId(m.preview)
    };
  });
  var seen = {};
  var tags = (Array.isArray(x.tags) ? x.tags : []).map(function (t) { return String(t).replace(/^#+/, '').trim().slice(0, 40); })
    .filter(function (t) { var k = t.toLowerCase(); if (!t || seen[k]) return false; seen[k] = true; return true; }).slice(0, 30);
  return {
    id: String(x.id), date: String(x.date),
    title: String(x.title || '').trim().slice(0, 200),
    body: String(x.body || '').replace(/\r\n?/g, '\n').replace(/\s+$/, ''),
    tags: tags, media: media
  };
}

function cleanStored(e) {
  try {
    var r = cleanRec(e);
    r.created = String(e.created || '').slice(0, 40);
    r.updated = String(e.updated || '').slice(0, 40);
    r.fileId = okId(e.fileId);
    return r;
  } catch (err) { return null; }
}

function toMarkdown(r) {
  var lines = ['---',
    'id: ' + JSON.stringify(r.id), 'date: ' + JSON.stringify(r.date), 'title: ' + JSON.stringify(r.title),
    'tags: ' + JSON.stringify(r.tags), 'media: ' + JSON.stringify(r.media),
    'created: ' + JSON.stringify(r.created || ''), 'updated: ' + JSON.stringify(r.updated || ''),
    '---', '', r.body || ''];
  if (r.media.length) {
    lines.push('', '', ATTACH_MARK);
    r.media.forEach(function (m) {
      lines.push('- [' + (m.type === 'video' ? 'Video' : 'Photo') + ': ' + (m.name || m.id) + '](https://drive.google.com/file/d/' + m.id + '/view)');
    });
  }
  return lines.join('\n') + '\n';
}

function fromMarkdown(text, fileId) {
  text = String(text).replace(/\r\n?/g, '\n');
  var m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  var meta = {};
  m[1].split('\n').forEach(function (line) {
    var k = line.indexOf(':');
    if (k < 1) return;
    var key = line.slice(0, k).trim(), raw = line.slice(k + 1).trim();
    try { meta[key] = JSON.parse(raw); } catch (e) { meta[key] = raw; }
  });
  var body = m[2], cut = body.indexOf(ATTACH_MARK);
  if (cut >= 0) body = body.slice(0, cut);
  return cleanStored({ id: meta.id, date: meta.date, title: meta.title, body: body.replace(/^\n+/, ''), tags: meta.tags, media: meta.media,
    created: meta.created, updated: meta.updated, fileId: fileId });
}

function fileName(r) {
  var t = r.title.replace(/[\\\/:*?"<>|#\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return r.date.slice(0, 10) + ' ' + r.date.slice(11, 13) + r.date.slice(14, 16) + (t ? ' ' + t : '') + '.md';
}

/* ================================================================ */
/* Automatic titles                                                 */
/* ================================================================ */
var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var TITLE_RULES = 'You write titles for entries in a personal journal. Reply with the title only: 2 to 7 words, ' +
  'in the main language the entry is written in (keep local words like place or food names as they are), saying plainly what the entry is about. ' +
  'No quotation marks, emoji, hashtags or full stop at the end. Never ask questions or explain. If the entry is short or unclear, ' +
  'still give your best title based on its words.';

function plainText(md) {
  return String(md || '').replace(/\r\n?/g, '\n').split('\n').map(function (l) {
    return l.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').replace(/^\s*>\s?/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').trim();
  }).join('\n').trim();
}

function basicTitle(rec) {
  var lines = plainText(rec.body).split('\n').filter(function (l) { return l.trim(); });
  if (lines.length) {
    var first = lines[0].trim(), m = first.match(/^(.+?(?:[.!?](?=\s|$)|[。！？]))/);
    var t = (m ? m[1] : first).replace(/[\s.!?。！？,;:，；：]+$/, '');
    if (t.length > 60) { t = t.slice(0, 60); var sp = t.lastIndexOf(' '); if (sp > 30) t = t.slice(0, sp); t = t.replace(/[\s,;:，；：]+$/, '') + '…'; }
    if (t) return t.charAt(0).toUpperCase() + t.slice(1);
  }
  var d = String(rec.date || ''), label = 'Journal entry';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}/.test(d)) {
    var h = +d.slice(11, 13);
    label = DAYS[new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)).getDay()] + ' ' +
      (h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night');
  }
  var ms = rec.media || [], v = ms.filter(function (x) { return (x.type || x) === 'video'; }).length, p = ms.length - v;
  if (p && v) return label + ' photos and videos';
  if (p) return label + (p === 1 ? ' photo' : ' photos');
  if (v) return label + (v === 1 ? ' video' : ' videos');
  return label;
}

function quiet(msg) { var e = new Error(msg); e.quiet = true; return e; }

function tidyTitle(raw) {
  var t = String(raw || '').trim().split('\n')[0];
  t = t.replace(/^\s*title\s*[:\-]\s*/i, '').replace(/^[\s"'“”‘’*#_`]+|[\s"'“”‘’*_`.。]+$/g, '').replace(/\s+/g, ' ').trim();
  if (!t) throw quiet('The AI reply had no title');
  if (t.length > 90 || t.split(' ').length > 12) throw quiet('The AI reply was too long for a title');
  return t;
}

function claudeCall(key, path, body) {
  return fetch('https://api.anthropic.com/v1/' + path, {
    method: body ? 'POST' : 'GET',
    headers: Object.assign({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body ? { 'content-type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) throw new Error('Claude error ' + r.status + (d.error && d.error.message ? ': ' + d.error.message : ''));
      return d;
    });
  }, function () { throw new Error('Could not reach Claude. Check your connection.'); });
}

function aiTitle(key, model, rec) {
  var entry = (rec.tags && rec.tags.length ? 'Tags: ' + rec.tags.join(', ') + '\n' : '') + '<entry>\n' + plainText(rec.body).slice(0, 6000) + '\n</entry>';
  return claudeCall(key, 'messages', {
    model: model || 'claude-haiku-5-5', max_tokens: 60,
    thinking: { type: 'disabled' },          // without this, short entries can use the whole reply on thinking
    system: TITLE_RULES, messages: [{ role: 'user', content: entry }]
  }).then(function (d) {
    if (d.stop_reason === 'max_tokens') throw quiet('Claude replied with more than a title');
    return tidyTitle((d.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text || ''; }).join(''));
  });
}

function makeTitle(rec) {
  return settings().catch(function () { return { data: {} }; }).then(function (s) {
    var key = s.data.anthropicKey;
    if (!key || !String(rec.body || '').trim()) return { title: basicTitle(rec), ai: false, note: '' };
    return aiTitle(key, s.data.claudeModel, rec).then(function (t) { return { title: t, ai: true, note: '' }; }, function (e) {
      return { title: basicTitle(rec), ai: false, note: e.quiet ? '' : 'The AI title did not work (' + String(e.message || e).slice(0, 160) + '), so the first sentence was used.' };
    });
  });
}

/* ================================================================ */
/* Photos and videos                                                */
/* ================================================================ */
function xhrPut(url, body, range, onProg) {
  return new Promise(function (res, rej) {
    var x = new XMLHttpRequest();
    x.open('PUT', url);
    x.setRequestHeader('Content-Range', range);
    x.upload.onprogress = function (e) { if (onProg) onProg(e.loaded); };
    x.onload = function () { res({ status: x.status, body: x.responseText }); };
    x.onerror = function () { rej(new Error('The upload lost its connection. Tap the item to try again.')); };
    x.send(body);
  });
}

// Small cache for list previews, so thumbnails appear instantly and offline.
var IDB = (function () {
  var dbp = null;
  function open() {
    if (!dbp) dbp = new Promise(function (res) {
      try {
        var r = indexedDB.open('diari-cache', 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('m'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { res(null); };
      } catch (e) { res(null); }
    });
    return dbp;
  }
  return {
    get: function (k) {
      return open().then(function (db) {
        if (!db) return null;
        return new Promise(function (res) {
          try { var q = db.transaction('m').objectStore('m').get(k); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { res(null); }; }
          catch (e) { res(null); }
        });
      });
    },
    put: function (k, v) { return open().then(function (db) { if (db) try { db.transaction('m', 'readwrite').objectStore('m').put(v, k); } catch (e) {} }); },
    clear: function () { return open().then(function (db) { if (db) try { db.transaction('m', 'readwrite').objectStore('m').clear(); } catch (e) {} }); }
  };
})();

var targets = {};

/* ================================================================ */
/* What the app calls                                               */
/* ================================================================ */
window.DiariStore = {
  Auth: Auth,
  basicTitle: basicTitle,

  boot: function () {
    return root().then(function (r) {
      return readIndex(r).then(function (idx) { return idx || rebuildIndex(r); }).then(function (idx) {
        return Promise.all([settings().catch(function () { return { data: {} }; }),
          Auth.email ? null : dj(DRIVE + '/about?fields=user(emailAddress)').then(function (a) {
            Auth.email = a.user && a.user.emailAddress || ''; lsSet('diari-email', Auth.email);
          }).catch(function () {})
        ]).then(function (x) {
          return { index: { entries: idx.entries }, rootUrl: 'https://drive.google.com/drive/folders/' + r, aiTitles: x[0].data.anthropicKey ? 'Claude' : '' };
        });
      });
    });
  },

  save: function (input) {
    var rec = cleanRec(input), note = '';
    var titled = rec.title ? Promise.resolve() : makeTitle(rec).then(function (t) { rec.title = t.title; note = t.note; });
    return titled.then(root).then(function (r) {
      return readIndex(r).then(function (idx) { return idx || rebuildIndex(r); }).then(function (index) {
        var i = index.entries.findIndex(function (e) { return e.id === rec.id; });
        var prev = i >= 0 ? index.entries[i] : null, now = new Date().toISOString();
        rec.created = prev && prev.created ? prev.created : now;
        rec.updated = now;
        var name = fileName(rec), text = toMarkdown(rec);
        return folder(r, rec.date.slice(0, 4)).then(function (y) { return folder(y, rec.date.slice(5, 7)); }).then(function (monthId) {
          var existing = prev && prev.fileId ? getMeta(prev.fileId, 'id,name,trashed,parents').catch(function (e) { if (e.expired) throw e; return null; }) : Promise.resolve(null);
          return existing.then(function (f) {
            if (f && !f.trashed) {
              var params = {};
              var parents = f.parents || [];
              if (parents.indexOf(monthId) < 0) { params.addParents = monthId; if (parents.length) params.removeParents = parents.join(','); }
              return updateFile(f.id, text, f.name !== name ? { name: name } : {}, params).then(function () { return f.id; });
            }
            return createFile(monthId, name, text).then(function (res) { return res.id; });
          });
        }).then(function (fileId) {
          rec.fileId = fileId;
          var gone = [];
          if (prev) {
            var keep = {};
            rec.media.forEach(function (m) { keep[m.id] = true; });
            gone = (prev.media || []).filter(function (m) { return !keep[m.id]; });
          }
          if (i >= 0) index.entries[i] = rec; else index.entries.push(rec);
          return writeIndex(r, index).then(function () { return Promise.all(gone.map(trashMedia)); });
        }).then(function () { return Object.assign({}, rec, { _note: note }); });
      });
    });
  },

  remove: function (id) {
    return root().then(function (r) {
      return readIndex(r).then(function (idx) { return idx || rebuildIndex(r); }).then(function (index) {
        var i = index.entries.findIndex(function (e) { return e.id === id; });
        if (i < 0) return true;
        var e = index.entries[i];
        index.entries.splice(i, 1);
        return writeIndex(r, index).then(function () {
          return Promise.all([e.fileId ? trash(e.fileId).catch(function () {}) : null].concat((e.media || []).map(trashMedia)));
        }).then(function () { return true; });
      });
    });
  },

  discard: function (items) { return Promise.all((Array.isArray(items) ? items : []).map(trashMedia)); },

  rebuild: function () { return root().then(rebuildIndex).then(function (idx) { return { entries: idx.entries }; }); },

  suggest: function (x) {
    var rec = {
      date: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(x.date)) ? String(x.date) : '',
      body: String(x.body || ''),
      tags: Array.isArray(x.tags) ? x.tags.map(String).slice(0, 30) : [],
      media: Array.isArray(x.media) ? x.media.map(function (t) { return { type: t === 'video' ? 'video' : 'photo' }; }) : []
    };
    return makeTitle(rec);
  },

  titleAll: function () {
    return root().then(function (r) {
      return readIndex(r).then(function (idx) { return idx || rebuildIndex(r); }).then(function (index) {
        var todo = index.entries.filter(function (e) { return !e.title; }).slice(0, 40), note = '', count = 0;
        var chain = Promise.resolve();
        todo.forEach(function (e) {
          chain = chain.then(function () { return makeTitle(e); }).then(function (t) {
            if (t.note) note = t.note;
            e.title = t.title; count++;
            if (e.fileId) return updateFile(e.fileId, toMarkdown(e), { name: fileName(e) }).catch(function (err) { if (err.expired) throw err; });
          });
        });
        return chain.then(function () { return count ? writeIndex(r, index) : null; }).then(function () {
          return { index: { entries: index.entries }, count: count, left: index.entries.filter(function (e) { return !e.title; }).length, note: note };
        });
      });
    });
  },

  target: function (date) {
    var k = date.slice(0, 7);
    if (targets[k]) return targets[k];
    targets[k] = root().then(function (r) { return folder(r, MEDIA_NAME); }).then(function (media) {
      return Promise.all([folder(media, date.slice(0, 4)).then(function (y) { return folder(y, date.slice(5, 7)); }), folder(media, PREVIEWS_NAME)]);
    }).then(function (x) { return { folderId: x[0], previewId: x[1] }; })
      .catch(function (e) { delete targets[k]; throw e; });
    return targets[k];
  },

  upload: function (blob, meta, onProg) {
    var size = blob.size, mime = meta.mime || blob.type || 'application/octet-stream';
    return driveFetch(UPLOAD + '/files?uploadType=resumable&fields=id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size) },
      body: JSON.stringify({ name: meta.name, parents: [meta.folderId], description: MEDIA_TAG, mimeType: mime })
    }).then(function (r) {
      if (!r.ok) return driveError(r).then(function (m) { throw new Error(m); });
      var loc = r.headers.get('Location');
      if (!loc) throw new Error('Google Drive did not start the upload. Try again.');
      var CH = 8 * 1024 * 1024, off = 0;
      function next() {
        var end = Math.min(off + CH, size);
        var range = size ? 'bytes ' + off + '-' + (end - 1) + '/' + size : 'bytes */0';
        return xhrPut(loc, blob.slice(off, end), range, function (sent) { if (onProg && size) onProg(Math.min(1, (off + sent) / size)); })
          .then(function (res) {
            if (res.status === 200 || res.status === 201) return JSON.parse(res.body).id;
            if (res.status === 308 && end < size) { off = end; return next(); }
            throw new Error('The upload stopped (Drive error ' + res.status + '). Tap the item to try again.');
          });
      }
      return next();
    });
  },

  load: function (id, onProg, persist) {
    var cached = persist ? IDB.get(id) : Promise.resolve(null);
    return cached.then(function (blob) {
      if (blob) return URL.createObjectURL(blob);
      return driveFetch(DRIVE + '/files/' + encodeURIComponent(id) + '?alt=media').then(function (r) {
        if (!r.ok) return driveError(r).then(function (m) { throw new Error(m); });
        var total = +r.headers.get('Content-Length') || 0, type = r.headers.get('Content-Type') || '';
        if (!r.body || !onProg || !total) return r.blob();
        var reader = r.body.getReader(), chunks = [], got = 0;
        function pump() {
          return reader.read().then(function (x) {
            if (x.done) return new Blob(chunks, { type: type });
            chunks.push(x.value); got += x.value.length; onProg(got / total);
            return pump();
          });
        }
        return pump();
      }).then(function (b) { if (persist) IDB.put(id, b); return URL.createObjectURL(b); });
    });
  },

  /** Saves (or removes, with '') the Claude key after checking it with Claude. */
  setClaudeKey: function (key) {
    key = String(key || '').trim();
    var check = key ? claudeCall(key, 'models?limit=1') : Promise.resolve();
    return check.then(function () { return saveSettings({ anthropicKey: key }); }).then(function (d) { return d.anthropicKey ? 'Claude' : ''; });
  },

  signOut: function () {
    Auth.signOut();
    ['diari-index', 'diari-draft', 'diari-root', 'diari-email', 'diari-reopen'].forEach(lsDel);
    return IDB.clear();
  }
};
})();
