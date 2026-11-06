# GoreeCloud Maps — Prioritized Roadmap

All items below are **planned**, not current product capabilities.

## P0 — Validate foundation
- Maintain the committed dependency lockfile and clean `npm ci` install checks, monitor dependency advisories, and complete broader third-party provenance, license and supply-chain review.
- Build on passing synthetic viewport/keyboard/forced-colors, narrow-width CSS reflow, and isolated **genuine Chromium 200–400% browser zoom** tests with real phones/tablets, manual zoom in Chromium/Firefox/Safari, keyboard-only traversal, screen-reader testing, broader visual states, and comprehensive GoreeCloud UI design acceptance. Reviewed synthetic screenshots are scoped evidence, not production UI approval.
- Extend implemented keyboard map-center pin tests to map navigation and keyboard-only point changes; verify real tile-provider attribution, cookie/privacy exposure, CSP and Referrer-Policy with licensed production infrastructure.
- Connect authorized own-hosted map tiles, Nominatim and OSRM; verify service capacity, data freshness, licensing, alerts and observability.
- Complete the approved GoreeCloud UI **component/layout** adoption, accessible visual QA and five-platform MIPS assessment; scoped stable Foundations color/typography token integration has begun, but is not full design-system acceptance.
- Trusted HTTPS gateway, request budgets, structured privacy-safe errors and operations runbook.
- Finish the browser-only geolocation consent-epoch regression in PR #18, then verify actual browser/device permission timing, cancellation boundaries, and no stale route starts. Profile renderer performance and network consumption on real mobile devices; synthetic CI already checks that the map code bundle is not fetched before explicit consent.

## P1 — Useful travel features
- Richer geocoding, reverse geocoding, POI details, saved route plans, **GPX waypoint import and route-track interchange** (waypoint export is already implemented), and richer GeoJSON geometry compatibility.
- Walking and cycling profiles, route alternatives, estimated arrival times and route instruction steps.
- EV routing, charging station connectors and local transit data integration.
- Progressive web app installability, offline-first UI shell and compliant self-hosted offline tiles.
- Native Android and iOS navigation surfaces using MapLibre Native or approved alternatives.

## P2 — High-value intelligence
- Licensed/live traffic ingestion and verifiable incident moderation, with transparent coverage.
- Weather and road hazard layers, speed limit indicators and privacy-safe community reports.
- Licensed street-level imagery and immersive views, 3D terrain/buildings where available.
- Secure GoreeCloud account sync with opt-in consent, cross-device sharing and identity.
- AI-powered geographic search only after appropriate grounded sources, consent and capability verification.

## P3 — Platform breadth
- Public transport realtime feeds where licensed, multimodal routing, accessibility-aware directions.
- Full native driving guidance/voice, Android Auto and Apple CarPlay where technically and legally supported.
- Developer APIs, quotas, SDKs and GoreeCloud Mesh event contracts.
- Disaster/community mapping workflows, provenance and moderation.

No live Waze/Google/Apple proprietary dataset copying is authorized by this plan.
