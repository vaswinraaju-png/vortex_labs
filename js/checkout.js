// ─────────────────────────────────────────────────────────────
// CHECKOUT FLOW — Razorpay integration.
// Order creation and signature verification happen server-side
// via /api/create-order and /api/verify-payment (using the
// Secret Key, never exposed to the browser).
// ─────────────────────────────────────────────────────────────
const PRICE = 499; // INR

function saveOrder(data){
  const existing = getOrder() || {};
  sessionStorage.setItem('ads_dashboard_order', JSON.stringify({...existing, ...data}));
}
function getOrder(){
  try{ return JSON.parse(sessionStorage.getItem('ads_dashboard_order') || 'null'); }
  catch{ return null; }
}

// ── checkout.html ──
let _validatedCoupon = null; // { code, discountedAmount } once applied successfully

async function applyCoupon(){
  const input = document.getElementById('coupon');
  const btn = document.getElementById('apply-coupon-btn');
  const msgEl = document.getElementById('coupon-msg');
  const code = input.value.trim();

  if(!code){
    msgEl.textContent = 'Enter a coupon code first.';
    msgEl.style.color = 'var(--muted, #6b6b6b)';
    msgEl.style.display = 'block';
    return;
  }

  btn.textContent = 'Checking...';
  btn.disabled = true;

  try{
    const res = await fetch('/api/validate-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon: code })
    });
    const data = await res.json();

    if(data.valid){
      _validatedCoupon = { code, discountedAmount: data.discountedAmount };
      msgEl.textContent = `Coupon applied ✓ ${data.discountPercent}% off`;
      msgEl.style.color = 'var(--success, #1a7a3d)';
      msgEl.style.display = 'block';

      document.getElementById('summary-base').textContent = '₹' + data.baseAmount;
      document.getElementById('summary-discount-row').style.display = 'flex';
      document.getElementById('summary-discount').textContent = '-₹' + (data.baseAmount - data.discountedAmount);
      document.getElementById('summary-total').textContent = '₹' + data.discountedAmount;

      input.disabled = true;
      btn.style.display = 'none';
      document.getElementById('remove-coupon-btn').style.display = 'inline-block';
    }else{
      _validatedCoupon = null;
      msgEl.textContent = data.error || 'Invalid coupon code';
      msgEl.style.color = 'var(--danger, #c0392b)';
      msgEl.style.display = 'block';

      document.getElementById('summary-base').textContent = '₹' + PRICE;
      document.getElementById('summary-discount-row').style.display = 'none';
      document.getElementById('summary-total').textContent = '₹' + PRICE;
    }
  }catch(err){
    msgEl.textContent = 'Could not check coupon: ' + err.message;
    msgEl.style.color = 'var(--danger, #c0392b)';
    msgEl.style.display = 'block';
  }finally{
    btn.textContent = 'Apply';
    btn.disabled = false;
  }
}

function removeCoupon(){
  _validatedCoupon = null;
  const input = document.getElementById('coupon');
  const msgEl = document.getElementById('coupon-msg');

  input.value = '';
  input.disabled = false;
  document.getElementById('apply-coupon-btn').style.display = 'inline-block';
  document.getElementById('remove-coupon-btn').style.display = 'none';
  msgEl.style.display = 'none';

  document.getElementById('summary-base').textContent = '₹' + PRICE;
  document.getElementById('summary-discount-row').style.display = 'none';
  document.getElementById('summary-total').textContent = '₹' + PRICE;
}

function submitCheckout(e){
  e.preventDefault();
  const name = document.getElementById('buyer-name').value.trim();
  const email = document.getElementById('buyer-email').value.trim();
  const phone = document.getElementById('buyer-phone').value.trim();
  const coupon = document.getElementById('coupon')?.value.trim() || '';
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

  const finalAmount = _validatedCoupon ? _validatedCoupon.discountedAmount : PRICE;
  saveOrder({ name, email, phone, coupon: _validatedCoupon ? coupon : '', amount: finalAmount, createdAt: Date.now() });
  window.location.href = 'payment.html';
}

// ── payment.html ──
function initPaymentPage(){
  const order = getOrder();
  if(!order){ window.location.href = 'checkout.html'; return; }
  document.getElementById('pay-name').textContent = order.name;
  document.getElementById('pay-email').textContent = order.email;
  document.getElementById('pay-amount').textContent = '₹' + order.amount;
  document.getElementById('pay-btn').textContent = 'Pay ₹' + order.amount;
}

// Loads Razorpay's Checkout.js SDK dynamically, only when needed.
function loadRazorpayScript(){
  return new Promise((resolve, reject) => {
    if(window.Razorpay){ resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });
}

// Creates the order server-side, then opens Razorpay's hosted
// checkout popup.
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
    await loadRazorpayScript();

    const res = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: order.name, email: order.email, phone: order.phone, coupon: order.coupon || '' })
    });
    const data = await res.json();

    if(!res.ok){
      throw new Error(data.error || 'Failed to create order');
    }

    saveOrder({ rzpOrderId: data.orderId, amount: data.amount });

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
          const verify = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              name: order.name, email: order.email, phone: order.phone,
              amount: order.amount, coupon: order.coupon || ''
            })
          });
          const result = await verify.json();
          if(result.verified){
            saveOrder({
              paid: true,
              rzpPaymentId: response.razorpay_payment_id,
              rzpOrderId: response.razorpay_order_id
            });
            window.location.href = 'success.html?payment_id=' + encodeURIComponent(response.razorpay_payment_id);
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
function initSuccessPage(){
  const params = new URLSearchParams(window.location.search);
  const paymentId = params.get('payment_id');
  const order = getOrder();

  if(!paymentId || !order || !order.paid){
    document.getElementById('success-pending').style.display = 'none';
    document.getElementById('success-error').style.display = 'block';
    document.getElementById('success-error-detail').textContent =
      'We could not confirm this order. If you completed payment, contact support with your payment ID.';
    return;
  }

  document.getElementById('success-pending').style.display = 'none';
  document.getElementById('success-content').style.display = 'block';
  document.getElementById('success-name').textContent = order.name || '—';
  document.getElementById('success-email').textContent = order.email || '—';
  document.getElementById('success-order-id').textContent = paymentId;
}
