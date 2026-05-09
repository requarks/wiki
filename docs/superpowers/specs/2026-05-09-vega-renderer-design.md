# Vega + Vega-Lite Renderer — Design Spec

**Date:** 2026-05-09
**Status:** Approved
**Author:** Tayeb Chlyah

---

## Goal

Add support for [Vega](https://vega.github.io/vega/) and [Vega-Lite](https://vega.github.io/vega-lite/) charts in Wiki.js pages via fenced code blocks, using the official `vega-embed` library. Charts render in both the live page view and the markdown editor preview.

---

## Context

Wiki.js already supports several embedded visualization syntaxes via the same pattern: a server-side rendering module rewrites highlighted fenced blocks into a placeholder `<div>`, and the client mounts a JS library on those divs after the page loads.

Reference modules:
- `server/modules/rendering/html-mermaid/` — minimal renderer (8-line `init`).
- Hydration in `client/themes/default/components/page.vue` (live view) and `client/components/editor/editor-markdown.vue` (editor preview).

This spec follows that pattern, with deviations noted where Vega's characteristics differ from Mermaid.

---

## Markdown Syntax

Two fenced-code languages, mapped to two engines:

````markdown
```vega
{ ...full Vega spec... }
```

```vega-lite
{ ...Vega-Lite spec... }
```
````

The fence language unambiguously selects the engine. No auto-detection from `$schema`. Trailing whitespace and surrounding whitespace ignored. Spec body is JSON.

---

## Architecture

### Server modules

Two new rendering modules, modeled on `html-mermaid`:

- `server/modules/rendering/html-vega/`
  - `definition.yml`: `key: htmlVega`, `dependsOn: htmlCore`, `enabledDefault: true`, no props.
  - `renderer.js`: matches `pre.prismjs > code.language-vega`, replaces parent `<pre>` with `<div class="vega">{spec text}</div>`.
- `server/modules/rendering/html-vega-lite/`
  - Same structure, key `htmlVegaLite`, class `vega-lite`, language `language-vega-lite`.

Modules are independent — each can be enabled/disabled separately.

### Client hydration

Single shared helper module (`client/components/vega/hydrate.js`) exporting:

```
hydrateVega(rootEl, { darkMode })
```

Behavior:

1. Query `rootEl.querySelectorAll('.vega, .vega-lite')`.
2. If empty, return immediately (avoids paying the script-load cost on pages without charts).
3. Lazily inject three `<script>` tags from a public CDN (jsdelivr) in order: `vega`, `vega-lite`, `vega-embed`. Each script registers a global (`window.vega`, `window.vegaLite`, `window.vegaEmbed`). Versions are pinned in the helper module.
4. The load promise is cached at module scope so subsequent calls reuse the same loaded scripts.
5. For each matched element:
   - On first hydration, copy the element's text content into a `data-vega-spec` attribute (for idempotent re-runs).
   - Read spec text from `data-vega-spec`, `JSON.parse`.
   - Determine mode: `'vega-lite'` if element has `vega-lite` class, else `'vega'`.
   - Call `window.vegaEmbed(el, spec, { mode, actions: false, theme: darkMode ? 'dark' : undefined })`.
6. On any failure (parse error, embed rejection, script load failure), replace the element's content with an inline error box (see Error Handling).

### Hydration call sites

Two integrations:

- **Live page view:** `client/themes/default/components/page.vue` mounted hook, alongside the existing Mermaid initialization. Passes `darkMode = this.$vuetify.theme.dark`.
- **Editor preview:** `client/components/editor/editor-markdown.vue` preview render path. Hydration runs after each debounced markdown re-render. Because the preview pane innerHTML is replaced on each render, hydration must re-find the new elements each time. The CDN load promise is cached at module scope, so subsequent runs only pay the embed cost.

### Markup normalization

The two call sites produce different DOM shapes for vega blocks:

- **Live page view:** the server-side `html-vega` / `html-vega-lite` renderers have already rewritten fenced code blocks to `<div class="vega">…</div>` / `<div class="vega-lite">…</div>` before the HTML reaches the browser.
- **Editor preview:** the in-browser `markdown-it` instance produces the default fenced-block markup `<pre><code class="language-vega">…</code></pre>` (or `language-vega-lite`). The server-side renderer does not run on this path.

The hydrator handles both shapes by running a `normalizeRawCodeBlocks` step at the start: any `pre > code.language-vega` / `pre > code.language-vega-lite` is replaced with the equivalent `<div class="vega">` / `<div class="vega-lite">` (using `textContent` to copy the spec text, so no HTML is ever injected). After normalization, the rest of the hydrator only deals with the unified div shape.

This keeps the editor's `markdown-it` configuration untouched — earlier attempts to short-circuit `markdown-it`'s `highlight()` for vega languages failed because `markdown-it` wraps any non-`<pre>` highlight return value in `<pre><code class="language-X">`, defeating the trick.

---

## Bundle Strategy

Vega libraries are **lazy-loaded from a public CDN** (jsdelivr) at runtime. No Vega code is bundled into the Wiki.js webpack output.

Rationale:
- Bundling was attempted first but was abandoned: Vega 6.x / Vega-Lite 6.x / vega-embed 7.x are ESM-only with `exports`-field package metadata and use modern syntax (optional chaining, import attributes) that the existing webpack 4 + babel + terser stack does not support without a substantial upgrade.
- Combined Vega + Vega-Lite + vega-embed is roughly 700 KB gzipped — too large to eagerly include in the main bundle even if bundling were straightforward.
- The CDN approach keeps the cost off pages that don't use charts and avoids the webpack 4 incompatibility entirely.

Tradeoffs accepted (explicit user decision after bundling failed):
- **Airgapped / on-prem deployments without internet egress will not render Vega charts.** The error box will display a "Failed to load Vega library" message.
- A `Content-Security-Policy` configured to restrict `script-src` must allow `cdn.jsdelivr.net` (or the equivalent CDN domain) for chart pages.
- Third-party CDN is now a runtime dependency. Outages on jsdelivr block chart rendering.

The first vega block on a page incurs a one-time CDN load delay (roughly 1–2 seconds depending on network). Subsequent blocks reuse the cached script.

---

## Dependencies

- **No new package.json dependencies.** Vega libraries are loaded at runtime from jsdelivr.
- Versions of `vega`, `vega-lite`, and `vega-embed` are pinned as constants inside `client/components/vega/hydrate.js`.
- Version bumps require editing the helper module and rebuilding (no `yarn upgrade` flow).
- No additional server-side dependencies.

---

## Theming

Pass `theme` to `vega-embed`:
- `'dark'` when `$vuetify.theme.dark` is true.
- `undefined` (vega-embed default) otherwise.

Theme is read once at hydration time. Toggling dark/light mode after a chart renders does **not** re-render the chart — the page must be reloaded for the new palette to apply. This matches existing Mermaid behavior. Live theme reactivity is explicitly out of scope.

---

## Security Model

Trusted-editor model — same as Mermaid and KaTeX:

- Specs are passed straight through to `vega-embed` without sanitization.
- Remote `data.url` references are allowed (vega-embed will fetch them at render time).
- Vega expression parser is enabled (default vega-embed behavior).

Rationale: page editors are already trusted with raw HTML and other dynamic content via existing renderers. Sandboxing Vega specs would block common, legitimate use cases (loading a CSV from a URL, expression-based encodings) without addressing a meaningfully different threat surface than what existing renderers already accept.

This decision is recorded so future work can revisit if the trust model changes (e.g., introducing untrusted contributors).

---

## Error Handling

All failure modes surface a visible inline error box, replacing the chart container's content. The hydrator catches:

1. JSON parse failure on the spec text.
2. `vega-embed` promise rejection (compile errors, runtime errors, remote-data fetch failures).
3. CDN script load failure (network unavailable, blocked by CSP, jsdelivr outage, airgapped deployment).

Error box markup (sketch — actual class names follow existing renderer conventions):

```
<div class="vega-error">
  <strong>Vega render error</strong>
  <p>{message}</p>
  <pre>{original spec text}</pre>
</div>
```

Styling: red 1 px border, padding for readability, monospace `<pre>`. Style lives alongside the helper or in `client/scss/`.

For the dynamic-import failure case, the error is rendered on the first matched element and the failure is logged to `console.error`.

---

## Idempotency

The editor preview re-renders markdown on each edit (debounced). Hydration must be safe to run repeatedly:

- On first run for a given element, copy text content into `data-vega-spec` before calling `embed` (which replaces the element's children).
- On subsequent runs, read from `data-vega-spec` so re-hydration doesn't see the rendered SVG/canvas as the source.
- Each re-run replaces the rendered output via vega-embed's normal call.

Because the editor preview replaces the entire preview pane's innerHTML on each render cycle, in practice the elements seen are fresh — the `data-vega-spec` mechanism is defensive against future changes to the preview pipeline.

---

## Testing

**Server-side unit tests:**

Add tests under `server/test/` (mirror existing renderer test patterns if any are present) confirming each renderer's `init` transforms `<pre class="prismjs"><code class="language-vega">…</code></pre>` into `<div class="vega">…</div>`, and the same for `vega-lite`.

**Manual QA checklist:**

- Live page view: render a Vega-Lite bar chart, render a full Vega scatter, both light and dark mode.
- Editor preview: same charts, confirm hydration after edit + debounce.
- Induced error case: malformed JSON, malformed spec, unreachable remote data URL — confirm error box renders.
- Network tab: confirm CDN scripts do not load on a page without vega blocks; load exactly once on a page with one or more blocks.
- Offline test: simulate CDN unreachable (devtools "Offline" or block jsdelivr.net) and confirm error box appears with "Failed to load Vega library" message.

---

## Out of Scope

- Live theme reactivity (re-rendering on dark/light toggle without reload). Matches Mermaid behavior.
- Custom or user-supplied Vega themes beyond vega-embed's built-ins.
- Spec sandboxing (remote-data restrictions, expression-parser disabling). Trusted-editor model accepted.
- Vega action menu / tooltip customization beyond `actions: false`.
- Server-side pre-rendering. `vega-embed` is browser-only; SSR is not pursued.

---

## File Inventory

New:
- `server/modules/rendering/html-vega/definition.yml`
- `server/modules/rendering/html-vega/renderer.js`
- `server/modules/rendering/html-vega-lite/definition.yml`
- `server/modules/rendering/html-vega-lite/renderer.js`
- `client/components/vega/hydrate.js`
- `client/scss/components/vega.scss`
- `server/test/rendering/vega.test.js`

Modified:
- `client/themes/default/components/page.vue` — call hydrator in mounted hook.
- `client/components/editor/editor-markdown.vue` — call hydrator in preview render path (mounted, processContent, previewShown watcher). The hydrator handles raw `<pre><code class="language-vega">` markup directly — no `markdown-it` `highlight()` modification needed.
- `client/scss/app.scss` — import the new `components/vega` partial.

Not modified:
- `package.json` — no new dependencies (CDN strategy).
