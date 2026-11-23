import { canJoin } from 'prosemirror-transform'

import { schema } from './schema'

/**
 * Images going into a gallery, as the list of addresses a gallery reads.
 *
 * A gallery whose body is a list of addresses is a block container, edited in place like any page
 * content, so an image dropped or picked into it would otherwise go in as an image -- which the gallery
 * draws, but not in the shape its body is written in. The Markdown editor writes `- /media/photo.png`
 * there; this is the same, as the bullet list that parses into.
 */

/**
 * Where a position is in a gallery's body, the depth of that gallery's node; otherwise -1.
 *
 * The innermost block container decides, so a block nested in a gallery is not taken for it. Only a
 * container: a gallery whose body is a single fenced source is an atom, with nowhere for a caret.
 *
 * @param {import('prosemirror-model').ResolvedPos} $pos
 */
export function galleryDepth($pos) {
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth)
    if (node.type === schema.nodes.block_container) {
      return node.attrs.name === 'gallery' ? depth : -1
    }
  }
  return -1
}

/**
 * The transaction putting a list of addresses into the gallery the selection is in.
 *
 * As items of the list the caret is already in, after the caret's own, when that list is the
 * gallery's. Otherwise as a list after the part of the gallery the caret is in -- or in place of it
 * when that is an empty paragraph -- joined to a list right before or after it, so that a gallery
 * holds one list rather than a run of them.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @param {import('prosemirror-model').Node} list A bullet list, one item per address.
 * @returns {?import('prosemirror-state').Transaction} Null when the selection is not in a gallery.
 */
export function insertGalleryItems(state, list) {
  const { $from, to } = state.selection
  const depth = galleryDepth($from)
  if (depth < 0 || list?.type !== schema.nodes.bullet_list) {
    return null
  }
  const tr = state.tr
  // -> None when a node in the gallery is selected, or a gap cursor stands between two: `to` is past it
  const child = $from.depth > depth ? $from.node(depth + 1) : null
  if (
    child?.type === list.type &&
    $from.depth >= depth + 2 &&
    $from.node(depth + 2).type === schema.nodes.list_item
  ) {
    return tr.insert($from.after(depth + 2), list.content)
  }
  let start = child ? $from.after(depth + 1) : to
  if (child?.isTextblock && child.content.size === 0) {
    start = $from.before(depth + 1)
    tr.replaceWith(start, $from.after(depth + 1), list)
  } else {
    tr.insert(start, list)
  }
  // -> The one after first, since joining there leaves `start` where it was
  const end = start + list.nodeSize
  if (tr.doc.resolve(end).nodeAfter?.type === list.type && canJoin(tr.doc, end)) {
    tr.join(end)
  }
  if (tr.doc.resolve(start).nodeBefore?.type === list.type && canJoin(tr.doc, start)) {
    tr.join(start)
  }
  return tr
}
