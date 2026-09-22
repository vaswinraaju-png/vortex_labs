// ─────────────────────────────────────────────────────────────
// CHECKOUT FLOW — real Cashfree integration.
// Order creation happens server-side via /api/create-order
// (uses your Secret Key, never exposed to the browser).
// Order details are passed between pages via sessionStorage
// (per-tab, cleared on close) for display purposes only — the
// actual paid/unpaid truth is re-verified server-side on
// success.html via /api/order-status.
// ─────────────────────────────────────────────────────────────
const ORDER_KEY = 'ads_dashboard_order';
const PRICE = 499; // INR

// ── ChatGPT Ads advanced matching helpers ──
async function sha256Hex(str){
  const enc = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function normalizeEmail(email){ return email.trim().toLowerCase(); }
function normalizePhone(phone){
  let digits = String(phone).replace(/[\s().-]/g,'').replace(/^\+/,'').replace(/^0+/,'');
  return digits;
}
function normalizeName(name){ return name.toLowerCase().replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~]/g,''); }

// Re-inits the pixel with hashed buyer info once we have it, so later
// events (checkout_started onward) get advanced matching. Safe to call
// more than once; only one pixel is initialized on these pages.
async function identifyBuyer(name, email, phone){
  try{
    const [emailHash, phoneHash, nameHash] = await Promise.all([
      email ? sha256Hex(normalizeEmail(email)) : null,
      phone ? sha256Hex(normalizePhone(phone)) : null,
      name ? sha256Hex(normalizeName(name)) : null
    ]);
    const user = {};
    if(emailHash) user.email_sha256 = emailHash;
    if(phoneHash) user.phone_number_sha256 = phoneHash;
    if(nameHash) user.first_name_sha256 = nameHash;
    if(window.oaiq && Object.keys(user).length){
      oaiq('init', { pixelId: '4dJ5M9GtMmeF5kE4wxxd7w', user });
    }
  }catch(e){ /* advanced matching is best-effort, never block the flow */ }
}

function saveOrder(data){
  const existing = getOrder() || {};
  sessionStorage.setItem(ORDER_KEY, JSON.stringify({...existing, ...data}));
}
function getOrder(){
  try{ return JSON.parse(sessionStorage.getItem(ORDER_KEY) || 'null'); }
  catch{ return null; }
}
function clearOrder(){ sessionStorage.removeItem(ORDER_KEY); }

// ── checkout.html ──
function submitCheckout(e){
  e.preventDefault();
  const name = document.getElementById('buyer-name').value.trim();
  const email = document.getElementById('buyer-email').value.trim();
  const phone = document.getElementById('buyer-phone').value.trim();
  const errEl = document.getElementById('checkout-error');

  if(!name || !email || !phone){
    errEl.textContent = 'Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if(!emailOk){
    errEl.textContent = 'Enter a valid email address.';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  saveOrder({ name, email, phone, amount: PRICE, createdAt: Date.now() });

  identifyBuyer(name, email, phone).then(() => {
    if(window.oaiq){
      oaiq("measure", "checkout_started", {
        type: "contents",
        amount: PRICE,
        currency: "INR",
        contents: [{ id: "ads-dashboard", name: "Ads Dashboard", content_type: "product", quantity: 1 }]
      });
    }
    window.location.href = 'payment.html';
  });
}

// ── payment.html ──
function initPaymentPage(){
  const order = getOrder();
  if(!order){ window.location.href = 'checkout.html'; return; }
  document.getElementById('pay-name').textContent = order.name;
  document.getElementById('pay-email').textContent = order.email;
  document.getElementById('pay-amount').textContent = '₹' + order.amount;
  identifyBuyer(order.name, order.email, order.phone);
}

// Creates the order server-side, then opens Cashfree's hosted
// checkout using their JS SDK (loaded via <script> in payment.html).
async function submitPayment(e){
  e.preventDefault();
  const btn = document.getElementById('pay-btn');
  const errEl = document.getElementById('payment-error');
  errEl.style.display = 'none';
  btn.textContent = 'Processing...';
  btn.disabled = true;

  const order = getOrder();
  if(!order){ window.location.href = 'checkout.html'; return; }

  try{
    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: order.name,
        email: order.email,
        phone: order.phone,
        amount: order.amount
      })
    });
    const data = await res.json();

    if(!res.ok){
      throw new Error(data.error || 'Failed to create order');
    }

    saveOrder({ cfOrderId: data.orderId });

    // Cashfree JS SDK — loaded via <script src="https://sdk.cashfree.com/js/v3/cashfree.js"> in payment.html
    const cashfree = Cashfree({ mode: data.mode || 'production' });
    cashfree.checkout({
      paymentSessionId: data.paymentSessionId,
      redirectTarget: '_self'
    });
    // On success, Cashfree redirects the browser to the return_url
    // configured server-side (success.html?order_id=...).
  }catch(err){
    errEl.textContent = 'Payment could not be started: ' + err.message;
    errEl.style.display = 'block';
    btn.textContent = 'Pay ₹' + (order.amount || PRICE);
    btn.disabled = false;
  }
}

// ── success.html ──
// Re-verifies payment status server-side rather than trusting the
// redirect alone — the order_id comes back in the URL from Cashfree.
async function initSuccessPage(){
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  const order = getOrder();

  if(order) identifyBuyer(order.name, order.email, order.phone);

  if(!orderId){
    document.getElementById('success-pending').style.display = 'none';
    document.getElementById('success-error').style.display = 'block';
    return;
  }

  try{
    const res = await fetch('/api/order-status?order_id=' + encodeURIComponent(orderId));
    const data = await res.json();

    if(!res.ok || data.status !== 'PAID'){
      document.getElementById('success-pending').style.display = 'none';
      document.getElementById('success-error').style.display = 'block';
      document.getElementById('success-error-detail').textContent =
        'Order status: ' + (data.status || 'unknown') + '. If you completed payment, this may take a moment to update, or contact support with your order ID.';
      return;
    }

    saveOrder({ paid: true, cfOrderId: orderId });

    // Fire ChatGPT Ads purchase conversion event, once, using the order
    // id as event_id for dedup safety if server-side tracking is added later.
    if (window.oaiq) {
      oaiq("measure", "order_created", {
        type: "contents",
        amount: data.amount || order?.amount || PRICE,
        currency: "INR",
        contents: [{ id: "ads-dashboard", name: "Ads Dashboard", content_type: "product", quantity: 1 }]
      }, { event_id: orderId });
    }

    document.getElementById('success-pending').style.display = 'none';
    document.getElementById('success-content').style.display = 'block';
    document.getElementById('success-name').textContent = data.customerName || order?.name || '—';
    document.getElementById('success-email').textContent = data.customerEmail || order?.email || '—';
    document.getElementById('success-order-id').textContent = orderId;
    // TODO: replace with your real download link / delivery mechanism
    // (e.g. a signed URL from your backend, or an emailed license key).
    document.getElementById('download-link').href = '#';
  }catch(err){
    document.getElementById('success-pending').style.display = 'none';
    document.getElementById('success-error').style.display = 'block';
    document.getElementById('success-error-detail').textContent = 'Error checking order status: ' + err.message;
  }
}
