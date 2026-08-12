# Cloudflare Pages Functions

Reserved for server-side endpoints. Static assets are served from `dist/`; any
`.js`/`.ts` file here becomes a route under `/`.

This directory exists so the **future "create + push to a new GitHub repo"** feature
has a home. That feature needs a backend the static configurator can't provide: a
GitHub OAuth **code→token exchange** requires a client secret, which can't live in
browser code. The plan:

- `functions/api/github/callback.js` — exchange the OAuth `code` for a token
  (client secret from a Pages environment variable), then create the repo and push
  the generated files via the GitHub REST API.
- The browser app kicks off the OAuth flow and, on return, calls the function.

Nothing here yet — the configurator is fully client-side today. Because the repo is
already on Cloudflare Pages, adding this is a drop-in (no re-platforming).
