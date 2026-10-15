# 02: Security headers and client IP at the proxy

**What to build:** the part of `docs/prd.md` §8.6 that lives in Coolify's proxy (Traefik), not in the API: headers for the static frontend, and a client IP the API's rate limiter can trust. Part of M4; done alongside `.scratch/mvp/issues/15-coolify-deployment.md`.

**Blocked by:** 01, mvp 15

**Status:** ready-for-human

- [ ] The static frontend is served with a `Content-Security-Policy` that fits the Vite build (scripts and styles from `'self'`, Inter's font origin if it is loaded remotely, `frame-ancestors 'none'`), plus `X-Content-Type-Options: nosniff` and `Referrer-Policy`. Check in the browser console that nothing is blocked.
- [ ] HSTS is sent over HTTPS (Helmet already sets it on `/api` responses; the proxy may set it for the whole host).
- [ ] The proxy overwrites any client-sent `X-Forwarded-For` with the real peer address (Traefik's default when the client is not a trusted IP). Verify: a request sending a forged `X-Forwarded-For` still hits the sign-in limit (`429` after 5 per minute).
- [ ] Verify the API receives a single-value `X-Forwarded-For` (just the client address, no proxy chain). Better-Auth, configured without `trustedProxies`, ignores a chain, and a chain or a missing header puts every client in one shared rate-limit bucket.
- [ ] The API container's port 3000 is not published on the VPS; only the proxy reaches it.
- [ ] If Cloudflare (or another CDN) is ever put in front of Traefik, switch the API's `ipAddressHeaders` to `cf-connecting-ip`; otherwise every visitor shares Cloudflare's IPs and the rate limits.

## Comments

- Split from 01 in the grilling session (2026-10-14): the API returns only JSON, so it cannot set the CSP of the HTML page the proxy serves.
