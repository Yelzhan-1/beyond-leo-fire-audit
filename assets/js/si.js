/* Beyond LEO Fire Audit: SI (AI) explanation hook.

   The audit never lets a language model decide a verdict. This module is the single place where an
   optional "explain these results" feature can plug in. It has no API key and no backend of its own.

   Contract
   --------
   window.BLFA_SI.status()   -> { available: boolean, provider: 'endpoint' | 'claude-artifact' | 'none', message: string }
   window.BLFA_SI.explain(payload) -> Promise<{ text: string, provider: string }>
       payload = { question: string, records: { verdicts: [...], evidence: [...] } }
       rejects with Error whose .code is 'unavailable' | 'network' | 'bad_response' | 'http_<status>'

   Endpoint (a separate task adds a secure proxy; nothing here changes when it lands)
   ---------------------------------------------------------------------------------
   Set the URL of a same-origin or CORS-enabled proxy in ONE of these ways, before the first call:
     <meta name="blfa-si-endpoint" content="/api/explain">     (in the page head)
     window.BLFA_SI_ENDPOINT = '/api/explain';                 (before this script loads)
   The proxy receives  POST application/json  { question, records, instructions }  and must answer
   200 application/json  { "text": "..." }.  The proxy, not the browser, holds the key.

   Inside a Claude Artifact, window.claude.use('sample') is used instead, as before. */
(function (root) {
  'use strict';

  var TIMEOUT_MS = 30000;
  var INSTRUCTIONS = 'You are answering a question for a reader of a spacecraft fire-safety audit. Use only the records provided. ' +
    'If they do not answer the question, say so plainly. Write at most 120 words of plain prose, no lists, and name the experiment or source behind each claim.';

  function endpoint() {
    if (root.BLFA_SI_ENDPOINT) return String(root.BLFA_SI_ENDPOINT);
    var m = root.document && root.document.querySelector('meta[name="blfa-si-endpoint"]');
    var v = m && m.getAttribute('content');
    return v ? v.trim() : '';
  }

  var artifactFn = null, artifactTried = false;
  function artifact() {
    if (artifactTried) return Promise.resolve(artifactFn);
    artifactTried = true;
    try {
      if (root.claude && typeof root.claude.use === 'function') {
        return root.claude.use('sample').then(function (fn) { artifactFn = fn || null; return artifactFn; }, function () { return null; });
      }
    } catch (err) { /* not inside Claude */ }
    return Promise.resolve(null);
  }

  function err(code, message) { var e = new Error(message); e.code = code; return e; }

  function status() {
    if (endpoint()) return { available: true, provider: 'endpoint', message: 'Explanations come from the configured SI service. The verdicts above do not depend on it.' };
    if (artifactFn) return { available: true, provider: 'claude-artifact', message: 'Explanations come from Claude inside this artifact. The verdicts above do not depend on it.' };
    return { available: false, provider: 'none', message: 'SI explanations are not switched on in this deployment. The verdicts and records above come from fixed rules and cited sources and are complete without it.' };
  }

  function viaEndpoint(url, payload) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : 0;
    return root.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: payload.question, records: payload.records, instructions: INSTRUCTIONS }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw err('http_' + res.status, 'The SI service answered with status ' + res.status + '.');
      return res.json();
    }, function () { throw err('network', 'The SI service could not be reached.'); })
      .then(function (body) {
        if (!body || typeof body.text !== 'string' || !body.text.trim()) throw err('bad_response', 'The SI service sent an empty answer.');
        return { text: body.text.trim(), provider: 'endpoint' };
      }).then(function (r) { clearTimeout(timer); return r; }, function (e) { clearTimeout(timer); throw e; });
  }

  function explain(payload) {
    var url = endpoint();
    if (url) return viaEndpoint(url, payload);
    return artifact().then(function (fn) {
      if (!fn) throw err('unavailable', status().message);
      var prompt = INSTRUCTIONS + '\n\nQuestion: ' + payload.question + '\n\nRecords:\n' + JSON.stringify(payload.records);
      return fn(prompt, { modelTier: 'quick' }).then(function (r) {
        if (!r || !r.text) throw err('bad_response', 'Claude sent an empty answer.');
        return { text: r.text, provider: 'claude-artifact' };
      });
    });
  }

  /* Resolve the artifact path early so status() is accurate once the page has rendered. */
  function ready() { return endpoint() ? Promise.resolve(status()) : artifact().then(status); }

  root.BLFA_SI = { status: status, explain: explain, ready: ready };
})(typeof window !== 'undefined' ? window : globalThis);
