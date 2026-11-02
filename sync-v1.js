/* ToolSync v1 – gemeinsamer GitHub-Sync für die Tools unter thevizce.github.io
 *
 * Einbinden:  <script src="/startseite/sync-v1.js"></script>
 * Benutzen:
 *   const SYNC = window.ToolSync && ToolSync.create({
 *     tool: 'pokemon-go',                       // Dateiname im Daten-Repo: pokemon-go.json
 *     collections: { pokemon: 'array', regionHints: 'map' }, // array = Liste mit id, map = Objekt
 *     fields: ['xpDigits'],                      // einzelne Werte, als Ganzes abgeglichen
 *     get: () => S,                              // aktueller Stand des Tools
 *     apply: async data => { ...; return true }  // zusammengeführten Stand übernehmen + lokal speichern
 *   });
 *   SYNC && SYNC.start();     // nach dem Laden
 *   SYNC && SYNC.changed();   // nach jedem erfolgreichen lokalen Speichern
 *
 * Speicher:
 *   localStorage  "toolsync.config"   – Repo + Token (klein, wird auf der Startseite eingetragen)
 *   IndexedDB     "toolsync"          – pro Tool: Abgleich-Stand (meta) und Sicherheitskopie (safety)
 * Ruft nie localStorage.clear() auf und fasst keine Daten anderer Tools an.
 */
(function () {
  'use strict';
  if (window.ToolSync) return;

  const CFG_KEY = 'toolsync.config';
  const DB_NAME = 'toolsync';
  const API = 'https://api.github.com';
  const TOMB_MAX_AGE = 365 * 864e5;   // Löschvermerke ein Jahr behalten
  const STAMP_DELAY = 300;
  const PUSH_DELAY = 3000;
  const MASS_DELETE_MIN = 10, MASS_DELETE_SHARE = 0.3;

  /* ---------- Konfiguration ---------- */
  function readConfig() {
    try {
      const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
      if (c && c.token && c.owner && c.repo) return Object.assign({ branch: 'main', path: '' }, c);
    } catch (e) {}
    return null;
  }
  const repoKey = c => `${c.owner}/${c.repo}@${c.branch}/${c.path || ''}`;

  /* ---------- eigene kleine Datenbank ---------- */
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB nicht verfügbar'));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
        if (!d.objectStoreNames.contains('safety')) d.createObjectStore('safety');
      };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); };
      r.onerror = () => { dbp = null; rej(r.error || new Error('Sync-Datenbank nicht verfügbar')); };
      r.onblocked = () => { dbp = null; rej(new Error('Sync-Datenbank blockiert')); };
    });
    return dbp;
  }
  async function dbGet(store, key) {
    const d = await openDb();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readonly'), q = t.objectStore(store).get(key);
      t.oncomplete = () => res(q.result);
      t.onerror = t.onabort = () => rej(t.error || new Error('Lesefehler'));
    });
  }
  async function dbPut(store, key, val) {
    const d = await openDb();
    return new Promise((res, rej) => {
      const t = d.transaction(store, 'readwrite');
      t.objectStore(store).put(val, key);
      t.oncomplete = () => res();
      t.onerror = t.onabort = () => rej(t.error || new Error('Schreibfehler'));
    });
  }

  /* ---------- Hilfen ---------- */
  function stable(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(x => x === undefined ? 'null' : stable(x)).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  function hash(v) {
    const s = stable(v);
    let h1 = 0x811c9dc5, h2 = 0x1505;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = (Math.imul(h2, 33) + c) | 0;
    }
    return (h1 >>> 0).toString(36) + '.' + (h2 >>> 0).toString(36) + '.' + s.length.toString(36);
  }
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  function b64enc(s) {
    const b = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
  function deviceName() {
    const ua = navigator.userAgent;
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad|Macintosh.*Mobile/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
      : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Gerät';
    const app = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
    return os + (app ? ' (App)' : '');
  }
  const syncError = (msg, extra) => Object.assign(new Error(msg), extra || {});

  /* ---------- GitHub ---------- */
  function headers(c, accept) {
    return { Authorization: 'Bearer ' + c.token, Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  }
  const repoUrl = c => `${API}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
  const fileUrl = (c, file) => repoUrl(c) + '/contents/' + (c.path ? c.path.replace(/^\/|\/$/g, '') + '/' : '').split('/').concat(file).filter(Boolean).map(encodeURIComponent).join('/');

  async function ghFail(r, what) {
    let m = ''; try { m = (await r.json()).message || ''; } catch (e) {}
    if (r.status === 401) return syncError('Token ungültig oder abgelaufen. Neuen Token auf der Startseite eintragen.', { auth: true });
    if (r.status === 403 && /rate limit/i.test(m)) return syncError('GitHub-Anfragelimit erreicht. In ein paar Minuten klappt es wieder.', { retry: true });
    if (r.status === 403) return syncError('Der Token darf nicht auf das Daten-Repo schreiben (Contents: Read and write nötig).', { auth: true });
    if (r.status >= 500) return syncError(`GitHub antwortet gerade nicht (${r.status}).`, { retry: true });
    return syncError(`${what} fehlgeschlagen (${r.status}${m ? ': ' + m : ''})`);
  }

  async function ghRead(c, file) {
    const r = await fetch(fileUrl(c, file) + '?ref=' + encodeURIComponent(c.branch), { headers: headers(c), cache: 'no-store' });
    if (r.status === 404) {
      const rr = await fetch(repoUrl(c), { headers: headers(c), cache: 'no-store' });
      if (!rr.ok) throw syncError(`Daten-Repo ${c.owner}/${c.repo} nicht gefunden, oder der Token hat keinen Zugriff darauf.`, { auth: true });
      return { sha: null, json: null };
    }
    if (!r.ok) throw await ghFail(r, 'Lesen');
    const j = await r.json();
    let text;
    if (j.content && j.encoding === 'base64') text = b64dec(j.content);
    else {
      // größer als 1 MB: Inhalt über die Blob-Schnittstelle holen
      const br = await fetch(repoUrl(c) + '/git/blobs/' + j.sha, { headers: headers(c, 'application/vnd.github.raw+json'), cache: 'no-store' });
      if (!br.ok) throw await ghFail(br, 'Lesen');
      text = await br.text();
    }
    let json;
    try { json = JSON.parse(text); } catch (e) { throw syncError(`${file} im Daten-Repo ist kein gültiges JSON. Es wird nichts überschrieben.`); }
    return { sha: j.sha, json };
  }

  async function ghWrite(c, file, body, sha, message) {
    const payload = { message, content: b64enc(JSON.stringify(body)), branch: c.branch };
    if (sha) payload.sha = sha;
    const r = await fetch(fileUrl(c, file), { method: 'PUT', headers: Object.assign(headers(c), { 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
    if (r.status === 409 || r.status === 422) throw syncError('conflict', { conflict: true });
    if (!r.ok) throw await ghFail(r, 'Speichern');
    return (await r.json()).content.sha;
  }

  /* ---------- Werkzeug-Instanz ---------- */
  function create(opts) {
    if (!opts || !opts.tool || typeof opts.get !== 'function' || typeof opts.apply !== 'function') throw new Error('ToolSync: tool, get und apply sind nötig');
    const TOOL = String(opts.tool);
    const FILE = TOOL + '.json';
    const COLLS = Object.assign({}, opts.collections || {});
    const FIELDS = (opts.fields || []).slice();

    let queue = Promise.resolve();
    const run = fn => (queue = queue.then(fn, fn));
    let applying = false, dirty = false, started = false;
    let stampTimer = null, pushTimer = null;
    let lastSync = 0, status = 'off', statusText = '', lastError = null;

    /* Einträge eines Bereichs als Map id → Wert */
    function entries(state, coll) {
      const v = state ? state[coll] : null, m = new Map();
      if (COLLS[coll] === 'map') {
        if (v && typeof v === 'object') for (const k of Object.keys(v)) if (v[k] !== undefined) m.set(k, v[k]);
      } else if (Array.isArray(v)) {
        for (const it of v) {
          if (it == null) continue;
          const id = (typeof it === 'object' && it.id != null && it.id !== '') ? String(it.id) : 'h:' + hash(it);
          if (!m.has(id)) m.set(id, it);
        }
      }
      return m;
    }
    const native = (coll, m) => COLLS[coll] === 'map' ? Object.fromEntries(m) : Array.from(m.values());

    function blankMeta() { return { v: 1, sha: null, repo: null, init: false, lastSync: 0, h: {}, u: {}, del: {}, fh: {}, fu: {} }; }
    async function loadMeta() {
      const m = Object.assign(blankMeta(), (await dbGet('meta', TOOL)) || {});
      for (const c of Object.keys(COLLS)) { m.h[c] = m.h[c] || {}; m.u[c] = m.u[c] || {}; m.del[c] = m.del[c] || {}; }
      return m;
    }
    const saveMeta = m => dbPut('meta', TOOL, m);

    /* Lokale Änderungen erkennen und mit Zeitstempel versehen */
    function stamp(meta, state, initial) {
      const now = Date.now();
      let n = 0;
      for (const c of Object.keys(COLLS)) {
        const cur = entries(state, c), H = meta.h[c], U = meta.u[c], D = meta.del[c];
        for (const [id, val] of cur) {
          const h = hash(val);
          if (H[id] !== h) { H[id] = h; U[id] = initial ? 1 : now; if (D[id]) delete D[id]; n++; }
        }
        for (const id of Object.keys(H)) {
          if (!cur.has(id)) { delete H[id]; delete U[id]; D[id] = now; n++; }
        }
      }
      for (const f of FIELDS) {
        const v = state ? state[f] : undefined;
        const h = v === undefined ? null : hash(v);
        if ((meta.fh[f] || null) !== h) { meta.fh[f] = h; meta.fu[f] = initial ? 1 : now; n++; }
      }
      return n;
    }

    /* Lokal + entfernt zusammenführen. Pro Eintrag gewinnt die jüngste Änderung (auch eine Löschung).
       Bei Gleichstand gewinnt der entfernte Stand. */
    function merge(meta, state, remote, keep) {
      const R = remote && remote.json ? remote.json : null;
      const rData = (R && R.data) || {}, rU = (R && R.u) || {}, rDel = (R && R.del) || {}, rFu = (R && R.fu) || {};
      const out = { data: {}, u: {}, del: {}, fu: {} };
      const res = { localChanged: false, deletions: [], existing: 0 };
      const cutoff = Date.now() - TOMB_MAX_AGE;

      for (const c of Object.keys(COLLS)) {
        const L = entries(state, c), Rm = entries(rData, c);
        const lu = meta.u[c], ld = meta.del[c], ru = rU[c] || {}, rd = rDel[c] || {};
        const ids = [];
        const seen = new Set();
        const add = id => { if (!seen.has(id)) { seen.add(id); ids.push(id); } };
        L.forEach((_, id) => add(id)); Rm.forEach((_, id) => add(id));
        Object.keys(ld).forEach(add); Object.keys(rd).forEach(add);

        const M = new Map(), U = {}, D = {};
        for (const id of ids) {
          const hasL = L.has(id), hasR = Rm.has(id);
          if (hasL || hasR) res.existing++;
          const tL = hasL ? (lu[id] != null ? lu[id] : 0) : -1;
          const tR = hasR ? (ru[id] != null ? ru[id] : 0) : -1;
          const keepIt = keep && keep.has(c + '\u0000' + id);
          const dL = keepIt ? -1 : (ld[id] || -1);
          const dR = keepIt ? -1 : (rd[id] || -1);
          const tDel = Math.max(dL, dR), tVal = Math.max(tL, tR);
          if (tDel >= 0 && tDel >= tVal) {
            if (tDel > cutoff) D[id] = tDel;
            if (hasL || hasR) res.deletions.push({ c, id, local: hasL });
            if (hasL) res.localChanged = true;
          } else if (tVal >= 0) {
            const fromRemote = hasR && (tR >= tL);
            const val = fromRemote ? Rm.get(id) : L.get(id);
            if (fromRemote && (!hasL || hash(L.get(id)) !== hash(val))) res.localChanged = true;
            M.set(id, val); U[id] = fromRemote ? tR : tL;
          }
        }
        out.data[c] = native(c, M); out.u[c] = U; out.del[c] = D;
      }
      for (const f of FIELDS) {
        const lv = state ? state[f] : undefined, rv = rData[f];
        const tL = lv !== undefined ? (meta.fu[f] != null ? meta.fu[f] : 0) : -1;
        const tR = rv !== undefined ? (rFu[f] != null ? rFu[f] : 0) : -1;
        if (tL < 0 && tR < 0) continue;
        const fromRemote = tR >= tL;
        const v = fromRemote ? rv : lv;
        if (fromRemote && hash(lv === undefined ? null : lv) !== hash(v)) res.localChanged = true;
        out.data[f] = v; out.fu[f] = fromRemote ? tR : tL;
      }
      res.out = out;
      res.remoteChanged = !R || stable({ d: R.data || {}, u: R.u || {}, del: R.del || {}, fu: R.fu || {} }) !== stable({ d: out.data, u: out.u, del: out.del, fu: out.fu });
      return res;
    }

    /* Nach erfolgreichem Übernehmen: Abgleich-Stand auf das Ergebnis setzen */
    function adopt(meta, out) {
      for (const c of Object.keys(COLLS)) {
        const m = entries(out.data, c), H = {};
        m.forEach((v, id) => { H[id] = hash(v); });
        meta.h[c] = H; meta.u[c] = Object.assign({}, out.u[c]); meta.del[c] = Object.assign({}, out.del[c]);
      }
      for (const f of FIELDS) {
        if (f in out.data) { meta.fh[f] = out.data[f] === undefined ? null : hash(out.data[f]); meta.fu[f] = out.fu[f]; }
      }
    }

    async function safetyCopy(reason, state) {
      try { await dbPut('safety', TOOL + (reason === 'erster Abgleich' ? '' : ':' + Date.now()), { tool: TOOL, reason, at: new Date().toISOString(), data: clone(state) }); }
      catch (e) { console.warn('ToolSync: Sicherheitskopie fehlgeschlagen', e); }
    }

    /* ---------- Abgleich ---------- */
    function syncNow() {
      return run(async () => {
        clearTimeout(pushTimer); pushTimer = null;
        const cfg = readConfig();
        if (!cfg) { setStatus('off'); return; }
        if (navigator.onLine === false) { setStatus('offline'); return; }
        setStatus('syncing');
        try {
          const meta = await loadMeta();
          const state = opts.get();
          if (!state) { setStatus(dirty ? 'pending' : 'ok'); return; }
          if (meta.repo !== repoKey(cfg)) { meta.sha = null; meta.repo = repoKey(cfg); }
          if (!meta.init) {
            const existing = await dbGet('safety', TOOL).catch(() => null);
            if (!existing) await safetyCopy('erster Abgleich', state);
          }
          stamp(meta, state, !meta.init);

          for (let attempt = 0; ; attempt++) {
            const remote = await ghRead(cfg, FILE);
            if (remote.json && (remote.json.format !== 'toolsync' || remote.json.tool !== TOOL)) {
              throw syncError(`${FILE} im Daten-Repo gehört nicht zu diesem Tool. Es wird nichts überschrieben.`);
            }
            let plan = merge(meta, opts.get(), remote);

            // Schutz vor versehentlichem Massenlöschen
            const n = plan.deletions.length;
            if (n >= MASS_DELETE_MIN && n > plan.existing * MASS_DELETE_SHARE) {
              const ok = window.confirm(
                `Sync (${TOOL}): ${n} von ${plan.existing} Einträgen würden gelöscht – auf allen Geräten.\n\n` +
                `OK = wirklich löschen\nAbbrechen = Einträge behalten bzw. wiederherstellen`);
              if (ok) {
                await safetyCopy('vor Massenlöschung', opts.get());
              } else {
                const keep = new Set(plan.deletions.map(d => d.c + '\u0000' + d.id));
                const now = Date.now();
                for (const d of plan.deletions) { delete meta.del[d.c][d.id]; if (d.local) meta.u[d.c][d.id] = now; }
                plan = merge(meta, opts.get(), remote, keep);
              }
            }

            if (plan.localChanged) {
              applying = true;
              let ok;
              try { ok = await opts.apply(clone(plan.out.data)); }
              finally { applying = false; }
              if (ok === false) throw syncError('Die Daten aus der Cloud konnten lokal nicht gespeichert werden. Es wird nichts hochgeladen.');
            }
            adopt(meta, plan.out);
            meta.init = true;
            await saveMeta(meta);

            if (plan.remoteChanged) {
              const body = { format: 'toolsync', version: 1, tool: TOOL, updatedAt: new Date().toISOString(), device: deviceName(), data: plan.out.data, u: plan.out.u, del: plan.out.del, fu: plan.out.fu };
              try {
                meta.sha = await ghWrite(cfg, FILE, body, remote.sha, `${TOOL}: Abgleich von ${deviceName()}`);
              } catch (e) {
                if (e.conflict && attempt < 4) { await new Promise(r => setTimeout(r, 400 + attempt * 600)); continue; }
                if (e.conflict) throw syncError('Ein anderes Gerät speichert gerade. Bitte gleich noch einmal versuchen.', { retry: true });
                throw e;
              }
            } else {
              meta.sha = remote.sha;
            }
            meta.lastSync = Date.now();
            await saveMeta(meta);
            break;
          }
          dirty = false; lastSync = Date.now(); lastError = null;
          setStatus('ok');
        } catch (e) {
          console.warn('ToolSync:', e);
          lastError = e;
          if (e instanceof TypeError || navigator.onLine === false) setStatus('offline', 'Keine Verbindung – wird später nachgeholt.');
          else setStatus('error', e.message || String(e));
        }
      });
    }

    function changed() {
      if (applying || !readConfig()) return;
      dirty = true;
      if (status !== 'error') setStatus('pending');
      clearTimeout(stampTimer);
      stampTimer = setTimeout(() => {
        run(async () => {
          try {
            const meta = await loadMeta();
            if (!meta.init) return;             // vor dem ersten Abgleich: das erledigt syncNow
            stamp(meta, opts.get(), false);
            await saveMeta(meta);
          } catch (e) { console.warn('ToolSync: Änderung nicht vermerkt', e); }
        });
      }, STAMP_DELAY);
      clearTimeout(pushTimer);
      pushTimer = setTimeout(syncNow, PUSH_DELAY);
    }

    function start() {
      if (started) return syncNow();
      started = true;
      document.addEventListener('visibilitychange', () => {
        if (!readConfig()) return;
        if (document.visibilityState === 'hidden') { if (dirty) syncNow(); }
        else if (Date.now() - lastSync > 20000 || dirty) syncNow();
      });
      window.addEventListener('online', () => { if (readConfig()) syncNow(); });
      window.addEventListener('storage', e => { if (e.key === CFG_KEY) syncNow(); });
      window.addEventListener('beforeunload', e => {
        if (dirty && readConfig()) { syncNow(); }
      });
      return syncNow();
    }

    /* ---------- Anzeige ---------- */
    let host = null, pill = null, pop = null;
    const LABEL = { off: 'Sync aus', ok: 'Synchron', pending: 'Ausstehend', syncing: 'Gleiche ab…', offline: 'Offline', error: 'Sync-Fehler' };
    const COLOR = { off: '#6b7280', ok: '#4cc38a', pending: '#e5b04a', syncing: '#7c9cff', offline: '#9aa1b2', error: '#ef6464' };
    function ensureBadge() {
      if (host || opts.badge === false) return;
      host = document.createElement('div');
      host.setAttribute('data-toolsync', TOOL);
      const pos = Object.assign({ bottom: '12px', left: '12px' }, opts.badge || {});
      host.style.cssText = 'position:fixed;z-index:2147483000;' + Object.entries(pos).map(([k, v]) => `${k}:calc(${v} + env(safe-area-inset-${k}, 0px))`).join(';');
      const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
      root.innerHTML = `<style>
        :host{all:initial}
        .p{font:600 12px/1 system-ui,-apple-system,sans-serif;color:#e8eaf0;background:rgba(26,29,36,.92);border:1px solid #2d3240;border-radius:99px;padding:7px 10px 7px 8px;display:flex;align-items:center;gap:6px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);user-select:none}
        .d{width:8px;height:8px;border-radius:50%;flex:none}
        .t{white-space:nowrap}
        .p.min .t{display:none}
        .spin{animation:s 1s linear infinite}
        @keyframes s{50%{opacity:.3}}
        .pop{position:absolute;bottom:38px;left:0;width:min(290px,calc(100vw - 32px));background:#1a1d24;color:#e8eaf0;border:1px solid #2d3240;border-radius:12px;padding:12px;font:13px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)}
        .pop b{font-weight:600}
        .pop .m{color:#9aa1b2;margin:6px 0 10px;word-break:break-word}
        .pop .err{color:#ef6464}
        .row{display:flex;gap:8px;flex-wrap:wrap}
        button,a.btn{font:inherit;color:#e8eaf0;background:#222631;border:1px solid #2d3240;border-radius:8px;padding:6px 10px;cursor:pointer;text-decoration:none}
        button:hover,a.btn:hover{border-color:#7c9cff}
      </style><div class="pop" hidden></div><div class="p" role="button" tabindex="0"><span class="d"></span><span class="t"></span></div>`;
      pill = root.querySelector('.p'); pop = root.querySelector('.pop');
      pill.addEventListener('click', togglePop);
      pill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePop(); } });
      document.addEventListener('click', e => { if (!pop.hidden && !e.composedPath().includes(host)) pop.hidden = true; });
      const add = () => document.body.appendChild(host);
      if (document.body) add(); else document.addEventListener('DOMContentLoaded', add);
    }
    function fmtTime(t) {
      if (!t) return 'noch nie';
      const d = new Date(t), today = new Date().toDateString() === d.toDateString();
      return (today ? 'heute ' : d.toLocaleDateString('de-DE') + ' ') + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    function renderPop() {
      if (!pop) return;
      const cfg = readConfig();
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      if (!cfg) {
        pop.innerHTML = `<b>GitHub-Sync ist auf diesem Gerät nicht eingerichtet.</b><div class="m">Einmal auf der Startseite Daten-Repo und Token eintragen, dann gleichen alle Tools automatisch ab.</div><div class="row"><a class="btn" href="/startseite/#sync">Einrichten</a></div>`;
        return;
      }
      pop.innerHTML = `<b>${esc(LABEL[status] || status)}</b>
        <div class="m">${statusText ? `<span class="${status === 'error' ? 'err' : ''}">${esc(statusText)}</span><br>` : ''}Letzter Abgleich: ${fmtTime(lastSync)}<br>Datei: ${esc(cfg.owner + '/' + cfg.repo + '/' + FILE)}</div>
        <div class="row"><button data-a="now">Jetzt abgleichen</button><a class="btn" href="/startseite/#sync">Einstellungen</a></div>`;
      pop.querySelector('[data-a="now"]').onclick = () => { syncNow(); };
    }
    function togglePop() { renderPop(); pop.hidden = !pop.hidden; }
    function setStatus(s, text) {
      status = s; statusText = text || (s === 'error' && lastError ? lastError.message : '');
      ensureBadge();
      if (!pill) return;
      pill.querySelector('.d').style.background = COLOR[s] || '#6b7280';
      pill.querySelector('.d').classList.toggle('spin', s === 'syncing');
      pill.querySelector('.t').textContent = s === 'ok' ? '☁︎' : '☁︎ ' + (LABEL[s] || s);
      pill.title = LABEL[s] + (statusText ? ': ' + statusText : '');
      if (pop && !pop.hidden) renderPop();
      if (typeof opts.onStatus === 'function') { try { opts.onStatus(s, statusText); } catch (e) {} }
    }

    // Anfangsstatus: eingerichtet → „Ausstehend“, bis der erste Abgleich durch ist
    setStatus(readConfig() ? 'pending' : 'off');
    (async () => {
      try { const m = await loadMeta(); if (!lastSync) lastSync = m.lastSync || 0; } catch (e) {}
    })();

    return {
      start, changed, syncNow,
      get status() { return status; },
      get configured() { return !!readConfig(); }
    };
  }

  window.ToolSync = { version: 1, create, readConfig, CONFIG_KEY: CFG_KEY, DB_NAME };
})();
