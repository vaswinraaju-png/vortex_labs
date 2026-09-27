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

**Now included:** email notifications via Resend on every verified payment, and order/coupon logging via Supabase.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase SQL editor, run:
   ```sql
   create table orders (
     id uuid primary key default gen_random_uuid(),
     order_id text unique not null,
     payment_id text,
     customer_name text not null,
     customer_email text not null,
     customer_phone text not null,
     product_name text not null default 'Ads Dashboard',
     product_id text not null default 'ads-dashboard',
     amount numeric not null,
     status text not null default 'pending', -- 'pending' | 'paid' | 'failed'
     delivered boolean not null default false,
     created_at timestamptz not null default now()
   );
   create index orders_order_id_idx on orders (order_id);

   create table coupons (
     id uuid primary key default gen_random_uuid(),
     code text unique not null,
     discount_percent numeric not null, -- e.g. 99 for 99% off
     uses_left integer, -- null = unlimited
     expiry timestamptz, -- null = never expires
     created_at timestamptz not null default now()
   );

   -- seed the test coupon
   insert into coupons (code, discount_percent, uses_left, expiry)
   values ('ASHHHHKSJDHCNIS99DISC', 99, null, null);
   ```
3. In Supabase, go to **Project Settings, API** and copy the **Project URL** and **service_role key** (never the anon key).
4. Add both to Vercel as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, then redeploy.

### How order/coupon data flows

- `api/create-order.js` looks up the coupon (if any) in the `coupons` table, checks `expiry` and `uses_left`, applies the discount, then inserts a `pending` row into `orders`.
- `api/verify-payment.js` updates that row to `status: 'paid'` and sets `payment_id` once the signature is verified, and decrements the coupon's `uses_left` if one was used.
- `delivered` stays `false` by default. Mark it `true` yourself in Supabase's table editor once you've sent the buyer their download.
- All Supabase calls are best-effort, if misconfigured or a request fails, the payment flow itself is never blocked.

### Coupons

Coupons now live entirely in the Supabase `coupons` table, not in code. Add new codes by inserting rows:
```sql
insert into coupons (code, discount_percent, uses_left, expiry)
values ('YOURCODE', 20, 50, '2026-12-31');
```

### Required setup: environment variables

In Vercel, go to **Settings, Environment Variables** and add:

| Name | Value |
|---|---|
| `RAZORPAY_KEY_ID` | Your Razorpay Key ID (e.g. `rzp_live_...`) |
| `RAZORPAY_SECRET` | Your Razorpay Key Secret |
| `RESEND_API_KEY` | Your Resend API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |

Redeploy after adding these. Keys are never exposed to the browser, only the two serverless functions in `api/` read them.

### Email notifications (Resend)

On every verified payment, an email is sent to `v.aswinraaju@gmail.com` (set in `api/verify-payment.js`) with the order details. Update the `NOTIFY_EMAIL` constant and the `from` address (must be a domain verified in your Resend account) as needed. If `RESEND_API_KEY` is missing or the send fails, the payment flow is **never blocked**, it just logs a warning and continues.

## Pixel tracking

The ChatGPT Ads Measurement Pixel and Meta Pixel are installed on every page and fire `page_viewed` / `PageView` automatically. These are pure client-side pings, unaffected by the payment backend.

## Deploying

Requires Vercel (or another platform supporting serverless functions) because of the two functions in `api/`. A purely static host will not be able to run the payment flow, though the rest of the site works fine.
