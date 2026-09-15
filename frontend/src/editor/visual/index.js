import { gapCursor } from 'prosemirror-gapcursor'
import { history, redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import { EditorState } from 'prosemirror-state'
import { columnResizing, tableEditing } from 'prosemirror-tables'
import { EditorView } from 'prosemirror-view'

import { MarkdownRenderer } from '@/renderers/markdown'

import { collabPlugins, collabRedo, collabUndo, seedIfEmpty } from './collab'
import { buildInputRules, buildKeymap } from './commands'
import { imageBar } from './images'
import { linkBar } from './links'
import { createNodeViews } from './nodeviews'
import { createParser } from './parse'
import { schema } from './schema'
import { serialize } from './serialize'

/**
 * The Visual editor, assembled.
 *
 * One object holding the three things that have to agree with each other — the renderer, the parser
 * built on it, and the serialiser — so that nothing else in the app can accidentally pair a parser
 * with a renderer configured differently. `EditorVisual.vue` builds exactly one of these and talks to
 * it; everything below this line is free of Vue.
 */

export { schema, serialize }

/**
 * @param {object} options
 * @param {HTMLElement} options.mount Where the editor's DOM goes.
 * @param {string} options.content The page source to open on.
 * @param {object} options.config The site's markdown editor config — the same one the preview uses,
 *        because the parse and the render have to be the same parse and the same render.
 * @param {object} options.context What the node views need from the app; see `createNodeViews`.
 * @param {() => void} options.onChange Called after every change to the document. Deliberately given
 *        nothing: the source and the render are what `getMarkdown` and `getRender` produce, and
 *        producing them is the expensive part the caller is expected to debounce.
 * @param {() => void} [options.onSelectionChange] Called after every transaction, for the toolbar.
 */
export function createVisualEditor({
  mount,
  content,
  config,
  context,
  onChange,
  onSelectionChange
}) {
  const renderer = new MarkdownRenderer(config)
  const parser = createParser(renderer, config)

  const render = (markdown) => renderer.render(markdown, { pagePath: context.pagePath() })

  /*
    A block's body is rendered through the same pipeline, on its own: the block reads its source out
    of the markup it is handed, so a diagram's fence has to arrive as the `<pre>` the renderer makes
    of it rather than as raw text.
  */
  context.renderMarkdown = (markdown) => render(markdown)

  /*
    Everything but the document. Built as a function because collaborating swaps two of them: the
    shared document replaces `history`, since Yjs has to be the one deciding what undo means when more
    than one person is typing — see `collab.js`.
  */
  /** Whether this editor has joined a session, which changes what undo means. */
  let collaborating = false

  /**
   * Whether `destroy` has been called, which everything reachable from outside has to ask.
   *
   * A destroyed `EditorView` throws on anything that touches its document, and transactions do arrive
   * after teardown: `y-prosemirror` batches the metadata it sets and flushes it on a microtask, so a
   * change made in the moment the author left the page is dispatched into a view that no longer
   * exists. That surfaced as `Cannot read properties of null (reading 'matchesNode')` every time a
   * collaborative session was closed, and as an uncaught error it took the rest of whatever was
   * unwinding with it.
   */
  let destroyed = false

  const buildPlugins = (isCollab) => [
    buildInputRules(),
    keymap(buildKeymap({ collab: isCollab })),
    gapCursor(),
    // -> Before `tableEditing`, which is what its own documentation asks for
    columnResizing(),
    tableEditing(),
    /*
      The bar that appears under the link the caret is in. A plugin because a link is a mark and has no
      node view to hang anything off — see `links.js`.
    */
    linkBar({
      onEdit: (range) => context.editLink(range),
      onRemove: (range) => context.removeLink(range),
      t: context.t
    }),
    /*
      And the one that appears over the selected image. A plugin for the same reason, from the other
      direction: an image IS a node, but a leaf one that nothing can be drawn inside -- see
      `images.js`.
    */
    imageBar({
      onEdit: (target) => context.editImage(target),
      onReplace: (target) => context.replaceImage(target),
      onRemove: (target) => context.removeNode(target.pos),
      t: context.t
    })
  ]

  const view = new EditorView(mount, {
    state: EditorState.create({
      doc: parser.parse(content ?? '', context.pagePath()),
      plugins: [...buildPlugins(false), history()]
    }),
    nodeViews: createNodeViews(context),
    attributes: {
      class: 'visual-editor-content page-contents',
      spellcheck: 'true'
    },
    dispatchTransaction(transaction) {
      // -> See `destroyed`: a transaction can outlive the view it was made for
      if (destroyed) {
        return
      }
      const next = view.state.apply(transaction)
      view.updateState(next)
      /*
        The change is only reported, not serialised: serialising and rendering the whole document is
        what the caller debounces, and doing it here would be doing it on every keystroke before the
        debounce ever saw it.
      */
      if (transaction.docChanged) {
        onChange?.()
      }
      // -> Always, and never debounced: this is what the toolbar reads, and a toolbar that lights up
      //    half a second after the caret moved is a toolbar that is wrong half the time
      onSelectionChange?.()
    }
  })

  return {
    view,
    schema,

    /** The page source as it stands. */
    getMarkdown: () => serialize(view.state.doc),

    /** The render of that source, which is what a save stores as the page's HTML. */
    getRender: () => render(serialize(view.state.doc)),

    /**
     * Undo and redo, as the document currently means them.
     *
     * Read at the moment of the click rather than captured, because what they mean changes when the
     * editor joins a session — see the keymap, which makes the same switch for `Mod-z`.
     */
    undo: () => (collaborating ? collabUndo : undo)(view.state, view.dispatch),
    redo: () => (collaborating ? collabRedo : redo)(view.state, view.dispatch),

    /**
     * A snippet of markdown as a fragment ready to be inserted.
     *
     * This is what lets the Visual editor reuse every overlay the Markdown editor has — the block
     * picker, the table editor, the file manager all hand back markdown, and it is parsed by the same
     * parser that opened the page rather than by a second set of insert paths per construct.
     */
    parseFragment(markdown) {
      return parser.parse(markdown ?? '', context.pagePath()).content
    },

    /**
     * Replace everything, for the cases where the source changed underneath the editor — a pending
     * asset's blob URL being rewritten to where the file actually landed, most of all.
     *
     * The history is deliberately left alone rather than reset: an author who undoes past this point
     * gets the document they had, which is the lesser surprise.
     */
    setMarkdown(markdown) {
      const doc = parser.parse(markdown ?? '', context.pagePath())
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
      tr.setMeta('addToHistory', false)
      view.dispatch(tr)
    },

    /**
     * Hand the document over to a collaborative session.
     *
     * Called once the room has synced and not before: the shared document is what the editor becomes,
     * and one that has not synced yet says nothing at all — binding to it early would replace the page
     * with an empty one and then save that.
     *
     * The room is seeded from what this browser is holding when nobody has filled it yet, which is
     * safe to race on; `collab.js` explains why.
     */
    enableCollab({ ydoc, awareness }) {
      seedIfEmpty(ydoc, view.state.doc)
      collaborating = true
      /*
        No `doc`: `ySyncPlugin` produces it from the shared fragment, which is what keeps the binding
        and the document in step. See the note in `collab.js`.
      */
      view.updateState(
        EditorState.create({
          schema,
          plugins: [...buildPlugins(true), ...collabPlugins({ ydoc, awareness })]
        })
      )
      /*
        The store follows immediately. What the room holds may differ from what this browser loaded --
        somebody else's unsaved edits -- and until this runs a save would send the copy that was
        replaced.
      */
      onChange?.()
    },

    destroy() {
      destroyed = true
      view.destroy()
    }
  }
}
