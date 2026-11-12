/* Workspace Junction landing-page checkout.
   Same page and steps as the original /m/checkout.html, with payment handled by this site's
   own billing API and Stripe's hosted payment page:
   - the price shown is confirmed by the server before the customer can pay;
   - card details are entered only on Stripe, never in this page;
   - nothing is ever shown as paid here. Confirmation happens after Stripe returns. */
(function () {
  'use strict';

  var API = '/api/public/catalog';
  var ADDRESS = 'A real Oakbrook Terrace street address with your own mailbox number';

  /* Prices are the ones published on the landing pages. `plans` maps each billing cycle to the
     catalog package that is actually charged; the amount is always re-read from the server. */
  var PACKAGES = {
    mailbox: {
      name: 'Business Mailbox',
      badge: 'BEST SELLER',
      defaultCycle: 'monthly',
      image: 'images/wj-workstation.webp',
      description: 'A real commercial street address in Oakbrook Terrace with a secure private mailbox and 24/7 access.',
      plans: {
        monthly: {slug: 'mailbox-rental-monthly-flex', cents: 3500, label: 'month', caption: 'Billed every month.'},
        yearly: {slug: 'mailbox-rental-annual', cents: 34800, label: 'year', caption: '$29/month, billed annually. One payment covers 12 months and saves $72.'}
      },
      features: [
        {name: 'Real street address', desc: ADDRESS},
        {name: 'Secure, private mailbox', desc: 'Your own lockable mailbox'},
        {name: '24/7 mailbox access', desc: 'Collect your mail any time'},
        {name: 'Mail and package receiving', desc: 'Business mailing address. Not a registered agent service.'}
      ]
    },
    founders: {
      name: 'Founders Package',
      badge: 'MOST POPULAR',
      defaultCycle: 'yearly',
      image: 'images/wj-coworking.webp',
      description: 'LLC formation, registered agent, business address with mailbox, a 5-page website with hosting, and workspace hours.',
      plans: {
        yearly: {slug: 'founders-package', cents: 49700, label: 'year', caption: '$41.42/month, billed annually. Approx. $150 Illinois state filing fee is paid separately to Illinois. Domain not included.'}
      },
      features: [
        {name: 'Illinois LLC formation', desc: 'We prepare and file for you'},
        {name: 'Registered agent for one year', desc: 'Illinois registered agent service'},
        {name: 'Business address with mailbox', desc: ADDRESS},
        {name: '5-page website', desc: 'With hosting and management'},
        {name: 'Meeting room and coworking hours', desc: 'Plus member discounts'}
      ]
    },
    'founders-pro': {
      name: 'Founders Pro Package',
      badge: 'FULL SERVICE',
      defaultCycle: 'yearly',
      image: 'images/wj-team-meeting.webp',
      description: 'Everything in Founders plus a done-for-you CRM with lead capture, automated follow-up and scheduling.',
      plans: {
        yearly: {slug: 'founders-pro-package', cents: 390000, label: 'year', caption: '$325/month, billed annually. Approx. $150 Illinois state filing fee is paid separately to Illinois. Domain registration is not included.'}
      },
      features: [
        {name: 'LLC formation and registered agent', desc: 'Or annual filing management if you already have an LLC'},
        {name: 'Mailbox with business address', desc: ADDRESS + ', 24/7 access'},
        {name: '5-page website with hosting', desc: 'Two rounds of revisions'},
        {name: 'CRM setup with pipelines', desc: 'Built for your business'},
        {name: 'Automated follow-up by email and SMS', desc: 'With lead capture from your website'},
        {name: 'Appointment scheduling and reporting', desc: 'Contact management and growth tools'}
      ]
    }
  };
  var ALIASES = {'mailbox-privacy': 'mailbox', business_mailbox: 'mailbox', 'founders-launch': 'founders', 'founders-pro-crm': 'founders-pro', 'founders-pro-leads': 'founders-pro', founders_pro: 'founders-pro'};

  var $ = function (id) { return document.getElementById(id); };
  var money = function (cents) { return '$' + (cents / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}); };
  var text = function (value) { var s = document.createElement('span'); s.textContent = value == null ? '' : String(value); return s.innerHTML; };

  var params = new URLSearchParams(window.location.search);
  var requested = params.get('package') || 'founders';
  var selectedSlug = PACKAGES[requested] ? requested : ALIASES[requested] || 'founders';
  var pkg = PACKAGES[selectedSlug];
  var cycle = pkg.plans[params.get('cycle')] ? params.get('cycle') : pkg.defaultCycle;
  var quote = null;        // last server-confirmed price for the current selection
  var quoteToken = 0;
  var confirmExtra = false; // set after the customer confirms a second subscription to the same plan
  var busy = false;

  /* ── One-time page adjustments ── */
  function prepare() {
    /* Card details are entered on Stripe only, so the card inputs are removed, not just hidden. */
    ['stripe-standard-fields', 'stripe-element-field'].forEach(function (id) { var el = $(id); if (el) el.remove(); });
    var save = $('save-card');
    var saveLine = save && save.closest('label');
    var note = document.createElement('p');
    note.className = 'wjm-terms-notice';
    note.id = 'wj-pay-note';
    note.style.cssText = 'margin:0 0 14px; font-size:14px;';
    note.textContent = 'You will enter your card on Stripe\'s secure payment page in the next step. No card details are typed into this page.';
    if (saveLine) saveLine.replaceWith(note);

    /* The simulated confirmation screen of the original page is never used. */
    var confirmView = $('confirmation-view');
    if (confirmView) confirmView.remove();

    var button = $('btn-submit-checkout');
    var terms = document.createElement('label');
    terms.className = 'wjm-checkbox-line';
    terms.style.marginTop = '16px';
    terms.innerHTML = '<input type="checkbox" id="wj-terms"> <span>I agree to the <a href="https://workspacejunction.com/terms/" target="_blank" rel="noopener">Terms &amp; Conditions</a>, to a Workspace Junction account being created for this purchase, and to this plan renewing automatically at the price shown until I cancel.</span>';
    var status = document.createElement('div');
    status.id = 'wj-checkout-status';
    status.setAttribute('role', 'alert');
    status.setAttribute('tabindex', '-1');
    status.style.cssText = 'color:#DC2626; font-size:14px; margin-top:12px; min-height:1em;';
    if (button) { button.parentNode.insertBefore(terms, button); button.parentNode.insertBefore(status, button); }

    /* Details typed into a landing-page form arrive through this tab's session storage. */
    try {
      var saved = JSON.parse(window.sessionStorage.getItem('wj_checkout_prefill') || 'null');
      if (saved) {
        if (saved.name && $('cust-name')) $('cust-name').value = saved.name;
        if (saved.email && $('cust-email')) $('cust-email').value = saved.email;
        if (saved.phone && $('cust-phone')) $('cust-phone').value = saved.phone;
      }
    } catch (err) { /* storage blocked: the form starts empty */ }
  }

  function setStatus(message, isError) {
    var box = $('wj-checkout-status');
    if (!box) return;
    box.style.color = isError === false ? '#0e3421' : '#DC2626';
    box.textContent = message || '';
    if (message) box.focus();
  }

  function setButtons(disabled, label) {
    [['btn-submit-checkout', '🔒 Pay with Stripe &amp; Complete Membership'], ['btn-side-submit', '🔒 Pay with Stripe']].forEach(function (pair) {
      var btn = $(pair[0]);
      if (!btn) return;
      btn.disabled = disabled;
      btn.innerHTML = '<span>' + (label || pair[1]) + '</span>' + (label ? '' : ' &rarr;');
    });
  }

  /* ── Rendering ── */
  function render() {
    var plan = pkg.plans[cycle];
    $('plan-thumb-img').src = pkg.image;
    $('plan-name-display').textContent = pkg.name;
    $('side-plan-name').textContent = pkg.name;
    $('plan-badge-display').textContent = pkg.badge;
    $('plan-desc-display').textContent = pkg.description + ' ' + plan.caption;
    $('plan-price-display').textContent = (plan.cents / 100).toFixed(2);
    $('plan-cycle-display').textContent = plan.label;
    $('side-plan-price').textContent = money(plan.cents) + ' / ' + plan.label;

    var select = $('billing-cycle-select');
    select.innerHTML = Object.keys(pkg.plans).map(function (key) { return '<option value="' + key + '">' + (key === 'yearly' ? 'Yearly' : 'Monthly') + '</option>'; }).join('');
    select.value = cycle;
    select.disabled = Object.keys(pkg.plans).length < 2;

    $('plan-features-list').innerHTML = pkg.features.map(function (f) {
      return '<li class="wjm-feature-bullet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><div><strong>' + text(f.name) + '</strong><br><small style="color:#64748B;">' + text(f.desc) + '</small></div></li>';
    }).join('');

    $('side-subtotal').textContent = '…';
    $('side-total').textContent = '…';
    confirmExtra = false;
    refreshQuote();
  }

  /* The server is the only source of the amount that will be charged. */
  function refreshQuote() {
    var token = ++quoteToken;
    var plan = pkg.plans[cycle];
    quote = null;
    setButtons(true, 'Checking price…');
    fetch(API + '/quote/', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-WSJ-CSRF': '1'}, body: JSON.stringify({planSlug: plan.slug})})
      .then(function (res) { return res.json().then(function (body) { return {ok: res.ok, body: body}; }); })
      .then(function (result) {
        if (token !== quoteToken) return;
        if (!result.ok || typeof result.body.dueNowAmount !== 'number') throw new Error('quote');
        quote = result.body;
        $('side-subtotal').textContent = money(quote.subtotalAmount);
        $('side-tax').textContent = money(quote.taxAmount || 0);
        $('side-total').textContent = money(quote.dueNowAmount);
        $('plan-price-display').textContent = (quote.dueNowAmount / 100).toFixed(2);
        $('side-plan-price').textContent = money(quote.dueNowAmount) + ' / ' + plan.label;
        /* Terms attached to the package (for example a minimum term) are shown before payment. */
        var notice = quote.notices && quote.notices.rulesNotice;
        if (notice) $('plan-desc-display').textContent = pkg.description + ' ' + plan.caption + ' ' + notice;
        setStatus('');
        setButtons(false);
      })
      .catch(function () {
        if (token !== quoteToken) return;
        $('side-subtotal').textContent = '—';
        $('side-total').textContent = '—';
        setButtons(true, 'Online checkout unavailable');
        setStatus('We could not confirm the price for this plan right now, so online checkout is paused. Please call (773) 986-1908 or email grow@workspacejunction.com and we will set it up with you.');
      });
  }

  /* ── Plan picker (same modal as the original page) ── */
  function initPlanModal() {
    var modal = $('plan-modal');
    var container = $('modal-plans-container');
    $('open-plan-modal').addEventListener('click', function () {
      container.innerHTML = Object.keys(PACKAGES).map(function (slug) {
        var p = PACKAGES[slug];
        var first = p.plans[p.defaultCycle];
        return '<div class="wjm-modal-plan-row ' + (slug === selectedSlug ? 'is-selected' : '') + '" data-slug="' + slug + '" role="button" tabindex="0"><div><strong style="font-size:15px; color:var(--wj-forest);">' + text(p.name) + '</strong><span class="wjm-plan-badge" style="margin-left:8px; font-size:10px;">' + text(p.badge) + '</span><p style="margin:4px 0 0; font-size:12px; color:#64748B;">' + text(p.description.slice(0, 75)) + '...</p></div><div style="text-align:right;"><strong style="font-size:16px; color:var(--wj-forest);">' + money(first.cents) + '</strong><small style="color:#64748B;">/' + first.label + '</small></div></div>';
      }).join('');
      modal.classList.add('is-open');
      container.querySelectorAll('.wjm-modal-plan-row').forEach(function (row) {
        var choose = function () {
          selectedSlug = row.getAttribute('data-slug');
          pkg = PACKAGES[selectedSlug];
          cycle = pkg.defaultCycle;
          render();
          modal.classList.remove('is-open');
        };
        row.addEventListener('click', choose);
        row.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      });
    });
    $('close-plan-modal').addEventListener('click', function () { modal.classList.remove('is-open'); });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('is-open'); });
  }

  /* ── Payment ── */
  function value(id) { var el = $(id); return el ? el.value.trim() : ''; }

  function pay() {
    if (busy) return;
    if (!quote) { setStatus('Please wait until the price has been confirmed.'); return; }
    var name = value('cust-name'), email = value('cust-email'), phone = value('cust-phone');
    var address = value('bill-address'), city = value('bill-city'), zip = value('bill-zip');
    if (!name || !email || !phone || !address || !city || !zip) { setStatus('Please fill in your name, email, phone and billing address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('Enter a valid email address, like name@example.com.'); $('cust-email').focus(); return; }
    if (!$('wj-terms').checked) { setStatus('Please tick the box to agree to the terms before paying.'); $('wj-terms').focus(); return; }

    var prefix = value('cust-phone-prefix');
    var billing = [address, value('bill-apt'), city, value('bill-state'), zip, value('bill-country')].filter(Boolean).join(', ');
    busy = true;
    setStatus('');
    setButtons(true, 'Opening Stripe…');

    fetch(API + '/checkout/', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json', 'X-WSJ-CSRF': '1'},
      body: JSON.stringify({
        planSlug: pkg.plans[cycle].slug,
        customerName: name,
        customerEmail: email,
        customerPhone: ((prefix && phone.charAt(0) !== '+' ? prefix + ' ' : '') + phone).slice(0, 50),
        notes: ('Landing-page checkout (' + selectedSlug + '). Billing address: ' + billing).slice(0, 2000),
        acceptRecurringTerms: true,
        acceptAccountTerms: true,
        confirmAdditionalSubscription: confirmExtra || undefined
      })
    })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (body) { return {status: res.status, ok: res.ok, body: body}; }); })
      .then(function (result) {
        var body = result.body || {};
        if (result.status === 409 && body.code === 'DUPLICATE_SUBSCRIPTION') {
          confirmExtra = true;
          throw new Error((body.message || 'You already have this plan.') + ' Press the pay button again if you want a second one.');
        }
        if (!result.ok) throw new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Checkout could not be started. Please try again.');
        if (!body.checkoutUrl) throw new Error('Checkout could not be started. Please try again or call (773) 986-1908.');
        try {
          if (body.receiptProof && body.orderId) window.sessionStorage.setItem('wsj-receipt:' + body.orderId, body.receiptProof);
          window.sessionStorage.removeItem('wj_checkout_prefill');
        } catch (err) { /* storage blocked: the confirmation page still shows the payment state */ }
        /* Stripe's hosted page takes the card. This page never reports a payment itself. */
        window.location.href = body.checkoutUrl;
      })
      .catch(function (error) {
        busy = false;
        setButtons(false);
        setStatus(error && error.message ? error.message : 'Checkout could not be started. Please try again.');
      });
  }

  function init() {
    prepare();
    initPlanModal();
    $('billing-cycle-select').addEventListener('change', function (e) { if (pkg.plans[e.target.value]) { cycle = e.target.value; render(); } });
    $('btn-submit-checkout').addEventListener('click', pay);
    $('btn-side-submit').addEventListener('click', pay);
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
