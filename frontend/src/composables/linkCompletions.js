import * as monaco from 'monaco-editor'
import { Range } from 'monaco-editor'

import { isOutsideFences } from '@/helpers/markdownFences'
import { decodeUrlPath, splitLocalePath } from '@/helpers/pagePaths'
import { useSiteStore } from '@/stores/site'

/** How many pages are offered at once. */
const SUGGEST_LIMIT = 5

/** The longest link text searched for, which is as long a query as `pages/suggest` accepts. */
const TEXT_QUERY_MAX = 255

/** How long typing has to pause before the server is asked, so a burst of keys is one request. */
const DEBOUNCE_MS = 150

/**
 * Pages of this wiki offered while the target of a markdown link is typed, as far as the server says
 * the author may read them. Two ways, decided by what follows the `](`:
 *
 * - **Nothing yet** -- `[live collaboration](` offers the pages matching the link's text, by title and
 *   path (`pages/suggest`, so never a page marked as not searchable), and accepting one writes its path.
 *   Links are usually written text first, and the text is often the very title of the page meant.
 * - **A path from the root** -- `[foo](/sam` offers the pages whose path starts with `sam`. Typing the
 *   `/` is what switches from the first to this one.
 *
 * Only after `](`, and in the second case only for a path from the root, which is how the link picker
 * writes a page link too -- a relative href, a URL and an image (`![…](`, which is an asset) are left
 * alone. The pages are the ones in the locale being written in, and the link is written with that
 * locale's prefix, so it addresses the page offered rather than the primary locale's page of the same
 * name. A prefix typed by hand (`/fr/…`) is honoured instead, and kept as it was typed.
 *
 * The list is `incomplete`, so Monaco asks again as the path grows instead of filtering the first
 * answer: the server returns a handful of pages, not every page a later keystroke could narrow to.
 * Typing anything but a `/` after the text's matches therefore closes them, since that is a relative
 * href or a URL being written.
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
      triggerCharacters: ['(', '/'],
      provideCompletionItems
    })
  }

  function dispose() {
    provider?.dispose()
    provider = null
    cache.clear()
  }

  async function fetchPagesByPath(locale, prefix) {
    const key = `path\n${locale}\n${prefix}`
    if (!cache.has(key)) {
      const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/suggest-path`, {
        searchParams: { prefix, locale, limit: SUGGEST_LIMIT }
      }).json()
      cache.set(key, resp?.results ?? [])
    }
    return cache.get(key)
  }

  async function fetchPagesByText(locale, query) {
    const key = `text\n${locale}\n${query}`
    if (!cache.has(key)) {
      const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/suggest`, {
        searchParams: { query, locale, limit: SUGGEST_LIMIT }
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
    // -> The last `[…](` before the caret, with nothing typed since or only a path from the root
    const typed = line.slice(0, position.column - 1).match(/(!?)\[([^\]]*)\]\((\/[^\s()]*)?$/)
    if (!typed || typed[1] || !isOutsideFences(model.getLinesContent(), position.lineNumber - 1)) {
      return none
    }
    const href = typed[3] ?? ''
    // -> No path yet: the link's text is what is searched for, as long as there is some
    const query = href ? '' : typed[2].replace(/\s+/g, ' ').trim().slice(0, TEXT_QUERY_MAX)
    if (!href && !query) {
      return none
    }

    // -> A locale prefix only counts once it is followed by a slash: `/fr` may be `/fresh` half typed
    const split = href.indexOf('/', 1) > 0 ? splitLocalePath(href, siteStore.localePrefixes) : null
    const locale = split?.locale ?? getLocale()
    const typedPrefix = split ? href.slice(0, href.indexOf('/', 1)) : ''
    const linkPrefix = split ? typedPrefix : siteStore.localeUrlPrefix(locale)
    const prefix = href ? decodeUrlPath((split?.path ?? href).slice(1)) : ''

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS))
    if (token.isCancellationRequested) {
      return none
    }
    let pages
    try {
      pages = query ? await fetchPagesByText(locale, query) : await fetchPagesByPath(locale, prefix)
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
        // -> Matched by the text, the title is what the author recognises; by the path, the path is
        label: query
          ? { label: page.title, description: `/${page.path}` }
          : { label: `/${page.path}`, description: page.title },
        kind: monaco.languages.CompletionItemKind.File,
        // -> What the author typed is matched against: the path, with their own prefix if they wrote
        //    one. With no path typed there is nothing at the caret to match, and every page is kept.
        filterText: `${typedPrefix}/${page.path}`,
        // -> The server's order, best match or shallowest first, rather than Monaco's fuzzy score
        sortText: String(idx).padStart(3, '0'),
        insertText: `${linkPrefix}/${page.path}`,
        range
      }))
    }
  }

  return { register, dispose }
}
