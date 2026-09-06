import { blockAttributes } from '@/helpers/blocks'

/**
 * The blocks already in a page's source, read back and rewritten.
 *
 * The counterpart to `blocks.js`, which writes a block out: this finds the ones a page already
 * carries so the editor can offer to edit their parameters, reads what they were given back into the
 * form's shape, and writes the answer over the line it came from.
 *
 * A block's parameters and its body are read and written separately, and nothing here ever rewrites a
 * whole block. Everything a block's props can say is on the OPENING line, so that is all
 * `blockOpeningLine` replaces — what sits between the fences is the author's, page content or the
 * blocks of a tabset, and rebuilding the block from its definition the way inserting one does would
 * throw that away. `findBlockContent` is the other half, for the one shape of body an editor can be
 * offered for: a block that declares a `contentEditor` and holds a single fenced source.
 */

/** The opening or closing line of a fenced block, indented up to the three spaces markdown allows. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/** The same line, with the info string after it — which for these is the language the body is in. */
const FENCE_OPENING = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)/

/**
 * The line that closes a block component: nothing but colons.
 *
 * MDC closes a block with the fence it was opened with, so the count is compared by the caller rather
 * than baked in here — a `::` inside a `:::` block closes something nested, not the block itself.
 */
const CLOSING = /^ {0,3}(:{2,})[ \t]*$/

/**
 * A block component opening a line: `::block-name`, with its attributes if it was given any.
 *
 * Anchored to the start of the line because that is MDC's own rule for a block — `:block-name{…}`
 * mid-sentence is an inline component, which has no body and is not what the picker writes. Three or
 * more colons is the same block fenced to hold blocks of its own, so the count is captured and put
 * back rather than assumed.
 */
const OPENING = /^(:{2,})block-([a-z0-9-]+)[ \t]*(?:\{(.*)\})?[ \t]*$/

/**
 * One entry in an attribute list: `name`, `name=value`, `name="value"`, or a `.class` / `#id`
 * shorthand. Ordered so a quoted value wins over the unquoted reading, which would stop at the space.
 */
const ATTRIBUTE = /([.#][^\s"'=]+)|([^\s"'=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s}]*)))?/g

/**
 * Split an attribute list into what it says.
 *
 * `name` is null for a `.class` or `#id`, which belongs to no prop; `value` is null for a bare name,
 * which MDC reads as true. `raw` is what was written, kept so that anything this block does not
 * declare survives a rewrite untouched — see `blockOpeningLine`.
 *
 * @param {string} source The inside of the braces.
 * @returns {Array<{ name: string|null, value: string|null, raw: string }>}
 */
function parseAttributes(source) {
  return [...source.matchAll(ATTRIBUTE)].map((match) => ({
    name: match[1] ? null : match[2],
    value: match[1] ? null : (match[3] ?? match[4] ?? match[5] ?? null),
    raw: match[0]
  }))
}

/**
 * Every block in the source, in the order they appear. Line numbers are 1-based, to be handed
 * straight to the editor.
 *
 * A block inside a fenced code block is a code sample and not a block, so those are skipped — the
 * same reading `findEditableTables` takes of the same lines. Nesting needs no tracking of its own:
 * every opening line stands on its own, whatever it is written inside.
 *
 * @param {string} text The page source.
 * @returns {Array<{ block: string, line: number, fence: string, attributes: Array }>}
 */
export function findBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let fence = null

  for (let index = 0; index < lines.length; index++) {
    const edge = FENCE.exec(lines[index])
    if (fence) {
      if (edge && edge[1][0] === fence[0] && edge[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    if (edge) {
      fence = edge[1]
      continue
    }

    const opening = OPENING.exec(lines[index])
    if (opening) {
      blocks.push({
        block: opening[2],
        line: index + 1,
        fence: opening[1],
        attributes: parseAttributes(opening[3] ?? '')
      })
    }
  }
  return blocks
}

/**
 * What the form should open on: the block's props, filled in from what the page gave them.
 *
 * A prop the source says nothing about starts at the block's own default, which is what the block
 * will do if left alone — the same footing the picker starts a new block on.
 *
 * @param {{ attributes: Array }} found A block from `findBlocks`.
 * @param {{ props?: Array }} definition The same block as the API describes it.
 * @returns {Record<string, unknown>} Values by prop name.
 */
export function blockValues(found, definition) {
  const written = new Map(
    found.attributes.filter((attribute) => attribute.name).map((a) => [a.name, a.value])
  )
  return Object.fromEntries(
    (definition.props ?? []).map((prop) => {
      if (!written.has(prop.name)) {
        return [prop.name, prop.default ?? '']
      }
      const value = written.get(prop.name)
      switch (prop.type) {
        /*
          -> A bare `hideToolbar` is true, and so is any value but the word false — which is exactly
             how the blocks themselves read a boolean attribute, since MDC writes every prop as a
             string and an attribute that is merely present would otherwise be true whatever it says.
        */
        case 'boolean':
          return [prop.name, value === null ? true : value !== 'false']
        case 'number': {
          const number = Number(value)
          return [prop.name, Number.isFinite(number) ? number : (prop.default ?? '')]
        }
        default:
          return [prop.name, value ?? '']
      }
    })
  )
}

/**
 * The opening line to write back, from what the form now holds.
 *
 * Anything in the original list that the block does not declare is carried over as it was written:
 * a `.class`, or an attribute belonging to a version of the block that had a prop this one has not.
 * None of them survive being saved — the renderer allows a block exactly the attributes its
 * definition declares — but dropping them here would edit a line the author is still writing.
 *
 * @param {{ block: string, fence: string, attributes: Array }} found A block from `findBlocks`.
 * @param {{ props?: Array }} definition The same block as the API describes it.
 * @param {Record<string, unknown>} values What the form holds, by prop name.
 * @returns {string} The line, with no trailing newline.
 */
export function blockOpeningLine(found, definition, values) {
  const declared = new Set((definition.props ?? []).map((prop) => prop.name))
  const kept = found.attributes
    .filter((attribute) => !attribute.name || !declared.has(attribute.name))
    .map((attribute) => attribute.raw)
  const attributes = [...blockAttributes(definition, values), ...kept].join(' ')
  return `${found.fence}block-${found.block}${attributes ? `{${attributes}}` : ''}`
}

/**
 * The fenced source in a block's body, for a block that declares a `contentEditor`.
 *
 * That kind of block holds one fenced code block and nothing else — a diagram, a drawing — which is
 * how every source block in this wiki is written: the fence is what keeps markdown off the text, so
 * `-->` stays two dashes and a line opening with `#` stays a line and not a heading.
 *
 * The whole fenced block is reported, its two fence lines included, and `writeBlockContent` puts one
 * back the same way. Editing only the lines BETWEEN them cannot express an empty body — there are no
 * lines there to replace — and would have to reach for an insert at a position instead.
 *
 * @param {string} text The page source.
 * @param {{ line: number, fence: string }} found The block, from `findBlocks`.
 * @returns {{ language: string, fence: string, source: string, startLine: number, endLine: number }|null}
 *          The fenced body, or null for a block that does not hold exactly one.
 */
export function findBlockContent(text, found) {
  const lines = text.split('\n')
  let opening = null

  for (let index = found.line; index < lines.length; index++) {
    const line = lines[index]
    if (!opening) {
      // -> The block ended before any fence began: its body is prose, which this cannot edit
      const closing = CLOSING.exec(line)
      if (closing && closing[1].length >= found.fence.length) {
        return null
      }
      const edge = FENCE_OPENING.exec(line)
      if (edge) {
        opening = { fence: edge[1], language: edge[2] ?? '', startLine: index + 1 }
      }
      continue
    }
    /*
      A closing fence is the same character and at least as long. `FENCE` alone is too loose here,
      since it would also match a second opening -- the character has to be compared.
    */
    const edge = FENCE.exec(line)
    if (edge && edge[1][0] === opening.fence[0] && edge[1].length >= opening.fence.length) {
      return {
        language: opening.language,
        fence: opening.fence,
        source: lines.slice(opening.startLine, index).join('\n'),
        startLine: opening.startLine,
        endLine: index + 1
      }
    }
  }
  // -> An unterminated fence is a block still being written; there is nothing whole to hand an editor
  return null
}

/**
 * The fenced body to write back, from what an editor now holds.
 *
 * The fence character and the language are the ones that were there, so nothing about the block moves
 * except the text an editor was given. The fence is LENGTHENED where the new text contains a run of
 * that character as long as it — otherwise a body carrying its own fence would close this one early
 * and the rest of it would land in the page as markdown.
 *
 * @param {{ language: string, fence: string }} content The body, from `findBlockContent`.
 * @param {string} source What the editor produced.
 * @returns {string} The lines to put back, fences included and no trailing newline.
 */
export function writeBlockContent(content, source) {
  const marker = content.fence[0]
  const longest = Math.max(
    0,
    ...[...source.matchAll(new RegExp(`\\${marker}{3,}`, 'g'))].map((match) => match[0].length)
  )
  const fence = marker.repeat(Math.max(content.fence.length, longest + 1))
  return `${fence}${content.language}\n${source}\n${fence}`
}
