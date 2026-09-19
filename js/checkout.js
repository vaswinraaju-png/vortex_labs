// ─────────────────────────────────────────────────────────────
// CHECKOUT FLOW — client-side only. No backend exists yet.
// Order details are passed between checkout.html -> payment.html
// -> success.html via sessionStorage (per-tab, cleared on close).
// ─────────────────────────────────────────────────────────────
const ORDER_KEY = 'ads_dashboard_order';
const PRICE = 19; // USD

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
  window.location.href = 'payment.html';
}

// ── payment.html ──
function initPaymentPage(){
  const order = getOrder();
  if(!order){ window.location.href = 'checkout.html'; return; }
  document.getElementById('pay-name').textContent = order.name;
  document.getElementById('pay-email').textContent = order.email;
  document.getElementById('pay-amount').textContent = '$' + order.amount;
}

// ─────────────────────────────────────────────────────────────
// TODO: replace this stub with your real payment gateway.
//
// Example (Razorpay):
//   const rzp = new Razorpay({
//     key: 'YOUR_KEY_ID',
//     amount: order.amount * 100,
//     currency: 'INR',
//     name: 'Ads Dashboard',
//     prefill: { name: order.name, email: order.email, contact: order.phone },
//     handler: function(response){
//       saveOrder({ paymentId: response.razorpay_payment_id, paid: true });
//       window.location.href = 'success.html';
//     }
//   });
//   rzp.open();
//
// Example (Stripe Checkout): redirect to a Checkout Session URL
// created by your backend, then handle the success redirect back
// to success.html?session_id=... and verify server-side.
//
// This stub simply marks the order paid and moves on, so the flow
// is testable end-to-end before a real gateway is wired in.
// ─────────────────────────────────────────────────────────────
function submitPaymentStub(e){
  e.preventDefault();
  const btn = document.getElementById('pay-btn');
  btn.textContent = 'Processing...';
  btn.disabled = true;
  setTimeout(()=>{
    saveOrder({ paid: true, paymentId: 'STUB-' + Date.now() });
    window.location.href = 'success.html';
  }, 900);
}

// ── success.html ──
function initSuccessPage(){
  const order = getOrder();
  if(!order || !order.paid){ window.location.href = 'checkout.html'; return; }
  document.getElementById('success-name').textContent = order.name;
  document.getElementById('success-email').textContent = order.email;
  document.getElementById('success-order-id').textContent = order.paymentId || '—';
  // TODO: replace with your real download link / delivery mechanism
  // (e.g. a signed URL from your backend, or an emailed license key).
  document.getElementById('download-link').href = '#';
}
