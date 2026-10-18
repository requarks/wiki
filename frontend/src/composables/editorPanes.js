import { computed, reactive, ref, watch } from 'vue'

import { useMinWidth } from '@/composables/screen'

/**
 * How the author last left a source editor: whether the preview and the Contents pane were open, and
 * whether the preview followed the caret. Per browser, like the file manager's view options: it is how
 * somebody likes to edit, not something about the page -- so one entry for every page and every note,
 * in the Markdown and AsciiDoc editors alike.
 */
const STORAGE_KEY = 'wiki.editor.view'

/**
 * The remembered view, each option taken only if it is still a boolean -- the entry outlives the code
 * that wrote it, and may have been hand-edited. A missing or unreadable one is a first visit: all on.
 */
function storedView() {
  let stored = null
  try {
    stored = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null')
  } catch {
    // -> Unreadable is the same as absent
  }
  const option = (key) => (typeof stored?.[key] === 'boolean' ? stored[key] : true)
  return {
    previewShown: option('previewShown'),
    previewScrollSync: option('previewScrollSync'),
    contentsOpen: option('contentsOpen')
  }
}

/**
 * The side panes of a source editor -- the render preview and the Contents pane -- and what the window
 * has to say about them.
 */
export function useEditorPanes() {
  /**
   * Whether the window is wide enough to open the preview beside the source, and the Contents pane
   * beside that.
   *
   * 1024 is the app's `md` breakpoint (`css/tailwind.css`). Below it the two panes are half a small
   * window each, and the source is the one being typed into -- so the preview starts closed and is
   * opened when wanted, from the toolbar button that takes its place.
   */
  const isAtLeastMd = useMinWidth(1024)

  const remembered = storedView()

  const panes = reactive({
    /*
      Read once, as a DEFAULT rather than a binding: past this first value the pane is the author's to
      open and close, and a bound one would slam it shut the moment a window was dragged narrower
      mid-edit. What was remembered only decides a window wide enough for it; a narrow one starts
      closed whatever the author does on a desktop.
    */
    previewShown: isAtLeastMd.value && remembered.previewShown,
    previewScrollSync: remembered.previewScrollSync,
    /** Whether the author has the Contents pane open. The window has a say too -- see `contentsShown`. */
    contentsOpen: remembered.contentsOpen
  })

  /*
    Written on every change, which is to say only when the author flips one: the narrow window's closed
    preview is a starting state rather than a choice, and is never written over what was chosen on a
    wide one.
  */
  watch(
    () => [panes.previewShown, panes.previewScrollSync, panes.contentsOpen],
    ([previewShown, previewScrollSync, contentsOpen]) => {
      try {
        globalThis.localStorage?.setItem(
          STORAGE_KEY,
          JSON.stringify({ previewShown, previewScrollSync, contentsOpen })
        )
      } catch {
        // -> Full, or storage denied: everything still works, it is just not remembered
      }
    }
  )

  /** Whether the Contents column is drawn: a window with room for a third column, and not closed. */
  const contentsShown = computed(() => isAtLeastMd.value && panes.contentsOpen)

  /**
   * Whether the preview is laid out as though the Contents pane were beside it -- which is
   * `contentsShown`, except that it stays true while the pane is sliding away and only lets go once it
   * has gone (`contentsLeft`, from the transition's `after-leave`).
   *
   * The preview's measure is worked out from the window rather than from its pane (`has-contents` in
   * the stylesheets), so dropping it the moment the pane starts to close would widen the preview's text
   * past a pane that is still taking room from it, and clip it for the half second of the slide.
   * Opening needs no such wait: the preview narrows at once and the pane grows into the room.
   */
  const contentsLaidOut = ref(contentsShown.value)
  watch(contentsShown, (shown) => {
    if (shown) {
      contentsLaidOut.value = true
    }
  })

  function contentsLeft() {
    contentsLaidOut.value = false
  }

  /**
   * Whether the toolbar offers to bring the Contents pane back: closed by the author, where it could
   * be open. Not merely "not shown" -- a window too narrow for it has no use for a button that opens
   * nothing.
   */
  const contentsClosed = computed(() => isAtLeastMd.value && !panes.contentsOpen)

  return { panes, contentsShown, contentsLaidOut, contentsLeft, contentsClosed }
}
