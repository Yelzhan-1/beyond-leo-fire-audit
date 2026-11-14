# NASA FLEX microgravity data (processed subsets)

These files are **small extracts** from [PSI-69 — Flame Extinguishment Experiment (FLEX)](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69) in the NASA Physical Sciences Informatics (PSI) repository. They are used only to illustrate droplet combustion measurements on the Method page. **Audit verdicts are not computed from these files**; they still come from the fixed rules and literature values in `assets/js/engine.js`.

| File | Contents |
|------|----------|
| `flex-meta.json` | Source URLs, DOI, licence, processing date |
| `flex-co2-burn-rate.json` | Summary burning-rate constants *K* (mm²/s) vs ambient CO₂ (21% O₂), from the PSI experimental table |
| `flex-002-d2-series.json` | Droplet diameter and *d*² vs time for ISS test FLEX-002 (identifier 20CAL10) |

## Source (download again from NASA)

- **Investigation:** [https://psi.nasa.gov/physci/repo/data/investigations/PSI-69](https://psi.nasa.gov/physci/repo/data/investigations/PSI-69)
- **DOI:** [10.60555/mbq8-0451](https://doi.org/10.60555/mbq8-0451)
- **Licence:** CC0 1.0 (as stated on the PSI investigation page)
- **Original files used:**
  - `PSI-69_Experimental table_FLEX.csv` — via  
    `https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download?file=PSI-69_Experimental%20table_FLEX.csv&version=5&redirect=true`
  - `PSI-69_Raw Data_FLEX-002_DropletData.txt` — via  
    `https://psi.nasa.gov/geode-py/ws/studies/PSI-69/download?file=PSI-69_Raw%20Data_FLEX-002_DropletData.txt&version=5&redirect=true`

## Processing steps

Run from the repo root (requires network):

```bash
node scripts/process-flex-data.mjs
```

1. Download the two PSI files above (API version 5, same as the current PSI-69 release).
2. Parse the experimental CSV (Latin-1/Windows-1252) into normalised JSON records.
3. Keep rows with fuel Methanol or Heptane, O₂ mole fraction 0.21, and a numeric *K*.
4. Parse FLEX-002 droplet track (tab-separated rows; PSI ships some files with `\r` line breaks), keep 0 ≤ *t* ≤ burn time from the summary table, downsample to ≤ 120 points.
5. Write the three JSON files in this folder (total size well under 1 MB).

## Relation to this audit

The **CO₂ extinguisher** row in the audit cites FLEX for the fraction of CO₂ needed to stop steady droplet burning (20% for heptane, 30% for methanol at 1 atm in the Dietrich et al. summary). The CO₂ chart here shows measured burning-rate constants from PSI across ambient CO₂ levels at 21% O₂; it supports that rule qualitatively but does not replace the published limits in the engine.

Reference repo used only as a pointer to PSI (not as data source): [aliabbasov99/nasa-space-apps](https://github.com/aliabbasov99/nasa-space-apps).