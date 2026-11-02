/* Zurück zur Startseite – kleiner ⌂-Knopf unten links.
 * Einbinden: <script src="/startseite/nav-v1.js" defer></script>
 * Für Tools ohne GitHub-Sync. Tools mit sync-v1.js haben den Knopf schon im Sync-Feld,
 * dann tut dieses Skript nichts. Schreibt nichts in den Speicher.
 */
(function () {
  'use strict';
  function add() {
    if (document.querySelector('[data-toolsync],[data-toolnav]')) return;
    const host = document.createElement('div');
    host.setAttribute('data-toolnav', '');
    host.style.cssText = 'position:fixed;z-index:2147483000;bottom:calc(12px + env(safe-area-inset-bottom, 0px));left:calc(12px + env(safe-area-inset-left, 0px))';
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = '<style>:host{all:initial}a{font:600 15px/1 system-ui,-apple-system,sans-serif;color:#e8eaf0;background:rgba(26,29,36,.92);border:1px solid #2d3240;border-radius:99px;width:30px;height:28px;display:grid;place-items:center;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}a:hover{border-color:#7c9cff}</style>'
      + '<a href="/startseite/" title="Zur Startseite" aria-label="Zur Startseite">⌂</a>';
    document.body.appendChild(host);
  }
  // kurz warten, damit ein evtl. vorhandenes Sync-Feld zuerst da ist
  const go = () => setTimeout(add, 0);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
