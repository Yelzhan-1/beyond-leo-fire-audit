# SI (AI) explanation hook

Verdicts are **never** produced by a language model. `assets/js/si.js` is the only place an optional “explain these results” feature can attach.

## API

```js
window.BLFA_SI.status()    // { available, provider, message }
window.BLFA_SI.ready()     // Promise; re-checks artifact availability
window.BLFA_SI.explain({ question, records })  // Promise<{ text, provider }>
```

`records` is `{ verdicts: [...], evidence: [...] }` as returned by the audit search.

Errors use `err.code`: `unavailable` | `network` | `bad_response` | `http_<status>`.

## Enable an endpoint (recommended for production)

Set **one** of these before `si.js` runs:

```html
<meta name="blfa-si-endpoint" content="/api/explain">
```

```html
<script>window.BLFA_SI_ENDPOINT = '/api/explain';</script>
```

Your proxy accepts:

- **Request:** `POST` `application/json`  
  `{ "question": string, "records": object, "instructions": string }`
- **Response:** `200` `application/json`  
  `{ "text": string }`

The proxy holds the API key; the static site does not.

## Claude Artifact

If `window.claude.use('sample')` exists (Artifact host), that path is used when no endpoint is configured.

## Default deployment

With no endpoint and no Artifact host, `status().available` is `false` and the Evidence page shows an honest message. Verdicts and records are complete without SI.