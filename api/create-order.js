// ─────────────────────────────────────────────────────────────
// Vercel Serverless Function — creates a Cashfree order.
//
// Requires these environment variables set in Vercel:
//   CASHFREE_APP_ID
//   CASHFREE_SECRET_KEY
//
// Production API base — change to https://sandbox.cashfree.com/pg
// if you ever need to test against Cashfree's sandbox instead.
// ─────────────────────────────────────────────────────────────
const CASHFREE_BASE_URL = 'https://api.cashfree.com/pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    return res.status(500).json({
      error: 'Cashfree credentials not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Vercel environment variables.'
    });
  }

  const { name, email, phone, amount } = req.body || {};

  if (!name || !email || !phone || !amount) {
    return res.status(400).json({ error: 'Missing required fields: name, email, phone, amount' });
  }

  // Basic phone sanitization — Cashfree expects digits only, 10+ length
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return res.status(400).json({ error: 'Phone number must contain at least 10 digits' });
  }

  const orderId = 'order_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  // Where Cashfree sends the customer back after payment.
  // Adjust the origin if this is deployed under a different domain.
  const origin = req.headers.origin || `https://${req.headers.host}`;
  const returnUrl = `${origin}/success.html?order_id={order_id}`;

  try {
    const cfRes = await fetch(`${CASHFREE_BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': appId,
        'x-client-secret': secretKey
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: Number(amount),
        order_currency: 'INR',
        customer_details: {
          customer_id: 'cust_' + Date.now(),
          customer_name: name,
          customer_email: email,
          customer_phone: cleanPhone
        },
        order_meta: {
          return_url: returnUrl
        }
      })
    });

    const data = await cfRes.json();

    if (!cfRes.ok) {
      return res.status(cfRes.status).json({
        error: data.message || 'Failed to create Cashfree order',
        details: data
      });
    }

    return res.status(200).json({
      orderId: data.order_id,
      paymentSessionId: data.payment_session_id
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error creating order: ' + err.message });
  }
}
