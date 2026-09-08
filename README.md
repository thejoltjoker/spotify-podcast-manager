# Spotify Podcast Manager

Browse, filter, and remove podcast episodes saved in your Spotify library.

A React SPA that uses the Spotify Web API with Authorization Code + PKCE (no backend, no client secret). Can run locally or deploy to Cloudflare Workers as static assets.

## Features

- Log in with Spotify (PKCE)
- Load all saved podcast episodes from your library
- Browse followed shows and open a show’s episode list
- Highlight episodes not yet saved in your library (“new”) and save them in one click
- Sort, filter, search, and paginate in a table
- Distinguish unplayed, in-progress, and finished episodes (from Spotify resume point)
- Filter by podcast and play status
- Play now / add to queue on your active Spotify device (Premium; Play falls back to opening the Spotify app if needed)
- Remove selected episodes from your library
- Mark as played & remove (clears resume position, then removes)

## Setup

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Under **Redirect URIs**, add:

   ```
   http://127.0.0.1:5173/callback
   ```

   Do not use `http://localhost` — Spotify rejects it for local development. After you deploy, also add `https://<your-worker-host>/callback`.
3. Copy the Client ID and create your env file:

   ```bash
   cp .env.example .env
   ```

4. Set `VITE_SPOTIFY_CLIENT_ID` in `.env` to your Client ID.

## Run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173) (same host as the redirect URI).

## Deploy (Cloudflare Workers)

The app ships as static assets via [`wrangler.jsonc`](wrangler.jsonc) (`dist/` + SPA fallback for `/callback`).

1. In the Worker → **Settings** → **Build**, set:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy` (default)
   - **Build variable:** `VITE_SPOTIFY_CLIENT_ID` = your Spotify Client ID
2. Push to the connected GitHub branch (or run `npm run deploy` locally).
3. In the Spotify Dashboard, add redirect URI `https://<your-worker-host>/callback`.

## Scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start Vite dev server              |
| `npm run build`   | Typecheck and production build     |
| `npm run preview` | Preview production build           |
| `npm run deploy`  | Build and deploy with Wrangler     |
| `npm run lint`    | Run oxlint                         |

## Scopes

Only the scopes needed for library episodes, resume position, and playback control:

- `user-library-read`
- `user-library-modify`
- `user-read-playback-position`
- `user-read-playback-state`
- `user-modify-playback-state`

## Stack

React 19 · TypeScript · Vite · Chakra UI v3 · TanStack Table · React Router · Spotify Web API (PKCE)

## Attribution

Content provided by Spotify. This app does not cache Spotify content beyond immediate use and does not use the API to train models.
