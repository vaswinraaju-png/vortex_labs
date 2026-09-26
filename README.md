# Ads Dashboard, Landing Page

A fully static marketing site for the Ads Dashboard product. No backend, no payment processing, no server-side code of any kind.

## Structure
```
index.html            — landing page (hero, feature sections, pricing)
checkout.html           — static details form (does not submit anywhere)
payment.html              — static placeholder ("checkout not available")
success.html                — static placeholder
contact-us.html                — contact page (business details, static form)
privacy-policy.html              — placeholder legal page
terms-of-service.html              — placeholder legal page
refund-policy.html                   — placeholder legal page
css/style.css                          — site styling
js/checkout.js                           — inert placeholder (form UX only, no backend calls)
assets/                                    — product screenshots used on the landing page
```

## What this is (and isn't)

This is a pure static site: HTML, CSS, and client-side JS only. There is:
- No payment gateway integration (Razorpay, Cashfree, or otherwise)
- No database (no Supabase, no order storage)
- No email sending
- No serverless functions of any kind

The `checkout.html` → `payment.html` → `success.html` flow exists as static pages for the site structure, but does not process anything, the checkout form shows an inline "not available" message on submit rather than calling any backend.

## Pixel tracking

The ChatGPT Ads Measurement Pixel and Meta Pixel are both installed on every page and fire `PageView` / `page_viewed` automatically. These are pure client-side pings, no backend involved, and remain functional even with everything else stripped out.

## Deploying

Fully static, deploy to Vercel, Netlify, GitHub Pages, or any static host. No build step, no environment variables, no serverless function support required.
