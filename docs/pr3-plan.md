# PR3 plan: compare, share link, PNG report card, polish

## Overview

Build on PR2 (`cursor/pr2-live-tool-687f`): UI polish from screenshots, shareable URL copy, offline PNG report card, side-by-side scenario compare with URL state, optional onboarding coach. No `engine.js` or data edits; vanilla JS/CSS only; CSP unchanged.

## Files (implementation order)

| Order | Files | Goal |
|-------|--------|------|
| 1 | `docs/pr3-plan.md` | This plan |
| 2 | `assets/js/tool/scenario.js` | Compare query (`cmp`, `cg`/`cp`/`co2`), share URL builder, scenario subtitle helper |
| 3 | `assets/js/tool/flame-geom.js` | Qualitative flame behaviour labels (no new physics) |
| 4 | `assets/js/tool/report-card.js` | Report data model + canvas draw + download |
| 5 | `assets/js/ui/home.js`, `index.html` | Polish, share, report, compare wiring |
| 6 | `assets/css/pages.css`, `assets/css/components.css` | Ticks, stage strip, compare table, toast, coach, tap targets |
| 7 | `tests/scenario.test.mjs`, `tests/share.test.mjs`, `tests/report-card.test.mjs` | URL/compare/share/report model |
| 8 | `scripts/screenshot-pr3.mjs` | Verification artifacts |

## Goal checklist

1. **Polish** — gravity tick label positioning; custom scenario subtitle; flame stage stat strip; mobile spacing/tap targets.
2. **Share** — clipboard + Web Share API + toast + fallback input.
3. **Report card** — 1200×630 PNG via offscreen canvas; `document.fonts.ready`.
4. **Compare** — toggle, B destination, diff-highlighted table; URL `cmp` params.
5. **Onboarding** — dismissible coach strip + `localStorage` (if 1–4 complete).

## Risks

| Risk | Mitigation |
|------|------------|
| Tick labels still collide at 270px rail | Edge-aligned transforms; short labels; optional second row via CSS |
| Compare doubles paint cost | Evaluate B only when compare on; reuse summary API |
| Font load on report canvas | Await `document.fonts.ready`; system fallback stack |
| Clipboard on non-HTTPS | Selectable URL fallback in toast |
| Engine parity | Do not touch `engine.js`; run `engine-parity.test.mjs` |

## Verification

- `npm run check`
- Cold-load console check: `/`, `/?g=0`, `/?d=mars&cmp=iss`, `/audit`, `/evidence`, `/calculators`, `/method`, `/about`
- Screenshots under `/opt/cursor/artifacts/` per PR brief