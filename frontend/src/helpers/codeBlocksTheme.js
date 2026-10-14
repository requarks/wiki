/**
 * Every highlight.js theme the admin area offers, as loaders that fetch one on demand.
 *
 * `?inline` hands back the stylesheet as a STRING rather than injecting it: these have to be scoped
 * before they are applied (to the page content in `App.vue`, to the preview on admin/theme), which
 * cannot be done to a stylesheet the bundler has already added to the document. `**` covers the
 * `base16/` family, since that is how the admin's list names half of its options.
 *
 * Only the themes asked for are ever fetched; the rest sit in the build as assets nobody requests.
 */
const HLJS_THEMES = import.meta.glob('../../node_modules/highlight.js/styles/**/*.min.css', {
  query: '?inline',
  import: 'default'
})

/**
 * The stylesheet of a highlight.js theme, as a string, or null for a name highlight.js does not ship.
 *
 * @param {string} name The theme as `codeBlocksTheme` stores it -- `github-dark`, `base16/ashes`.
 */
export async function loadCodeBlocksTheme(name) {
  const load = HLJS_THEMES[`../../node_modules/highlight.js/styles/${name}.min.css`]
  return load ? load() : null
}
