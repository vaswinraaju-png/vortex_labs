// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — checks a Cashfree order's payment
// status. Called by success.html after the customer returns from
// Cashfree's hosted checkout, so we never trust the redirect alone.
//
// Requires the same environment variables as create-order.js:
//   CASHFREE_APP_ID
//   CASHFREE_SECRET_KEY
//
// Must use the SAME CASHFREE_MODE as create-order.js, or order
// lookups will fail (sandbox orders don't exist in production).
// ─────────────────────────────────────────────────────────────
const CASHFREE_BASE_URL = process.env.CASHFREE_MODE === 'sandbox'
  ? 'https://sandbox.cashfree.com/pg'
  : 'https://api.cashfree.com/pg';

import { updateOrderStatus } from './_supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    return res.status(500).json({ error: 'Cashfree credentials not configured.' });
  }

  const { order_id } = req.query;
  if (!order_id) {
    return res.status(400).json({ error: 'Missing order_id' });
  }

  try {
    const cfRes = await fetch(`${CASHFREE_BASE_URL}/orders/${encodeURIComponent(order_id)}`, {
      method: 'GET',
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey
      }
    });

    const data = await cfRes.json();

    if (!cfRes.ok) {
      return res.status(cfRes.status).json({ error: data.message || 'Failed to fetch order status', details: data });
    }

    // Sync the durable record with Cashfree's authoritative status.
    // "PAID" maps to our "paid"; everything else maps to "failed" once
    // Cashfree reports a terminal non-paid state (EXPIRED, etc). Active/
    // pending states just leave the row as "pending" for now.
    if (data.order_status === 'PAID') {
      await updateOrderStatus(data.order_id, { status: 'paid' });
    } else if (data.order_status === 'EXPIRED' || data.order_status === 'TERMINATED') {
      await updateOrderStatus(data.order_id, { status: 'failed' });
    }

    return res.status(200).json({
      orderId: data.order_id,
      status: data.order_status, // e.g. "PAID", "ACTIVE", "EXPIRED"
      amount: data.order_amount,
      customerEmail: data.customer_details?.customer_email,
      customerName: data.customer_details?.customer_name
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error fetching order: ' + err.message });
  }
}
