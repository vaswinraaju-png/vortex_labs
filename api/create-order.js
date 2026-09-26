// Creates a Razorpay order server-side via direct REST call (no SDK
// dependency, so no npm install is needed at build time). Uses
// RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET from Vercel env vars.
const COUPONS = { 'ASHHHHKSJDHCNIS99DISC': 0.99 }; // test coupon: 99% off
const BASE_PRICE = 499;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, coupon } = req.body || {};
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let amount = BASE_PRICE;
  if (coupon && COUPONS[coupon]) {
    amount = Math.max(1, Math.round(BASE_PRICE * (1 - COUPONS[coupon])));
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  try {
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: 'INR',
        notes: { product: 'Ads Dashboard', name, email, phone, coupon: coupon || '' }
      })
    });
    const order = await rzpRes.json();
    if (!rzpRes.ok) {
      return res.status(rzpRes.status).json({ error: 'Failed to create order: ' + (order.error?.description || 'unknown error') });
    }
    return res.status(200).json({ orderId: order.id, amount, keyId });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
}
