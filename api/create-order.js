// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — creates a Razorpay order.
//
// Requires these environment variables set in Vercel:
//   RAZORPAY_KEY_ID
//   RAZORPAY_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (for coupons + order logging)
//
// No Razorpay SDK/npm package used — plain fetch against their
// REST API, so this needs no build step or dependencies.
// ─────────────────────────────────────────────────────────────
import { getCoupon, insertOrder } from './_supabase.js';

const BASE_PRICE = 499; // INR

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({
      error: 'Razorpay credentials not configured. Set RAZORPAY_KEY_ID and RAZORPAY_SECRET in Vercel environment variables.'
    });
  }

  const { name, email, phone, coupon } = req.body || {};

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: name, email, phone' });
  }

  let amount = BASE_PRICE;
  let appliedCoupon = null;

  if (coupon) {
    const row = await getCoupon(coupon);
    if (row) {
      const notExpired = !row.expiry || new Date(row.expiry) > new Date();
      const hasUses = row.uses_left == null || row.uses_left > 0;
      if (notExpired && hasUses) {
        amount = Math.max(1, Math.round(BASE_PRICE * (1 - row.discount_percent / 100)));
        appliedCoupon = row;
      }
    }
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: 'INR',
        payment_capture: 1, // auto-capture
        notes: { product: 'Ads Dashboard', name, email, phone, coupon: coupon || '' }
      })
    });

    const data = await rzpRes.json();

    if (!rzpRes.ok) {
      return res.status(rzpRes.status).json({
        error: data.error?.description || 'Failed to create Razorpay order',
        details: data
      });
    }

    // Log the order as pending — never blocks the payment flow if this fails.
    await insertOrder({ orderId: data.id, name, email, phone, amount, status: 'pending' });

    return res.status(200).json({
      orderId: data.id,
      amount,
      keyId,
      couponApplied: !!appliedCoupon
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error creating order: ' + err.message });
  }
}
