# `blocks/`

Self-contained Lit components. Each lives in `blocks/block-<name>/component.js` — the glob in
`rollup.config.mjs` picks up any directory matching `block-*` automatically, so a new block needs no
config change. Output goes to `blocks/compiled/`, which the backend serves under `/_blocks/` —
alongside the blocks a site has imported as packages, see [Distributing a block](../.claude/rules/distributing-blocks.md).
Blocks are loaded dynamically at runtime, which is why `_blocks/**` is excluded from
Vite's `dynamicImportVarsOptions`. A block pulling in a heavy library is fine — nothing is fetched
until its tag turns up in a page — and a library that still ships CommonJS works too, since the
rollup config runs `@rollup/plugin-commonjs` after `resolve()`.

Blocks style themselves off `:host` and read the theme colors via CSS custom properties
(`var(--q-primary)` — the `--q-` prefix is historical; the properties are declared in
`css/tailwind.css` and rewritten at runtime for per-site theming).

**Except where the block's content IS the thing being styled**, which is `block-tab` and
`block-steps`: both leave what they hold in the light DOM, because it is page content and has to be
drawn by the article's own stylesheet. A shadow root cannot reach into it either — `::slotted()`
matches the slotted element and nothing below it, so a slotted `<ol>`'s `<li>` items are already out
of range — so their appearance lives in `frontend/src/css/_page-contents.scss` with the rest of the
content typography, and the component itself is a plain `HTMLElement` carrying the definition. Don't
copy that shape for a block that draws its own furniture; a shadow root is still the default.

**Dark mode goes through `blocks/shared/theme.js`, never `:host-context()`.** The app's source of
truth is the `body--dark` class on `<body>`, which CSS in a shadow root cannot see; `:host-context()`
is the selector for exactly that and is what every block used to use, but only Chromium ever shipped
it — MDN has it deprecated, Firefox and Safari never implemented it, and there it silently never
matches, so the block stayed light on a dark page. Instead construct a `DarkMode` controller
(`this._darkMode = new DarkMode(this)`) in the block's constructor and write `:host([dark])`; the
controller keeps that attribute in step, sharing one MutationObserver across every block on the page.
A block that must *act* on the change rather than restyle for it passes `onChange`, or reads
`.isDark` — `block-diagram` redraws mermaid in its own dark theme, `block-map` resolves a per-block
`theme` prop that can pin a map light on a dark page.

**An inline block sits in a line of text** — `block-badge`, `block-color`, `block-kbd`,
`block-progress`, `block-timestamp`, `block-unit`. It declares
`inline: true` in its `static definition`, and is written `:block-color[#ff6600]{…}` in markdown
(`renderers/modules/markdown-it-inline-blocks.js`) and `block-color:[#ff6600, …]` in AsciiDoc (the
`wikiblock` macro in `renderers/asciidoc.js`); both render `<block-color …>#ff6600</block-color>`.
The value between the brackets is the element's TEXT, never a prop: that is what shows before the
component loads, in the search index, and on a site that switched the block off (the sanitiser drops
the tag and keeps the text). So the component reads its value from `textContent` before its first
render (`willUpdate` with `!this.hasUpdated`), renders it in a shadow root with no `<slot>`, and is
`display: inline`. Its `template` is the starting value an editor puts between the brackets. The
picker sends it as `insertInlineBlock`, inserted at the caret rather than on a line of its own; the
Visual editor draws one as its component (an `inline_block` node, `InlineBlockView`), and a
double-click opens `BlockParamsDialog` over its value and its props together. The source editors complete
its name after `:block-` (markdown) or `block-` (AsciiDoc) anywhere in a line, and its props inside
the `{…}` or after the value's comma — only inline blocks there, and never one after `::block-`.
A block tinted from the theme (`block-badge`, `block-progress`) takes a `color` select and paints
it with `toneColor` from `shared/tones.js`; the options are still listed in each definition, which
has to stay plain literals for the manifest.
