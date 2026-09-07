import { fileSave } from 'browser-fs-access'

import { MarkdownRenderer } from '@/renderers/markdown'

/**
 * What a recorded page version is, to the two screens that show one.
 *
 * The history overlay and the version view both have to answer the same questions about a version --
 * what format was it written in, what does its source save as, and what HTML does it become -- and
 * they used to answer them separately. The format question alone is asked six times between them
 * (colouring a diff, two renders, two downloads, a restore), so it lives here once.
 *
 * Nothing here touches a store or the i18n catalogue, which is what keeps it a helper: a caller
 * supplies the renderer config it already holds, and reports failures in its own words.
 */

/** What a version's source is saved as, by the format it was written in. */
const FILE_TYPES = {
  markdown: { ext: 'md', mime: 'text/markdown' },
  html: { ext: 'html', mime: 'text/html' }
}

/** For a format nothing here knows: plain text saves and reads as itself. */
const FALLBACK_TYPE = { ext: 'txt', mime: 'text/plain' }

/**
 * The format a version was written in -- which decides how it colours, how it renders and what it
 * downloads as.
 *
 * Read off the VERSION and never off the page it belongs to: a page converted from markdown to HTML
 * since is still a markdown version, and asking the page would render it as the wrong thing.
 *
 * `meta.contentType` is what `pageHistory.record` writes for every version, so the rest is belt and
 * braces for a row that somehow lacks it.
 *
 * @param {object} version A version as the API returns one.
 * @returns {string} `markdown`, `html`, or whatever the version claims.
 */
export function versionContentType(version) {
  return version?.meta?.contentType || version?.meta?.editor || 'markdown'
}

/**
 * Save a version's source to a file the reader picks.
 *
 * Named for the page and the moment -- `notes-2026-09-07-03-30-38.md` -- because a folder of
 * `page.md` files says nothing about which page or which version each one is.
 *
 * @param {object} version A version WITH its `content`; the history list alone does not carry it.
 * @returns {Promise<boolean>} True once written, false if the reader dismissed the picker. Anything
 *   that actually went wrong is thrown, for the caller to report in its own words.
 */
export async function saveVersionSource(version) {
  const type = FILE_TYPES[versionContentType(version)] ?? FALLBACK_TYPE
  const name = version.path?.split('/').at(-1) || 'page'
  const stamp = (version.versionDate ?? '').slice(0, 19).replace(/[:T]/g, '-')
  try {
    /*
      A bare MIME type, with no `;charset=` on it: the save picker uses this as an `accept` key and
      rejects a type carrying parameters outright. Nothing is lost by dropping it -- a Blob built from
      a JS string is UTF-8 already.
    */
    await fileSave(new Blob([version.content ?? ''], { type: type.mime }), {
      fileName: `${name}-${stamp}.${type.ext}`,
      extensions: [`.${type.ext}`]
    })
    return true
  } catch (err) {
    // -> Dismissing the file picker is not a failure, and nothing should be said about it
    if (err.name === 'AbortError') {
      return false
    }
    throw err
  }
}

/**
 * A version's source as the HTML a page stores.
 *
 * Produced on this side for the same reason every save produces it here: the markdown pipeline is a
 * frontend one, and the server would otherwise have to drive a headless browser. A version records
 * the source it held and not the render, so there is nothing stored to use instead.
 *
 * The config is passed IN rather than read from `stores/editor` here, because no other helper in this
 * directory reaches for a store and this is not the file to start in. The caller has it already, and
 * has to make sure it is loaded (`editorStore.fetchConfigs()`) before asking.
 *
 * @param {object} version A version WITH its `content`.
 * @param {object} options
 * @param {object} options.markdownConfig `editorStore.editors.markdown` — per-site renderer settings
 *   (line breaks, typographer, …).
 * @param {string} options.pagePath The page this HTML is FOR, which is what a relative image in it
 *   resolves against. Not always the version's own `path`: content being restored onto a page that
 *   has since moved belongs to where that page is now.
 * @returns {string} The HTML, or the source unchanged for a format this does not render.
 */
export function renderVersionSource(version, { markdownConfig, pagePath }) {
  const content = version?.content ?? ''
  if (versionContentType(version) !== 'markdown') {
    return content
  }
  return new MarkdownRenderer(markdownConfig ?? {}).render(content, { pagePath })
}
