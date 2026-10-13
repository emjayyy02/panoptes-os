# Panoptes OS

M17.1 operator console: React, Vite, TypeScript, CSS Modules. Uses real n8n HTTP read endpoints; no local backend.

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and set `PANOPTES_DEV_PROXY_TARGET` to the current upstream origin.
3. Run `npm run dev` and open http://127.0.0.1:5173.

Checks: `npm run lint` and `npm run build`.

The **development-only** Vite proxy rewrites `/api/panoptes` to `/webhook/panoptes` and adds the ngrok warning bypass upstream. Browser requests contain no custom headers or credentials. This proxy is disabled for preview and does not ship in the static build. Production routing, CORS, authentication, and stable hosting are M18 work; a production build needs a browser-accessible `VITE_PANOPTES_API_BASE` set at build time.

Recent incidents are sorted by `occurred_at`. Raw statuses and timestamps are preserved. Detail navigation and approval actions are reserved for M17.2.
