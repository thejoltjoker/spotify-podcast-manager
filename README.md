# Spotify Podcast Manager

Browse, filter, and remove podcast episodes saved in your Spotify library.

A local React SPA that uses the Spotify Web API with Authorization Code + PKCE (no backend, no client secret).

## Features

- Log in with Spotify (PKCE)
- Load all saved podcast episodes from your library
- Sort, filter, search, and paginate in a table
- Remove selected episodes from your library
- Mark as played & remove (clears resume position, then removes)

## Setup

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Under **Redirect URIs**, add exactly:

   ```
   http://127.0.0.1:5173/callback
   ```

   Do not use `http://localhost` — Spotify rejects it for local development.
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

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start Vite dev server    |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview production build |
| `npm run lint`  | Run oxlint               |

## Scopes

Only the scopes needed for library episodes and resume position:

- `user-library-read`
- `user-library-modify`
- `user-read-playback-position`

## Stack

React 19 · TypeScript · Vite · Chakra UI v3 · TanStack Table · Spotify Web API (PKCE)

## Attribution

Content provided by Spotify. This app does not cache Spotify content beyond immediate use and does not use the API to train models.
