# GoreeCloud Maps

Privacy-first maps and navigation **development preview**. This repository is an original GoreeCloud foundation, not a deployed mapping service or an implementation of all planned capabilities.

## What is available in this preview

- **Map-first responsive layout:** full-bleed map canvas, floating search and controls, desktop tool lens, mobile expandable bottom sheet and a clearly labeled **illustrative offline street preview** before consent. The preview is fictional cartographic artwork, not real geographic data or directions. An actual MapLibre map with OpenStreetMap development raster tiles appears only after explicit network consent; its JavaScript is lazy-loaded.
- Explicit, permission-based browser geolocation, scoped to the current map-consent session. Revoking map consent ignores delayed location results and clears device-derived route starts; manual start selection overrides pending GPS. This is synthetic browser-tested behavior, not physical-device acceptance. Select points by clicking the map.
- Local longitude,latitude coordinate lookup without any geocoding provider request.
- Local-only saved places, browser-only preference, and erase-all control.
- Saved-place GeoJSON import/export and local **GPX 1.1 waypoint export** (not GPX import or route-track export), with bounded saved points, XML-safe names and duplicate-aware GeoJSON merging; accessible start/end coordinate entry.
- Route requests are invalidated when endpoints change, preventing outdated directions from being displayed as current.
- Local saved-place changes are applied to the UI only after browser-storage writes succeed; failed persistence is reported instead of silently pretending success. Browser/device acceptance pending.
- Optional place search through a configured Nominatim-compatible upstream and driving routes through a configured OSRM-compatible upstream.
- Same-origin Node proxy using bounded JSON POST inputs for private search/route requests, provider reply limits, and no storage of search queries or route coordinates.
- Accessible, rounded and floating controls using a **locally bundled, exact-Git-blob-verified GC UI alpha semantic CSS token snapshot** with light/dark appearance and a curated Lagoon accent. Native adapters, full component migration, premium visual acceptance and human AT remain pending.
- Node tests, GitHub Actions security/build checks, three-viewport Chromium journeys, keyboard/forced-colors checks, synthetic narrow-width reflow, and isolated **genuine Chromium 200%/400% zoom** with measured DPR and scroll reachability. Screen-reader, other-engine, real-device and holistic visual acceptance remain pending; native-zoom virtual-GPU screenshots can be incomplete.
- A keyboard-operable "Pin map center" control can select the visible map position without pointer input.

No real-time traffic, turn-by-turn voice guidance, offline tile downloads, satellite images, street imagery, production authentication, or device-native app is claimed.

## Local development

Requires Node 22+. Review dependencies and their licenses before installation. The former Foundations 1.0.1 GitHub release archive is no longer available (HTTP 404 verified November 11, 2026). To restore reproducible offline CSS, the development preview now includes the MIT-licensed [current GC UI alpha tokens](https://github.com/GoreeCloud/gc-ui/blob/1c173d64d966b52122ac02eb0ffbd07d2a5a09e4/src/tokens.css), pinned to blob `dd9a918eb4239cdd47fb13f383ee3496de459489`, with machine-verified byte integrity in `tests/gc-ui-token-source.test.mjs`. The alpha asset is **not** equivalent to the former stable package and has not passed full consumer visual/AT acceptance. See [migration boundary](docs/GC-UI-TOKEN-MIGRATION.md).

1. Run `npm ci` to install the verified dependency versions from the committed `package-lock.json`. Review package sources, code and licenses before installation.
2. Copy `.env.example` to `.env`, or supply the optional server environment variables through your shell.
3. In terminal one, run `npm run api` (default 127.0.0.1:8787).
4. In terminal two, run `npm run dev` and open the displayed local Vite URL.
5. Run `npm test`, `npm run check`, and `npm run build`. GitHub Actions performs a clean lockfile install and runs separate synthetic Playwright desktop/tablet/phone checks; see [status](docs/STATUS.md) for observed evidence.

To serve built files, run `npm run build` then `npm run preview`; the preview server listens on 127.0.0.1:8787, not a public interface. Do not expose it directly to the internet without production hardening and a trusted HTTPS gateway.

### Geographic providers

The interactive map uses the OSMF community tile service by default **for low-volume development only** after an explicit click. Its [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) requires a valid web `Referer`: the app therefore uses `Referrer-Policy: strict-origin-when-cross-origin`, which sends the website **origin only** to cross-site HTTPS tile servers, not the page path or search text. This origin, your IP address and requested tile coordinates are visible to the tile provider after consent. Before public or high-traffic use, configure a self-hosted or properly licensed tile service and update attribution. Do not bulk-prefetch or offer offline downloads from OSMF community tile servers.

Search and routing are **disabled by default**. Set `MAPS_GEOCODER_URL` to a trusted Nominatim-compatible service (for example `https://nominatim.example.org/`) and `MAPS_ROUTER_URL` to a trusted OSRM-compatible service (for example `https://router.example.org/`). Upstream endpoints are operator-controlled and never accepted as an end-user URL. No public demonstration service is silently enabled. Geocoding uses submit-only search rather than provider-abusive autocomplete; the proxy limits search frequency per process and validates replies. Hosting real search and routing requires data ingestion, monitoring and provider-specific compliance.

Tile, search, and routing providers observe the data sent to them. GoreeCloud Maps does not claim end-to-end privacy for third-party requests.

## Source and legal

Original first-party code: MIT License (see [LICENSE](LICENSE)). Map renderer: [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) (BSD-3-Clause). Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. OSM Foundation [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) applies to the default development tile provider. Geographic data, imagery and commercial provider services have distinct terms; do not copy Waze, Google Maps, or Apple Maps content.

## Architecture and delivery

See [architecture](docs/ARCHITECTURE.md), [status](docs/STATUS.md), [roadmap](docs/ROADMAP.md), and [scoped UI QA review](docs/UI-QA-2026-11-06.md). The five GoreeCloud integrated platform systems have not yet been verified as fully integrated; this preview is **not Anchor or production-ready**.
