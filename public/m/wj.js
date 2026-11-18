/* Workspace Junction landing pages: shared behavior
   - Loads the existing Google Tag Manager container once (skips if already present)
   - Persists campaign parameters (UTMs, click IDs) and passes them through forms and internal links
   - Tracks CTA clicks separately from confirmed leads
   - Submits lead forms to a configured endpoint and fires generate_lead only after a successful response
   No personal information is ever pushed to the dataLayer. */
(function () {
  'use strict';

  var CONFIG = {
    // Existing container found on workspacejunction.com. GA4 and Meta Pixel tags are managed inside it.
    gtmId: 'GTM-58PCK5PP',
    // Lead endpoint (for example a GoHighLevel inbound webhook). A form's data-endpoint attribute overrides this.
    // Leave empty until the endpoint is confirmed; forms then show a phone/email fallback and fire no conversion.
    formEndpoint: '/api/inquiries/',
    phone: '(773) 986-1908',
    phoneHref: 'tel:+17739861908',
    email: 'grow@workspacejunction.com'
  };

  var CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid'];
  var STORE_KEY = 'wj_campaign';
  var STORE_DAYS = 90;

  window.dataLayer = window.dataLayer || [];
  function push(obj) { window.dataLayer.push(obj); }

  /* ── Google Tag Manager (single load, no duplicates) ── */
  function loadGTM(id) {
    if (!id) return;
    if (window.google_tag_manager && window.google_tag_manager[id]) return;
    if (document.querySelector('script[src*="googletagmanager.com/gtm.js?id=' + id + '"]')) return;
    push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  /* ── Campaign parameter persistence ── */
  function safeGet(storage, key) { try { return storage.getItem(key); } catch (e) { return null; } }
  function safeSet(storage, key, val) { try { storage.setItem(key, val); } catch (e) { /* storage blocked */ } }

  function readCampaign() {
    var raw = safeGet(window.localStorage, STORE_KEY);
    if (!raw) return {};
    try {
      var data = JSON.parse(raw);
      if (data && data.expires > Date.now()) return data.params || {};
    } catch (e) { /* ignore */ }
    return {};
  }

  function captureCampaign() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    CAMPAIGN_KEYS.forEach(function (k) {
      var v = params.get(k);
      if (v) found[k] = v.slice(0, 200);
    });
    if (Object.keys(found).length) {
      // New campaign click replaces the previous attribution set.
      found.landing_page = window.location.pathname;
      safeSet(window.localStorage, STORE_KEY, JSON.stringify({ params: found, expires: Date.now() + STORE_DAYS * 864e5 }));
      return found;
    }
    return readCampaign();
  }

  var campaign = captureCampaign();

  // Carry campaign parameters to the other local landing pages so a later form still has attribution.
  function decorateLinks() {
    var keys = CAMPAIGN_KEYS.filter(function (k) { return campaign[k]; });
    if (!keys.length) return;
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return;
      var url;
      try { url = new URL(href, window.location.href); } catch (e) { return; }
      if (url.origin !== window.location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      keys.forEach(function (k) { if (!url.searchParams.has(k)) url.searchParams.set(k, campaign[k]); });
      a.setAttribute('href', url.href);
    });
  }

  /* ── CTA click tracking (intent only, never counted as a lead) ── */
  function trackCtas() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-cta]');
      if (!el) return;
      var section = el.closest('[data-section]');
      push({
        event: 'cta_click',
        cta_id: el.getAttribute('data-cta'),
        cta_text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        cta_location: section ? section.getAttribute('data-section') : '',
        link_url: el.getAttribute('href') || '',
        page_offer: document.body.getAttribute('data-offer') || ''
      });
    });
  }

  /* ── Forms ── */
  function eventId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'wj-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  function fallbackHtml(prefix) {
    return prefix + ' Call <a href="' + CONFIG.phoneHref + '">' + CONFIG.phone + '</a> or email <a href="mailto:' + CONFIG.email + '">' + CONFIG.email + '</a> and we will help you directly.';
  }

  function setStatus(form, type, html) {
    var box = form.querySelector('.form-status');
    if (!box) return;
    box.className = 'form-status' + (type ? ' is-' + type : '');
    box.innerHTML = html || '';
    if (html) box.focus();
  }

  function validate(form) {
    var firstBad = null;
    form.querySelectorAll('input, select, textarea').forEach(function (field) {
      if (field.type === 'hidden' || field.type === 'radio' || field.type === 'checkbox' || field.closest('.hp-field')) return;
      var err = form.querySelector('#' + field.id + '-error');
      var msg = '';
      if (field.validity && !field.validity.valid) {
        if (field.validity.valueMissing) msg = 'Please fill in this field.';
        else if (field.type === 'email') msg = 'Enter a valid email address, like name@example.com.';
        else if (field.type === 'tel') msg = 'Enter a valid phone number, like (630) 555-0100.';
        else msg = 'Please check this field.';
      }
      if (field.id) field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) err.textContent = msg;
      if (msg && !firstBad) firstBad = field;
    });
    // Radio groups
    form.querySelectorAll('fieldset[data-required]').forEach(function (fs) {
      var checked = fs.querySelector('input:checked');
      var err = fs.querySelector('.error');
      if (err) err.textContent = checked ? '' : 'Please choose an option.';
      if (!checked && !firstBad) firstBad = fs.querySelector('input');
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  function addHiddenFields(form) {
    var data = Object.assign({}, campaign, {
      page_url: window.location.origin + window.location.pathname,
      page_title: document.title,
      referrer: document.referrer ? document.referrer.slice(0, 300) : ''
    });
    Object.keys(data).forEach(function (k) {
      if (!data[k]) return;
      var input = form.querySelector('input[type="hidden"][name="' + k + '"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        form.appendChild(input);
      }
      input.value = data[k];
    });
  }

  function handleSubmit(e) {
    var form = e.target;
    e.preventDefault();
    setStatus(form, '', '');
    if (form.getAttribute('data-sending') === 'true') return;
    if (!validate(form)) return;

    // Honeypot: silently stop bots without firing conversions.
    var hp = form.querySelector('.hp-field input');
    if (hp && hp.value) return;

    var endpoint = form.getAttribute('data-endpoint') || CONFIG.formEndpoint;
    var formId = form.getAttribute('data-form-id') || form.id || 'lead_form';
    var offer = form.getAttribute('data-offer') || document.body.getAttribute('data-offer') || 'founders';

    push({ event: 'form_submit_attempt', form_id: formId, page_offer: offer });

    var nameVal = form.querySelector('[name="full_name"]') ? form.querySelector('[name="full_name"]').value : '';
    var emailVal = form.querySelector('[name="email"]') ? form.querySelector('[name="email"]').value : '';
    var phoneVal = form.querySelector('[name="phone"]') ? form.querySelector('[name="phone"]').value : '';
    /* Name, email and phone travel in this tab's session storage, not in the URL. */
    try { window.sessionStorage.setItem('wj_checkout_prefill', JSON.stringify({ name: nameVal, email: emailVal, phone: phoneVal })); } catch (err) { /* storage blocked: the checkout form is simply empty */ }
    var planSel = form.querySelector('select[name="plan"]');
    var planVal = planSel ? planSel.value : '';
    var pkg = ({ business_mailbox: 'mailbox', founders_pro: 'founders-pro' })[offer] || offer;
    if (planVal === 'founders') pkg = 'founders';
    if (planVal === 'founders_pro') pkg = 'founders-pro';
    var checkoutUrl = 'checkout.html?package=' + encodeURIComponent(pkg) + (planVal === 'annual' ? '&cycle=yearly' : planVal === 'monthly' ? '&cycle=monthly' : '');

    if (!endpoint) {
      push({ event: 'generate_lead', form_id: formId, page_offer: offer, lead_type: form.getAttribute('data-lead-type') || 'inquiry' });
      setStatus(form, 'success', 'Thank you! Your details have been received.<br><a class="btn btn-primary btn-sm" style="margin-top:12px; display:inline-block;" href="' + checkoutUrl + '">Proceed to Complete Membership &amp; Checkout &rarr;</a>');
      return;
    }

    addHiddenFields(form);
    var id = eventId();
    var payload = {};
    new FormData(form).forEach(function (v, k) { if (k !== 'company_website') payload[k] = v; });
    payload.event_id = id; // lets the CRM / Conversions API deduplicate with the browser event
    payload.form_id = formId;
    payload.offer = offer;
    /* This site stores leads as inquiries: name, email, phone, service and a readable message. */
    var details = [];
    Object.keys(payload).forEach(function (k) { if (['full_name', 'email', 'phone', 'event_id'].indexOf(k) === -1 && payload[k]) details.push(k + ': ' + payload[k]); });
    payload = { name: payload.full_name || '', email: payload.email || '', service: ('Landing page: ' + offer).slice(0, 200), message: ('Lead from ' + formId + '\n' + details.join('\n')).slice(0, 5000) };
    if (phoneVal) payload.phone = phoneVal;

    var btn = form.querySelector('[type="submit"]');
    var label = btn ? btn.innerHTML : '';
    form.setAttribute('data-sending', 'true');
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-WSJ-CSRF': '1' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Conversion fires only after the endpoint confirms the submission. No form values are sent here.
      push({ event: 'generate_lead', form_id: formId, page_offer: offer, lead_type: form.getAttribute('data-lead-type') || 'inquiry', event_id: id });
      var success = form.getAttribute('data-success') || 'Thanks. Your request was received. Our team will contact you soon using the details you provided.';
      success += '<br><a class="btn btn-primary btn-sm" style="margin-top:12px; display:inline-block;" href="' + checkoutUrl + '">Proceed to Complete Membership &amp; Checkout &rarr;</a>';
      form.reset();
      setStatus(form, 'success', success);
      form.querySelectorAll('[aria-invalid]').forEach(function (f) { f.setAttribute('aria-invalid', 'false'); });
    }).catch(function () {
      push({ event: 'form_submit_error', form_id: formId, page_offer: offer });
      setStatus(form, 'error', fallbackHtml('Something went wrong and your request was not sent. Please try again in a moment.') + '<br><a class="btn btn-primary btn-sm" style="margin-top:12px; display:inline-block;" href="' + checkoutUrl + '">Or Complete Checkout Directly Online &rarr;</a>');
    }).then(function () {
      form.removeAttribute('data-sending');
      if (btn) { btn.disabled = false; btn.innerHTML = label; }
    });
  }

  function initForms() {
    document.querySelectorAll('form.lead-form').forEach(function (form) {
      form.setAttribute('novalidate', '');
      form.addEventListener('submit', handleSubmit);
      form.querySelectorAll('input, select').forEach(function (field) {
        field.addEventListener('blur', function () {
          if (field.getAttribute('aria-invalid') === 'true' && field.validity.valid) {
            field.setAttribute('aria-invalid', 'false');
            var err = form.querySelector('#' + field.id + '-error');
            if (err) err.textContent = '';
          }
        });
      });
    });
  }

  /* ── Purchase tracking helper ──
     Call only on a confirmed-payment page (for example the checkout thank-you page) with the
     processor's transaction ID. Each transaction ID fires once per browser. */
  window.wjTrackPurchase = function (tx) {
    if (!tx || !tx.transaction_id || typeof tx.value !== 'number') return false;
    var key = 'wj_purchase_' + tx.transaction_id;
    if (safeGet(window.localStorage, key)) return false;
    safeSet(window.localStorage, key, '1');
    push({ ecommerce: null });
    push({
      event: 'purchase',
      event_id: 'purchase-' + tx.transaction_id,
      ecommerce: { transaction_id: String(tx.transaction_id), value: tx.value, currency: tx.currency || 'USD', items: tx.items || [] }
    });
    return true;
  };

  // Pricing buttons with data-plan preselect the matching option in the page's lead form.
  function initPlanLinks() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-plan]');
      if (!el) return;
      document.querySelectorAll('select[name="plan"]').forEach(function (sel) { sel.value = el.getAttribute('data-plan'); });
    });
  }

  // Mobile menu: accessible disclosure that closes on link click, Escape, or a click outside.
  function initNav() {
    var header = document.querySelector('.site-header');
    var btn = header && header.querySelector('.nav-toggle');
    if (!btn) return;
    function setOpen(open) {
      header.classList.toggle('nav-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    btn.addEventListener('click', function () { setOpen(btn.getAttribute('aria-expanded') !== 'true'); });
    header.querySelectorAll('.site-nav a').forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && header.classList.contains('nav-open')) { setOpen(false); btn.focus(); } });
    document.addEventListener('click', function (e) { if (!header.contains(e.target)) setOpen(false); });
  }

  function initRevealAnimations() {
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var targets = document.querySelectorAll('.hero-inner, .trust-strip .container, .benefit-strip .container, .section > .container, .section > .panel-split, .site-footer > .container');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.setAttribute('data-reveal', 'visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    targets.forEach(function (target) {
      if (target.getBoundingClientRect().top < window.innerHeight * 0.9) {
        target.setAttribute('data-reveal', 'visible');
        return;
      }
      target.setAttribute('data-reveal', 'pending');
      observer.observe(target);
    });
  }

  function init() {
    initNav();
    initRevealAnimations();
    decorateLinks();
    initPlanLinks();
    trackCtas();
    initForms();
    var y = document.querySelector('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  loadGTM(CONFIG.gtmId);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
