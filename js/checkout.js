// ─────────────────────────────────────────────────────────────
// STATIC PLACEHOLDER — no backend, no payment processing.
// This file intentionally does nothing beyond basic form UX.
// All payment/backend integration has been removed.
// ─────────────────────────────────────────────────────────────

function submitCheckout(e){
  e.preventDefault();
  const errEl = document.getElementById('checkout-error');
  if(errEl){
    errEl.textContent = 'Checkout is not available right now. Please check back soon.';
    errEl.style.display = 'block';
  }
}
