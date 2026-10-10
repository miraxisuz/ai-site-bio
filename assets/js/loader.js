/* Cinematic loader controller.
 *
 * - The drawing sequence itself is pure CSS (see "Cinematic loader" in main.css).
 * - Progress is REAL: four readiness signals (markup, fonts, portrait, window load).
 *   The displayed number only ever eases toward what has actually completed.
 * - If everything is ready early, the remaining animation is sped up instead of
 *   making the visitor sit through it. Skip is available at all times.
 * - Every wait has a timeout, so a failed font/image can never trap the visitor.
 * - Idempotent: guarded against double initialisation; listeners and timers are
 *   cleaned up on exit; scroll lock is always released.
 */
(function () {
  'use strict';
  if (window.__mmLoaderInit) return;
  window.__mmLoaderInit = true;

  var root = document.documentElement;
  var loader = document.getElementById('loader');
  if (!loader) { release(); return; }
  if (!root.classList.contains('is-loading')) { loader.remove(); root.classList.add('page-ready', 'intro-done'); return; }

  var HARD_CAP_MS = 8000;       // never wait longer than this for anything
  var FONT_CAP_MS = 3500;
  var IMG_CAP_MS = 4000;
  var LOAD_CAP_MS = 6000;
  var FAST_RATE = 2.6;          // playback speed-up once the page is ready
  var EXIT_MS = 1150;           // shutter transition length (+ margin)

  var timers = [];
  var rafId = 0;
  var exiting = false;
  var allReady = false;
  var timelineDone = false;
  var shown = 0;                // displayed progress 0..1
  var tasks = { markup: false, fonts: false, portrait: false, page: false };
  var total = 4;

  var pctEl = document.getElementById('ld-pct');
  var stepsEl = document.getElementById('ld-steps');
  var skipBtn = document.getElementById('ld-skip');
  var nameEl = document.getElementById('ld-name');

  function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }

  /* ---- split the name into letters for the staggered rise ---- */
  try {
    var text = nameEl.textContent;
    nameEl.textContent = '';
    for (var i = 0; i < text.length; i++) {
      var c = document.createElement('span');
      c.className = 'c';
      var inner = document.createElement('i');
      inner.textContent = text[i] === ' ' ? '\u00A0' : text[i];
      c.appendChild(inner);
      c.style.setProperty('--n', i);
      nameEl.appendChild(c);
    }
  } catch (e) { /* cosmetic only */ }

  /* ---- real readiness signals ---- */
  function mark(key) {
    if (tasks[key]) return;
    tasks[key] = true;
    var li = stepsEl && stepsEl.querySelector('[data-step="' + key + '"]');
    if (li) li.classList.add('is-done');
    var n = 0; for (var k in tasks) if (tasks[k]) n++;
    if (n === total) onReady();
  }

  // 1. Markup — this script is deferred, so the DOM is parsed by definition.
  mark('markup');

  // 2. Fonts — wait for the stylesheet, then for the faces we actually use.
  (function () {
    var finished = false;
    function fin() { if (!finished) { finished = true; mark('fonts'); } }
    later(fin, FONT_CAP_MS);
    function loadFaces() {
      if (!document.fonts || !document.fonts.load) return fin();
      var faces = ['400 1em "Instrument Serif"', 'italic 400 1em "Instrument Serif"', '400 1em "Hanken Grotesk"'];
      Promise.all(faces.map(function (f) { return document.fonts.load(f).catch(function () {}); })).then(fin, fin);
    }
    var link = document.querySelector('link[href*="fonts.googleapis.com/css2"]');
    if (!link || link.sheet) loadFaces();
    else { link.addEventListener('load', loadFaces, { once: true }); link.addEventListener('error', fin, { once: true }); }
  })();

  // 3. Hero portrait — loaded and decoded (or failed; either way we proceed).
  (function () {
    var img = document.getElementById('hero-img');
    var finished = false;
    function fin() { if (!finished) { finished = true; mark('portrait'); } }
    later(fin, IMG_CAP_MS);
    if (!img) return fin();
    function ready() { (img.decode ? img.decode() : Promise.resolve()).then(fin, fin); }
    if (img.complete) { img.naturalWidth ? ready() : fin(); }
    else { img.addEventListener('load', ready, { once: true }); img.addEventListener('error', fin, { once: true }); }
  })();

  // 4. Everything else — the window load event.
  (function () {
    var finished = false;
    function fin() { if (!finished) { finished = true; mark('page'); } }
    later(fin, LOAD_CAP_MS);
    if (document.readyState === 'complete') fin();
    else window.addEventListener('load', fin, { once: true });
  })();

  /* ---- progress display: eases toward real completion, never beyond it ---- */
  function tick() {
    var done = 0; for (var k in tasks) if (tasks[k]) done++;
    var target = done / total;
    shown += (target - shown) * (target === 1 ? 0.28 : 0.12);
    if (target - shown < 0.002) shown = target;
    loader.style.setProperty('--ld', shown.toFixed(4));
    if (pctEl) pctEl.textContent = Math.round(shown * 100) + '%';
    maybeExit();
    if (!exiting) rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  /* ---- timeline (CSS animations) ---- */
  var anims = [];
  try { anims = loader.getAnimations({ subtree: true }); } catch (e) { anims = []; }
  if (anims.length && window.Promise) {
    Promise.all(anims.map(function (a) { return a.finished.catch(function () {}); }))
      .then(function () { timelineDone = true; maybeExit(); });
  } else {
    later(function () { timelineDone = true; maybeExit(); }, 3200);   // no Web Animations support
  }

  function onReady() {
    allReady = true;
    // Ready early? Don't make anyone wait: compress what's left of the sequence.
    if (!timelineDone) anims.forEach(function (a) { try { if (a.playState === 'running') a.updatePlaybackRate(FAST_RATE); } catch (e) {} });
    maybeExit();
  }

  function maybeExit() {
    if (exiting) return;
    if (allReady && timelineDone && shown >= 0.999) exit(false);
  }

  /* ---- exit: frame passes the viewer, shutters part, hero begins ---- */
  function exit(skipped) {
    if (exiting) return;
    exiting = true;
    cancelAnimationFrame(rafId);
    if (skipped) anims.forEach(function (a) { try { a.finish(); } catch (e) {} });
    teardownInput();
    loader.classList.add('is-exit');
    loader.setAttribute('aria-hidden', 'true');
    later(function () { root.classList.add('page-ready'); }, skipped ? 120 : 380);   // hero starts under the opening shutters
    later(release, skipped ? 900 : EXIT_MS);
  }

  function release() {
    (timers || []).forEach(clearTimeout); timers = [];
    root.classList.remove('is-loading');
    root.classList.add('page-ready', 'intro-done');
    try { sessionStorage.setItem('mm-intro', '1'); } catch (e) {}
    if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    window.dispatchEvent(new CustomEvent('mm:intro-complete'));
  }

  /* ---- skip ---- */
  function onSkip() { exit(true); }
  function onKey(e) { if (e.key === 'Escape') exit(true); }
  function teardownInput() {
    if (skipBtn) skipBtn.removeEventListener('click', onSkip);
    document.removeEventListener('keydown', onKey);
    loader.removeEventListener('click', onSkip);
  }
  if (skipBtn) skipBtn.addEventListener('click', onSkip);
  document.addEventListener('keydown', onKey);
  loader.addEventListener('click', onSkip);

  /* ---- hard cap: whatever is still pending, let the visitor in ---- */
  later(function () {
    allReady = true; timelineDone = true; shown = 1;
    exit(false);
  }, HARD_CAP_MS);
})();
