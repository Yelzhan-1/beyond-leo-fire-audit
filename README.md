# Beyond LEO Fire Audit

A static site for the 2026 NASA Space Apps Challenge, [*Flame in Freefall*](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

The ISS runs on fire-safety rules of thumb: stop the airflow and the flame dies, the smoke detector will catch it, a material that passes the 1 g flame test is safe. This project checks ten of those rules against five crewed environments (ISS, an Orion-class capsule, a lunar lander or habitat, a pressurized rover and a Mars surface habitat) and marks each one as **holds**, **weakens**, **breaks** or **unknown**, with the NASA experiment behind every verdict.

## Run locally

```bash
npm ci
npm start          # http://localhost:8080 (clean URLs, same as Vercel)
npm test           # engine parity, contrast, page shell and links
npm run check      # JSON validity, html-validate, tests
```

No build step. Pages are plain HTML at the repo root; `scripts/serve.mjs` mirrors `vercel.json` (`cleanUrls`, `404.html` for unknown paths).

After editing `partials/head.html`, `partials/header.html` or `partials/footer.html`:

```bash
npm run sync       # rewrite <!-- partial:... --> blocks in every page
```

## Site map

| Page | URL | Role |
|------|-----|------|
| Overview | `/` | Problem, live stats, mini verdict map, CTAs |
| Audit | `/audit` | Matrix, cabin builder, evidence panel, rankings |
| Evidence | `/evidence` | Search, experiments, records, sources |
| Calculators | `/calculators` | CO₂ discharge, oxygen masks, air after fire |
| Method & data | `/method` | Rules, limits, NASA data, SI note, `evidence.json` |
| About | `/about` | Challenge, Team NZE Almaty, AI disclosure |

## Code layout

```
assets/css/          tokens, base, components, pages
assets/js/data/      SOURCES, INV, ENVS (assign window.AUDIT_DATA)
assets/js/engine.js  verdict engine (DOM-free, window.AUDIT)
assets/js/ui/        one script per page + nav.js, common.js
assets/js/si.js      optional SI explanation hook (no API key here)
partials/            shared head, header, footer (synced into *.html)
scripts/             serve, sync-partials, check-json
tests/               engine parity snapshot, contrast, pages.test.mjs
evidence.json        machine-readable export of rules, verdicts, records
```

The engine is tested in Node via `tests/helpers/load-engine.mjs` and compared to `tests/fixtures/engine-snapshot.json` captured from the pre-refactor monolith.

## Verdicts and data

No language model decides a cell. Each rule has a written decision rule (on the Method page), applied to cabin conditions and evidence records. Optional SI on the Evidence page can explain search results from those records only; see [`docs/si-hook.md`](docs/si-hook.md).

`evidence.json` holds the same rules, verdicts, evidence records and sources in machine-readable form.

## Author

Zhanibek, Team NZE (Almaty).

Independent project. Not a NASA product and not endorsed by NASA.