// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — verifies a Razorpay payment
// signature server-side. Never trust the client-side success
// callback alone; this is the actual proof the payment is real.
//
// Requires: RAZORPAY_SECRET (same as create-order.js)
// ─────────────────────────────────────────────────────────────
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keySecret = process.env.RAZORPAY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ error: 'Razorpay credentials not configured.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ verified: false, error: 'Invalid payment signature' });
  }

  // TODO: this is where order logging (Supabase) and email
  // notification (Resend) will be added back in later.

  return res.status(200).json({ verified: true });
}
