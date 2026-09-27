// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — creates a Razorpay order.
//
// Requires these environment variables set in Vercel:
//   RAZORPAY_KEY_ID
//   RAZORPAY_SECRET
//
// No Razorpay SDK/npm package used — plain fetch against their
// REST API, so this needs no build step or dependencies.
// ─────────────────────────────────────────────────────────────
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

  const { name, email, phone } = req.body || {};

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: name, email, phone' });
  }

  const amount = BASE_PRICE; // no coupon logic for now

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
        notes: { product: 'Ads Dashboard', name, email, phone }
      })
    });

    const data = await rzpRes.json();

    if (!rzpRes.ok) {
      return res.status(rzpRes.status).json({
        error: data.error?.description || 'Failed to create Razorpay order',
        details: data
      });
    }

    return res.status(200).json({
      orderId: data.id,
      amount,
      keyId
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error creating order: ' + err.message });
  }
}
