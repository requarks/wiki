/**
 * Moving a page between the Markdown and Visual editors.
 *
 * Both write markdown, so there is nothing to translate: a conversion changes which editor opens the
 * page and nothing about what it says. What it does change is the SPELLING of the source, because the
 * Visual editor has a document model and markdown has more than one way to write most things in it —
 * so the file comes back with its lists indented one way, its tables padded one way and its emphasis
 * written with one character.
 *
 * That rewrite lands at conversion time, on purpose. Deferred to the first save it would arrive mixed
 * into somebody's real edit, and the diff of "fixed a typo" would be the whole file. Done here it is
 * one history version that says what it is.
 *
 * `verifyRoundTrip` is the safety net, and the reason converting can be offered at all. Rather than
 * trusting the serialiser to be correct, the rewritten source is rendered and compared with the
 * render of the original: if the page would come out differently, the author is told before anything
 * is written, with the difference in hand. A serialiser bug becomes a refused conversion instead of a
 * damaged page.
 */

/** Attributes the renderer stamps for the preview pane, which `models/rendering.ts` strips on save. */
const PREVIEW_ARTIFACTS = /\s*data-line="\d+"/g

/**
 * A render reduced to what it actually says.
 *
 * The preview's line markers go, because they are scaffolding rather than content and the server
 * removes them before storing anything. Whitespace between tags is collapsed for the same reason: the
 * serialiser may put a construct on a different line from where the author had it without changing a
 * word of the page.
 */
function meaningOf(html) {
  return html
    .replace(PREVIEW_ARTIFACTS, '')
    .replace(/\bclass="line"/g, '')
    .replace(/\bline\b ?/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The first place two renders stop agreeing, as a short excerpt of each.
 *
 * For telling an author what would change. A character offset into minified HTML is no use to
 * anybody, so what comes back is the neighbourhood of the difference in both versions.
 */
function firstDifference(before, after) {
  let at = 0
  while (at < before.length && at < after.length && before[at] === after[at]) {
    at++
  }
  const from = Math.max(0, at - 60)
  return {
    before: before.slice(from, at + 120).trim(),
    after: after.slice(from, at + 120).trim()
  }
}

/**
 * Rewrite a page's source the way the Visual editor writes it, and check the page still renders the
 * same.
 *
 * @param {string} content The page source as it stands.
 * @param {object} deps
 * @param {{ parse: (md: string, path: string) => object }} deps.parser From `createParser`.
 * @param {(doc: object) => string} deps.serialize From `serialize`.
 * @param {{ render: (md: string, env: object) => string }} deps.renderer The site's renderer.
 * @param {string} deps.pagePath The page's path, which a relative image resolves against.
 * @returns {{ content: string, render: string, changed: boolean, identical: boolean,
 *            difference: ?{ before: string, after: string }, error: ?string }}
 *          `identical` is the one to gate on: it says the page renders the same afterwards.
 *          `changed` only says the source text is not byte-for-byte what it was, which is expected
 *          and harmless.
 */
export function normalizeForVisual(content, { parser, serialize, renderer, pagePath = '' }) {
  const source = content ?? ''
  let rewritten
  try {
    rewritten = serialize(parser.parse(source, pagePath))
  } catch (err) {
    return {
      content: source,
      render: '',
      changed: false,
      identical: false,
      difference: null,
      error: err.message
    }
  }

  let before
  let after
  try {
    before = renderer.render(source, { pagePath })
    after = renderer.render(rewritten, { pagePath })
  } catch (err) {
    return {
      content: rewritten,
      render: '',
      changed: rewritten !== source,
      identical: false,
      difference: null,
      error: err.message
    }
  }

  const identical = meaningOf(before) === meaningOf(after)
  return {
    content: rewritten,
    render: after,
    changed: rewritten !== source,
    identical,
    difference: identical ? null : firstDifference(meaningOf(before), meaningOf(after)),
    error: null
  }
}

/**
 * What a conversion has to send, for either direction.
 *
 * Converting TO the Visual editor rewrites the source; converting away from it does not, because the
 * source is already the form the Visual editor writes — every markdown editor reads it unchanged. So
 * the other direction sends nothing but the editor, and the page's content column is never touched.
 */
export function conversionPayload({ toEditor, normalized, reasonForChange }) {
  if (toEditor !== 'visual') {
    return { editor: toEditor, reasonForChange }
  }
  return {
    editor: toEditor,
    ...(normalized.changed ? { content: normalized.content, render: normalized.render } : {}),
    reasonForChange
  }
}
