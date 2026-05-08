# Maturity Matrix Editor Integration — Design Spec

**Date:** 2026-05-08  
**Status:** Approved  
**Author:** Tayeb Chlyah

---

## Goal

Integrate the Couchbase Use Case Maturity Assessment Matrix HTML tool into the Wiki.js markdown editor, following the same pattern as the existing draw.io integration. Users can insert a new matrix or edit an existing one via a visual editor, with the result stored as readable markdown in the wiki page.

---

## Context

The draw.io integration (`editor-modal-drawio.vue`) serves as the reference pattern:
- A sidebar button opens a full-screen iframe
- The iframe communicates with the Vue component via `postMessage`
- The result is stored as a fenced code block in the markdown
- `processMarkers` in `editor-markdown.vue` detects the stored block and renders an "Edit Diagram" inline button

The maturity matrix integration follows this pattern with one key difference: the stored format is plain readable markdown (tables + summary scores), not base64 binary, making it parseable by any tool or AI.

---

## Storage Format

When saved, the wiki page contains:

```
<!--maturity-matrix-->
# Use Case Maturity Assessment Matrix

**Customer:** <value>
**Use Case:** <value>
**Generated:** <timestamp>

---

## Summary Scores

| Section | Score | Status |
...

---

## <SectionName>

**Section Score:** ...

```vega
{...radar chart JSON spec...}
```

| KPI | Score | Weight | Final | Max | Applicable | Notes | Action Plan |
|-----|-------|--------|-------|-----|------------|-------|-------------|
| <kpi name> | <N> (<label>) | <N> (<label>) | <N> | <N> | Y/N | <text> | <text> |
...

<!--/maturity-matrix-->
```

**In the rendered wiki view:** the HTML comments are invisible, the markdown tables and headings render natively. No custom renderer required. Vega blocks render as interactive charts if the vega plugin is active, otherwise as code blocks.

**In the CodeMirror editor:** `processMarkers` detects the `<!--maturity-matrix-->` opening comment and replaces it visually with an "Edit Maturity Matrix" inline button widget. The content lines remain visible as markdown (unlike draw.io's full fold — readable tables are useful to see).

---

## HTML Tool Changes (`client/static/maturity-matrix/index.html`)

The HTML is copied from `UCMAMv1_1_1_16.html` into `client/static/maturity-matrix/index.html`, then modified to become a pure wiki component. It no longer needs standalone save behavior.

### Removals
- `buildUpdatedHtml()` function
- `saveData()` function (file download / File System Access API logic)
- `exportMarkdown()` function (standalone markdown download)
- "Export Markdown" button from topbar
- "Save" button replaced (see below)

### Additions

**Topbar:** Replace "Save" button action with a call to `saveToWiki()`. Add a "Close" button that sends `{ event: 'exit' }` to the parent.

**`buildMarkdown()` function:** Extracted from `exportMarkdown()` — same logic but returns the markdown string instead of triggering a download.

**`saveToWiki()` function:** Calls `buildMarkdown()` and sends `{ event: 'save', markdown }` to the parent via `window.parent.postMessage`.

**`parseMarkdown(markdownString)` function:** Reconstructs `state` from a previously saved markdown block. Line-by-line parser:
- Extracts `customer` from `**Customer:** ...` line
- Extracts `useCase` from `**Use Case:** ...` line  
- Skips ```` ```vega ``` ```` blocks entirely
- Skips `## Summary Scores` section
- For each `## SectionName` heading: looks up known section template (Performance/Availability/Excellence) to get `id`/`color`/`pill`; unknown names get a neutral custom section
- For each KPI table row under a section: parses all 8 columns (name, score, weight, final, max, applicable, notes, action) and pushes a KPI object with a fresh `id` via `++nextId`
- Dash `—` values in notes/action columns converted back to empty string
- After parsing: sets the DOM input values for customer and use case fields

**`postMessage` listener** (added near bottom, before `render()` call):
- Sends `{ event: 'ready' }` immediately to signal the iframe is ready
- Listens for `{ action: 'init', markdown: string | null }`:
  - If `markdown` is a non-empty string: call `parseMarkdown(markdown)` then `render()`
  - If `markdown` is null/absent: call `render()` only (default example state unchanged)

**`Cmd/Ctrl+S` keybind:** Updated to call `saveToWiki()` instead of `saveData()`.

**`localStorage`:** Keep existing read-on-init behavior (harmless, provides sensible defaults for the example state).

---

## New Vue Component: `editor-modal-maturitymatrix.vue`

Location: `client/components/editor/editor-modal-maturitymatrix.vue`

Modeled exactly on `editor-modal-drawio.vue`:

- Full-screen fixed overlay (`position: fixed`, `z-index: 10`, `width: 100%`, `height: 100vh`)
- Single `<iframe>` pointing to `/_assets/maturity-matrix/index.html`
- Reads `activeModalData` and `activeModal` from Vuex store (same keys used by draw.io)
- On `mounted`: registers `window` message listener
- On `beforeDestroy`: removes message listener
- Message handler:
  - `ready` → send `{ action: 'init', markdown: activeModalData }` to iframe (null if inserting new)
  - `save` → emit `editorInsert` with `{ kind: 'MATURITY_MATRIX', markdown: msg.markdown }`, then close modal
  - `exit` → close modal (set `activeModal` to empty string)

---

## `editor-markdown.vue` Changes

### 1. Sidebar button

Add below the existing "Insert Diagram" button:
- Icon: `mdi-table-check` (or similar matrix/grid icon)
- Tooltip: "Insert Maturity Matrix"  
- Click: set `activeModalData = null`, call `toggleModal('editorModalMaturityMatrix')`

### 2. `processMarkers` extension

Extend the existing line-scanning loop to detect maturity matrix blocks:

- When a line starts exactly with `<!--maturity-matrix-->`: record start line, begin searching for end marker
- When a line starts exactly with `<!--/maturity-matrix-->`: 
  - Call `addMarker` with kind `'maturity-matrix'`, `from = { line: startLine, ch: 0 }`, `to = { line: startLine, ch: length of that line }`, text `'Edit Maturity Matrix'` — replaces the full comment text with the widget button
  - Click action: select from start line (inclusive) to end line (inclusive), extract all lines between the two comment lines as a single markdown string, set `activeModalData` to that string, call `toggleModal('editorModalMaturityMatrix')`
- Unlike draw.io, do **not** fold the block — the markdown tables between the markers are useful to read in the editor

### 3. `editorInsert` handler extension

Add `MATURITY_MATRIX` case in the existing `$root.$on('editorInsert', ...)` handler:

- Wrap `opts.markdown` with the two comment lines: `<!--maturity-matrix-->\n` + markdown + `\n<!--/maturity-matrix-->`
- Replace the current editor selection with this wrapped content (same pattern as `DIAGRAM` case)
- Call `processMarkers` on the affected line range so the "Edit Maturity Matrix" button appears immediately

---

## `editor.vue` Changes

Register the new modal component alongside existing modals:

```
editorModalMaturityMatrix: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-maturitymatrix.vue')
```

---

## Data Flow Summary

```
INSERT NEW
User clicks "Insert Maturity Matrix"
  → activeModalData = null, modal opens
  → iframe loads, sends ready
  → Vue sends { action: 'init', markdown: null }
  → HTML renders default example state
  → User edits, clicks Save
  → HTML sends { event: 'save', markdown }
  → Vue emits editorInsert(MATURITY_MATRIX)
  → Editor inserts <!--maturity-matrix--> + markdown + <!--/maturity-matrix-->
  → processMarkers adds "Edit Maturity Matrix" widget

EDIT EXISTING
User clicks "Edit Maturity Matrix" widget
  → Inner markdown extracted from between comment markers
  → activeModalData = markdown, modal opens
  → iframe loads, sends ready
  → Vue sends { action: 'init', markdown }
  → HTML calls parseMarkdown(markdown), renders restored state
  → User edits, clicks Save
  → HTML sends { event: 'save', markdown }
  → Vue emits editorInsert(MATURITY_MATRIX)
  → Editor replaces selected block (start comment → end comment)
  → processMarkers re-adds widget
```

---

## Constraints & Notes

- No server-side changes needed
- No custom renderer needed at this stage — markdown tables render natively
- `activeModalData` Vuex key is reused (already exists for draw.io, set to `null` between uses)
- `nextId` in the HTML must be set to `max(all parsed KPI ids) + 1` at the end of `parseMarkdown` to avoid id collisions when the user adds KPIs after editing
- The `client/static/` directory is copied verbatim to `assets/` at build time (webpack `CopyWebpackPlugin`), so the HTML and any companion assets go there
- The iframe origin is same-host so no cross-origin `postMessage` restrictions apply in production
- DOMPurify is not needed for the maturity matrix (no SVG injection — output is markdown text)
