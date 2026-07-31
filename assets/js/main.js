/* ==========================================================================
   Oriental Bakery — main.js

   Enhancement only. Every page renders and works with JS disabled: links are
   real links, the menu markup is plain HTML, and both the reveal animation and
   the image fade are gated behind `html.js` in the stylesheet.

   1. mobileNav()        — hamburger under 640px
   2. stickyNavState()   — shadow once the header lifts off the page
   3. revealOnScroll()   — gentle fade-and-rise for cards and sections
   4. lazyLoadImages()   — IntersectionObserver decode + fade-in
   5. ripple()           — soft ripple on .door-cta and .card
   6. smoothAnchors()    — offset in-page jumps past the sticky header
   7. currentYear()      — footer copyright
   ========================================================================== */

(function () {
  'use strict';

  var MOBILE_NAV_MAX = 639.98;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Mobile nav ------------------------------------------------------- */

  function mobileNav() {
    var toggle = document.querySelector('.nav__toggle');
    var menu = document.getElementById('navMenu');
    if (!toggle || !menu) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Close after picking a destination (in-page anchors don't reload).
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // Tapping outside the open menu dismisses it.
    document.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') !== 'true') return;
      if (!e.target.closest('.nav')) setOpen(false);
    });

    // Leaving mobile width must not strand the menu in the "open" state,
    // since the desktop rules ignore .is-open entirely.
    window.addEventListener('resize', function () {
      if (window.innerWidth > MOBILE_NAV_MAX) setOpen(false);
    });
  }

  /* 2. Sticky nav state -------------------------------------------------- */

  function stickyNavState() {
    var nav = document.getElementById('siteNav');
    if (!nav) return;

    var ticking = false;
    function update() {
      nav.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* 3. Reveal on scroll -------------------------------------------------- */

  function revealOnScroll() {
    var items = document.querySelectorAll('.reveal');
    if (!items.length) return;

    // No observer (or the user prefers less motion): show everything at once.
    if (!('IntersectionObserver' in window) || reduceMotion) {
      for (var i = 0; i < items.length; i++) items[i].classList.add('is-visible');
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* 4. Lazy images ------------------------------------------------------- */

  function lazyLoadImages() {
    var imgs = document.querySelectorAll('img.lazy-img');
    if (!imgs.length) return;

    function show(img) { img.classList.add('is-loaded'); }

    // Markup ships a real `src` plus native loading="lazy", so images resolve
    // without JS. This adds the fade once the bytes are actually decoded, and
    // supports optional data-src for anything deferred harder in future.
    function activate(img) {
      var deferred = img.getAttribute('data-src');
      if (deferred && !img.src) {
        img.addEventListener('load', function () { show(img); }, { once: true });
        img.addEventListener('error', function () { show(img); }, { once: true });
        img.src = deferred;
        img.removeAttribute('data-src');
        return;
      }
      if (img.complete && img.naturalWidth > 0) { show(img); return; }
      img.addEventListener('load', function () { show(img); }, { once: true });
      img.addEventListener('error', function () { show(img); }, { once: true });
    }

    if (!('IntersectionObserver' in window)) {
      imgs.forEach(activate);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        activate(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: '250px 0px' });

    imgs.forEach(function (img) { io.observe(img); });

    // Safety net: never leave an image stuck at opacity 0 if it decoded before
    // the observer ran, or if it sits outside any scroll path.
    window.addEventListener('load', function () {
      imgs.forEach(function (img) {
        if (img.complete && img.naturalWidth > 0) show(img);
      });
    });
  }

  /* 5. Ripple ------------------------------------------------------------ */

  function ripple(e, el) {
    var rect = el.getBoundingClientRect();
    var size = Math.max(rect.width, rect.height);
    var x = (e.clientX || rect.left + rect.width / 2) - rect.left;
    var y = (e.clientY || rect.top + rect.height / 2) - rect.top;

    var span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (x - size / 2) + 'px';
    span.style.top = (y - size / 2) + 'px';

    el.appendChild(span);
    span.addEventListener('animationend', function () { span.remove(); });
    window.setTimeout(function () { span.remove(); }, 900); // belt and braces
  }

  function bindRipples() {
    if (reduceMotion) return;
    document.addEventListener('click', function (e) {
      var el = e.target.closest('.door-cta, .card');
      if (el) ripple(e, el);
    });
  }

  /* 6. Smooth anchors ---------------------------------------------------- */

  function smoothAnchors() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var id = link.getAttribute('href');
      if (!id || id === '#') return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });

      // Keep the URL and keyboard focus in step with the visual jump.
      history.replaceState(null, '', id);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }

  /* 7. Footer year ------------------------------------------------------- */

  function currentYear() {
    var slots = document.querySelectorAll('[data-year]');
    var year = String(new Date().getFullYear());
    slots.forEach(function (el) { el.textContent = year; });
  }

  /* Boot ----------------------------------------------------------------- */

  function init() {
    mobileNav();
    stickyNavState();
    revealOnScroll();
    lazyLoadImages();
    bindRipples();
    smoothAnchors();
    currentYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
