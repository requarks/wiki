---
paths:
  - "frontend/src/editor/excalidraw/**"
  - "frontend/src/components/EditorExcalidraw.vue"
  - "frontend/src/css/_page-contents.scss"
  - "frontend/vite.config.js"
  - "backend/core/collab.ts"
  - "backend/models/rendering.ts"
---

# Drawings (the Excalidraw editor)

A page whose whole body is one drawing, written with `excalidraw` and stored as the `.excalidraw`
document Excalidraw itself writes. `frontend/src/editor/excalidraw/` is the whole of it, plus
`EditorExcalidraw.vue` for the Vue side.

**This is the only React in the app, and it is quarantined.** Excalidraw is a React application and
there is no Vue port worth having, so `editor/excalidraw/index.js` owns `react`, `react-dom` and
`@excalidraw/excalidraw`, and nothing else imports any of them. `EditorExcalidraw.vue` hands it a
`<div>` and gets back a plain object of methods. There is no JSX and no JSX toolchain —
`createElement` is called directly, which one component can afford. Both are reached only through the
`defineAsyncComponent` in `pages/Index.vue`, so ~405 kB gzipped is fetched the first time somebody
opens a drawing and never on an instance that has none.

**A reader never loads any of it.** The page's `render` is an SVG the editor exported at save time,
which is the same bargain the markdown pipeline already makes — a page's HTML is produced once, by
the browser that changed it. Three things follow, and each is load-bearing:

- **The drawing is exported LIGHT, always**, and `_page-contents.scss` inverts it under `.body--dark`
  with Excalidraw's own `THEME_FILTER`. Excalidraw does dark mode by inverting the finished picture
  rather than by recolouring what is in it, so an export made at night has the filter baked onto its
  root element — stored that way it would be a photographic negative for every reader on a light
  page. One stored render, two themes to serve it in; `exportSceneSvg` and that rule have to stay in
  step.
- **`skipInliningFonts` is on**, so the SVG names its fonts instead of carrying a base64 copy of each
  one. The `@font-face` rules a reader needs are generated at build time from the Excalidraw package
  by `excalidrawAssets` in `vite.config.js` and imported by `main.js` — about a kilobyte, fetching no
  font until a glyph calls for one. It also keeps the font subsetter out of the bundle, which is a
  megabyte of WebAssembly-in-JavaScript for a job nothing here needs done.
- **The fonts are served from `/_assets/excalidraw/`**, declared as `window.EXCALIDRAW_ASSET_PATH`
  before Excalidraw loads (`assetPath.js`, a side-effect module imported first for exactly that).
  Excalidraw appends its own CDN as a fallback even when that is set, so shipping the complete set is
  the only thing that keeps a reader's browser at home — which is what `offline` is about. **Xiaolai
  is deliberately not shipped**: 13 MB for Excalidraw's CJK handwriting fallback, so a drawing with
  CJK text in it needs the internet. One name in `EXCALIDRAW_SKIPPED_FONTS` reverses that.

**An image inside a drawing is an asset, not base64.** Excalidraw keeps pictures in a `files` map as
data URLs; left alone that puts a screenshot in the `content` column and in every version of the page
for ever. Nothing about that field requires a `data:` — it is assigned to `img.src` and written as an
SVG `href` — so a pasted image goes through `editorStore.addPendingAsset` like a markdown one, and
the upload just before a save rewrites it. Note `addFiles` deliberately ignores an id it already
holds, so repointing an image means giving it a NEW file id; the abandoned entry is dropped by
`serializeScene`, which keeps only the files an element uses.

**Collaboration is the existing room with a third shared type** — read `core/collab.ts` and
`editor/visual/collab.js` first. Elements live in a `Y.Map` keyed by id rather than a `Y.Array`,
because z order is carried by each element's own fractional `index` and there is no array position
for two authors to fight over. The seed is built client-side under `SEED_CLIENT_ID = 2`; the server's
is 0 and ProseMirror's is 1, and a seed reusing an id the document has seen is discarded in silence.
`buildSeed` on the server skips `content` for a canvas editor (`CANVAS_EDITORS`), since a scene is
tens of kilobytes of JSON that no client would ever bind to.

**The sanitizer had to learn two things** (`models/rendering.ts`): the inert text and font attributes
an export puts on every `text` element, and the `image` element. Neither grants anything new — `href`
is scheme-checked like every other link, and `img` beside it could always fetch a picture. `data:` is
not an allowed scheme, which is the other half of why images go to the asset store. `extractText`
also puts a space after each `svg text`, because an export writes every LINE as a `text` of its own
and a two-line label came out as one unsearchable run of letters.

Ctrl+S does not save here, the same as in the Visual and Redirection editors: that shortcut is a
Monaco keybinding, not something each editor implements.
