# Ads Dashboard, Landing Page & Checkout

Marketing landing page and a 3-step checkout flow (details, payment, download) for the Ads Dashboard product, with a live **Razorpay** payment integration.

## Structure
```
index.html          — landing page (hero, feature sections, pricing)
checkout.html         — Step 1: collects buyer name/email/phone/coupon
payment.html            — Step 2: real Razorpay hosted checkout
success.html              — Step 3: server-verifies payment, shows download link
contact-us.html              — Contact page (business details, contact form)
privacy-policy.html            — placeholder legal page
terms-of-service.html            — placeholder legal page
refund-policy.html                 — placeholder legal page
css/style.css                        — marketing-oriented styling
js/checkout.js                         — flow logic, pixel tracking, order state (sessionStorage)
api/create-order.js                      — Vercel serverless function: creates a Razorpay order (with coupon support)
api/order-status.js                        — Vercel serverless function: verifies payment signature, logs to Supabase, emails you
assets/                                      — product screenshots used on the landing page
```

## Payment integration (Razorpay, Production)

The flow:

1. `checkout.html` collects buyer details + optional coupon code, stores them in `sessionStorage`.
2. `payment.html` calls `/api/create-order` (a Vercel serverless function), which creates the order server-side using your Razorpay credentials, applies any valid coupon, and returns an order ID + amount + key ID.
3. Razorpay's Checkout.js opens their hosted payment modal using that order ID.
4. On completion, Razorpay's `handler` callback fires client-side with `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
5. Those are sent to `/api/order-status`, which **verifies the signature server-side** (HMAC SHA256 using your Secret Key), so a client-side response is never trusted alone.
6. On verified success: the order is logged to Supabase, an email notification is sent to you via Resend, and the browser redirects to `success.html`, which shows the download link.

### Required setup: environment variables

In your Vercel project, go to **Settings, Environment Variables** and add:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | Your Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Your Razorpay Key Secret |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key (never the anon key) |
| `RESEND_API_KEY` | Your Resend API key |

**Redeploy after adding these** so Vercel picks them up. Keys are never exposed to the browser; only the two serverless functions in `api/` read them.

### Coupons

Coupon codes are defined in `api/create-order.js`:
```js
const COUPONS = { 'ASHHHHKSJDHCNIS99DISC': 0.99 }; // 99% off, for testing
```
Add more codes as `{ 'CODE': discountFraction }`. The discount is applied server-side, never trust a client-supplied amount.

### Currency

Orders are created in **INR** at ₹499 base price (before any coupon).

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase SQL editor, run:
   ```sql
   create table orders (
     id uuid primary key default gen_random_uuid(),
     razorpay_order_id text unique not null,
     razorpay_payment_id text,
     name text not null,
     email text not null,
     phone text not null,
     product text not null default 'Ads Dashboard',
     amount numeric not null,
     status text not null default 'pending', -- 'pending' | 'paid' | 'failed'
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   create index orders_razorpay_order_id_idx on orders (razorpay_order_id);
   ```
3. In Supabase, go to **Project Settings, API** and copy the **Project URL** and **service_role key**.
4. Add both to Vercel as described above, then redeploy.

Every verified payment inserts a row with `status: 'paid'`. If Supabase env vars are missing or a write fails, the payment flow is **never blocked**, it just fails silently in the background. Order tracking is additive, not a dependency of checkout working.

## Email notifications (Resend)

1. Sign up at [resend.com](https://resend.com), verify a sending domain (or use their test domain while developing).
2. Get your API key from the Resend dashboard, add it as `RESEND_API_KEY` in Vercel.
3. Update the `from` and `to` addresses in `api/order-status.js` to match your verified sending domain and where you want notifications delivered.

## Delivery (download link)

`success.html` auto-triggers a download and shows a clickable button, both pointing at a single URL defined in `js/checkout.js` (`initSuccessPage`):

```js
const DOWNLOAD_URL = 'REPLACE_WITH_YOUR_STORAGE_ZIP_URL';
```

**This must be updated before going live.** Upload the actual Ads Dashboard `.zip` file to Supabase Storage, S3, or any other host that gives you a direct download URL, then paste that URL in place of the placeholder. Until this is set, the download link won't fire (the auto-download is skipped and the button does nothing).

## Order data

Buyer info is held in `sessionStorage` (key `ads_dashboard_order`) purely for display across the flow, cleared when the tab closes. The actual source of truth for whether an order is paid is the server-side signature verification in `api/order-status.js`, plus the corresponding Supabase row.

## Pixel tracking

Both the ChatGPT Ads Measurement Pixel and Meta Pixel are installed on every page and fire the full funnel: `page_viewed`, `checkout_started` / `InitiateCheckout`, and `order_created` / `Purchase` (fired only after Razorpay's signature is verified server-side).

## Deploying

Requires Vercel (or another platform supporting serverless functions) because of the two functions in `api/`. A purely static host (GitHub Pages, Netlify without functions) will not be able to run the payment flow, though the rest of the site works fine.
