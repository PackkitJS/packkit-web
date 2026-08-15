# GitHub "create + push repo" — Cloudflare Pages Functions

These endpoints implement the **create a new GitHub repo and push the scaffold as an
initial commit** feature. The browser generates the project client-side; these Functions
handle the parts a static site can't: the OAuth **code→token exchange** (needs the client
secret) and the authenticated GitHub API calls. The token never reaches the browser — it
lives only in a short-lived, httpOnly cookie.

## Endpoints

| Route | Method | What it does |
| --- | --- | --- |
| `/api/github/start` | GET | Sets a CSRF `state` cookie and redirects to GitHub's authorize page (`scope=repo`). |
| `/api/github/callback` | GET | Verifies `state`, exchanges `code`→token (server-side), stashes it in an httpOnly cookie, redirects to `/?github=connected`. |
| `/api/github/session` | GET | Reports `{connected, login}` (the app labels the button / skips re-auth). |
| `/api/github/create-repo` | POST | Reads the token cookie, creates the repo, and pushes `{name, private, description, files}` as one commit. Single-use: clears the token after. |
| `/api/github/logout` | POST | Forgets the token. |

The push uses the **Git Data API**: create the repo with `auto_init` (a truly empty repo
rejects tree creation), build one tree with every file inline, create a single orphan
commit, then force the default branch onto it — so the result is exactly one clean
`Initial commit from Packkit` with the whole scaffold.

## Security

- Token stored **httpOnly + Secure + SameSite=Lax**, 15-min max-age, single-use.
- OAuth `state` CSRF check; the client secret only ever lives in the Function's env.
- `SameSite=Lax` keeps the `create-repo` POST safe from cross-site CSRF.

## One-time setup (required — the feature is inert without it)

1. **Create a GitHub OAuth App** (Settings → Developer settings → OAuth Apps → New):
   - **Homepage URL:** `https://packkit-web.pages.dev`
   - **Authorization callback URL:** `https://packkit-web.pages.dev/api/github/callback`
   - Copy the **Client ID** and generate a **Client secret**.
2. **Add them as Cloudflare Pages environment variables** (Pages project → Settings →
   Environment variables → Production):
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET` (mark as a secret / encrypted)
3. Redeploy. Until both env vars exist, `/api/github/start` returns `501 not configured`.

## Local development

`npm run dev` (esbuild) serves the static site but **does not run these Functions**. To
exercise the OAuth flow locally, run `npx wrangler pages dev dist` (with the two env vars
set) instead — or just test on the deployed Pages site.
