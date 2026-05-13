/* Theme JS — small utilities (mobile menu, AJAX add-to-cart on product cards) */
(function () {
  'use strict';

  // Scroll reveal — toggle .vis when element enters viewport.
  // Fallback: if IO unsupported, reveal everything immediately.
  function initReveal() {
    var els = document.querySelectorAll('.pk-reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('vis'); });
      return;
    }
    // Opt-in animation: hide elements (.js-reveal-ready selector) only once we know JS is alive.
    document.documentElement.classList.add('js-reveal-ready');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (x) {
        if (x.isIntersecting) {
          x.target.classList.add('vis');
          io.unobserve(x.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }

  // Safety net: reveal anything still hidden 2s after load (e.g. observer races on print/preview).
  window.addEventListener('load', function () {
    setTimeout(function () {
      document.querySelectorAll('.pk-reveal:not(.vis)').forEach(function (el) { el.classList.add('vis'); });
    }, 2000);
  });

  // mobile nav toggle
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-pk-mob-toggle]');
    if (!t) return;
    const nav = document.querySelector('.pk-nav');
    if (nav) nav.classList.toggle('open');
  });

  // AJAX add-to-cart on .add-btn[data-variant-id]
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.add-btn[data-variant-id]');
    if (!btn) return;
    e.preventDefault();
    if (btn.classList.contains('adding') || btn.classList.contains('added')) return;
    const vid = btn.getAttribute('data-variant-id');
    const origHtml = btn.innerHTML;
    btn.classList.add('adding'); btn.disabled = true;
    btn.innerHTML = '...';

    fetch((window.PK && window.PK.routes.cart_add) || '/cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ items: [{ id: parseInt(vid, 10), quantity: 1 }] })
    })
      .then(function (r) { return r.json(); })
      .then(function () {
        btn.classList.remove('adding'); btn.classList.add('added');
        btn.innerHTML = '✓ Lisätty';
        setTimeout(function () { btn.classList.remove('added'); btn.disabled = false; btn.innerHTML = origHtml; }, 1800);
      })
      .catch(function () {
        btn.classList.remove('adding'); btn.disabled = false; btn.innerHTML = origHtml;
      });
  });

  // qty steppers
  document.addEventListener('click', function (e) {
    const inc = e.target.closest('[data-qty-inc]');
    const dec = e.target.closest('[data-qty-dec]');
    if (!inc && !dec) return;
    const wrap = (inc || dec).closest('.pk-qty');
    const input = wrap && wrap.querySelector('input');
    if (!input) return;
    let v = parseInt(input.value, 10) || 1;
    if (inc) v += 1; else v = Math.max(1, v - 1);
    input.value = v;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
})();
