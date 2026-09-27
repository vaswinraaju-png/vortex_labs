// ─────────────────────────────────────────────────────────────
// Minimal Supabase REST client — no SDK dependency, just fetch
// against Supabase's auto-generated REST API (PostgREST).
//
// Requires these environment variables set in Vercel:
//   SUPABASE_URL               (Project URL, e.g. https://xxxx.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY  (service_role key, NOT the anon key —
//                                this bypasses row-level security and
//                                must never be exposed to the browser)
// ─────────────────────────────────────────────────────────────

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=representation'
  };
}

function configured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Fetch a single coupon row by code. Returns null if not found,
// not configured, or on any error (fails open to "no coupon").
async function getCoupon(code) {
  if (!configured() || !code) return null;
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/coupons?code=eq.${encodeURIComponent(code)}&select=*`,
      { headers: headers() }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error('Supabase getCoupon error:', err.message);
    return null;
  }
}

// Decrement a coupon's uses_left by 1. No-op if uses_left is null
// (unlimited) or already at 0. Best-effort, never throws.
async function decrementCoupon(code, currentUsesLeft) {
  if (!configured() || currentUsesLeft == null) return;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/coupons?code=eq.${encodeURIComponent(code)}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ uses_left: Math.max(0, currentUsesLeft - 1) })
    });
  } catch (err) {
    console.error('Supabase decrementCoupon error:', err.message);
  }
}

// Insert a new order row. Returns the inserted row, or null on
// failure (never blocks the payment flow itself).
async function insertOrder({ orderId, name, email, phone, amount, status }) {
  if (!configured()) {
    console.warn('Supabase not configured — skipping order insert.');
    return null;
  }
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify([{
        order_id: orderId,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        product_name: 'Ads Dashboard',
        product_id: 'ads-dashboard',
        amount,
        status
      }])
    });
    if (!res.ok) {
      console.error('Supabase insertOrder failed:', await res.text());
      return null;
    }
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error('Supabase insertOrder error:', err.message);
    return null;
  }
}

// Update an order's status (and payment_id) by order_id.
async function updateOrder(orderId, fields) {
  if (!configured()) {
    console.warn('Supabase not configured — skipping order update.');
    return null;
  }
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(orderId)}`,
      { method: 'PATCH', headers: headers(), body: JSON.stringify(fields) }
    );
    if (!res.ok) {
      console.error('Supabase updateOrder failed:', await res.text());
      return null;
    }
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error('Supabase updateOrder error:', err.message);
    return null;
  }
}

export { getCoupon, decrementCoupon, insertOrder, updateOrder, configured };
