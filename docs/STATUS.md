# GoreeCloud Maps — Status

**Stage:** Source development preview; not deployed or production accepted.

**Source present:** Web map client, Node proxy scaffold with optional Nominatim/OSRM adapters, bounded JSON POST request handling, local saved locations, local GeoJSON saved-place portability, manual route coordinate entry, provider consent and automation tests.

**Verified automated checks (November 6, 2026):** Node tests, syntax checks, Vite build and production-dependency advisory check passed in GitHub Actions. A separate real Chromium test job passed synthetic desktop (1440×900), tablet (820×1180) and phone (390×844) journeys for map consent and canvas startup, coordinate search, local saves, GeoJSON import/export, manual routes, mocked search/routing providers, theme persistence, and rejection of obsolete route results. Evidence: [main browser CI 42244215895](https://github.com/GoreeCloud/maps/actions/runs/42244215895) and [PR #7 browser CI 42244883746](https://github.com/GoreeCloud/maps/actions/runs/42244883746). The runs preserved synthetic screenshots for review; no human visual acceptance is claimed.

**Still unverified:** real hardware geolocation and touch behavior, screen-reader accessibility, full keyboard-only and contrast/zoom audits, human screenshot review against GoreeCloud UI, live geocoder/router and tile-service compatibility, provider licensing at production scale, operational HTTPS/reverse proxy, trusted deployments and production monitoring. CI uses mocked geocoder/router responses and intercepted tiles, not evidence of production navigation accuracy.

**Unavailable in this milestone:** native Android/iOS, turn-by-turn navigation, traffic and crowd reports, elevation/3D, offline tile downloading, account sync and live business data. A reproducible dependency lockfile is not yet committed.

**Design authority:** GoreeCloud UI. **Privacy authority:** GoreeShield. **Cybersecurity authority:** Wardveil. **Interoperability:** GoreeCloud Mesh. **Identity:** GoreeCloud Identity when applicable.

**Release gate:** five integrated platform systems not fully verified; not Anchor.
