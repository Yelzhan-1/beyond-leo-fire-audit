# PR1 plan: tool-first app shell, typography, color, theme

## Overview

Restyle the static site into a product-like audit tool on the index page, replace the design token system (Space Grotesk, IBM Plex Mono, ember accent, fixed light theme), tighten the app shell navbar, relocate long copy from the home page, and fix known layout bugs—without changing `engine.js` or data files.

## Files to touch (order)

1. **Plan** — `docs/pr1-plan.md` (this file)
2. **Tokens & CSP** — `assets/css/tokens.css`, `partials/head.html` (Google Fonts), `vercel.json` (CSP), `assets/js/ui/nav.js` (theme-color meta)
3. **App shell** — `partials/header.html`, `partials/footer.html`, run `npm run sync`; remove `data-theme="dark"` from page bands on all `*.html`
4. **Index tool workspace** — `index.html`, `assets/js/ui/home.js`, `assets/css/pages.css`, `assets/css/components.css`, `assets/css/base.css` as needed
5. **Relocated content** — `method.html`, `assets/js/ui/method.js` (overview context + verdict heat map)
6. **Bug fixes** — `assets/css/pages.css` / `components.css` (Method TOC/CTA, step cards), optional `about.html` pointer
7. **Tests** — `tests/pages.test.mjs` (nav label Tool, index tool markup, ten rules per cabin)

## Implementation slices

| Slice | Commit focus |
|-------|----------------|
| A | Plan document |
| B | Design tokens, fonts, CSP, focus colour |
| C | Header/footer partials + sync + drop forced dark bands |
| D | Index 3-zone layout + `home.js` wired to `window.AUDIT` |
| E | Move “More context” blocks to Method |
| F | TOC/steps/spacing + a11y pass |
| G | Tests + screenshots + PR |

## Risks

| Risk | Mitigation |
|------|------------|
| WCAG AA fails after palette change | Run `tests/contrast.test.mjs` after token edit; iterate hex values |
| `pages.test.mjs` nav label drift | Update `NAV` constant to `Tool`; run `npm run sync` |
| Google Fonts blocked by CSP | Add only `fonts.googleapis.com` / `fonts.gstatic.com` to CSP |
| Index depends on engine load order | Keep existing script order; use `BLFA.boot` |
| Light mode hero still dark | Remove per-section `data-theme="dark"`; no hard-coded dark fills in `.flames` |

## Left for PR2/PR3

- Live slider logic, compare/share/export, verdict matrix UX, interactive flame physics tied to sliders.

## Verification

- `npm test` (39+ tests, parity snapshot unchanged)
- Local serve + Puppeteer screenshots: index/audit/method @ 1440 dark+light, index @ 390 mobile
- No console errors on index