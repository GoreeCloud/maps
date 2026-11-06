# GoreeCloud Maps — Architecture (development preview)

- **UI:** Vite and JavaScript ESM with MapLibre GL JS; map tiles are loaded only after a user action. Default tile center is a generic US-scale view, not a claim about user location.
- **Data:** raster tile source with mandatory OpenStreetMap attribution. Tile provider is operator-configurable, never a dataset bundled into this repository.
- **API:** dependency-free Node HTTP process. Same-origin `/api/config`, `/api/search`, `/api/route`, `/api/health`. Provider base URLs come solely from server environment, validated on startup (HTTPS required except loopback HTTP).
- **Privacy:** search queries and route coordinates are not retained; saved places remain in device browser localStorage; device geolocation needs a deliberate click and browser permission. Tile fetches and configured proxy upstream calls disclose information to operators.
- **Security:** endpoint validation; no arbitrary target URLs; response size limits; no external provider until configured for search and routes; strict JSON response handling; no cookies or analytics; server binds loopback by default.
- **Runtime:** development server via Vite proxy; the Node server also serves the production build with same-origin API routes. The latter is not yet hardened as a public production gateway.
- **Failure behavior:** missing geocoder/router returns 503, bad coordinates return 400, upstream failure returns a bounded 502, client displays actionable errors.
- **Scope boundaries:** no persistent backend account database, no traffic telemetry ingestion, no ads, no autonomous location tracking, no background synchronization, no offline tile downloads.

## Required platform assessment (MIPS)
- **GC UI:** adopted verified design vocabulary as a local interface implementation; shared package integration and visual acceptance pending.
- **GoreeShield:** privacy-oriented behavior implemented locally; actual central integration pending.
- **Wardveil:** server input validation and request controls implemented locally; central cybersecurity integration pending.
- **GoreeCloud Identity:** no account system in this preview; evaluate authenticated features and approved Identity contracts before adding users.
- **GoreeCloud Mesh:** REST contract documented locally; actual mesh adapter and interop tests pending.

All five require a verified integration disposition before Anchor eligibility. No fake integrations are exposed.
