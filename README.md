# Ads Dashboard — Landing Page & Checkout

Marketing landing page and a 3-step checkout flow (details → payment → download) for the Ads Dashboard product.

## Structure
```
index.html       — landing page (hero, feature sections, pricing)
checkout.html     — Step 1: collects buyer name/email/phone
payment.html      — Step 2: payment placeholder (see below)
success.html      — Step 3: confirms payment, shows download link
css/style.css      — marketing-oriented styling
js/checkout.js      — flow logic, order state (sessionStorage)
assets/             — product screenshots used on the landing page
```

## Payment integration
`payment.html` currently uses a **stub**: clicking "Pay" simulates success after ~1s and moves to `success.html`. This is intentional so the flow is testable end-to-end before a real gateway is wired in.

To connect a real payment gateway, edit `js/checkout.js` — the `submitPaymentStub` function has a comment block with integration examples for Razorpay and Stripe. Replace that function's contents with your gateway's checkout call, and call `saveOrder({ paid: true, paymentId: ... })` followed by a redirect to `success.html` once payment is confirmed.

**Important:** verify payment success server-side before granting the download in a production setup — this stub is client-side only and not secure against tampering. Add a backend endpoint that confirms payment with your gateway (webhook or session lookup) before serving the real download link.

## Delivery
`success.html` shows a "Download" button pointing to a placeholder (`#`). Update `download-link`'s `href` in `js/checkout.js` (`initSuccessPage`) to point at wherever the paid dashboard package is actually hosted (signed URL, private repo invite, etc.).

## Order data
Buyer info collected in checkout flows through `sessionStorage` (key `ads_dashboard_order`) between pages — cleared when the browser tab closes. No data is sent anywhere yet; wire this up to your backend/CRM/email tool once ready.

## Deploying
Fully static — deploy to Vercel, Netlify, or any static host. No build step.
