import { Plugin } from 'prosemirror-state'

import { barButton } from './bar'
import { schema } from './schema'

/**
 * Editing a link that is already in the page.
 *
 * A link is a MARK, not a node, so it gets none of what the block nodes get: there is no node view to
 * hang a header bar off, and nothing about a run of marked text announces that it can be changed. An
 * author could retype the words, because those are ordinary content, but the address behind them was
 * unreachable — the only way to change it was to delete the link and write another.
 *
 * So this is the missing affordance: a small bar that appears under the link the caret is in, and the
 * three things anybody wants to do to a link from there. It is a plugin rather than part of the
 * component because finding the link is a question about the document, and answering it needs the
 * selection on every transaction.
 */

/**
 * The link the selection sits in, as the range it covers.
 *
 * Marks split a textblock into runs, so a link whose middle word is bold is several children sharing
 * one link mark rather than a single one — which is why this walks outwards over adjacent children
 * carrying an EQUAL mark instead of taking the one the cursor happens to be in. `eq` and not identity:
 * two runs of the same link are two mark instances with the same attributes.
 *
 * @returns {?{ from, to, text, href, title, mdAttrs, marks }}
 *          Null when the selection is not in a link.
 */
export function findLink(state) {
  const type = schema.marks.link
  const { $from } = state.selection

  /*
    Which mark the cursor means. `$from.marks()` is what typing here would carry, which for a caret at
    the very start of a link is NOT the link — so the character on either side is consulted too, and a
    caret touching a link counts as being in it.
  */
  const mark =
    type.isInSet($from.marks()) ||
    (($from.nodeBefore && type.isInSet($from.nodeBefore.marks)) ?? null) ||
    (($from.nodeAfter && type.isInSet($from.nodeAfter.marks)) ?? null)
  if (!mark) {
    return null
  }

  const parent = $from.parent
  const parentStart = $from.start()
  const runs = []
  parent.forEach((child, offset) => {
    runs.push({ child, from: parentStart + offset, to: parentStart + offset + child.nodeSize })
  })

  const index = runs.findIndex(
    (run) => run.from <= $from.pos && $from.pos <= run.to && mark.isInSet(run.child.marks)
  )
  if (index < 0) {
    return null
  }

  let first = index
  let last = index
  while (first > 0 && mark.isInSet(runs[first - 1].child.marks)) {
    first--
  }
  while (last < runs.length - 1 && mark.isInSet(runs[last + 1].child.marks)) {
    last++
  }

  const from = runs[first].from
  const to = runs[last].to
  return {
    from,
    to,
    text: state.doc.textBetween(from, to, '', ''),
    href: mark.attrs.href,
    title: mark.attrs.title ?? '',
    wikilink: mark.attrs.wikilink,
    // -> Whatever `{…}` the link carries, so editing it does not drop a `target="_blank"`
    mdAttrs: mark.attrs.mdAttrs,
    // -> Everything the run carries besides the link, so replacing the text does not drop its emphasis
    marks: runs[first].child.marks.filter((m) => m.type !== type)
  }
}

/**
 * Write a link's address, text and title back over the range it occupies.
 *
 * The text is only replaced when it actually changed. Rewriting it unconditionally would flatten a
 * link whose words are partly bold into one run of whatever the first run was marked with, on every
 * save of a dialog where nobody touched the text.
 */
export function applyLink(view, range, { text, href, title, newTab }) {
  const type = schema.marks.link
  /*
    The link's other attributes are kept as they were and only `target` is decided here, so an id or a
    class somebody put on the link in the source survives being edited through the dialog.
  */
  const mdAttrs = { ...range.mdAttrs }
  if (newTab) {
    mdAttrs.target = '_blank'
  } else {
    delete mdAttrs.target
  }
  const mark = type.create({
    href,
    title: title || null,
    // -> Still a wikilink while it still goes where its target says; a new address makes it an
    //    ordinary link, since the target is what the href would be derived from
    wikilink: href === range.href ? (range.wikilink ?? null) : null,
    mdAttrs: Object.keys(mdAttrs).length > 0 ? mdAttrs : null
  })
  const tr = view.state.tr

  if (text && text !== range.text) {
    tr.replaceWith(range.from, range.to, schema.text(text, [...range.marks, mark]))
  } else {
    tr.removeMark(range.from, range.to, type)
    tr.addMark(range.from, range.to, mark)
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
}

/** Take the link off, keeping the words it was on. */
export function removeLink(view, range) {
  view.dispatch(view.state.tr.removeMark(range.from, range.to, schema.marks.link))
  view.focus()
}

/**
 * The bar itself.
 *
 * @param {object} handlers
 * @param {(range: object) => void} handlers.onEdit Open whatever edits a link; given the range.
 * @param {(range: object) => void} handlers.onRemove Unlink; given the range.
 * @param {(key: string) => string} handlers.t
 */
export function linkBar({ onEdit, onRemove, t }) {
  return new Plugin({
    view(editorView) {
      const dom = document.createElement('div')
      dom.className = 'visual-link-bar'
      dom.hidden = true

      const href = document.createElement('a')
      href.className = 'visual-link-bar-href'
      href.target = '_blank'
      href.rel = 'noopener'
      dom.append(href)

      let range = null
      dom.append(
        barButton(t('editor.visual.link.edit'), () => range && onEdit(range)),
        barButton(t('editor.visual.link.remove'), () => range && onRemove(range))
      )

      /*
        Into the element ProseMirror was mounted into rather than the body: that box scrolls with the
        document, so a bar placed against it stays on its link as the page is scrolled without anything
        having to listen for it.
      */
      const surface = editorView.dom.parentNode
      surface.append(dom)

      const update = (view) => {
        range = view.editable ? findLink(view.state) : null
        if (!range) {
          dom.hidden = true
          return
        }
        href.textContent = range.href
        href.href = range.href
        href.title = range.href

        const coords = view.coordsAtPos(range.from)
        const box = surface.getBoundingClientRect()
        dom.hidden = false
        dom.style.top = `${coords.bottom - box.top + 6}px`
        dom.style.left = `${Math.max(0, coords.left - box.left)}px`
      }

      update(editorView)
      return {
        update,
        destroy: () => dom.remove()
      }
    }
  })
}
