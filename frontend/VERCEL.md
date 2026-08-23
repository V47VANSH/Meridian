# Vercel deployment notes

`vercel.json` lives here, not at the repository root, because the Vercel project
is imported with **Root Directory = `frontend`**. Vercel reads `vercel.json`
from the root directory it was given, so a copy at the repository root would be
silently ignored — and the API rewrite with it, leaving every `/api` call to 404
against the static site.

## The API rewrite

```json
{ "source": "/api/:path*", "destination": "https://<render-api>/api/:path*" }
```

The browser calls `/api` on the Vercel origin and Vercel forwards it to Render.
That is deliberate, and it buys three things:

- **No CORS.** The browser only ever sees one origin, in production exactly as
  behind the Vite dev proxy locally. Neither environment exercises CORS at all.
- **No API URL in the bundle.** `VITE_API_BASE_URL` stays at its default of
  `/api`, so the same build artifact works against any backend.
- **One place to repoint.** Moving the API means editing this file, not
  rebuilding the frontend.

Both rewrite rules currently point at <https://may2026-team-098.onrender.com>.
**If the API moves, change it in both** — the site will otherwise load fine and
then fail to sign in, showing a 404 on `/api/v1/auth/login` in the browser's
network tab. That is the symptom to look for.

## The SPA fallback

```json
{ "source": "/((?!api/|health|assets/).*)", "destination": "/index.html" }
```

React Router owns the URL, so a hard refresh on `/resident/dashboard` — or
someone opening a shared link — must still be served `index.html`. The negative
lookahead keeps API calls, the health probe and hashed build assets out of that
fallback, so a genuinely missing asset 404s instead of quietly returning HTML.

## Project settings

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite (auto-detected) |
| Build Command | default (`npm run build`) |
| Output Directory | default (`dist`) |
| Environment variables | none required |

`npm run build` runs `tsc && vite build`, so a type error fails the deploy rather
than shipping.

Full walkthrough, including Render and Supabase: [`../DEPLOYMENT.md`](../DEPLOYMENT.md).
