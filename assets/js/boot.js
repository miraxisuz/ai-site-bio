/* Runs synchronously in <head>. Decides whether the intro plays, flags JS,
   loads web fonts without blocking render, and guarantees the page can
   never stay locked behind the loader. */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  // Dev helper: open the site with ?intro to replay the intro at any time.
  var force = /[?&]intro(=1|=true|&|$)/.test(location.search);
  var seen = false;
  try { seen = sessionStorage.getItem('mm-intro') === '1'; } catch (e) {}

  if (reduce || (seen && !force)) {
    root.classList.add('skip-intro');
  } else {
    root.classList.add('is-loading');
  }

  // Non-blocking Google Fonts (CSS is allowed by CSP; failure just means fallback fonts).
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(link);

  // Absolute failsafe: whatever happens, release the page.
  setTimeout(function () {
    root.classList.remove('is-loading');
    root.classList.add('page-ready', 'intro-done');
  }, 12000);
})();
