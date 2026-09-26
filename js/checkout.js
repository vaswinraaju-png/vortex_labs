// ─────────────────────────────────────────────────────────────
// CHECKOUT FLOW — real Razorpay integration.
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
  const coupon = document.getElementById('coupon')?.value.trim() || '';

  saveOrder({ name, email, phone, coupon, amount: PRICE, createdAt: Date.now() });

  identifyBuyer(name, email, phone).then(() => {
    if(window.oaiq){
      oaiq("measure", "checkout_started", {
        type: "contents",
        amount: PRICE,
        currency: "INR",
        contents: [{ id: "ads-dashboard", name: "Ads Dashboard", content_type: "product", quantity: 1 }]
      });
    }
    if(window.fbq){
      fbq('track', 'InitiateCheckout', {
        value: PRICE,
        currency: 'INR',
        content_ids: ['ads-dashboard'],
        content_type: 'product',
        contents: [{ id: 'ads-dashboard', quantity: 1 }]
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

// Creates the order server-side, then opens Razorpay's hosted
// checkout using their JS SDK (loaded via <script> in payment.html).
async function submitPayment(e){
  if(e) e.preventDefault();
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
        coupon: order.coupon || ''
      })
    });
    const data = await res.json();

    if(!res.ok){
      throw new Error(data.error || 'Failed to create order');
    }

    saveOrder({ rzpOrderId: data.orderId, amount: data.amount });

    // Razorpay Checkout JS SDK — loaded via
    // <script src="https://checkout.razorpay.com/v1/checkout.js"> in payment.html
    const rzp = new Razorpay({
      key: data.keyId,
      amount: data.amount * 100,
      currency: 'INR',
      name: 'Ads Dashboard',
      description: 'Ads Dashboard, One-time purchase',
      order_id: data.orderId,
      prefill: { name: order.name, email: order.email, contact: order.phone },
      handler: async function(response){
        try{
          const verify = await fetch('/api/order-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              name: order.name, email: order.email, phone: order.phone,
              amount: data.amount
            })
          });
          const result = await verify.json();
          if(result.verified){
            saveOrder({
              paid: true,
              rzpPaymentId: response.razorpay_payment_id,
              rzpOrderId: response.razorpay_order_id
            });
            window.location.href = 'success.html?order_id=' + encodeURIComponent(response.razorpay_order_id) + '&payment_id=' + encodeURIComponent(response.razorpay_payment_id);
          }else{
            errEl.textContent = 'Payment verification failed. Contact support with payment ID ' + response.razorpay_payment_id + '.';
            errEl.style.display = 'block';
            btn.textContent = 'Pay ₹' + (order.amount || PRICE);
            btn.disabled = false;
          }
        }catch(err){
          errEl.textContent = 'Could not verify payment: ' + err.message;
          errEl.style.display = 'block';
          btn.textContent = 'Pay ₹' + (order.amount || PRICE);
          btn.disabled = false;
        }
      },
      modal: {
        ondismiss: function(){
          btn.textContent = 'Pay ₹' + (order.amount || PRICE);
          btn.disabled = false;
        }
      }
    });
    rzp.open();
  }catch(err){
    errEl.textContent = 'Payment could not be started: ' + err.message;
    errEl.style.display = 'block';
    btn.textContent = 'Pay ₹' + (order.amount || PRICE);
    btn.disabled = false;
  }
}

// ── success.html ──
// Re-verifies payment status from our own saved order state (already
// confirmed server-side by /api/order-status during the handler above)
// rather than trusting the redirect alone.
async function initSuccessPage(){
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('order_id');
  const paymentId = params.get('payment_id');
  const order = getOrder();

  if(order) identifyBuyer(order.name, order.email, order.phone);

  if(!orderId || !order || !order.paid){
    document.getElementById('success-pending').style.display = 'none';
    document.getElementById('success-error').style.display = 'block';
    document.getElementById('success-error-detail').textContent =
      'We could not confirm this order. If you completed payment, contact support with your payment ID.';
    return;
  }

  // Fire ChatGPT Ads purchase conversion event, once, using the order
  // id as event_id for dedup safety if server-side tracking is added later.
  if (window.oaiq) {
    oaiq("measure", "order_created", {
      type: "contents",
      amount: order.amount || PRICE,
      currency: "INR",
      contents: [{ id: "ads-dashboard", name: "Ads Dashboard", content_type: "product", quantity: 1 }]
    }, { event_id: orderId });
  }

  // Fire Meta Pixel purchase conversion event, same trigger point.
  if (window.fbq) {
    fbq('track', 'Purchase', {
      value: order.amount || PRICE,
      currency: 'INR',
      content_ids: ['ads-dashboard'],
      content_type: 'product',
      contents: [{ id: 'ads-dashboard', quantity: 1 }]
    }, { eventID: orderId });
  }

  document.getElementById('success-pending').style.display = 'none';
  document.getElementById('success-content').style.display = 'block';
  document.getElementById('success-name').textContent = order.name || '—';
  document.getElementById('success-email').textContent = order.email || '—';
  document.getElementById('success-order-id').textContent = paymentId || orderId;

  // ─────────────────────────────────────────────────────────────
  // TODO: replace this URL with your real Supabase Storage / S3
  // download link for the Ads Dashboard .zip file.
  // ─────────────────────────────────────────────────────────────
  const DOWNLOAD_URL = 'REPLACE_WITH_YOUR_STORAGE_ZIP_URL';
  const dl = document.getElementById('download-link');
  dl.href = DOWNLOAD_URL;
  dl.setAttribute('download', 'ads-dashboard.zip');

  // Auto-trigger the download once, then also leave the button clickable.
  if(DOWNLOAD_URL !== 'REPLACE_WITH_YOUR_STORAGE_ZIP_URL'){
    setTimeout(() => { dl.click(); }, 600);
  }
}
