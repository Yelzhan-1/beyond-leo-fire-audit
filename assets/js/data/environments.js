/* Beyond LEO Fire Audit: the five preset cabins and the default custom cabin.
   Pure data, no DOM. Loaded before engine.js and read through window.AUDIT_DATA. */
(function (root) {
  'use strict';
  var D = root.AUDIT_DATA = root.AUDIT_DATA || {};

  D.ENVS = [
    { id: 'iss', name: 'ISS', phrase: 'the ISS', kind: 'Space station, the baseline', g: 0, p: 101.3, o2: 21, v: 1005, dust: false, beyond: false,
      notes: 'Sea-level air. Volume is the NASA pressurized volume of 1,005 m³; the habitable volume is 388 m³.', src: ['issfacts'], assumed: {} },
    { id: 'orion', name: 'Orion-class capsule', phrase: 'an Orion-class capsule', kind: 'Deep-space spacecraft', g: 0, p: 101.3, o2: 21, v: 9.3, dust: false, beyond: true,
      notes: 'Volume is the 330 cubic feet of habitable volume NASA lists for Orion; its pressurized volume is 690.6 cubic feet (19.6 m³). Sea-level air is assumed here. Orion was designed for up to 30% oxygen at 10.2 psia, and its materials are certified at that condition.', src: ['orion', 'hirsch09'], assumed: { p: true, o2: true } },
    { id: 'lander', name: 'Lunar lander or habitat', phrase: 'a lunar lander or habitat', kind: 'Lunar surface base', g: 0.16, p: 56.5, o2: 34, v: 17, dust: true, beyond: true,
      notes: 'NASA states that the lander, lunar habitat and pressurized rover nominally use 8.2 psia (56.5 kPa) with 34% oxygen. The 17 m³ volume is an assumption, set to match the free volume in which Saffire measured toxic gases.', src: ['urban21', 'ferkul26'], assumed: { v: true } },
    { id: 'rover', name: 'Pressurized rover', phrase: 'a pressurized rover', kind: 'Lunar surface vehicle', g: 0.16, p: 56.5, o2: 34, v: 13, dust: true, beyond: true,
      notes: 'Same nominal atmosphere as the lander. Volume is the 13 m³ living space of the JAXA and Toyota pressurized rover concept.', src: ['ferkul26', 'jaxa'], assumed: {} },
    { id: 'mars', name: 'Mars surface habitat', phrase: 'a Mars surface habitat', kind: 'Martian surface base', g: 0.38, p: 56.5, o2: 34, v: 100, dust: true, beyond: true,
      notes: 'Gravity is 0.38 g. The atmosphere is assumed equal to the lunar exploration atmosphere and the 100 m³ volume is a placeholder. Change both in the cabin builder.', src: [], assumed: { p: true, o2: true, v: true } }
  ];
  D.CUSTOM_DEFAULT = { id: 'custom', name: 'Your cabin', phrase: 'your cabin', kind: 'Set the conditions yourself', g: 0.16, p: 70.3, o2: 26.5, v: 30, dust: true, beyond: true, notes: '', src: [], assumed: {}, custom: true };
})(typeof window !== 'undefined' ? window : globalThis);
