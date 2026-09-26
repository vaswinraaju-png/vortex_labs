// Creates a Razorpay order server-side. Uses RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
// from Vercel env vars. Auto-capture is Razorpay's default behavior.
import Razorpay from 'razorpay';

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

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });

  try {
    const order = await instance.orders.create({
      amount: amount * 100, // paise
      currency: 'INR',
      notes: { product: 'Ads Dashboard', name, email, phone, coupon: coupon || '' }
    });
    return res.status(200).json({ orderId: order.id, amount, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
}
