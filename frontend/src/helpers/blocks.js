/**
 * The MDC markup for a block, as the editor writes it into a page.
 *
 * Shared rather than living in the block picker, because the picker is not the only way a block gets
 * inserted — the toolbar has a shortcut for the tabset, which has to produce exactly what picking
 * Tabs from the list would have produced, and the "Edit Block Parameters" lens rewrites the opening
 * line of a block already in the page.
 *
 * `::block-name{prop="value"}` is what the renderer turns into `<block-name prop="value">`, the
 * element the component registers itself as.
 */

/**
 * What an author filled in, as MDC attributes — one `name="value"` per prop worth writing out.
 *
 * Separate from `blockMarkdown` because editing an existing block reuses only this half: its body is
 * whatever the author has since written between the two fences, and rebuilding the whole block from
 * the definition would throw that away.
 *
 * @param {{ props?: Array }} block A block as the API describes it.
 * @param {Record<string, unknown>} [values] What the author filled in, by prop name.
 * @returns {string[]} The attributes, in the order the block declares its props.
 */
export function blockAttributes(block, values = {}) {
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
  // -> A double quote in a value would close the attribute; MDC has no escape for it, so it goes
  return written.map((prop) => `${prop.name}="${String(values[prop.name]).replaceAll('"', "'")}"`)
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
