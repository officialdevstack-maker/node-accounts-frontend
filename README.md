# Spurs Accounts frontend

React, TypeScript, and Vite application.

## Development

```sh
npm ci
npm run dev
```

The Vite `/api` proxy defaults to `http://localhost:3000`, matching the backend's default `PORT`. Override it with `VITE_API_PROXY` when the API runs elsewhere.

## Vercel

Deploy the frontend on Vercel and replace `<RENDER_SERVICE>` in [`vercel.json`](./vercel.json) with the Render backend hostname. Keep the `/api/(.*)` rewrite before the catch-all SPA fallback. This makes API requests same-origin in the browser so authentication cookies remain first-party. See the [OIDC deployment guide](../sdk/js/oidc.md#13-deploying-on-render--vercel) for issuer and cookie settings.
