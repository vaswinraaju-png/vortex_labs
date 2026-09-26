// Verifies Razorpay payment signature server-side, logs the order to
// Supabase, and sends an email notification via Resend. This is the
// single source of truth for "did this order actually get paid".
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, name, email, phone, amount } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields' });
  }

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  if (expected !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  // Log to Supabase (best-effort, never blocks the success response)
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify([{
        razorpay_order_id, razorpay_payment_id,
        name, email, phone, product: 'Ads Dashboard', amount, status: 'paid'
      }])
    });
  } catch (e) { /* non-blocking */ }

  // Email notification via Resend (best-effort)
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'orders@vortexlabs.app',
        to: 'v.aswinraaju@gmail.com',
        subject: `New order: Ads Dashboard - ₹${amount}`,
        html: `<p><b>Name:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone}</p><p><b>Amount:</b> ₹${amount}</p><p><b>Payment ID:</b> ${razorpay_payment_id}</p>`
      })
    });
  } catch (e) { /* non-blocking */ }

  return res.status(200).json({ verified: true });
}
