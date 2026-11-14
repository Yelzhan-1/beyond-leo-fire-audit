# PR2 plan: live tool — sliders, flame, verdict drawer, matrix UX, URL state

## Overview

Wire the index tool workspace to `window.AUDIT`: working environment sliders, physics-shaped flame (gravity + O₂), verdict change feedback, evidence drawer (shared with audit), interactive matrix highlights, and shareable URL query state. No engine or data changes; vanilla JS only.

## Files (implementation order)

| Order | Files | Goal |
|-------|--------|------|
| 1 | `docs/pr2-plan.md` | This plan |
| 2 | `assets/js/tool/scenario.js`, `assets/js/tool/flame-geom.js` | Pure URL + flame helpers (Node-testable) |
| 3 | `assets/js/ui/detail-panel.js`, `assets/js/ui/drawer.js` | Shared evidence drawer + detail HTML |
| 4 | `index.html`, `assets/js/ui/home.js`, `assets/css/pages.css`, `assets/css/components.css` | Sliders, flame, drawer, verdict flash, URL |
| 5 | `assets/js/ui/audit.js`, `audit.html`, `assets/css/pages.css` | Refactor drawer; matrix row/column hover |
| 6 | `tests/scenario.test.mjs`, `tests/flame-geom.test.mjs`, `tests/slider-map.test.mjs` | New unit tests |
| 7 | Screenshot script run, `npm run check` | Verification artifacts |

## Risks

| Risk | Mitigation |
|------|------------|
| Custom cabin drift vs audit builder | Reuse `BLFA.loadCustom` / `saveCustom` and same slider bounds as audit builder |
| Drawer a11y regressions | Focus trap, Esc, return focus; reuse audit markup |
| RAF slider thrash | Coalesce updates with `requestAnimationFrame` |
| CSP inline styles | CSS classes + `setProperty` only where audit already does (rank bars) |
| Parity snapshot | Do not edit `engine.js` or data |

## Left for PR3

Share/export UI, compare mode, deeper deep-linking on evidence, performance budget docs.