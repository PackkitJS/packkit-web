# packkit-web

The **Packkit** web configurator — pick a language, configure your stack, preview
the file tree, and download a ready-to-ship project as a zip. Runs entirely in the
browser; the same generators that power the CLIs and the MCP server run client-side.

- **JavaScript / TypeScript** → [`create-packkit`](https://github.com/PackkitLabs/create-packkit-js)
- **Python** → [`create-packkit-py`](https://github.com/PackkitLabs/create-packkit-py)

Adding a language is one browser-safe generator package + one adapter in
`src/adapters/` — the UI renders any generator's schema uniformly (via the
`@packkit/core` protocol), so nothing else changes.

## How it works

- `src/adapters/*` — one adapter per generator, normalizing its options/presets to
  a common shape and exposing `generate` / `command`.
- `src/app.js` — the generic UI (language picker → presets → schema-driven form →
  live file tree + ZIP + shareable link). No language-specific logic.
- `scripts/build.mjs` — esbuild bundles it (cores + JSZip) into `dist/`.

## Develop

```sh
npm install
npm run dev     # esbuild dev server on http://localhost:8788
npm run check   # build + an adapter smoke that generates for every generator (CI)
```

## Deploy — Cloudflare Pages

Connect this repo as a Cloudflare Pages project:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions directory | `functions` (default) |

The site is static today. `functions/` is reserved for a future **"create + push to
a new GitHub repo"** feature — that needs a serverless backend (OAuth token
exchange), which Cloudflare Pages Functions provides without re-platforming. See
[`functions/README.md`](functions/README.md).

## License

MIT © DanMat
