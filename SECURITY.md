# Security

Hardening and security practices for CORTEX (SAIL-IDP).

## Server hardening (implemented)

- **Security headers** (Helmet): `X-Content-Type-Options: nosniff`, `X-Frame-Options: sameorigin`, `Referrer-Policy: strict-origin-when-cross-origin`. CSP is disabled so the SPA and embedded content (e.g. Mermaid) work; tighten in production if needed.
- **CORS**: Set `CORS_ORIGIN` in production to your frontend origin(s). Default `*` is allowed but the server logs a warning in production.
- **Rate limiting**:
  - General `/api/*`: 120 req/min (production), 300/min (development).
  - Proxy and debug (`/api/documents/`, `/api/schemas/`, `/api/jobs`, `/api/debug/`): 60 req/min (production), 120/min (development).
- **Debug routes** (`/api/debug/status`, `/api/debug/errors`): **Disabled in production** (404). They expose DB stats, usage, env, and error logs.
- **Secrets**: API key is sent in `Api-Key` header from client to proxy; proxy forwards it to Retab. **Request/response bodies and headers are not logged** (only method, path, status, duration).

## API key handling

- **Client**: Retab API key is stored in the browser (`localStorage.retab_api_key`). This is a tradeoff for a local-first app; the key never leaves the user’s machine except to your proxy and then to Retab.
- **Proxy**: The server does not store the API key. It forwards the `Api-Key` header from each request to Retab and does not log it.
- **Production**: Prefer serving the app and API from the same origin and, if you add server-side API key injection, avoid sending the key in the client bundle.

## Database

- **SQLite**: File at `DB_PATH/sail-idp.db` (default `./data`). All queries use parameterized statements (no raw string interpolation).
- Restrict filesystem access to the process so only the app can read/write `DB_PATH`.

## Production checklist

1. Set `NODE_ENV=production`.
2. Set `CORS_ORIGIN` to your frontend origin (e.g. `https://cortex.example.com`). Avoid `*`.
3. Use HTTPS in front of the server (reverse proxy with TLS).
4. Ensure `DB_PATH` is on a volume with restricted permissions.
5. Keep dependencies updated (`npm audit`, `npm update`).
6. Debug routes are disabled automatically when `NODE_ENV=production`.

## Reporting issues

Report security-sensitive bugs to your internal security or SAIL team (e.g. philip.snowden@stewart.com), not in public issue trackers.
