/* ==========================================================================
   Oriental Bakery — main.js

   Enhancement only. Every page renders and works with JS disabled: links are
   real links, the menu markup is plain HTML, and both the reveal animation and
   the image fade are gated behind `html.js` in the stylesheet.

   1. mobileNav()        — hamburger under 768px
   2. stickyNavState()   — shadow once the header lifts off the page
   3. revealOnScroll()   — gentle fade-and-rise for cards and sections
   4. lazyLoadImages()   — IntersectionObserver decode + fade-in
   5. ripple()           — soft ripple on .btn and .card
   6. smoothAnchors()    — offset in-page jumps past the sticky header
   7. currentYear()      — footer copyright
   8. bakedToday()       — "Baked Today" freshness strip (backend, read)
   9. preOrder()         — pickup date + slot -> WhatsApp (no backend)
  10. subscribeForm()    — Bread Box signup (backend write + WhatsApp)
  11. loyaltyLookup()    — stamp count by phone (backend, read)
  12. wholesaleForm()    — B2B enquiry (backend write + WhatsApp)
  13. staffTools()       — PIN-gated internal pages
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     BACKEND — paste the Apps Script Web App /exec URL here after deploying.
     See backend/README.md. Leave as '' and every backend-dependent feature
     falls back to static copy or the WhatsApp path; nothing breaks.
     --------------------------------------------------------------------- */
  var BACKEND_URL = '';

  var WA_NUMBER = '255793097773';

  // Must match the CSS breakpoint in styles.css section 05 — six nav items
  // do not fit inline below 768px.
  var MOBILE_NAV_MAX = 767.98;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --------------------------------------------------------- backend I/O -- */

  function backendReady() { return typeof BACKEND_URL === 'string' && BACKEND_URL !== ''; }

  function apiGet(action, params) {
    if (!backendReady()) return Promise.reject(new Error('backend-not-configured'));
    var qs = Object.keys(params || {}).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    });
    qs.unshift('action=' + encodeURIComponent(action));
    return fetch(BACKEND_URL + '?' + qs.join('&'), { method: 'GET' })
      .then(function (r) { return r.json(); });
  }

  function apiPost(action, body) {
    if (!backendReady()) return Promise.reject(new Error('backend-not-configured'));
    var payload = Object.assign({ action: action }, body || {});
    // text/plain avoids a CORS preflight, which Apps Script cannot answer.
    return fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  /* ------------------------------------------------------------ WhatsApp -- */

  function waLink(message) {
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(message);
  }

  /* -------------------------------------------------------------- shared -- */

  function setStatus(el, message, tone) {
    if (!el) return;
    el.textContent = message;
    el.className = 'form-status' + (tone ? ' is-' + tone : '');
    el.hidden = !message;
  }

  function fieldValues(form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === 'submit') return;
      out[el.name] = (el.value || '').trim();
    });
    return out;
  }

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
      var el = e.target.closest('.btn, .card');
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

  /* 8. Baked Today ------------------------------------------------------- */

  /**
   * Reads today's list from the backend. The markup already contains the
   * honest static fallback, so if anything at all goes wrong — no backend, a
   * network failure, or simply no entry for today — we leave that in place.
   * Stale or invented items must never render as if they were live.
   */
  function bakedToday() {
    var box = document.getElementById('bakedToday');
    if (!box) return;
    var live = box.querySelector('[data-fresh-live]');
    var list = box.querySelector('[data-fresh-items]');
    var time = box.querySelector('[data-fresh-updated]');
    if (!live || !list) return;

    apiGet('freshToday')
      .then(function (data) {
        if (!data || !data.ok || !data.items || !data.items.length) return;
        list.textContent = data.items.join(', ');
        if (time) {
          time.textContent = data.updated_at ? ' — updated at ' + data.updated_at : '';
        }
        box.classList.add('is-live');   // reveals the live line, hides fallback
        live.hidden = false;
      })
      .catch(function () { /* fallback copy stays; nothing to do */ });
  }

  /* 9. Pre-order slots --------------------------------------------------- */

  /** Pure front-end. Builds a wa.me link from the chosen date and slot. */
  function preOrder() {
    var blocks = document.querySelectorAll('[data-preorder]');
    if (!blocks.length) return;

    Array.prototype.forEach.call(blocks, function (block) {
      var date = block.querySelector('[data-preorder-date]');
      var slot = block.querySelector('[data-preorder-slot]');
      var cta  = block.querySelector('[data-preorder-cta]');
      if (!date || !slot || !cta) return;

      // Never let someone pre-order for a date that has already passed.
      var today = new Date();
      var iso = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 10);
      date.min = iso;
      if (!date.value) date.value = iso;

      function update() {
        var chosen = date.value || iso;
        var pretty = chosen;
        var parts = chosen.split('-');
        if (parts.length === 3) {
          var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          if (!isNaN(d)) {
            pretty = d.toLocaleDateString('en-GB',
              { weekday: 'long', day: 'numeric', month: 'long' });
          }
        }
        cta.href = waLink(
          "Hi Oriental Bakery, I'd like to pre-order for pickup on " +
          pretty + ', ' + slot.value + '.'
        );
      }

      date.addEventListener('change', update);
      slot.addEventListener('change', update);
      update();
    });
  }

  /* 10. Subscription ----------------------------------------------------- */

  function subscribeForm() {
    var form = document.getElementById('subscribeForm');
    if (!form) return;
    var status = form.querySelector('.form-status');
    var handoff = document.getElementById('subscribeHandoff');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = fieldValues(form);
      if (!v.name || !v.phone) {
        setStatus(status, 'Please add your name and phone number.', 'error');
        return;
      }

      var summary = 'Hi Oriental Bakery, I would like to subscribe to the Bread Box.\n' +
        'Name: ' + v.name + '\nPhone: ' + v.phone +
        '\nPlan: ' + (v.plan || '—') +
        '\nFrequency: ' + (v.frequency || '—') +
        (v.notes ? '\nNotes: ' + v.notes : '');

      function handOff(savedMsg) {
        setStatus(status, savedMsg, 'success');
        if (handoff) {
          handoff.href = waLink(summary);
          handoff.hidden = false;
        }
      }

      setStatus(status, 'Sending…', '');
      apiPost('subscribe', v)
        .then(function (r) {
          handOff(r && r.ok
            ? 'Thank you. Confirm the details with us on WhatsApp and we will set it up.'
            : 'We could not save that automatically — send it to us on WhatsApp instead.');
        })
        .catch(function () {
          // No backend yet, or it failed: the enquiry must still reach a human.
          handOff('Send your details to us on WhatsApp and we will set it up.');
        });
    });
  }

  /* 11. Loyalty lookup --------------------------------------------------- */

  function loyaltyLookup() {
    var form = document.getElementById('loyaltyForm');
    if (!form) return;
    var status = form.querySelector('.form-status');
    var result = document.getElementById('loyaltyResult');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = (form.querySelector('[name="phone"]').value || '').trim();
      if (!phone) {
        setStatus(status, 'Enter the phone number you gave us in the shop.', 'error');
        return;
      }
      if (result) result.hidden = true;
      setStatus(status, 'Checking…', '');

      apiGet('loyaltyLookup', { phone: phone })
        .then(function (data) {
          if (!data || !data.ok) throw new Error('lookup failed');
          setStatus(status, '', '');
          if (!result) return;
          var target = data.target || 10;
          if (data.found) {
            var count = data.stamp_count || 0;
            result.innerHTML =
              '<p class="loyalty-count"><strong>' + count + '</strong> of ' + target +
              ' stamps</p><p>' + (data.remaining === 0
                ? 'Your reward is ready — mention it next time you visit.'
                : data.remaining + ' to go.') + '</p>';
          } else {
            result.innerHTML =
              '<p>We could not find that number yet. Ask us about joining the ' +
              'loyalty programme next time you visit.</p>';
          }
          result.hidden = false;
        })
        .catch(function () {
          setStatus(status,
            'The stamp check is not available right now — ask us on WhatsApp ' +
            'or next time you are in the shop.', 'error');
        });
    });
  }

  /* 12. Wholesale -------------------------------------------------------- */

  function wholesaleForm() {
    var form = document.getElementById('wholesaleForm');
    if (!form) return;
    var status = form.querySelector('.form-status');
    var handoff = document.getElementById('wholesaleHandoff');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = fieldValues(form);
      if (!v.business_name || !v.contact_name || !v.phone) {
        setStatus(status, 'Business name, contact person and phone are required.', 'error');
        return;
      }

      var summary = 'Hi Oriental Bakery, wholesale enquiry.\n' +
        'Business: ' + v.business_name + '\nContact: ' + v.contact_name +
        '\nPhone: ' + v.phone + (v.email ? '\nEmail: ' + v.email : '') +
        (v.items ? '\nItems: ' + v.items : '') +
        (v.delivery_days ? '\nPreferred delivery days: ' + v.delivery_days : '') +
        (v.notes ? '\nNotes: ' + v.notes : '');

      function handOff(msg) {
        setStatus(status, msg, 'success');
        if (handoff) {
          handoff.href = waLink(summary);
          handoff.hidden = false;
        }
      }

      setStatus(status, 'Sending…', '');
      apiPost('wholesaleOrder', v)
        .then(function (r) {
          handOff(r && r.ok
            ? 'Thank you — we have your enquiry. Confirm on WhatsApp to speak to us today.'
            : 'We could not save that automatically — send it on WhatsApp instead.');
        })
        .catch(function () {
          handOff('Send your enquiry on WhatsApp and we will come back to you.');
        });
    });
  }

  /* 13. Staff tools ------------------------------------------------------ */

  /** Internal pages. The PIN is only ever compared server-side. */
  function staffTools() {
    var fresh = document.getElementById('staffFreshForm');
    var stamp = document.getElementById('staffStampForm');
    if (!fresh && !stamp) return;

    function submit(form, action, build, onOk) {
      var status = form.querySelector('.form-status');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = fieldValues(form);
        if (!v.pin) { setStatus(status, 'Enter the staff PIN.', 'error'); return; }
        setStatus(status, 'Saving…', '');
        apiPost(action, build(v))
          .then(function (r) {
            if (!r || !r.ok) {
              setStatus(status, (r && r.error) || 'That did not save.', 'error');
              return;
            }
            setStatus(status, onOk(r, v), 'success');
            form.reset();
          })
          .catch(function (err) {
            setStatus(status, err && err.message === 'backend-not-configured'
              ? 'Backend is not configured yet — see backend/README.md.'
              : 'Could not reach the backend. Check your connection.', 'error');
          });
      });
    }

    if (fresh) {
      submit(fresh, 'setFreshToday',
        function (v) { return { pin: v.pin, items: v.items }; },
        function (r) { return 'Saved. Today’s list is now: ' + r.items; });
    }
    if (stamp) {
      submit(stamp, 'loyaltyStamp',
        function (v) { return { pin: v.pin, phone: v.phone, name: v.name }; },
        function (r) {
          return r.reward_earned
            ? 'Reward earned. Card reset to 0 — give the free item.'
            : 'Stamp added. Now on ' + r.stamp_count + ' of ' + r.target + '.';
        });
    }
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
    bakedToday();
    preOrder();
    subscribeForm();
    loyaltyLookup();
    wholesaleForm();
    staffTools();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
