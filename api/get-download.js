// api/get-download.js
// POST { order_id } -> { url } valid for 10 minutes, only for orders with status = 'paid'

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "products";
const FILE_PATH = "meta-ads-dashboard-main v2.zip"; // must match the exact path in the private bucket
const EXPIRES_IN_SECONDS = 600; // 10 minutes

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { order_id } = req.body || {};
  if (!order_id) {
    return res.status(400).json({ error: "order_id is required" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  try {
    // 1. Confirm this order exists and is actually paid
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?order_id=eq.${encodeURIComponent(order_id)}&select=status`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!orderRes.ok) {
      console.error("Supabase orders lookup failed", await orderRes.text());
      return res.status(502).json({ error: "Could not verify order" });
    }

    const orders = await orderRes.json();
    const order = orders[0];

    if (!order || order.status !== "paid") {
      return res.status(403).json({ error: "Order not verified as paid" });
    }

    // 2. Generate a short-lived signed URL from the PRIVATE bucket
    const signRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${FILE_PATH}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: EXPIRES_IN_SECONDS }),
      }
    );

    if (!signRes.ok) {
      console.error("Supabase signed URL creation failed", await signRes.text());
      return res.status(502).json({ error: "Could not generate download link" });
    }

    const signData = await signRes.json();
    // signData.signedURL is a relative path; prefix with the storage host
    const fullUrl = `${SUPABASE_URL}/storage/v1${signData.signedURL}`;

    return res.status(200).json({ url: fullUrl, expiresIn: EXPIRES_IN_SECONDS });
  } catch (err) {
    console.error("get-download error", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
};
