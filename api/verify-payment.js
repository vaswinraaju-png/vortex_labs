// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — verifies a Razorpay payment
// signature server-side. Never trust the client-side success
// callback alone; this is the actual proof the payment is real.
//
// Requires: RAZORPAY_SECRET (same as create-order.js)
//           RESEND_API_KEY (for order notification email)
// ─────────────────────────────────────────────────────────────
import crypto from 'crypto';

const NOTIFY_EMAIL = 'v.aswinraaju@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keySecret = process.env.RAZORPAY_SECRET;
  if (!keySecret) {
    return res.status(500).json({ error: 'Razorpay credentials not configured.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone, amount } = req.body || {};

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

  // Send order notification email — best-effort, never blocks the
  // verified response even if Resend is misconfigured or fails.
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${resendKey}`
        },
        body: JSON.stringify({
          from: 'Ads Dashboard <orders@vortexlabs.app>',
          to: [NOTIFY_EMAIL],
          subject: `New order: ${name || 'Unknown'} (₹${amount || '?'})`,
          html: `<p><b>Name:</b> ${name || '—'}</p><p><b>Email:</b> ${email || '—'}</p><p><b>Phone:</b> ${phone || '—'}</p><p><b>Amount:</b> ₹${amount || '—'}</p><p><b>Payment ID:</b> ${razorpay_payment_id}</p><p><b>Order ID:</b> ${razorpay_order_id}</p>`
        })
      });
    } catch (err) {
      console.error('Resend notification failed:', err.message);
    }
  } else {
    console.warn('RESEND_API_KEY not configured — skipping order notification email.');
  }

  return res.status(200).json({ verified: true });
}
