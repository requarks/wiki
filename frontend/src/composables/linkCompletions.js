import * as monaco from 'monaco-editor'
import { Range } from 'monaco-editor'

import { isOutsideFences } from '@/helpers/markdownFences'
import { decodeUrlPath, splitLocalePath } from '@/helpers/pagePaths'
import { useSiteStore } from '@/stores/site'

/** How many pages are offered at once. */
const SUGGEST_LIMIT = 5

/** How long typing has to pause before the server is asked, so a burst of keys is one request. */
const DEBOUNCE_MS = 150

/**
 * Pages of this wiki offered while the target of a markdown link is typed: `[foo](/sam` offers the
 * pages whose path starts with `sam`, as far as the server says the author may read them.
 *
 * Only after `](` and only for a path from the root, which is how the link picker writes a page link
 * too -- a relative href, a URL and an image (`![…](`, which is an asset) are left alone. The pages are
 * the ones in the locale being written in, and the link is written with that locale's prefix, so it
 * addresses the page offered rather than the primary locale's page of the same name. A prefix typed by
 * hand (`/fr/…`) is honoured instead, and kept as it was typed.
 *
 * The list is `incomplete`, so Monaco asks again as the path grows instead of filtering the first
 * answer: the server returns a handful of pages, not every page a later keystroke could narrow to.
 *
 * Call it during `setup`. Then `register()` once the editor exists, and `dispose()` with the editor.
 *
 * @param {object} opts
 * @param {() => object} opts.getEditor The Monaco editor, once there is one.
 * @param {() => string} opts.getLocale The locale of the page being edited.
 */
export function useLinkCompletions({ getEditor, getLocale }) {
  const siteStore = useSiteStore()

  /** Registered against the language rather than this editor; see `useTagCompletions`. */
  let provider = null

  /** Answers already fetched, by locale and prefix, so that backspacing asks the server nothing. */
  const cache = new Map()

  function register() {
    provider = monaco.languages.registerCompletionItemProvider('markdown', {
      triggerCharacters: ['/'],
      provideCompletionItems
    })
  }

  function dispose() {
    provider?.dispose()
    provider = null
    cache.clear()
  }

  async function fetchPages(locale, prefix) {
    const key = `${locale}\n${prefix}`
    if (!cache.has(key)) {
      const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/suggest-path`, {
        searchParams: { prefix, locale, limit: SUGGEST_LIMIT }
      }).json()
      cache.set(key, resp?.results ?? [])
    }
    return cache.get(key)
  }

  async function provideCompletionItems(model, position, context, token) {
    const none = { suggestions: [] }
    if (model !== getEditor()?.getModel()) {
      return none
    }
    const line = model.getLineContent(position.lineNumber)
    // -> The last `[…](` before the caret, with nothing typed since but a path from the root
    const typed = line.slice(0, position.column - 1).match(/(!?)\[[^\]]*\]\((\/[^\s()]*)$/)
    if (!typed || typed[1] || !isOutsideFences(model.getLinesContent(), position.lineNumber - 1)) {
      return none
    }
    const href = typed[2]

    // -> A locale prefix only counts once it is followed by a slash: `/fr` may be `/fresh` half typed
    const split = href.indexOf('/', 1) > 0 ? splitLocalePath(href, siteStore.localePrefixes) : null
    const locale = split?.locale ?? getLocale()
    const typedPrefix = split ? href.slice(0, href.indexOf('/', 1)) : ''
    const linkPrefix = split ? typedPrefix : siteStore.localeUrlPrefix(locale)
    const prefix = decodeUrlPath((split?.path ?? href).slice(1))

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS))
    if (token.isCancellationRequested) {
      return none
    }
    let pages
    try {
      pages = await fetchPages(locale, prefix)
    } catch {
      // -> Nothing to offer; the link picker is still there, and a failure is not worth an error here
      return none
    }
    if (token.isCancellationRequested) {
      return none
    }

    // -> Accepting with Tab or Enter inserts at the caret; the replace mode also takes the rest of the
    //    path after it, for a link being corrected rather than written
    const start = position.column - href.length
    const after = line.slice(position.column - 1).match(/^[^\s()]*/)[0]
    const range = {
      insert: new Range(position.lineNumber, start, position.lineNumber, position.column),
      replace: new Range(
        position.lineNumber,
        start,
        position.lineNumber,
        position.column + after.length
      )
    }
    return {
      incomplete: true,
      suggestions: pages.map((page, idx) => ({
        label: { label: `/${page.path}`, description: page.title },
        kind: monaco.languages.CompletionItemKind.File,
        // -> What the author typed is matched against: the path, with their own prefix if they wrote one
        filterText: `${typedPrefix}/${page.path}`,
        // -> The server's order, shallowest first, rather than Monaco's fuzzy score
        sortText: String(idx).padStart(3, '0'),
        insertText: `${linkPrefix}/${page.path}`,
        range
      }))
    }
  }

  return { register, dispose }
}
