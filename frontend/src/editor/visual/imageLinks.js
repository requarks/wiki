import { DOMSerializer, Fragment } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'

/**
 * The link carried by an inline node. Text uses a mark; an image keeps the same link attributes in
 * `imageLink`, because y-prosemirror 1.x does not store marks on non-text nodes.
 */
export function linkOnNode(node) {
  const type = node.type.schema.marks.link
  return (
    type.isInSet(node.marks) ||
    (node.type.name === 'image' && node.attrs.imageLink ? type.create(node.attrs.imageLink) : null)
  )
}

/** ProseMirror's attrs have no prototype; Yjs 13 element attributes require an ordinary object. */
function storedLinkAttrs(mark) {
  return { ...mark.attrs }
}

/** Visit images without rebuilding unchanged subtrees. Positions and all other node data stay put. */
function mapImages(node, visit) {
  if (node.type.name === 'image') {
    return visit(node)
  }
  const children = []
  let changed = false
  node.forEach((child) => {
    const next = mapImages(child, visit)
    children.push(next)
    changed ||= next !== child
  })
  return changed ? node.copy(Fragment.fromArray(children)) : node
}

/**
 * The editor's stored representation. Run before seeding a Y document, not after the link is already
 * lost. The parser and clipboard/command plugin use the same conversion.
 */
export function storeImageLinks(doc) {
  return mapImages(doc, (image) => {
    const type = image.type.schema.marks.link
    const link = type.isInSet(image.marks)
    if (!link || !Object.hasOwn(image.attrs, 'imageLink')) {
      return image
    }
    return image.type.create(
      { ...image.attrs, imageLink: storedLinkAttrs(link) },
      image.content,
      type.removeFromSet(image.marks)
    )
  })
}

/**
 * A temporary tree for the Markdown serializer. Restoring the mark here lets its existing link
 * writer keep one link around adjacent text and images, including titles and `{target="_blank"}`.
 * This tree is never written back into the collaborative document.
 */
export function imageLinksAsMarks(doc) {
  return mapImages(doc, (image) => {
    const link = image.attrs.imageLink && image.type.schema.marks.link.create(image.attrs.imageLink)
    return link
      ? image.type.create(
          { ...image.attrs, imageLink: null },
          image.content,
          link.addToSet(image.marks)
        )
      : image
  })
}

/** Copy one anchor around a mixed text/image link, instead of several anchors with the same id. */
export function imageLinkClipboardSerializer(schema) {
  const base = DOMSerializer.fromSchema(schema)
  const serializer = new DOMSerializer(base.nodes, base.marks)
  serializer.serializeFragment = (fragment, options, target) => {
    const children = []
    fragment.forEach((node) => children.push(imageLinksAsMarks(node)))
    return base.serializeFragment(Fragment.fromArray(children), options, target)
  }
  return serializer
}

/**
 * Link commands and HTML paste still produce ordinary link marks. Move those on images into their
 * attribute before the view (and therefore ySyncPlugin) sees the final state. Attribute and mark
 * steps do not move positions, so selecting or linking an image keeps the image selected.
 */
export function imageLinkStorage() {
  return new Plugin({
    appendTransaction(transactions, oldState, state) {
      if (!transactions.some((tr) => tr.docChanged)) {
        return null
      }
      // -> Skip unchanged subtrees: typing elsewhere on a large page need not inspect every image.
      const from = oldState.doc.content.findDiffStart(state.doc.content)
      if (from === null) {
        return null
      }
      const end = oldState.doc.content.findDiffEnd(state.doc.content)
      const tr = state.tr
      state.doc.nodesBetween(from, Math.max(from, end?.b ?? from), (node, pos) => {
        if (node.type.name !== 'image') {
          return
        }
        const type = state.schema.marks.link
        const link = type.isInSet(node.marks)
        if (link) {
          tr.setNodeAttribute(pos, 'imageLink', storedLinkAttrs(link))
          tr.removeMark(pos, pos + node.nodeSize, type)
        }
      })
      return tr.docChanged ? tr : null
    }
  })
}
