# Maps — GC UI semantic-name compatibility bridge

**Status:** Partial consumer migration, development source only; no alpha GC UI component swap, user-approved visual redesign, human AT or physical-device sign-off.

GoreeCloud Maps already consumes the stable, checksum-pinned [GC UI Foundations v1.0.1](https://github.com/GoreeCloud/gc-ui/releases/tag/foundations-v1.0.1) CSS contract (`--gc-v1-*`). The current experimental `@goreecloud/ui` source uses `--gc-*` semantic role names and is **not** a drop-in version upgrade for that separately published package.

This migration adds a **local CSS alias bridge** for canvas, surfaces, primary/supporting text, outline, brand/on-brand, focus and font role. Existing Maps `--canvas/--surface/--primary` internals now resolve through those `--gc-*` names but ultimately retain the verified stable Foundations values; no new network import, third-party library, color palette or storage behavior is introduced. `data-gc-theme` now follows the existing `data-gc-mode` and visible light/dark switch without removing legacy compatibility.

The synthetic Chromium browser accessibility suite verifies that both theme attributes remain aligned and `--gc-canvas` equals the old source role in both themes, while existing interactive, forced-colors, reduced-motion, true-zoom, consent and privacy tests must stay green.

**Not yet accepted:** A true package/component migration to alpha `@goreecloud/ui`, complete premium design conformance, all themes and accent families, physical Android/iOS screenshots, manual TalkBack/VoiceOver/Orca/NVDA, or production deployment. Continue with the [GC UI consumer migration issue](https://github.com/GoreeCloud/gc-ui/issues/13), per-consumer before/after evidence and explicit compatibility/release review. Revert the branch if rendered values or behavior drift unexpectedly.
