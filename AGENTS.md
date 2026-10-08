# AGENTS.md — working notes for this repo

## What this project is
A single static `index.html` — a "launcher" page. It fetches
`https://raw.githubusercontent.com/AniItsukiCoded/backups/main/launcher.html`
**client-side in the browser**, then `document.write`s the result. There is no
backend, no build step, no package manifest, and no server-side code.

Because the real launcher is fetched at runtime by the visitor's browser, the
sandbox only needs to serve the static file: no API, database, worker, or
external service is involved, and **no credentials/secrets are required**.

## Running it (Base44 sandbox)
```
docker compose -f docker-compose.base44.yml up -d
```
- One service, `web`, on `node:22`, serving the repo from a bind mount at
  `http://localhost:3000`. Editing `index.html` reloads the preview without a
  rebuild.

## Non-obvious quirks
- `dev-server.mjs` is **Base44 dev-tooling only**, not part of the shipped app.
  It is a dependency-free Node static server (no `package.json`, nothing to
  install) that injects a live-reload client into HTML and pushes reloads over
  SSE when `.html/.css/.js/.mjs` files change. It exists because this repo has
  no dev server of its own. Do not treat it as application code.
- `BASE44_PREVIEW_MODE` is passed into the service but is intentionally unused:
  the app has no host/origin checks or sandbox-only code paths to gate.
- The launcher's own remote fetch only works if the visitor's browser can reach
  `raw.githubusercontent.com`; the loader falls back to a cached copy in
  `localStorage`, then to an error state with a retry button.

## How to verify
- `curl -sS -o /dev/null -w '%{http_code}' http://localhost:3000/` → `200`.
- The served HTML should contain the injected `__dev_reload` script (proves the
  dev server, not some prebuilt bundle, is serving the live source).
- `docker compose -f docker-compose.base44.yml ps` → `web` reports `healthy`.
