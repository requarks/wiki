# AntV Infographic Renderer — Design Spec

**Date:** 2026-05-11
**Status:** Approved
**Author:** Tayeb Chlyah

---

## Goal

Add support for [AntV Infographic](https://github.com/antvis/infographic) diagrams in Wiki.js pages via fenced code blocks, using the official `@antv/infographic` library. Infographics render in both the live page view and the markdown editor preview.

---

## Context

Wiki.js already supports several embedded visualization syntaxes (Mermaid, Vega, Vega-Lite) via the same pattern: server-side renderer rewrites fenced blocks into a placeholder `<div>`, and the client mounts a JS library on those divs after the page loads.

This spec follows the [Vega/Vega-Lite renderer spec](./2026-05-09-vega-renderer-design.md) wherever the two libraries are similar, and deviates where AntV Infographic differs:

- The body is a custom indentation-sensitive DSL (not JSON).
- The library constructor requires explicit `width` and `height` (no auto-sizing from spec).
- The library exposes built-in themes (`default`, `light`, `dark`, `gradient`, `pattern`, `hand-drawn`) selectable via a string option.
- The output is SVG and the library is fault-tolerant to partial input (supports streaming render).

---

## Markdown Syntax

A single fenced-code language with optional whitespace-separated `key=value` parameters in the info string:

````markdown
```infographic
infographic list-row-simple-horizontal-arrow
data
  lists
    - label Step 1
      desc Start
    - label Step 2
      desc Complete
```

```infographic height=600 theme=hand-drawn
infographic ...
```
````

Recognized info-string keys: `height`, `width`, `theme`. Unknown keys are ignored. Body whitespace is preserved verbatim (the DSL is indentation-sensitive).

---

## Architecture

### Markdown preprocessor module

A markdown-it preprocessor — modeled on `server/modules/rendering/markdown-kroki/` — captures the fenced block before the default `fence` rule sees it, so the info string is preserved.

- `server/modules/rendering/markdown-infographic/`
  - `definition.yml`: `key: markdownInfographic`, `dependsOn: markdownCore`, `enabledDefault: true`, no props.
  - `renderer.js`: `init(mdinst, conf)` that calls `mdinst.use(require('./plugin'))`.
  - `plugin.js`: markdown-it plugin. Registers a block rule with `md.block.ruler.before('fence', 'infographic', ...)` matching ` ```infographic [params]\n{body}\n``` `. Emits a custom `infographic` token whose renderer rule outputs:

    ```html
    <div class="infographic" data-opts="{escaped params}">{escaped body text}</div>
    ```

  - Body text is HTML-escaped (no script injection possible). The `data-opts` attribute value is also escaped.

No `html-infographic` cheerio post-processing module is needed — the preprocessor produces final markup directly.

### Editor preview parity

The editor preview uses its own in-browser `markdown-it` instance (see `client/components/editor/editor-markdown.vue`). The same `plugin.js` is imported and applied there so the editor and the live page produce identical markup for infographic blocks:

```
import infographicPlugin from '../../../server/modules/rendering/markdown-infographic/plugin'
md.use(infographicPlugin)
```

The cross-tree import (client file pulling from `server/`) is accepted to avoid a shared/ directory or duplicate plugin source. Webpack bundles the plugin into the client output normally. This single cross-tree import is documented here so future maintainers don't treat it as a mistake.

### Client hydrator

`client/components/infographic/hydrate.js` exports:

```
hydrateInfographic(rootEl, { darkMode })
```

Behavior:

1. Query `rootEl.querySelectorAll('.infographic:not([data-infographic-rendered])')`.
2. If empty, return immediately.
3. Lazily inject one `<script>` from `cdn.jsdelivr.net/npm/@antv/infographic@VERSION/dist/infographic.min.js`. The pinned version is a module-scope constant. The script registers `window.AntVInfographic`. The load promise is cached at module scope so subsequent calls reuse the same script.
4. For each matched element:
   - On first hydration, copy the element's `textContent` into `data-infographic-spec`.
   - Parse `data-opts`: split on whitespace, then on `=`. Allowed keys: `height`, `width`, `theme`. Other keys ignored.
   - Mark `data-infographic-rendered="1"` and clear the element's children.
   - Compute final options:
     - `container: el`
     - `width: opts.width || '100%'`
     - `height: opts.height || 480`
     - `theme: opts.theme || (darkMode ? 'dark' : undefined)`
     - `editable: false`
   - Construct `new AntVInfographic.Infographic(finalOpts)` and call `.render(spec)` where `spec` is the value of `data-infographic-spec`.
5. On any failure (opts parse error, constructor throw, render throw/reject, script load failure), replace the element's content with an inline error box.

### Hydration call sites

Two integrations, identical to the vega renderer pattern:

- **Live page view:** `client/themes/default/components/page.vue` mounted hook. Passes `darkMode = this.$vuetify.theme.dark`.
- **Editor preview:** `client/components/editor/editor-markdown.vue` preview render path (mounted, processContent, previewShown watcher). Hydration runs after each debounced markdown re-render.

### Markup uniformity

Because both server and editor use the same preprocessor plugin, both paths produce the same `<div class="infographic" data-opts="…">` markup. No `normalizeRawCodeBlocks` step is needed (unlike the vega renderer, which uses one to bridge the editor's default fenced-block markup).

---

## Bundle Strategy

`@antv/infographic` is **lazy-loaded from a public CDN** (jsdelivr) at runtime. No infographic code is bundled into the Wiki.js webpack output.

Rationale (same as vega):

- Webpack 4 has known issues with modern ESM packages. CDN avoids the toolchain question.
- The minified UMD bundle is ~870 KB (the library bundles ~200 templates plus SVG rendering). Too large to eagerly include in the main bundle.
- CDN keeps the cost off pages without infographics.

Tradeoffs accepted:

- **Airgapped / on-prem deployments without internet egress will not render infographics.** The error box will display a "Failed to load infographic library" message.
- A `Content-Security-Policy` configured to restrict `script-src` must allow `cdn.jsdelivr.net`.
- Third-party CDN is a runtime dependency. jsdelivr outages block rendering.

The first infographic block on a page incurs a one-time CDN load delay. Subsequent blocks reuse the cached script.

---

## Dependencies

- **No new `package.json` dependencies.** The library is loaded at runtime.
- The pinned version of `@antv/infographic` lives as a constant in `hydrate.js`.
- Version bumps require editing the helper module and rebuilding (no `yarn upgrade` flow).
- No additional server-side dependencies.

---

## Theming

The `theme` option resolves in priority order:

1. Per-block `data-opts theme=…` value (any string the library accepts).
2. Otherwise: `'dark'` when `$vuetify.theme.dark` is true, `undefined` (library default) when false.

Theme is read once at hydration time. Toggling dark/light mode after an infographic renders does **not** re-render it — the page must be reloaded. Matches existing Mermaid and Vega behavior.

Known built-in theme names (from inspection of the UMD bundle): `default`, `light`, `dark`, `gradient`, `pattern`, `hand-drawn`. The hydrator does not validate; it passes the string through.

---

## Security Model

Trusted-editor model — identical to Vega and Mermaid:

- The DSL body is passed straight to `Infographic.render()` without sanitization.
- Page editors are already trusted with raw HTML and dynamic content via existing renderers.
- The library renders to SVG and does not evaluate user-supplied JavaScript expressions, so the surface is narrower than Vega's.

This decision is recorded so future work can revisit if the trust model changes (e.g., introducing untrusted contributors).

---

## Error Handling

All failure modes surface a visible inline error box, replacing the chart container's content. The hydrator catches:

1. `data-opts` parse failure.
2. `Infographic` constructor throw.
3. `.render()` throw or returned-promise rejection.
4. CDN script load failure.

Error box markup (sketch — actual class names follow existing renderer conventions):

```
<div class="infographic-error">
  <strong>Infographic render error</strong>
  <p>{message}</p>
  <pre>{original spec text}</pre>
</div>
```

Styling: red 1 px border, padding for readability, monospace `<pre>`. Lives in `client/scss/components/infographic.scss`.

For the CDN load failure case, the error is rendered on the first matched element and the failure is logged to `console.error`. Subsequent elements on the same page get their own error boxes.

The library is documented as fault-tolerant to partial input (it supports streaming render). Malformed-but-non-throwing input will render a partial result rather than trigger the error box.

---

## Idempotency

The editor preview re-renders markdown on each edit (debounced). Hydration is safe to run repeatedly:

- On first run, the element's `textContent` is copied into `data-infographic-spec`, and `data-infographic-rendered="1"` is set.
- Subsequent runs skip elements already marked rendered. They are re-found anew when the preview pane's innerHTML is replaced.
- This combination matches the vega renderer's defensive idempotency model.

---

## Testing

**Server-side unit tests:**

Add `server/test/rendering/infographic.test.js`. Confirms the preprocessor transforms:

- ` ```infographic\n{body}\n``` ` → `<div class="infographic" data-opts="">{escaped body}</div>`
- ` ```infographic height=600 theme=hand-drawn\n{body}\n``` ` → `<div class="infographic" data-opts="height=600 theme=hand-drawn">{escaped body}</div>`
- HTML-escaping of body and `data-opts` values is verified.

**Manual QA checklist:**

- Live page view: render `list-row-simple-horizontal-arrow` template, both light and dark mode, with and without `data-opts`.
- Editor preview: same content, confirm hydration after edit + debounce.
- Per-block theme: render with `theme=hand-drawn`, confirm override.
- Per-block sizing: render with `height=600 width=800`, confirm dimensions.
- Network tab: confirm CDN script does not load on a page without infographic blocks; loads exactly once on a page with one or more.
- Offline test: block `cdn.jsdelivr.net` and confirm error box appears.

---

## Out of Scope

- Live theme reactivity (re-render on dark/light toggle without reload). Matches Mermaid/Vega behavior.
- Editable infographics (`editable: false` is hardcoded; the built-in editor is not exposed in wiki pages).
- Custom AntV plugins or interactions (`plugins` / `interactions` constructor options not surfaced).
- Server-side pre-rendering. The library is browser-only.
- A shared/ directory or build-time codegen to avoid the cross-tree `plugin.js` import. Accepted as a single, documented exception.

---

## File Inventory

New:
- `server/modules/rendering/markdown-infographic/definition.yml`
- `server/modules/rendering/markdown-infographic/renderer.js`
- `server/modules/rendering/markdown-infographic/plugin.js`
- `client/components/infographic/hydrate.js`
- `client/scss/components/infographic.scss`
- `server/test/rendering/infographic.test.js`

Modified:
- `client/themes/default/components/page.vue` — call `hydrateInfographic` in mounted hook.
- `client/components/editor/editor-markdown.vue` — import `plugin.js`, call `md.use(infographicPlugin)`, call `hydrateInfographic` in the preview render path.
- `client/scss/app.scss` — import the new `components/infographic` partial.

Not modified:
- `package.json` — no new dependencies (CDN strategy).
