/**
 * The icon each editor is offered under.
 *
 * Shared because three screens now offer the same editors and would otherwise each keep their own
 * copy of this table: the New Page menu, the New Post button on a blog, and the Welcome screen a
 * wiki with no home page yet greets its first author with.
 *
 * WHICH editors are offered, and in what order, is never decided here — `siteStore.activeEditors` and
 * `siteStore.articleEditors` are the only things that answer that, so what a page can be created with
 * and what a search can be filtered by cannot drift apart. This is only what each one looks like.
 *
 * `redirect` is in the table though no site can create one without turning it on, because the table
 * has to cover every editor a page may already have been written with.
 *
 * The names are blueprint icons rather than Iconify references — `BlueprintIcon` resolves one to
 * `img:/_assets/icons/ultraviolet-<name>.svg` — so they are outside the build-time icon scan, and
 * composing one from a variable is safe here in a way it would not be for an `mdi:` name.
 */
export const EDITOR_ICONS = {
  markdown: 'markdown',
  visual: 'google-presentation',
  asciidoc: 'asciidoc',
  excalidraw: 'draw',
  channel: 'chat',
  blog: 'typewriter-with-paper',
  api: 'api',
  redirect: 'advance'
}
