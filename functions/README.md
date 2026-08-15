# Cloudflare Pages Functions

Server-side endpoints. Static assets are served from `dist/`; any `.js`/`.ts` file here
becomes a route under `/` (files prefixed with `_` are private modules, not routes).

- **`api/github/*`** — the **"create + push to a new GitHub repo"** feature: OAuth
  code→token exchange (the client secret can't live in browser code) plus the
  authenticated GitHub API calls that create the repo and push the generated scaffold as
  an initial commit. See [`api/github/README.md`](api/github/README.md) for the endpoints,
  the security model, and the **one-time OAuth-App + env-var setup** it needs.

This was the reason packkit-web went on Cloudflare Pages rather than a purely static host —
the `functions/` seam meant adding it was a drop-in, no re-platforming.
