import { NodeSelection, Plugin } from 'prosemirror-state'

import { barButton } from './bar'
import { schema } from './schema'

/**
 * Editing an image that is already in the page.
 *
 * An image is a leaf node, so clicking it selects it and there is nothing else to do with it: no
 * caret goes inside an `<img>`, and the three things an author wants — a different size, a different
 * picture, no picture — are all attributes of a node that offers no way to reach them. Retyping was
 * the only route, and that means knowing the `=WxH` suffix by heart.
 *
 * So this is the same shape as `links.js`: a small bar drawn against the selected image, and a plugin
 * rather than part of the node view because the question it answers — what is selected — is about the
 * document and has to be re-asked on every transaction. The node view draws the picture; this draws
 * what can be done to it.
 */

/**
 * The image the selection is on.
 *
 * A `NodeSelection` and not "an image somewhere near the caret": clicking a leaf node is exactly what
 * makes one, so this is the selection an author produces by pointing at the picture, and nothing else
 * brings the bar up.
 *
 * @returns {?{ pos: number, node: import('prosemirror-model').Node }} Null when the selection is not
 *          an image.
 */
export function findImage(state) {
  const { selection } = state
  if (!(selection instanceof NodeSelection) || selection.node.type !== schema.nodes.image) {
    return null
  }
  return { pos: selection.from, node: selection.node }
}

/**
 * Write attributes back onto the image at a position.
 *
 * Everything not named is kept, so resizing a picture does not drop its alt text and replacing it
 * does not drop a size that was set on it. The image is re-selected afterwards: the bar is keyed on
 * the selection, and `setNodeMarkup` leaves it pointing at a node that no longer exists, so without
 * this the bar disappears the moment it is used.
 */
function setImageAttrs(view, pos, attrs) {
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type !== schema.nodes.image) {
    return false
  }
  const tr = view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs }, node.marks)
  tr.setSelection(NodeSelection.create(tr.doc, pos))
  view.dispatch(tr)
  view.focus()
  return true
}

/**
 * What the image dialog edits: the text that stands in for the picture, and how big it is drawn.
 *
 * The dimensions are strings rather than numbers because `markdown-it-imsize` accepts a percentage as
 * well as a pixel count, and an empty one becomes null rather than `''` so that the serialiser can
 * tell "no width" from a width of nothing. The alt text does the same: empty is a deliberate value —
 * a picture that carries no meaning of its own, which a screen reader should skip rather than read
 * a file name out of — and null is how the node says it has none.
 */
export function applyImageEdit(view, pos, { alt, width, height }) {
  return setImageAttrs(view, pos, {
    alt: alt || null,
    width: width || null,
    height: height || null
  })
}

/** Point an image at a different file, keeping its size and everything else about it. */
export function applyImageSrc(view, pos, { src, alt }) {
  return setImageAttrs(view, pos, { src, ...(alt ? { alt } : {}) })
}

/** Take the image out of the page. */
export function removeImage(view, pos) {
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type !== schema.nodes.image) {
    return false
  }
  view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
  view.focus()
  return true
}

/**
 * The bar itself.
 *
 * @param {object} handlers
 * @param {(target: object) => void} handlers.onEdit Open whatever sets the alt text and the size.
 * @param {(target: object) => void} handlers.onReplace Pick a different file.
 * @param {(target: object) => void} handlers.onRemove Delete the image.
 * @param {(key: string) => string} handlers.t
 */
export function imageBar({ onEdit, onReplace, onRemove, t }) {
  return new Plugin({
    view(editorView) {
      const dom = document.createElement('div')
      dom.className = 'visual-image-bar'
      dom.hidden = true

      let target = null
      /*
        Read by the `load` listener below, which outlives the plugin: asking a destroyed view for a
        node's DOM throws.
      */
      let destroyed = false
      dom.append(
        barButton(t('editor.visual.image.edit'), () => target && onEdit(target)),
        barButton(t('editor.visual.image.replace'), () => target && onReplace(target)),
        barButton(t('editor.visual.image.remove'), () => target && onRemove(target))
      )

      // -> Into the element ProseMirror was mounted into, for the reason `links.js` gives
      const surface = editorView.dom.parentNode
      surface.append(dom)

      const update = (view) => {
        target = view.editable ? findImage(view.state) : null
        const el = target && view.nodeDOM(target.pos)
        if (!el?.getBoundingClientRect) {
          dom.hidden = true
          return
        }

        /*
          Against the image's own box rather than a document position, which is what puts the bar over
          the top-left corner of the picture however tall it is.
        */
        /*
          A picture that has not loaded yet has the empty box a browser gives an image with no
          intrinsic size, and so would leave the bar somewhere the image is not. One listener, which
          re-runs this once the real box exists — and which also covers the picture being REPLACED,
          where the new file's size arrives after the transaction that pointed at it.
        */
        if (el instanceof HTMLImageElement && !el.complete) {
          el.addEventListener('load', () => !destroyed && update(view), { once: true })
        }

        const rect = el.getBoundingClientRect()
        const box = surface.getBoundingClientRect()
        dom.hidden = false
        /*
          Above the image, and below it when there is no room above -- an image at the very top of the
          document has only the editable's own padding over it, which is less than the bar is tall.
          Measured after unhiding, since a hidden element has no height.
        */
        const above = rect.top - box.top - dom.offsetHeight - 6
        dom.style.top = `${above >= 0 ? above : rect.bottom - box.top + 6}px`
        dom.style.left = `${Math.max(0, rect.left - box.left)}px`
      }

      update(editorView)
      return {
        update,
        destroy: () => {
          destroyed = true
          dom.remove()
        }
      }
    }
  })
}
