import { glossaryHref, glossaryLinkTarget } from './glossaryUrl'

/**
 * Linking glossary terms where they occur in an article, in the reader's browser, as the page is drawn
 * (`dev/specs/glossary.md` §9).
 *
 * Done here rather than into the stored render, so that a new term appears in every page at once and a
 * deleted one disappears, without re-rendering a single page; and a crawler, which reads the stored
 * render, never sees it.
 *
 * **A match is wrapped in a real link**, `<a class="glossary-term" href="?glossary=<term>">`, which is
 * what makes it focusable, reachable by keyboard and copyable as a URL without any of that being built
 * by hand. It changes the article's elements and never its text, which is what annotations are matched
 * against (`helpers/annotations.js` reads every text node, and an `<a>` is not one of the elements it
 * skips). What it cannot keep is every live `Range` into the article exactly where it was: moving the
 * matched text into the link takes it out of the tree for a moment, and the DOM puts a range boundary
 * that was INSIDE it on the link's edge instead. So whoever changes the links tells whoever holds
 * ranges, and they find their passages again by text -- `contentRevision` on the annotation
 * components.
 *
 * **Links written by hand count too.** `[REST](?glossary=REST)`, or `[[Glossary:REST]]`, is drawn the
 * same way (`markGlossaryLinks`) whether or not anything is linked automatically, and takes that term's
 * one link for the page.
 */

/** Marks every glossary link, automatic or written by hand: what the stylesheet and the card look for. */
export const GLOSSARY_LINK_CLASS = 'glossary-term'

/** Marks the links this module put there, which are the only ones it ever takes out again. */
const AUTO_ATTR = 'data-glossary-auto'

/**
 * Elements whose text is never a mention: headings, links, code of every kind, things that are not
 * prose, and form controls. Custom elements (content blocks) are skipped by their hyphen, below.
 */
const SKIPPED = new Set([
  'a',
  'abbr',
  'audio',
  'button',
  'canvas',
  'code',
  'dfn',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'iframe',
  'input',
  'kbd',
  'math',
  'nav',
  'noscript',
  'option',
  'pre',
  'samp',
  'script',
  'select',
  'style',
  'svg',
  'template',
  'textarea',
  'var',
  'video'
])

/**
 * Classes that mark something rendered rather than written -- a formula, a diagram -- plus
 * `no-glossary`, which an author can put on anything (`{.no-glossary}` in markdown) to keep it clear.
 */
const SKIPPED_CLASSES = ['katex', 'mermaid', 'no-glossary']

/** A run of whitespace, which is one space wherever it is compared. */
const SPACE = /^\s+$/

function isSkipped(el) {
  if (SKIPPED.has(el.localName) || el.localName.includes('-') || el.isContentEditable) {
    return true
  }
  return SKIPPED_CLASSES.some((cls) => el.classList.contains(cls))
}

/**
 * A matcher for a locale's terms.
 *
 * Every name and alias is cut into the same word segments the text will be (`Intl.Segmenter`), so that
 * a match starts and ends on a word boundary in any script -- including the ones written without spaces
 * -- and `REST` is never found inside `RESTful`. Candidates are kept by their first segment and tried
 * longest first, so `REST API` wins over `REST` where both would fit.
 *
 * @param {Array<{ id: string, term: string, aliases: string[], caseSensitive: boolean }>} terms
 * @param {string} locale
 * @returns {{ byFirst: Map<string, object[]>, byName: Map<string, object>, segmenter: Intl.Segmenter, fold: (s: string) => string } | null}
 *          Null where the browser has no `Intl.Segmenter`, which leaves the page unlinked.
 */
export function buildMatcher(terms, locale) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') {
    return null
  }
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
  const fold = (value) => value.toLocaleLowerCase(locale)
  const byFirst = new Map()
  const byName = new Map()

  for (const term of terms) {
    const entry = { id: term.id, term: term.term, expansion: term.expansion ?? null }
    for (const name of [term.term, ...(term.aliases ?? [])]) {
      const tokens = tokensOf(segmenter, name)
      if (tokens.length < 1) {
        continue
      }
      byName.set(fold(name), entry)
      const candidate = {
        entry,
        caseSensitive: Boolean(term.caseSensitive),
        tokens,
        folded: tokens.map(fold),
        length: name.length
      }
      const key = candidate.folded[0]
      byFirst.set(key, [...(byFirst.get(key) ?? []), candidate])
    }
  }
  for (const candidates of byFirst.values()) {
    candidates.sort((a, b) => b.tokens.length - a.tokens.length || b.length - a.length)
  }
  return { byFirst, byName, segmenter, fold }
}

/** A name as segments, every run of whitespace one space and none at either end. */
function tokensOf(segmenter, name) {
  const tokens = []
  for (const { segment } of segmenter.segment(name.normalize('NFC').trim())) {
    tokens.push(SPACE.test(segment) ? ' ' : segment)
  }
  return tokens.filter((token, idx) => token !== ' ' || tokens[idx - 1] !== ' ')
}

/**
 * The term a name belongs to, from what the matcher was built from -- for a link written by hand,
 * whose name is whatever the author wrote.
 */
export function termByName(matcher, name) {
  const key = (name ?? '').normalize('NFC').trim().replace(/\s+/g, ' ')
  return matcher?.byName.get(matcher.fold(key)) ?? null
}

/**
 * Draw every link to a term on this page, written by hand, as a glossary link.
 *
 * @param {HTMLElement} root
 * @returns {HTMLAnchorElement[]} The links found, so the caller can count their terms as linked.
 */
export function markGlossaryLinks(root) {
  const found = []
  for (const anchor of root.querySelectorAll(`a[href*="glossary="]:not([${AUTO_ATTR}])`)) {
    if (glossaryLinkTarget(anchor)) {
      anchor.classList.add(GLOSSARY_LINK_CLASS)
      found.push(anchor)
    }
  }
  return found
}

/**
 * Link the first occurrence of each term in the article.
 *
 * @param {HTMLElement} root The element the render was written into.
 * @param {ReturnType<typeof buildMatcher>} matcher
 * @param {Set<string>} [linked] Ids of the terms already linked on the page -- by hand -- which are not
 *        linked again. Added to as terms are linked.
 * @returns {number} How many links were made.
 */
export function linkTerms(root, matcher, linked = new Set()) {
  if (!root || !matcher || matcher.byFirst.size < 1) {
    return 0
  }

  // -> Collected first and changed after: splitting a node under a live walker moves it
  const nodes = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
      }
      return isSkipped(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP
    }
  })
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node)
  }

  let count = 0
  for (const node of nodes) {
    for (const match of matchesIn(node.data, matcher, linked)) {
      wrap(node, match)
      count++
    }
  }
  return count
}

/**
 * The matches in one run of text, last first so that wrapping one leaves the offsets of the rest
 * where they were. Each term is claimed in `linked` as it is found, so it is linked once per page.
 */
function matchesIn(text, matcher, linked) {
  const { segmenter, fold } = matcher
  const segments = [...segmenter.segment(text)]
  const matches = []

  for (let i = 0; i < segments.length; i++) {
    const candidates = matcher.byFirst.get(fold(segments[i].segment))
    if (!candidates) {
      continue
    }
    const hit = candidates.find((candidate) => fits(candidate, segments, i, fold))
    if (!hit) {
      continue
    }
    const last = segments[i + hit.tokens.length - 1]
    // -> The longest name decides, even when its term is already linked: `REST API` a second time is
    //    not a first `REST`
    if (!linked.has(hit.entry.id)) {
      linked.add(hit.entry.id)
      matches.push({
        start: segments[i].index,
        end: last.index + last.segment.length,
        entry: hit.entry
      })
    }
    i += hit.tokens.length - 1
  }
  return matches.reverse()
}

function fits(candidate, segments, at, fold) {
  if (at + candidate.tokens.length > segments.length) {
    return false
  }
  for (let j = 0; j < candidate.tokens.length; j++) {
    const segment = segments[at + j].segment
    if (candidate.tokens[j] === ' ') {
      if (!SPACE.test(segment)) {
        return false
      }
    } else if (
      candidate.caseSensitive
        ? segment !== candidate.tokens[j]
        : fold(segment) !== candidate.folded[j]
    ) {
      return false
    }
  }
  return true
}

/** Wrap one match of a text node in a link, splitting the node around it. */
function wrap(node, { start, end, entry }) {
  const middle = start > 0 ? node.splitText(start) : node
  middle.splitText(end - start)
  const anchor = document.createElement('a')
  anchor.className = GLOSSARY_LINK_CLASS
  anchor.setAttribute(AUTO_ATTR, '')
  anchor.dataset.termId = entry.id
  anchor.href = glossaryHref(entry.term)
  middle.parentNode.insertBefore(anchor, middle)
  anchor.appendChild(middle)
}

/**
 * Take out every link `linkTerms` made, putting the text back as it was.
 *
 * The pieces the text was split into are joined again by `normalize()`. As with linking, a range with a
 * boundary inside a linked term is left on its edge; see the note at the top.
 *
 * @returns {number} How many links were taken out.
 */
export function unlinkTerms(root) {
  if (!root) {
    return 0
  }
  const parents = new Set()
  const anchors = root.querySelectorAll(`a[${AUTO_ATTR}]`)
  for (const anchor of anchors) {
    parents.add(anchor.parentNode)
    anchor.replaceWith(...anchor.childNodes)
  }
  parents.forEach((parent) => parent?.normalize())
  return anchors.length
}
