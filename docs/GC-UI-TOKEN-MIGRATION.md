# Maps — GC UI alpha token source migration

**Status:** Draft, source-implemented migration. Automated validation is required; physical-device, human assistive-technology and final visual approval are **not yet performed**. This is not a release.

## Why the dependency changed

The Maps package previously depended on `@goreecloud/gc-ui` from the `foundations-v1.0.1` release tarball. The dependency worked in a cached earlier environment, but on **November 11, 2026** the source GitHub repository returned **404 for the release/tag**, and a fresh npm resolution in [Maps browser CI](https://github.com/GoreeCloud/maps/actions/runs/43026130563) failed to fetch the artifact. The dated November 6 verification remains historical evidence only.

The currently authorized `GoreeCloud/gc-ui` repository is a distinct, **MIT-licensed `0.1.0-alpha.0`** implementation. Its CSS uses `--gc-*` semantic roles instead of the old release's `--gc-v1-*` roles. There is no verified API or palette parity with the removed release.

## What was changed

- Source: [`GoreeCloud/gc-ui` at `1c173d64d966b52122ac02eb0ffbd07d2a5a09e4`](https://github.com/GoreeCloud/gc-ui/blob/1c173d64d966b52122ac02eb0ffbd07d2a5a09e4/src/tokens.css), `src/tokens.css`, Git blob `dd9a918eb4239cdd47fb13f383ee3496de459489`.
- Offline same-owner, same-license snapshot `src/gc-ui-tokens.css` is byte-for-byte checked by `tests/gc-ui-token-source.test.mjs`. The snapshot contains no network imports, fonts or runtime JS. This is a temporary source-pinned distribution strategy, not a claimed package release.
- Remove the now-missing tarball from `package.json` and `package-lock.json`; retain MapLibre and Vite versions. `src/style.css` imports the local token sheet and maps existing page-specific aliases to canonical `--gc-canvas`, `--gc-surface`, `--gc-text`, `--gc-brand`, `--gc-focus-ring`, etc.
- The existing light/dark preference now updates both the compatibility `data-gc-mode` and canonical `data-gc-theme`. Lagoon remains selected.
- The existing browser accessibility suite must compare actual computed canvas colors to the new `--gc-canvas` role in light and dark, while checking consent, local operations, forced colors, 200/400% zoom and reflow as before.

## Risks, release gate and rollback

This is an **intentional visual palette change**, unlike the preceding compatibility alias proposal. Token contrasts are audited in GC UI, but Maps includes application-specific surface and SVG colors that need rendered contrast, screenshot-led whole-interface review and keyboard/touch/AT testing. Compare real 1440×900 desktop, 820×1180 tablet, 390×844 and 320×640 handset screens in both themes; inspect map consent, location denied, navigation, route editing, saved-place error and network-offline states. Human TalkBack, VoiceOver, Orca or NVDA review must be recorded from actual operation, never inferred from automated tests. No personal location, authentication tokens or remote map service is needed for the offline fixture.

Do not merge this draft until the new exact-head CI checks succeed and visual acceptance is documented. If the alpha token system cannot meet the required standards, restore the former visual behavior through **new reviewed local semantic assets** rather than reintroducing the unavailable remote tarball. No production deployment or native application acceptance follows from this migration.
