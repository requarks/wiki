/**
 * The markup for a block, as an editor writes it into a page.
 *
 * Shared rather than living in the block picker, because the picker is not the only way a block gets
 * inserted — the toolbar has a shortcut for the tabset, which has to produce exactly what picking
 * Tabs from the list would have produced, and the "Edit Block Parameters" lens rewrites the opening
 * line of a block already in the page.
 *
 * Both syntaxes end at the same element. `::block-name{prop="value"}` in markdown and
 * `[block-name, prop="value"]` over a delimited block in AsciiDoc are each turned by their own
 * renderer into `<block-name prop="value">`, which is what the component registers itself as — so
 * which props are worth writing out is one question with one answer here, and only the punctuation
 * around them differs.
 */

/**
 * A value as MDC has to write it: quoted, with any quote of its own turned into an apostrophe.
 *
 * Lossy, and unavoidably so — MDC has no escape for a double quote inside an attribute, so one left
 * in would close the attribute and spill the rest of the value into the page as markup. AsciiDoc
 * does have one, which is why this is an argument rather than the only way values are written; see
 * `quoteValue` in `helpers/asciidocBlocks.js`.
 */
function mdcQuoteValue(value) {
  return `"${String(value).replaceAll('"', "'")}"`
}

/**
 * What an author filled in, as attributes — one `name="value"` per prop worth writing out.
 *
 * Separate from `blockMarkdown` because editing an existing block reuses only this half: its body is
 * whatever the author has since written between the two fences, and rebuilding the whole block from
 * the definition would throw that away.
 *
 * @param {{ props?: Array }} block A block as the API describes it.
 * @param {Record<string, unknown>} [values] What the author filled in, by prop name.
 * @param {(value: unknown) => string} [quote] How to write one value, for a syntax that quotes
 *        differently. Defaults to MDC's way; AsciiDoc passes its own.
 * @returns {string[]} The attributes, in the order the block declares its props.
 */
export function blockAttributes(block, values = {}, quote = mdcQuoteValue) {
  /*
    Only what is worth writing out: anything given a value that is not already the block's own
    default. A block reading its default from its own code does not need to be told it in every page.
  */
  const written = (block.props ?? []).filter((prop) => {
    const value = values[prop.name]
    if (value === undefined || value === null || value === '') {
      return false
    }
    return String(value) !== String(prop.default ?? '')
  })
  return written.map((prop) => `${prop.name}=${quote(values[prop.name])}`)
}

/**
 * A block, opening and closing lines included.
 *
 * @param {{ block: string, props?: Array, template?: string }} block A block as the API describes it.
 * @param {Record<string, unknown>} [values] What the author filled in, by prop name.
 * @returns {string} The markup, opening and closing lines included.
 */
export function blockMarkdown(block, values = {}) {
  const attributes = blockAttributes(block, values).join(' ')
  const suffix = attributes ? `{${attributes}}` : ''

  /*
    A block that comes with a body to start from writes it between the two lines. One holding blocks
    of its own is fenced with three colons rather than two, since against a two-colon fence the first
    `::` inside it would read as the end of this one.
  */
  if (block.template) {
    const fence = /^::/m.test(block.template) ? ':::' : '::'
    return `${fence}block-${block.block}${suffix}\n${block.template}\n${fence}`
  }
  return `::block-${block.block}${suffix}\n::`
}

/**
 * The delimiters a wiki block may be written between in AsciiDoc, outermost first.
 *
 * AsciiDoc nests delimited blocks by ALTERNATING the delimiter rather than by growing it the way MDC
 * grows a fence, so which one a block gets depends on how deep it sits: a tabset takes `====` and
 * each tab inside it takes `--`. Four of them, which is the ceiling -- a fifth level of blocks inside
 * blocks has nothing left to alternate to, and nothing in this wiki goes near it.
 */
const ASCIIDOC_DELIMITERS = ['====', '--', '****', '____']

/**
 * A block's starter body, carried across from the markdown it is declared in.
 *
 * A block declares one `template` (see `BlockDefinition`), written in markdown because that is the
 * syntax the block system grew up in. Three shapes occur, and only two of them differ between the
 * syntaxes:
 *
 * - **A fenced source** -- every block with a `contentEditor`, which is most of the ones that have a
 *   template at all. Rewritten to `[source,lang]` over a `----` fence.
 * - **Plain prose** -- `block-spoiler`, `block-gallery`. The same text in both syntaxes; left alone.
 * - **Nested blocks or a list** -- `block-tabs`, `block-steps`. Not mechanically translatable, and
 *   not guessed at: a block declares an `asciidocTemplate` for this case and it is used verbatim.
 *
 * A custom block that declares neither an `asciidocTemplate` nor a fenced body gets its markdown
 * template as it stands, which is right for prose and visibly wrong for anything else -- the preview
 * shows it immediately, which is the failure worth having over a translator quietly mangling a shape
 * it was never shown.
 */
function asciidocTemplate(block, depth) {
  if (block.asciidocTemplate) {
    return block.asciidocTemplate
  }
  const template = block.template ?? ''
  const fenced = /^```(\S*)\n([\s\S]*)\n```$/.exec(template.trim())
  if (!fenced) {
    return template
  }
  /*
    The fence is four hyphens or more, and never the delimiter this block is being written between:
    `--` opens an open block, so a two-hyphen fence inside one would close it. Lengthened past any
    run of hyphens the body itself carries, exactly as `writeBlockContent` does.
  */
  const longest = Math.max(0, ...[...fenced[2].matchAll(/-{4,}/g)].map((match) => match[0].length))
  const fence = '-'.repeat(Math.max(4, longest + 1, ASCIIDOC_DELIMITERS[depth]?.length ?? 0))
  return `[source${fenced[1] ? `,${fenced[1]}` : ''}]\n${fence}\n${fenced[2]}\n${fence}`
}

/**
 * A block in AsciiDoc: its attribute line, its delimiters, and whatever body it starts with.
 *
 * The counterpart of `blockMarkdown`. A block with no template still gets a delimited body rather
 * than an empty attribute line, because an attribute line with nothing under it is a styled paragraph
 * as far as AsciiDoc is concerned and would not be a block at all.
 *
 * @param {{ block: string, props?: Array, template?: string, asciidocTemplate?: string }} block A
 *        block as the API describes it.
 * @param {Record<string, unknown>} [values] What the author filled in, by prop name.
 * @param {number} [depth] How deeply this block is being inserted, which decides its delimiter. Zero
 *        at the top level, which is every insertion the editor makes -- a nested block comes from a
 *        parent's own template and carries the delimiter written into it.
 * @returns {string} The markup, attribute line and delimiters included.
 */
export function blockAsciidoc(block, values = {}, depth = 0) {
  const attributes = blockAttributes(block, values, asciidocQuoteValue)
  const head = `[block-${block.block}${attributes.length > 0 ? `, ${attributes.join(', ')}` : ''}]`
  const delimiter = ASCIIDOC_DELIMITERS[depth] ?? ASCIIDOC_DELIMITERS.at(-1)
  const body = asciidocTemplate(block, depth)
  return `${head}\n${delimiter}\n${body}\n${delimiter}`
}

/**
 * A value as AsciiDoc writes one: quoted, with a quote or a backslash inside it escaped.
 *
 * Unlike MDC, which has to mangle a double quote -- see `mdcQuoteValue`. Exported because the "Edit
 * Block Parameters" lens rewrites an attribute line without going through `blockAsciidoc`, and the
 * two must agree about quoting or an edit would change a value it was only meant to move.
 */
export function asciidocQuoteValue(value) {
  return `"${String(value).replace(/(["\\])/g, '\\$1')}"`
}

/**
 * Whether every prop the block insists on has been given something.
 *
 * Asked by both the picker's Insert button and the parameters dialog's Apply: a required prop left
 * empty is a block that cannot draw anything.
 *
 * @param {{ props?: Array }} block A block as the API describes it.
 * @param {Record<string, unknown>} values What the author filled in, by prop name.
 * @returns {boolean}
 */
export function blockPropsFilled(block, values) {
  return (block.props ?? [])
    .filter((prop) => prop.required)
    .every((prop) => String(values[prop.name] ?? '').length > 0)
}
