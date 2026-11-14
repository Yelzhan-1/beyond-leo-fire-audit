/* Pure flame shape parameters from gravity and oxygen (microgravity combustion schematic). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BLFA_FLAME_GEOM = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function flameShape(g, o2) {
    var gn = Math.max(0, Math.min(1, g == null ? 0 : g));
    var o2n = Math.max(0, Math.min(1, ((o2 == null ? 21 : o2) - 15) / 25));
    var micro = gn < 0.01;
    var buoy = Math.sqrt(gn);
    var baseR = 34;

    if (micro) {
      var r = baseR * (0.55 + 0.22 * o2n);
      return {
        mode: 'sphere',
        height: r * 2,
        width: r * 2,
        coreRadius: 5 * (0.85 + 0.15 * o2n),
        blueMix: 1,
        brightness: 0.35 + 0.45 * o2n,
        warmMix: 0,
        flicker: 0.25
      };
    }

    var flick = 1 + 0.04 * gn;
    var h = 2 * baseR * (1 + 2.1 * buoy) * flick * (0.92 + 0.14 * o2n);
    var w = baseR * (1.02 - 0.18 * gn) * (0.95 + 0.1 * o2n);
    var warm = Math.pow(gn, 0.55);
    return {
      mode: 'teardrop',
      height: h,
      width: w,
      coreRadius: null,
      blueMix: Math.max(0, 1 - gn * 1.05),
      brightness: 0.5 + 0.5 * o2n,
      warmMix: warm,
      flicker: 0.35 + 0.35 * gn
    };
  }

  return { flameShape: flameShape };
});