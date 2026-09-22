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

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=representation'
  };
}

function supabaseConfigured() {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Insert a new order row. Returns the inserted row, or null on failure
// (failures are logged but never block the payment flow itself).
async function insertOrder({ cfOrderId, name, email, phone, amount, status }) {
  if (!supabaseConfigured()) {
    console.warn('Supabase not configured — skipping order insert.');
    return null;
  }
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: supabaseHeaders(),
      body: JSON.stringify([{
        cf_order_id: cfOrderId,
        name, email, phone,
        amount,
        status
      }])
    });
    if (!res.ok) {
      console.error('Supabase insert failed:', await res.text());
      return null;
    }
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error('Supabase insert error:', err.message);
    return null;
  }
}

// Update an order's status (and any other fields) by cf_order_id.
async function updateOrderStatus(cfOrderId, fields) {
  if (!supabaseConfigured()) {
    console.warn('Supabase not configured — skipping order update.');
    return null;
  }
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?cf_order_id=eq.${encodeURIComponent(cfOrderId)}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders(),
        body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() })
      }
    );
    if (!res.ok) {
      console.error('Supabase update failed:', await res.text());
      return null;
    }
    const rows = await res.json();
    return rows[0] || null;
  } catch (err) {
    console.error('Supabase update error:', err.message);
    return null;
  }
}

export { insertOrder, updateOrderStatus, supabaseConfigured };
