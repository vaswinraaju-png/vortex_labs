# Ads Dashboard, Landing Page & Checkout

Marketing landing page with a Razorpay payment integration for the Ads Dashboard product.

## Structure
```
index.html          — landing page
checkout.html         — Step 1: collects buyer name/email/phone
payment.html            — Step 2: real Razorpay hosted checkout
success.html              — Step 3: shows payment confirmation
contact-us.html              — Contact page
privacy-policy.html            — placeholder legal page
terms-of-service.html            — placeholder legal page
refund-policy.html                 — placeholder legal page
css/style.css                        — site styling
js/checkout.js                         — flow logic (order state, Razorpay integration)
api/create-order.js                      — Vercel serverless function: creates a Razorpay order
api/verify-payment.js                      — Vercel serverless function: verifies payment signature
assets/                                      — product screenshots
```

## Payment integration (Razorpay)

The flow:

1. `checkout.html` collects buyer details, stores them in `sessionStorage`.
2. `payment.html` calls `/api/create-order`, which creates the order server-side (auto-capture enabled) and returns an order ID.
3. Razorpay's Checkout.js SDK (loaded dynamically) opens their hosted payment popup, prefilled with the buyer's details.
4. On completion, Razorpay's `handler` callback fires client-side with `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
5. Those are sent to `/api/verify-payment`, which **verifies the signature server-side** (HMAC SHA256), so a client-side response is never trusted alone.
6. On verified success, the browser redirects to `success.html` showing confirmation.

**Not yet included:** order logging (Supabase) and email notifications (Resend) were intentionally left out of this pass, to be added back later.

### Required setup: environment variables

In Vercel, go to **Settings, Environment Variables** and add:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | Your Razorpay Key ID (e.g. `rzp_live_...`) |
| `RAZORPAY_SECRET` | Your Razorpay Key Secret |

Redeploy after adding these. The secret is never exposed to the browser, only the two serverless functions in `api/` read it.

### Currency

₹499, INR, no coupon logic in this pass.

## Pixel tracking

The ChatGPT Ads Measurement Pixel and Meta Pixel are installed on every page and fire `page_viewed` / `PageView` automatically. These are pure client-side pings, unaffected by the payment backend.

## Deploying

Requires Vercel (or another platform supporting serverless functions) because of the two functions in `api/`. A purely static host will not be able to run the payment flow, though the rest of the site works fine.
