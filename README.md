# GoreeCloud Maps

Privacy-first maps and navigation **development preview**. This repository is an original GoreeCloud foundation, not a deployed mapping service or an implementation of all planned capabilities.

## What is available in this preview

- Responsive MapLibre-based interactive map with OpenStreetMap raster tiles after explicit user consent.
- Explicit, permission-based browser geolocation; select points by clicking the map.
- Local longitude,latitude coordinate lookup without any geocoding provider request.
- Local-only saved places, browser-only preference, and erase-all control.
- Saved-place GeoJSON import/export (local file only), with validation and duplicate-aware merging; accessible start/end coordinate entry. Browser/device acceptance pending.
- Optional place search through a configured Nominatim-compatible upstream and driving routes through a configured OSRM-compatible upstream.
- Same-origin Node proxy using bounded JSON POST inputs for private search/route requests, provider reply limits, and no storage of search queries or route coordinates.
- Accessible, rounded and floating GoreeCloud UI-inspired controls, with light/dark appearance.
- Node unit tests and GitHub Actions build checks.

No real-time traffic, turn-by-turn voice guidance, offline tile downloads, satellite images, street imagery, production authentication, or device-native app is claimed.

## Local development

Requires Node 22+. Review dependencies and their licenses before installation.

1. Run `npm install` (the dependency lockfile is not yet committed).
2. Copy `.env.example` to `.env`, or supply the optional server environment variables through your shell.
3. In terminal one, run `npm run api` (default 127.0.0.1:8787).
4. In terminal two, run `npm run dev` and open the displayed local Vite URL.
5. Run `npm test`, `npm run check`, and `npm run build`.

To serve built files, run `npm run build` then `npm run preview`; the preview server listens on 127.0.0.1:8787, not a public interface. Do not expose it directly to the internet without production hardening and a trusted HTTPS gateway.

### Geographic providers

The interactive map uses the OSMF community tile service by default **for low-volume development only** after an explicit click. Before public or high-traffic use, configure a self-hosted or properly licensed tile service and update attribution. Do not bulk-prefetch or offer offline downloads from OSMF community tile servers.

Search and routing are **disabled by default**. Set `MAPS_GEOCODER_URL` to a trusted Nominatim-compatible service (for example `https://nominatim.example.org/`) and `MAPS_ROUTER_URL` to a trusted OSRM-compatible service (for example `https://router.example.org/`). Upstream endpoints are operator-controlled and never accepted as an end-user URL. No public demonstration service is silently enabled. Geocoding uses submit-only search rather than provider-abusive autocomplete; the proxy limits search frequency per process and validates replies. Hosting real search and routing requires data ingestion, monitoring and provider-specific compliance.

Tile, search, and routing providers observe the data sent to them. GoreeCloud Maps does not claim end-to-end privacy for third-party requests.

## Source and legal

Original first-party code: MIT License (see [LICENSE](LICENSE)). Map renderer: [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) (BSD-3-Clause). Map data: © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), ODbL. OSM Foundation [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) applies to the default development tile provider. Geographic data, imagery and commercial provider services have distinct terms; do not copy Waze, Google Maps, or Apple Maps content.

## Architecture and delivery

See [architecture](docs/ARCHITECTURE.md), [status](docs/STATUS.md), and [roadmap](docs/ROADMAP.md). The five GoreeCloud integrated platform systems have not yet been verified as fully integrated; this preview is **not Anchor or production-ready**.
