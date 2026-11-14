# Implementation plan: multi-page Beyond LEO Fire Audit

## Overview

Turn the single-file `index.html` (CSS, data, engine and UI in one 1,700-line file) into a static multi-page site with a sticky top navbar and a redesigned visual system. No framework, no bundler, no runtime dependencies. Every verdict, calculator result and evidence record must stay byte-identical to the pre-refactor engine.

## Architecture decisions

| Decision | Why |
|---|---|
| Real HTML pages at the repo root (`index`, `audit`, `evidence`, `calculators`, `method`, `about`, `404`) plus `vercel.json` with `cleanUrls: true` | Shareable, indexable URLs; works without JS; no fragile hash router. Links are relative and extensionless (`audit`), so they also work on any static host that maps `/audit` to `audit.html`. |
| Header and footer are a duplicated partial, written into every page by `scripts/sync-partials.mjs` and verified by a test | Works with JS off, no layout shift, no network round trip. A test fails if any page drifts from `partials/*.html`. |
| Engine split into `assets/js/data/*.js` (sources, investigations, environments) and `assets/js/engine.js`; both stay DOM-free and still expose `window.AUDIT` | Keeps the testable core. Evidence and rule definitions hold functions (`when`, `verdict`), so they cannot be plain JSON and stay in the engine file. |
| One UI script per page under `assets/js/ui/`, shared helpers in `common.js` | Pages load only what they need. |
| CSS: `tokens.css` (custom properties), `base.css`, `layout.css`, `components.css`, `pages.css` | Design tokens first, then reset/typography, shell, reusable components, page specifics. |
| System font stack, no web fonts | Fastest possible load, no third-party requests. |
| Dark mission-control theme by default, light theme via toggle, both through tokens | The contrast of every token pair is asserted in a test (WCAG AA). |
| SI/AI hook is one module, `assets/js/si.js`, with a configurable endpoint and no key | A later task adds the secure backend proxy and only has to set the endpoint. |

## Information architecture

1. **Overview** (`/`): the problem, why a flame behaves differently in freefall, what the tool does, live headline numbers, a mini audit heat map, calls to action.
2. **Audit** (`/audit`): environment x rule matrix, cabin builder, evidence for the selected cell, ranked experiments and open questions. Deep links: `?env=rover&row=vent`.
3. **Evidence** (`/evidence`): filterable experiments, evidence records and sources, plus the keyword search.
4. **Calculators** (`/calculators`): the three calculators.
5. **Method and data** (`/method`): how verdicts are made, limits, NASA data, where SI fits, challenge resources, data download.
6. **About** (`/about`): the challenge, the team, AI disclosure, disclaimer.

## Task list

### Phase 1: Safety net
- [x] Task 1: capture engine snapshot from the old monolith and add parity tests. Verify: `npm test` green against the old `index.html`.

### Phase 2: Split without behaviour change
- [x] Task 2: extract data and engine into `assets/js/**`, repair the Orion source link, point the test helper at the new files. Verify: parity tests still pass.
- [x] Task 3: partial sync script, dev server, `vercel.json`, CI scripts lint every page. Verify: `npm run lint:html`, partial test.

### Checkpoint: engine and tooling
- [x] parity tests, JSON check, lint all green

### Phase 3: Design system and pages (vertical slices)
- [x] Task 4: tokens, base, layout, components CSS and the navbar (keyboard, mobile menu, theme toggle). Verify: contrast test, manual keyboard pass.
- [x] Task 5: Audit page (matrix, builder, detail, ranks, deep links, mobile single-cabin view).
- [x] Task 6: Calculators page.
- [x] Task 7: Evidence page (experiments, records, sources, search, SI hook).
- [x] Task 8: Method and data page (with dataset load/empty/error states).
- [x] Task 9: Home page.
- [x] Task 10: About and 404.

### Checkpoint: pages
- [x] Nav and internal-link tests green, no console errors on any page at 1440 and 390 px

### Phase 4: Ship
- [x] Task 11: README, SI hook doc, screenshots, PR description.
- [x] Task 12: CI green on the PR (`npm run check` local; GitHub Actions workflow in `.github/workflows/ci.yml` on PRs).

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Behaviour regression while moving code | High | Snapshot parity test written before any move; UI ported from the old script function by function. |
| Matrix unusable on a 360 px screen | High | Below 900 px the matrix shows one cabin at a time behind a cabin picker. |
| Header/footer drift between pages | Medium | Generated from partials, checked by test. |
| Invented science in new copy | High | New copy reuses text already in the engine or is clearly about the tool, not NASA findings. Numbers shown on the home page are computed live from the engine. |
| Unverifiable external links (bot-blocked) | Low | Only the Orion link is changed (verified against the PDF's contents); the rest are reported in the PR. |

## Open questions

- Team roster for the About page (only "Zhanibek, Team NZE" is in the repo).
- Backend proxy URL for the SI hook (separate task).