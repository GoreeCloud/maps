# GoreeCloud Maps — Prioritized Roadmap

All items below are **planned**, not current product capabilities.

## P0 — Validate foundation
- Commit and verify the missing dependency lockfile; move CI to `npm ci` only after readback and clean-install checks. Maintain dependency advisories and complete broader third-party provenance review.
- Expand passing *synthetic* three-viewport Chromium smoke checks to human-reviewed screenshots, real phones/tablets, light/dark and increased-contrast visual acceptance, keyboard-only flows, and screen-reader testing.
- Verify accessible keyboard map selection, tile-provider attribution, cookie/privacy exposure, CSP and proper Referrer-Policy.
- Connect authorized own-hosted map tiles, Nominatim and OSRM; verify service capacity, data freshness, licensing, alerts and observability.
- Integrate approved GoreeCloud UI tokens/components and document five-platform MIPS assessment.
- Trusted HTTPS gateway, request budgets, structured privacy-safe errors and operations runbook.
- Profile map renderer performance and network consumption on real mobile devices; synthetic CI checks that the map code bundle is not fetched before the consent action.

## P1 — Useful travel features
- Richer geocoding, reverse geocoding, POI details, saved route plans, GPX, and richer GeoJSON geometry compatibility.
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
