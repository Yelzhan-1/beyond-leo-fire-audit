/* Scenario URL and slider/env mapping for the index tool (no DOM). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.BLFA_SCENARIO = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DEST_DEFAULT_ENV = { iss: 'iss', moon: 'lander', mars: 'mars', custom: 'custom' };
  var DEFAULT_PRESET_ID = 'lander';
  var GRAVITY_TICKS = [0, 0.16, 0.38, 1];
  var GRAVITY_TICK_LABELS = [
    { g: 0, label: 'ISS 0' },
    { g: 0.16, label: 'Moon 0.16' },
    { g: 0.38, label: 'Mars 0.38' },
    { g: 1, label: 'Earth 1' }
  ];

  var SLIDER = {
    g: { min: 0, max: 1, step: 0.01 },
    p: { min: 30, max: 101.3, step: 0.1 },
    o2: { min: 15, max: 40, step: 0.5 }
  };

  function num(v) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : null;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }

  function near(a, b, eps) {
    return Math.abs(a - b) <= (eps != null ? eps : 0.011);
  }

  function envIdFromDest(d) {
    return DEST_DEFAULT_ENV[d] || null;
  }

  function destFromEnvId(id) {
    if (id === 'iss' || id === 'orion') return 'iss';
    if (id === 'mars') return 'mars';
    if (id === 'custom') return 'custom';
    return 'moon';
  }

  /** Parse ?d=&g=&p=&o2= and legacy ?env= into a normalized object. */
  function parseScenarioQuery(search) {
    var q = search && search.charAt(0) === '?' ? search.slice(1) : (search || '');
    var p = new URLSearchParams(q);

    var env = p.get('env');
    var d = p.get('d');
    if (d && !envIdFromDest(d)) d = null;
    var envId = env || (d ? envIdFromDest(d) : null);
    var dest = d || (envId ? destFromEnvId(envId) : null);

    return {
      dest: dest,
      envId: envId,
      g: num(p.get('g')),
      p: num(p.get('p')),
      o2: num(p.get('o2')),
      row: p.get('row') || null
    };
  }

  /** Build query string from live cabin fields (omit defaults when env preset matches). */
  function serializeScenario(state, presetEnv) {
    var parts = [];
    var envId = state.envId || 'lander';
    var dest = state.dest || destFromEnvId(envId);
    if (dest) parts.push('d=' + encodeURIComponent(dest));
    if (envId && envId !== envIdFromDest(dest)) parts.push('env=' + encodeURIComponent(envId));
    var g = state.g, pr = state.p, o2 = state.o2;
    if (presetEnv) {
      if (!near(g, presetEnv.g)) parts.push('g=' + encodeURIComponent(roundG(g)));
      if (!near(pr, presetEnv.p, 0.05)) parts.push('p=' + encodeURIComponent(roundP(pr)));
      if (!near(o2, presetEnv.o2, 0.05)) parts.push('o2=' + encodeURIComponent(roundO2(o2)));
    } else {
      if (g != null) parts.push('g=' + encodeURIComponent(roundG(g)));
      if (pr != null) parts.push('p=' + encodeURIComponent(roundP(pr)));
      if (o2 != null) parts.push('o2=' + encodeURIComponent(roundO2(o2)));
    }
    return parts.join('&');
  }

  function roundG(g) { return (Math.round(g * 100) / 100).toFixed(2).replace(/\.?0+$/, '').replace(/^(\d+)$/, '$1.0'); }
  function roundP(p) { return (Math.round(p * 10) / 10).toFixed(1); }
  function roundO2(o) { return (Math.round(o * 10) / 10).toFixed(1).replace(/\.0$/, ''); }

  function sliderToEnvField(key, raw) {
    var b = SLIDER[key];
    if (!b) return null;
    var n = num(raw);
    if (n == null) return null;
    var v = clamp(n, b.min, b.max);
    if (key === 'g') return Math.round(v * 100) / 100;
    if (key === 'p') return Math.round(v * 10) / 10;
    return Math.round(v * 10) / 10;
  }

  function applyScenarioToEnv(base, parsed) {
    if (!base) return null;
    var e = JSON.parse(JSON.stringify(base));
    if (parsed.g != null) {
      var g = sliderToEnvField('g', parsed.g);
      if (g != null) e.g = g;
    }
    if (parsed.p != null) {
      var p = sliderToEnvField('p', parsed.p);
      if (p != null) e.p = p;
    }
    if (parsed.o2 != null) {
      var o2 = sliderToEnvField('o2', parsed.o2);
      if (o2 != null) e.o2 = o2;
    }
    return e;
  }

  function cloneEnvObj(e) {
    return e ? JSON.parse(JSON.stringify(e)) : null;
  }

  function findEnvById(envs, customDefault, getCustom, id) {
    if (id === 'custom' && getCustom) return cloneEnvObj(getCustom());
    for (var i = 0; i < (envs || []).length; i++) {
      if (envs[i].id === id) return cloneEnvObj(envs[i]);
    }
    if (customDefault && customDefault.id === id) return cloneEnvObj(customDefault);
    return null;
  }

  function validPresetId(envs, id) {
    if (id === 'custom') return true;
    return (envs || []).some(function (e) { return e.id === id; });
  }

  /** Build live cabin + envId/dest from URL params (no DOM). */
  function resolveScenarioFromUrl(parsed, envs, customDefault, getCustom) {
    var envId = null;
    var dest = null;

    if (parsed.envId && validPresetId(envs, parsed.envId)) envId = parsed.envId;
    if (parsed.dest && envIdFromDest(parsed.dest)) dest = parsed.dest;

    var base = findEnvById(envs, customDefault, getCustom, envId || DEFAULT_PRESET_ID);
    if (!base) base = findEnvById(envs, customDefault, getCustom, DEFAULT_PRESET_ID);

    var live = applyScenarioToEnv(base, parsed) || cloneEnvObj(base);
    var matched = matchPresetId(live, envs, customDefault);
    if (matched === 'custom' && getCustom) {
      live.id = 'custom';
      live.custom = true;
    } else {
      var preset = findEnvById(envs, customDefault, null, matched);
      if (preset) {
        live.name = preset.name;
        live.phrase = preset.phrase;
        live.kind = preset.kind;
        live.id = matched;
      }
    }

    dest = dest || destFromEnvId(matched);
    if (matched === 'custom' && (parsed.g != null || parsed.p != null || parsed.o2 != null) && !parsed.dest) dest = 'custom';

    return { live: live, envId: matched, dest: dest };
  }

  /** If g,p,o2,v,dust,beyond match a preset, return its id; else custom. */
  function matchPresetId(live, envs, customDefault) {
    if (!live || typeof live.g !== 'number' || !isFinite(live.g)) return 'custom';
    var list = (envs || []).concat(customDefault ? [customDefault] : []);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.id === 'custom') continue;
      if (near(live.g, p.g) && near(live.p, p.p, 0.05) && near(live.o2, p.o2, 0.05) &&
          live.v === p.v && !!live.dust === !!p.dust && !!live.beyond === !!p.beyond) return p.id;
    }
    if (customDefault && near(live.g, customDefault.g) && near(live.p, customDefault.p, 0.05) &&
        near(live.o2, customDefault.o2, 0.05) && live.v === customDefault.v) return 'custom';
    return 'custom';
  }

  return {
    DEST_DEFAULT_ENV: DEST_DEFAULT_ENV,
    DEFAULT_PRESET_ID: DEFAULT_PRESET_ID,
    GRAVITY_TICKS: GRAVITY_TICKS,
    GRAVITY_TICK_LABELS: GRAVITY_TICK_LABELS,
    SLIDER: SLIDER,
    parseScenarioQuery: parseScenarioQuery,
    serializeScenario: serializeScenario,
    sliderToEnvField: sliderToEnvField,
    applyScenarioToEnv: applyScenarioToEnv,
    resolveScenarioFromUrl: resolveScenarioFromUrl,
    matchPresetId: matchPresetId,
    envIdFromDest: envIdFromDest,
    destFromEnvId: destFromEnvId,
    near: near,
    clamp: clamp
  };
});