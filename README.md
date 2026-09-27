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

**Now included:** email notifications via Resend on every verified payment. Order logging (Supabase) is still not included.

### Coupons

Coupon codes are defined in `api/create-order.js`:
```js
const COUPONS = { 'ASHHHHKSJDHCNIS99DISC': 0.99 }; // 99% off, for testing
```
Add more as `{ 'CODE': discountFraction }`. Applied server-side, never trust a client-supplied amount.

### Required setup: environment variables

In Vercel, go to **Settings, Environment Variables** and add:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | Your Razorpay Key ID (e.g. `rzp_live_...`) |
| `RAZORPAY_SECRET` | Your Razorpay Key Secret |
| `RESEND_API_KEY` | Your Resend API key |

Redeploy after adding these. Keys are never exposed to the browser, only the two serverless functions in `api/` read them.

### Email notifications (Resend)

On every verified payment, an email is sent to `v.aswinraaju@gmail.com` (set in `api/verify-payment.js`) with the order details. Update the `NOTIFY_EMAIL` constant and the `from` address (must be a domain verified in your Resend account) as needed. If `RESEND_API_KEY` is missing or the send fails, the payment flow is **never blocked**, it just logs a warning and continues.

## Pixel tracking

The ChatGPT Ads Measurement Pixel and Meta Pixel are installed on every page and fire `page_viewed` / `PageView` automatically. These are pure client-side pings, unaffected by the payment backend.

## Deploying

Requires Vercel (or another platform supporting serverless functions) because of the two functions in `api/`. A purely static host will not be able to run the payment flow, though the rest of the site works fine.
