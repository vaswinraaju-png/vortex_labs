# Ads Dashboard — Landing Page & Checkout

Marketing landing page and a 3-step checkout flow (details, payment, download) for the Ads Dashboard product, with a **live Cashfree payment integration**.

## Structure
```
index.html          — landing page (hero, feature sections, pricing)
checkout.html        — Step 1: collects buyer name/email/phone
payment.html          — Step 2: real Cashfree hosted checkout
success.html           — Step 3: server-verifies payment, shows download link
contact-us.html          — Contact page (business details, contact form)
privacy-policy.html       — placeholder legal page
terms-of-service.html      — placeholder legal page
refund-policy.html          — placeholder legal page
css/style.css                — marketing-oriented styling
js/checkout.js                 — flow logic, order state (sessionStorage)
api/create-order.js              — Vercel serverless function: creates a Cashfree order
api/order-status.js                — Vercel serverless function: checks payment status
assets/                              — product screenshots used on the landing page
```

## Payment integration (Cashfree, Production)

This site uses **Cashfree's hosted checkout**. The flow:

1. `checkout.html` collects buyer details, stores them in `sessionStorage`.
2. `payment.html` calls `/api/create-order` (a Vercel serverless function), which creates the order server-side using your Cashfree credentials and returns a `payment_session_id`.
3. Cashfree's JS SDK opens their hosted checkout using that session ID.
4. On completion, Cashfree redirects the browser to `success.html?order_id=...`.
5. `success.html` calls `/api/order-status` to **re-verify the payment server-side** before showing the download, i.e. it never trusts the redirect alone.

### Required setup: environment variables

In your Vercel project, go to **Settings, Environment Variables** and add:

| Name | Value |
|---|---|
| `CASHFREE_APP_ID` | Your Cashfree App ID |
| `CASHFREE_SECRET_KEY` | Your Cashfree Secret Key |

**Redeploy after adding these** so Vercel picks them up. Your keys are never exposed to the browser; only the two serverless functions in `api/` read them.

This is wired to Cashfree's **Production** API (`https://api.cashfree.com/pg`) by default.

### Testing in Sandbox mode

Your production Cashfree account is likely still pending KYC/VCIP approval, in which case live transactions will fail with an error like "transactions are not enabled for your payment gateway account". You can still test the full checkout flow end-to-end using Cashfree's **Sandbox** environment while waiting for approval:

1. In the Cashfree dashboard, click **"Switch to Test"** (top left) to get your separate **Sandbox App ID and Secret Key** — these are different from your production keys.
2. In Vercel, add or update these environment variables:
   - `CASHFREE_APP_ID` and `CASHFREE_SECRET_KEY` — your **sandbox** keys (temporarily, while testing)
   - `CASHFREE_MODE` = `sandbox`
3. Redeploy.
4. On the hosted checkout page, use one of Cashfree's [test card/UPI details](https://www.cashfree.com/docs/payments/online/resources/sandbox-environment) to simulate a payment (no real money moves).

**To switch back to production** once VCIP clears: set `CASHFREE_APP_ID`/`CASHFREE_SECRET_KEY` back to your production keys, and either remove `CASHFREE_MODE` or set it to `production`. Redeploy.

Sandbox and production orders are completely separate. An order created in one mode cannot be looked up in the other.

### Currency

Orders are created in **INR** (₹499, compare-at ₹2,999).

## Delivery
`success.html` shows a "Download" button pointing to a placeholder (`#`). Update the `download-link` href in `initSuccessPage()` (`js/checkout.js`) to point at wherever the paid dashboard package is actually hosted (signed URL, private repo invite, etc.).

## Order data

Buyer info is held in `sessionStorage` (key `ads_dashboard_order`) purely for display across the flow, cleared when the tab closes.

**Every order is also saved durably to Supabase** — this is the actual record of who bought what and whether they paid.

### Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In the Supabase SQL editor, run:
   ```sql
   create table orders (
     id uuid primary key default gen_random_uuid(),
     cf_order_id text unique not null,
     name text not null,
     email text not null,
     phone text not null,
     amount numeric not null,
     status text not null default 'pending', -- 'pending' | 'paid' | 'failed'
     created_at timestamptz not null default now(),
     updated_at timestamptz not null default now()
   );
   create index orders_cf_order_id_idx on orders (cf_order_id);
   ```
3. In Supabase, go to **Project Settings, API** and copy:
   - **Project URL**
   - **service_role key** (NOT the `anon`/public key — the service_role key bypasses row-level security and must only ever be used server-side)
4. In Vercel, add environment variables:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service_role key
5. Redeploy.

### How it's used

- `api/create-order.js` inserts a row with `status: 'pending'` right after the Cashfree order is created.
- `api/order-status.js` updates that row to `status: 'paid'` once Cashfree confirms payment (or `'failed'` if the order expires/terminates without payment).
- If Supabase env vars are missing or a write fails, the payment flow is **never blocked** — it just logs a warning and continues. Order tracking is additive, not a dependency of checkout working.
- View/query your orders any time in the Supabase table editor, or via its REST/SQL interface.

## Deploying
Requires Vercel (or another platform supporting serverless functions) because of the functions in `api/`. A purely static host (GitHub Pages, Netlify without functions) will not be able to run the payment flow or order tracking, though the rest of the site works fine.
