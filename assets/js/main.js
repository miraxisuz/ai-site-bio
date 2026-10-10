/* Site behaviour — dependency-free.
 * Everything is progressive enhancement: if this file fails, the page is still
 * fully readable (reveal states are gated behind .reveal-ready, set below). */
(function () {
  'use strict';
  if (window.__mmMainInit) return;
  window.__mmMainInit = true;

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  var fineMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reduced = function () { return reduceMQ.matches; };

  /* ---------------- scroll reveals ---------------- */
  var revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && revealEls.length) {
    root.classList.add('reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        if (e.target.matches('.num') || e.target.querySelector('[data-count]')) countUp(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  /* ---------------- count-up (final value is in the HTML, so no-JS / SR read it) ---------------- */
  function countUp(scope) {
    if (reduced()) return;
    $$('[data-count]', scope.matches('[data-count]') ? scope.parentNode : scope).forEach(function (el) {
      if (el.__counted) return; el.__counted = true;
      var end = parseInt(el.getAttribute('data-count'), 10);
      var suffix = el.getAttribute('data-suffix') || '';
      if (!isFinite(end)) return;
      var t0 = null, dur = 1400;
      function step(t) {
        if (t0 === null) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 4);
        el.textContent = Math.round(end * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      el.textContent = '0' + suffix;
      requestAnimationFrame(step);
    });
  }

  /* ---------------- nav: state, hide-on-scroll, progress, timeline fill ---------------- */
  var nav = $('#nav');
  var bar = $('#progress');
  var timeline = $('#timeline');
  var lastY = window.scrollY, ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var y = window.scrollY;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar && max > 0) bar.style.setProperty('--p', Math.min(1, y / max).toFixed(4));
      if (nav) {
        nav.classList.toggle('is-scrolled', y > 24);
        var goingDown = y > lastY + 4, goingUp = y < lastY - 4;
        if (!root.classList.contains('menu-open')) {
          if (goingDown && y > 480) nav.classList.add('is-hidden');
          else if (goingUp || y < 480) nav.classList.remove('is-hidden');
        }
      }
      if (timeline) {
        var r = timeline.getBoundingClientRect();
        var vh = window.innerHeight;
        var p = (vh * 0.7 - r.top) / Math.max(1, r.height);
        timeline.style.setProperty('--tp', Math.max(0, Math.min(1, p)).toFixed(4));
      }
      lastY = y;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // keep the nav visible when keyboard focus lands inside it
  if (nav) nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });

  /* ---------------- active section in nav ---------------- */
  var navLinks = $$('#nav-links a[href^="#"]:not(.btn)');
  var secs = navLinks.map(function (a) { return $(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && secs.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (a) {
          if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------- mobile menu ---------------- */
  var menuBtn = $('#menu-btn'), menu = $('#menu');
  function setMenu(open) {
    if (!menu || !menuBtn) return;
    menu.classList.toggle('is-open', open);
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuBtn.querySelector('.menu-btn__label').textContent = open ? 'Close' : 'Menu';
    if (nav) { nav.classList.toggle('nav--over-menu', open); nav.classList.remove('is-hidden'); }
    // the menu is only reachable while open; the page behind it is unreachable while open
    if (open) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');
    [$('#main'), $('.footer')].forEach(function (el) { if (!el) return; if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    if (open) { var first = $('.menu__link', menu); if (first) first.focus({ preventScroll: true }); }
    else menuBtn.focus({ preventScroll: true });
  }
  if (menu && menuBtn) {
    menu.setAttribute('inert', '');   // closed by default
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    $$('.menu__link, .menu__foot a', menu).forEach(function (a) {
      a.addEventListener('click', function () { if (a.hash) setMenu(false); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });
    // leaving the mobile breakpoint while open must not leave the page locked
    window.matchMedia('(min-width: 62rem)').addEventListener('change', function (e) { if (e.matches && menu.classList.contains('is-open')) setMenu(false); });
    // keep Tab inside the open menu (toggle button + links)
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !menu.classList.contains('is-open')) return;
      var list = [menuBtn].concat($$('a', menu));
      var i = list.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && i === list.length - 1) { e.preventDefault(); list[0].focus(); }
    });
  }

  /* ---------------- pointer-aware depth (fine pointers only, rAF-throttled) ---------------- */
  var portrait = $('#portrait'), atmos = $('.atmos');
  if (fineMQ.matches && !reduced()) {
    var px = 0, py = 0, pend = false;
    window.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (pend) return; pend = true;
      requestAnimationFrame(function () {
        pend = false;
        var nx = px / window.innerWidth - 0.5, ny = py / window.innerHeight - 0.5;
        if (portrait) {
          var img = $('.portrait__frame img', portrait);
          if (img) { img.style.setProperty('--px', (nx * -14).toFixed(1) + 'px'); img.style.setProperty('--py', (ny * -14).toFixed(1) + 'px'); }
        }
        if (atmos) { atmos.style.setProperty('--gx', (50 + nx * 40).toFixed(1) + '%'); atmos.style.setProperty('--gy', (22 + ny * 30).toFixed(1) + '%'); }
      });
    }, { passive: true });

    // project card spotlight
    $$('.proj').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  }

  /* ---------------- project filters ---------------- */
  var items = $$('.proj-item');
  var filters = $$('.filter');
  var countEl = $('#filter-count');
  var LABELS = { all: 'projects', web: 'websites', system: 'systems', bot: 'Telegram bots' };

  function applyFilter(f) {
    var n = 0;
    items.forEach(function (li) {
      var show = f === 'all' || li.getAttribute('data-category') === f;
      li.hidden = !show;
      var card = $('.proj', li);
      if (show) {
        card.style.setProperty('--i', n % 6);
        n++;
        // reveal elements that were hidden while off-screen / filtered out
        card.classList.add('is-in');
        if (!reduced()) { card.classList.remove('is-entering'); void card.offsetWidth; card.classList.add('is-entering'); }
      }
    });
    filters.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-filter') === f ? 'true' : 'false'); });
    if (countEl) countEl.textContent = n + ' ' + (n === 1 && f === 'all' ? 'project' : LABELS[f]);
  }
  filters.forEach(function (b) { b.addEventListener('click', function () { applyFilter(b.getAttribute('data-filter')); }); });

  /* ---------------- project dialog ---------------- */
  var dlg = $('#project-dialog');
  var data = [];
  try { data = JSON.parse($('#project-data').textContent); } catch (e) { data = []; }
  var opener = null;

  function openProject(id, trigger) {
    var p = data.filter(function (d) { return d.id === id; })[0];
    if (!p || !dlg || typeof dlg.showModal !== 'function') return;
    opener = trigger || null;
    $('#dlg-kind').textContent = p.category;
    $('#dlg-title').textContent = p.title;
    $('#dlg-desc').textContent = p.desc;
    var tech = $('#dlg-tech'); tech.textContent = '';
    p.tech.forEach(function (t) { var li = document.createElement('li'); li.textContent = t; tech.appendChild(li); });
    var links = $('#dlg-links'); links.textContent = '';
    function addLink(href, text, cls) {
      var a = document.createElement('a');
      a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'btn btn--sm ' + cls;
      a.textContent = text + ' ↗';
      links.appendChild(a);
    }
    if (p.live) addLink(p.live, 'Live site', 'btn--solid');
    if (p.github) addLink(p.github, 'GitHub', 'btn--line');
    dlg.showModal();
  }
  $$('[data-open]').forEach(function (b) {
    b.addEventListener('click', function () { openProject(parseInt(b.getAttribute('data-open'), 10), b); });
  });
  if (dlg) {
    $('#dlg-close').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // backdrop click
    dlg.addEventListener('close', function () { if (opener && document.contains(opener)) opener.focus({ preventScroll: true }); });
  }

  /* ---------------- contact form (real delivery, honest states) ---------------- */
  var form = $('#contact-form');
  if (form) {
    var note = $('#form-note'), submit = $('#cf-submit'), label = $('#cf-label');
    var f = { name: $('#cf-name'), email: $('#cf-email'), subject: $('#cf-subject'), message: $('#cf-msg'), website: $('#cf-web') };
    var errs = { name: $('#err-name'), email: $('#err-email'), message: $('#err-msg') };
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var sending = false;

    function setErr(key, msg) {
      if (!errs[key]) return;
      errs[key].textContent = msg || '';
      if (msg) f[key].setAttribute('aria-invalid', 'true'); else f[key].removeAttribute('aria-invalid');
    }
    function showNote(state, html) {
      note.hidden = !state;
      note.setAttribute('data-state', state || 'idle');
      note.innerHTML = html || '';
    }
    function validate() {
      var bad = null;
      var name = f.name.value.trim(), email = f.email.value.trim(), msg = f.message.value.trim();
      setErr('name', name ? '' : 'Please tell me your name.');
      setErr('email', !email ? 'Please enter your email.' : (EMAIL.test(email) ? '' : 'That email address doesn\u2019t look right.'));
      setErr('message', msg.length < 10 ? 'Please write at least 10 characters.' : (msg.length > 1000 ? 'Please keep it under 1000 characters.' : ''));
      ['name', 'email', 'message'].some(function (k) { if (f[k].getAttribute('aria-invalid') === 'true') { bad = f[k]; return true; } });
      if (bad) bad.focus();
      return !bad;
    }
    ['name', 'email', 'message'].forEach(function (k) {
      f[k].addEventListener('input', function () { if (f[k].getAttribute('aria-invalid') === 'true') setErr(k, ''); });
    });

    function busy(on) {
      sending = on; submit.disabled = on; submit.classList.toggle('is-busy', on);
      label.textContent = on ? 'Sending\u2026' : 'Send message';
    }
    var FALLBACK = ' You can also email <a href="mailto:miraziz1off@gmail.com">miraziz1off@gmail.com</a> or write on <a href="https://t.me/mmuinov" target="_blank" rel="noopener noreferrer">Telegram</a>.';

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      showNote(null);
      if (!validate()) return;

      var ctrl = ('AbortController' in window) ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
      busy(true);

      fetch(form.getAttribute('action'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          name: f.name.value.trim(), email: f.email.value.trim(), subject: f.subject.value.trim(),
          message: f.message.value.trim(), website: f.website.value
        }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
      }).then(function (r) {
        // success is reported ONLY when the server confirms delivery to Telegram
        if (r.ok && r.body && r.body.success === true) {
          form.reset();
          showNote('ok', 'Message delivered \u2014 thank you! I\u2019ll get back to you soon.');
        } else {
          var m = (r.body && r.body.error) || 'The message could not be delivered.';
          if (r.status === 400 && r.body && r.body.field) setErr(r.body.field, m);
          showNote('error', escapeHtml(m) + FALLBACK);
        }
      }).catch(function (err) {
        var timedOut = err && err.name === 'AbortError';
        showNote('error', (timedOut ? 'The request took too long.' : 'Couldn\u2019t reach the server.') + FALLBACK);
      }).then(function () { clearTimeout(timer); busy(false); });
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();
