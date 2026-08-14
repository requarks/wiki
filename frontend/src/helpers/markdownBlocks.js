import { blockAttributes } from '@/helpers/blocks'

/**
 * The blocks already in a page's source, read back and rewritten.
 *
 * The counterpart to `blocks.js`, which writes a block out: this finds the ones a page already
 * carries so the editor can offer to edit their parameters, reads what they were given back into the
 * form's shape, and writes the answer over the line it came from.
 *
 * Only the OPENING line is ever read or replaced. Everything a block's props can say is on that line,
 * and what sits between the fences is the author's — page content, or the blocks of a tabset. Building
 * the whole block again from its definition, the way inserting one does, would throw that away.
 */

/** The opening or closing line of a fenced block, indented up to the three spaces markdown allows. */
const FENCE = /^ {0,3}(`{3,}|~{3,})/

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
