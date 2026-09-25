// -> Relative, like the renderers' other in-repo imports: this module is reachable from the headless
//    renderer bundle, which is built on its own
import { normalizePagePath } from '../../helpers/pagePaths'

/**
 * MediaWiki's link syntax: `[[Page Name]]`, `[[Page Name|shown text]]`, `[[Page Name#Section]]` and
 * `[[#Section]]`.
 *
 * A wikilink is a link to a page by its NAME, so the target is turned into the path that name would
 * be filed under -- `normalizePagePath`, the same spelling every path field in the app corrects to:
 * spaces become dashes and everything is lowercased. `[[Getting Started]]` is `/getting-started`, and
 * `[[Guides/Getting Started]]` is `/guides/getting-started`.
 *
 * Always from the root, as in MediaWiki, and never relative to the page it is written on. A site that
 * brackets its URLs by locale reads an unprefixed path as its primary locale, which is where these
 * land.
 *
 * The section is spelled the way `slugifyHeading` in `backend/models/rendering.ts` spells the id it
 * gives a heading, so `[[Page#Some Heading]]` finds the heading called "Some Heading". That makes this
 * one more copy of that rule, and the two have to agree.
 *
 * The tokens are an ordinary `link_open` / `link_close` pair, so everything that already reads links
 * reads these too -- the external-link class, the server's backlinks, the Visual editor. The target
 * as written is kept on the opening token's `meta.wikilink`, which is how the Visual editor knows to
 * write the link back in this form rather than as `[text](/path)`.
 */

/**
 * A heading as an anchor fragment. Mirrors `slugifyHeading` in `backend/models/rendering.ts`.
 */
function slugifySection(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replaceAll(/[^\p{L}\p{N}\s-]/gu, '')
      .replaceAll(/\s+/g, '-')
      .replaceAll(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || 'section'
  )
}

/**
 * Where a wikilink target points, as an href.
 *
 * @param {string} target The target as written, backslash escapes already resolved.
 * @returns {string} A root-relative path, optionally with a fragment; or the fragment alone for a
 *          link to a section of the page it is written on.
 */
export function wikiLinkHref(target) {
  const hash = target.indexOf('#')
  const page = hash < 0 ? target : target.slice(0, hash)
  const section = hash < 0 ? '' : target.slice(hash + 1)
  const fragment = section.trim() ? `#${slugifySection(section)}` : ''
  if (!page.trim()) {
    return fragment || '/'
  }
  return `/${normalizePagePath(page)}${fragment}`
}

/**
 * What a target may not contain. MediaWiki refuses the same characters in a title, and every one of
 * them is something else to the parser here: `|` is the label, `[` / `]` the brackets, `{` / `}` MDC
 * and `markdown-it-attrs`, `<` / `>` HTML.
 */
const INVALID_TARGET = /[[\]{}<>|\n]/

/** A target that is already a URL, `[[https://…]]`, which is not a page name. */
const URL_TARGET = /^[a-z][a-z\d+.-]*:\/\//i

/**
 * Find the `]]` that closes a wikilink opened at `start`, skipping backslash escapes.
 *
 * @returns {{ pipe: number, end: number } | null} The position of the first `|` (or -1) and of the
 *          closing `]]`, or null when there is none before the end of what is being tokenized.
 */
function scan(src, start, max) {
  let pipe = -1
  for (let pos = start; pos < max; pos++) {
    const ch = src.charCodeAt(pos)
    if (ch === 0x5c /* \ */) {
      pos++
    } else if (ch === 0x0a /* \n */) {
      return null
    } else if (ch === 0x7c /* | */ && pipe < 0) {
      pipe = pos
    } else if (ch === 0x5d /* ] */ && src.charCodeAt(pos + 1) === 0x5d && pos + 1 < max) {
      return { pipe, end: pos }
    }
  }
  return null
}

function wikilink(state, silent) {
  const { src, posMax } = state
  const start = state.pos
  if (src.charCodeAt(start) !== 0x5b /* [ */ || src.charCodeAt(start + 1) !== 0x5b) {
    return false
  }
  // -> A link inside a link is not markup, as with every other link syntax
  if (state.linkLevel > 0) {
    return false
  }

  const found = scan(src, start + 2, posMax)
  if (!found) {
    return false
  }
  // -> `[[1]](https://…)` is an ordinary link whose text happens to be `[1]`, the way citations are
  //    often written, and `[[x]][ref]` the same by reference
  const next = src.charCodeAt(found.end + 2)
  if (next === 0x28 /* ( */ || next === 0x5b /* [ */) {
    return false
  }

  const targetEnd = found.pipe < 0 ? found.end : found.pipe
  const rawTarget = src.slice(start + 2, targetEnd)
  const target = state.md.utils.unescapeAll(rawTarget).trim()
  if (!target || INVALID_TARGET.test(target) || URL_TARGET.test(target)) {
    return false
  }

  const href = state.md.normalizeLink(wikiLinkHref(target))
  if (!state.md.validateLink(href)) {
    return false
  }

  const labelStart = found.pipe < 0 ? -1 : found.pipe + 1
  // -> `[[Page|]]` has nothing to show, and is shown as the page name rather than as nothing
  const hasLabel = labelStart >= 0 && src.slice(labelStart, found.end).trim().length > 0

  if (!silent) {
    const open = state.push('link_open', 'a', 1)
    open.attrs = [['href', href]]
    open.markup = 'wikilink'
    open.meta = { wikilink: target }

    if (hasLabel) {
      // -> The label is markdown, as a link's text is: `[[Page|**bold** text]]`
      const oldPosMax = state.posMax
      state.pos = labelStart
      state.posMax = found.end
      state.linkLevel++
      state.md.inline.tokenize(state)
      state.linkLevel--
      state.posMax = oldPosMax
    } else {
      // -> The target alone is shown as written, and is not parsed: it is a name, not markup
      const text = state.push('text', '', 0)
      text.content = target
    }

    const close = state.push('link_close', 'a', -1)
    close.markup = 'wikilink'
  }

  state.pos = found.end + 2
  return true
}

export default (md) => {
  /*
    Ahead of MDC's inline span, which claims every `[` it meets and would otherwise read `[[Page]]` as
    a span holding `[Page]`. That rule is registered before `link`, so this is ahead of both.
  */
  md.inline.ruler.before('mdc_inline_span', 'wikilink', wikilink)
}
