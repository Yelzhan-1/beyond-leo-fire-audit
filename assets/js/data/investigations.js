/* Beyond LEO Fire Audit: the NASA investigations behind the evidence records.
   Pure data, no DOM. Loaded before engine.js and read through window.AUDIT_DATA. */
(function (root) {
  'use strict';
  var D = root.AUDIT_DATA = root.AUDIT_DATA || {};

  var PSI = 'https://psi.nasa.gov/physci/repo/data/investigations/';
  D.INV = {
    bass:    { name: 'BASS', full: 'Burning and Suppression of Solids', where: 'ISS glovebox', links: [{ label: 'PSI-26', url: PSI + 'PSI-26' }], psi: true },
    bass2:   { name: 'BASS-II', full: 'Burning and Suppression of Solids II', where: 'ISS glovebox', links: [{ label: 'PSI-25', url: PSI + 'PSI-25' }], psi: true },
    same:    { name: 'SAME and SAME-R', full: 'Smoke Aerosol Measurement Experiment and its reflight', where: 'ISS glovebox', links: [{ label: 'PSI-102', url: PSI + 'PSI-102' }, { label: 'PSI-101', url: PSI + 'PSI-101' }], psi: true },
    daft:    { name: 'DAFT and DAFT-2', full: 'Dust and Aerosol Measurement Feasibility Test', where: 'ISS cabin air', links: [{ label: 'PSI-47', url: PSI + 'PSI-47' }], psi: true },
    flex:    { name: 'FLEX', full: 'Flame Extinguishment Experiment', where: 'ISS Combustion Integrated Rack', links: [{ label: 'PSI-69', url: PSI + 'PSI-69' }], psi: true },
    bre:     { name: 'ACME BRE', full: 'Burning Rate Emulator', where: 'ISS Combustion Integrated Rack', links: [{ label: 'PSI repository', url: 'https://psi.nasa.gov/physci/repo/search?q=combustion' }], psi: true },
    saffire: { name: 'Saffire IV to VI', full: 'Spacecraft Fire Experiment on Cygnus cargo vehicles', where: 'Orbit, uncrewed Cygnus', links: [{ label: 'NTRS 20240002981', url: 'https://ntrs.nasa.gov/citations/20240002981' }], note: 'Saffire I to III are in PSI as PSI-98, PSI-99 and PSI-100. The IV to VI results used here come from NASA technical papers.' },
    mist:    { name: 'SoFIE-MIST', full: 'Material Ignition and Suppression Test', where: 'ISS Combustion Integrated Rack', links: [{ label: 'UC Berkeley report', url: 'https://vcresearch.berkeley.edu/news/nasa-funded-project-offers-new-insights-fire-behavior-space' }], note: 'Recent station experiment. Results are reaching the literature now.' },
    cc:      { name: 'Confined Combustion', full: 'Flame spread between baffles, using the BASS hardware', where: 'ISS glovebox', links: [{ label: 'NTRS 20205004657', url: 'https://ntrs.nasa.gov/citations/20205004657' }] },
    pg:      { name: 'Partial-gravity ground tests', full: 'NASA Glenn drop-tower centrifuge, parabolic flights and the LUCI sounding rocket', where: 'Earth facilities', links: [{ label: 'NTRS 20260001966', url: 'https://ntrs.nasa.gov/citations/20260001966' }] },
    gasp:    { name: 'Fire detection chamber tests', full: 'NASA Fire Detection System Project: smoke and lunar dust simulant in the GASP chamber', where: 'NASA Glenn', links: [{ label: 'NTRS 20260005612', url: 'https://ntrs.nasa.gov/citations/20260005612' }] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
