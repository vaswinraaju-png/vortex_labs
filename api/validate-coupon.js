// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — validates a coupon code and
// returns the discounted price. This is a preview only: it does
// NOT create an order or decrement uses_left. That only happens
// for real in create-order.js / verify-payment.js at checkout.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────
import { getCoupon } from './_supabase.js';

const BASE_PRICE = 499; // INR

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { coupon } = req.body || {};
  if (!coupon) {
    return res.status(400).json({ valid: false, error: 'No coupon code provided' });
  }

  const row = await getCoupon(coupon);
  if (!row) {
    return res.status(200).json({ valid: false, error: 'Invalid coupon code' });
  }

  const notExpired = !row.expiry || new Date(row.expiry) > new Date();
  if (!notExpired) {
    return res.status(200).json({ valid: false, error: 'This coupon has expired' });
  }

  const hasUses = row.uses_left == null || row.uses_left > 0;
  if (!hasUses) {
    return res.status(200).json({ valid: false, error: 'This coupon has been fully redeemed' });
  }

  const discountedAmount = Math.max(1, Math.round(BASE_PRICE * (1 - row.discount_percent / 100)));

  return res.status(200).json({
    valid: true,
    discountPercent: row.discount_percent,
    baseAmount: BASE_PRICE,
    discountedAmount
  });
}
