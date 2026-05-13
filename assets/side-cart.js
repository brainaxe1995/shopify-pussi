/**
 * EM Side Cart — Shopify port of em-side-cart v1.3.0
 *
 * Behavior parity:
 *  - FAB pulse, instant cache render, debounced refresh
 *  - Auto-open on add-to-cart (fetch+jQuery interceptors)
 *  - Free-ship progress bar
 *  - Flash sale section (timer, discount, +button)
 *  - Swipe to close, ESC to close
 *
 * Uses Shopify cart.js API instead of WC AJAX endpoints.
 */
(function () {
  'use strict';

  const CFG = window.PK || {};
  const ROUTES = CFG.routes || {};
  const MONEY_FMT = CFG.money_format || '${{amount}}';
  const FREE_SHIP = parseInt(CFG.free_ship_threshold, 10) || 0;
  const FLASH_ENABLED = !!CFG.flash_enabled;
  const FLASH_TIMER_MIN = parseInt(CFG.flash_timer_min, 10) || 15;
  const FLASH_DISC = parseInt(CFG.flash_discount_pct, 10) || 25;

  let overlay, drawer, items, flash, flashProducts, flashTimerEl;
  let footer, empty, headerCount, subtotalEl, shippingBar, shippingText, shippingFill;
  let fab, fabBadge, loader;

  let cartData = null;
  let cachedCartData = null;
  let timerInterval = null;
  let flashEndTime = null;
  let isRefreshing = false;
  let isRemoving = {};
  let lastRefreshTime = 0;
  const REFRESH_COOLDOWN = 2000;
  const CACHE_TTL = 30000;

  // ---------- helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function on(el, ev, fn) { el && el.addEventListener(ev, fn); }
  function show(el) { el && (el.style.display = ''); }
  function hide(el) { el && (el.style.display = 'none'); }
  function addClass(el, c) { el && el.classList.add(c); }
  function rmClass(el, c) { el && el.classList.remove(c); }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function money(cents) {
    // Force €-prefix Finnish format everywhere (matches Liquid € NN,NN format).
    const amount = (cents / 100).toFixed(2).replace('.', ',');
    return '€ ' + amount;
  }
  function showLoader() { addClass(loader, 'active'); }
  function hideLoader() { rmClass(loader, 'active'); }
  function invalidateCache() { cachedCartData = null; lastRefreshTime = 0; }
  function isCacheValid() { return cachedCartData && (Date.now() - lastRefreshTime < CACHE_TTL); }

  // ---------- init ----------
  function init() {
    overlay = $('#emscOverlay');
    drawer = $('#emscDrawer');
    items = $('#emscItems');
    flash = $('#emscFlashSection');
    flashProducts = $('#emscFlashProducts');
    flashTimerEl = $('#emscFlashTimer');
    footer = $('#emscFooter');
    empty = $('#emscEmpty');
    headerCount = $('#emscHeaderCount');
    subtotalEl = $('#emscSubtotal');
    shippingBar = $('#emscShippingBar');
    shippingText = $('#emscShippingText');
    shippingFill = $('#emscShippingFill');
    fab = $('#emscFab');
    fabBadge = $('#emscFabBadge');
    loader = $('#emscLoader');

    if (!drawer) return;

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        addClass(drawer, 'ready');
        addClass(overlay, 'ready');
      });
    });

    on(overlay, 'click', closeCart);
    on($('#emscCloseBtn'), 'click', closeCart);
    on($('#emscContinueBtn'), 'click', function () { closeCart(); window.location.href = '/collections/all'; });
    on(document, 'keydown', function (e) { if (e.key === 'Escape') closeCart(); });

    on(fab, 'click', function (e) { e.preventDefault(); e.stopPropagation(); openCart(); });

    document.addEventListener('click', function (e) {
      const t = e.target.closest('.cart-icon, .cart-link, .header-cart, [data-emsc-open], a[href$="/cart"]');
      if (!t) return;
      if (t === fab || (fab && fab.contains(t))) return;
      e.preventDefault();
      openCart();
    });

    interceptFetch();
    interceptJqueryAjax();

    // swipe close
    let touchStartX = 0;
    drawer.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    drawer.addEventListener('touchend', function (e) {
      if (e.changedTouches[0].clientX - touchStartX > 80) closeCart();
    }, { passive: true });

    initFlashTimer();

    on($('#emscCheckoutBtn'), 'click', function (e) {
      const href = this.getAttribute('href'); if (!href) return;
      e.preventDefault();
      this.style.opacity = .7; this.style.pointerEvents = 'none';
      this.innerHTML = '<span style="display:inline-flex;align-items:center;gap:8px"><span style="width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:emscSpin .8s linear infinite;display:inline-block"></span> Going to checkout…</span>';
      setTimeout(function () { window.location.href = href; }, 400);
    });

    refreshCart(false);
  }

  // ---------- fetch / xhr interceptors ----------
  function interceptFetch() {
    const orig = window.fetch;
    window.fetch = function () {
      const args = arguments;
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      return orig.apply(this, args).then(function (res) {
        if (/\/cart\/(add|change|update|clear)/.test(url)) {
          invalidateCache();
          setTimeout(function () { openCart(); }, 50);
        }
        return res;
      });
    };
  }
  function interceptJqueryAjax() {
    if (!window.jQuery || !window.jQuery.ajaxPrefilter) return;
    window.jQuery.ajaxPrefilter(function (opts) {
      const u = opts.url || '';
      if (/\/cart\/(add|change|update|clear)/.test(u)) {
        const orig = opts.success;
        opts.success = function () { invalidateCache(); openCart(); if (orig) orig.apply(this, arguments); };
      }
    });
  }

  // ---------- open / close ----------
  function openCart() {
    if (drawer.classList.contains('open')) {
      if (!isCacheValid()) refreshCart(false);
      return;
    }
    if (cachedCartData && isCacheValid()) {
      cartData = cachedCartData;
      renderCart();
      renderUpsells();
      updateBadge(cartData.item_count);
    }
    addClass(overlay, 'open');
    requestAnimationFrame(function () { addClass(drawer, 'open'); });
    addClass(fab, 'hidden');
    document.body.classList.add('emsc-cart-open');
    refreshCart(false);
  }
  function closeCart() {
    rmClass(drawer, 'open');
    setTimeout(function () { rmClass(overlay, 'open'); }, 50);
    rmClass(fab, 'hidden');
    document.body.classList.remove('emsc-cart-open');
  }

  // ---------- cart refresh ----------
  function refreshCart(shouldOpen) {
    if (isRefreshing) return;
    if (Date.now() - lastRefreshTime < REFRESH_COOLDOWN && isCacheValid()) {
      if (shouldOpen && cachedCartData && cachedCartData.item_count > 0) openCart();
      return;
    }
    isRefreshing = true;
    if (!cachedCartData) showLoader();

    fetch(ROUTES.cart, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        isRefreshing = false;
        lastRefreshTime = Date.now();
        cartData = data; cachedCartData = data;
        renderCart();
        updateBadge(data.item_count);
        renderUpsells();
        hideLoader();
        if (shouldOpen && data.item_count > 0) openCart();
      })
      .catch(function () { isRefreshing = false; hideLoader(); });
  }

  // ---------- render cart ----------
  function renderCart() {
    if (!cartData) return;
    if (!cartData.items || cartData.items.length === 0) {
      items.innerHTML = '';
      hide(footer); hide(flash); show(empty);
      addClass(shippingBar, 'hidden');
      return;
    }
    hide(empty); show(footer);

    let html = '';
    cartData.items.forEach(function (it) {
      if (isRemoving[it.key]) return;
      const linePrice = money(it.final_line_price);
      const unitPrice = money(it.final_price);
      const variation = it.variant_title && it.variant_title !== 'Default Title' ? '<div class="emsc-item-variation">' + esc(it.variant_title) + '</div>' : '';
      const showBoth = it.quantity > 1;
      const priceSection = showBoth
        ? '<div class="emsc-item-price">' + unitPrice + ' <span class="emsc-item-qty-label">× ' + it.quantity + '</span></div>'
        : '';
      const img = it.image ? it.image.replace('{width}', '200') : '';
      html += '' +
        '<div class="emsc-item" data-key="' + esc(it.key) + '">' +
          '<a href="' + esc(it.url) + '" class="emsc-item-img"><img src="' + esc(img) + '" alt="' + esc(it.product_title) + '" loading="lazy"></a>' +
          '<div class="emsc-item-info">' +
            '<a href="' + esc(it.url) + '" class="emsc-item-name">' + esc(it.product_title) + '</a>' +
            variation +
            priceSection +
          '</div>' +
          '<div class="emsc-item-right">' +
            '<button class="emsc-remove-btn" data-key="' + esc(it.key) + '" aria-label="Remove">&times;</button>' +
            '<div class="emsc-item-total">' + linePrice + '</div>' +
          '</div>' +
        '</div>';
    });
    items.innerHTML = html;

    if (subtotalEl) subtotalEl.innerHTML = money(cartData.total_price);
    updateShippingBar(cartData.total_price / 100);
    renderCalc(cartData);
    bindItemEvents();
  }

  function renderCalc(d) {
    // d in cents (Shopify cart.js values)
    var subtotal = d.items_subtotal_price != null ? d.items_subtotal_price : d.original_total_price;
    var discount = d.total_discount || 0;
    var afterDisc = d.total_price; // Shopify total_price already includes line + cart discounts
    // Shipping estimate: free over threshold, otherwise flat 6.20€
    var FREE = (FREE_SHIP || 100) * 100;
    var FLAT_SHIP = 620;
    var ship = (d.item_count === 0) ? 0 : (afterDisc >= FREE ? 0 : FLAT_SHIP);
    var total = afterDisc + ship;

    var $sub = $('#emscCalcSubtotal'); if ($sub) $sub.innerHTML = money(subtotal);
    var $dRow = $('#emscCalcDiscRow'), $d = $('#emscCalcDisc');
    if ($dRow && $d) {
      if (discount > 0) { $dRow.style.display = ''; $d.innerHTML = '-' + money(discount); }
      else { $dRow.style.display = 'none'; }
    }
    var $ship = $('#emscCalcShip');
    if ($ship) $ship.innerHTML = (ship === 0 && d.item_count > 0) ? 'Ilmainen' : (d.item_count === 0 ? '—' : money(ship));
    var $tot = $('#emscCalcTotal'); if ($tot) $tot.innerHTML = money(total);
  }

  function bindItemEvents() {
    $$('.emsc-remove-btn').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        const key = btn.getAttribute('data-key');
        const item = btn.closest('.emsc-item');
        if (isRemoving[key]) return;
        isRemoving[key] = true;
        addClass(item, 'removing');
        showLoader(); invalidateCache();

        fetch(ROUTES.cart_change, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ id: key, quantity: 0 })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            cartData = data; cachedCartData = data; lastRefreshTime = Date.now();
            setTimeout(function () {
              delete isRemoving[key];
              renderCart(); updateBadge(data.item_count); renderUpsells(); hideLoader();
            }, 300);
          })
          .catch(function () { delete isRemoving[key]; rmClass(item, 'removing'); hideLoader(); });
      };
    });
  }

  function updateBadge(count) {
    if (headerCount) headerCount.textContent = count;
    document.querySelectorAll('.cart-badge,.vs-cart-count,.vs-mob-badge').forEach(function (el) { el.textContent = count; });
    if (count > 0) {
      fabBadge.textContent = count; fabBadge.style.display = '';
      fabBadge.style.animation = 'none'; void fabBadge.offsetHeight; fabBadge.style.animation = '';
    } else {
      fabBadge.style.display = 'none';
    }
  }

  function updateShippingBar(subtotal) {
    if (!FREE_SHIP) { addClass(shippingBar, 'hidden'); return; }
    rmClass(shippingBar, 'hidden');
    const remain = FREE_SHIP - subtotal;
    const pct = Math.min(100, (subtotal / FREE_SHIP) * 100);
    shippingFill.style.width = pct + '%';
    if (remain <= 0) {
      addClass(shippingFill, 'complete');
      shippingText.innerHTML = '<span class="emsc-success-text">🎉 Saat ilmaisen toimituksen!</span>';
    } else {
      rmClass(shippingFill, 'complete');
      shippingText.innerHTML = 'Osta vielä <span class="emsc-highlight">' + money(remain * 100) + '</span> jotta saat ilmaisen toimituksen';
    }
  }

  // ---------- flash upsells ----------
  function getFlashSource() {
    const tag = document.getElementById('pk-flash-source');
    if (!tag) return [];
    try { return JSON.parse(tag.textContent.trim() || '[]'); } catch (e) { return []; }
  }

  function renderUpsells() {
    if (!FLASH_ENABLED) { hide(flash); return; }
    const src = getFlashSource();
    if (!src.length) { hide(flash); return; }

    // exclude items already in cart
    const cartIds = (cartData && cartData.items || []).map(function (i) { return i.product_id; });
    const candidates = src.filter(function (p) { return cartIds.indexOf(p.id) === -1; }).slice(0, 2);
    if (!candidates.length) { hide(flash); return; }

    let html = '';
    candidates.forEach(function (p) {
      const newPrice = Math.round(p.price * (1 - FLASH_DISC / 100));
      const variant = p.variation_label && p.variation_label !== 'Default Title'
        ? '<span class="emsc-flash-variant">' + esc(p.variation_label) + '</span>'
        : '';
      html += '' +
        '<div class="emsc-flash-item" data-variant-id="' + esc(p.variant_id) + '">' +
          '<span class="emsc-flash-tag">-' + FLASH_DISC + '%</span>' +
          '<a href="' + esc(p.permalink) + '" class="emsc-flash-thumb"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy"></a>' +
          '<div class="emsc-flash-info"><a href="' + esc(p.permalink) + '" class="emsc-flash-name">' + esc(p.name) + '</a>' + variant + '</div>' +
          '<div class="emsc-flash-price-col">' +
            '<span class="emsc-flash-new">' + money(newPrice) + '</span>' +
            '<span class="emsc-flash-old">' + money(p.price) + '</span>' +
          '</div>' +
          '<button class="emsc-flash-plus" data-variant-id="' + esc(p.variant_id) + '" aria-label="Add"><span class="emsc-plus-icon">+</span></button>' +
        '</div>';
    });
    flashProducts.innerHTML = html;
    show(flash);
    startFlashTimer();

    $$('.emsc-flash-plus').forEach(function (btn) {
      btn.onclick = function (e) {
        e.preventDefault();
        if (btn.classList.contains('adding') || btn.classList.contains('added')) return;
        const vid = btn.getAttribute('data-variant-id');
        addClass(btn, 'adding');
        btn.innerHTML = '<span class="emsc-btn-spinner"></span>';
        showLoader(); invalidateCache();

        fetch(ROUTES.cart_add, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ items: [{ id: parseInt(vid, 10), quantity: 1 }] })
        })
          .then(function (r) { return r.json(); })
          .then(function () {
            rmClass(btn, 'adding'); addClass(btn, 'added');
            btn.innerHTML = '<span class="emsc-check-icon">✓</span>';
            refreshCart(false);
          })
          .catch(function () {
            rmClass(btn, 'adding');
            btn.innerHTML = '<span class="emsc-plus-icon">+</span>';
            hideLoader();
          });
      };
    });
  }

  function initFlashTimer() {
    const stored = sessionStorage.getItem('emsc_flash_end');
    if (stored) {
      flashEndTime = parseInt(stored, 10);
      if (flashEndTime <= Date.now()) { flashEndTime = null; sessionStorage.removeItem('emsc_flash_end'); }
    }
  }
  function startFlashTimer() {
    if (!flashEndTime) {
      flashEndTime = Date.now() + FLASH_TIMER_MIN * 60 * 1000;
      sessionStorage.setItem('emsc_flash_end', flashEndTime);
    }
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function () {
      const rem = flashEndTime - Date.now();
      if (rem <= 0) {
        clearInterval(timerInterval);
        flashEndTime = Date.now() + FLASH_TIMER_MIN * 60 * 1000;
        sessionStorage.setItem('emsc_flash_end', flashEndTime);
        startFlashTimer(); return;
      }
      const m = Math.floor(rem / 60000); const s = Math.floor((rem % 60000) / 1000);
      flashTimerEl.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
