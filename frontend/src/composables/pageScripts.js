import { computed, nextTick, onScopeDispose, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'

/**
 * The style element carrying the current page's CSS. One per document: only one page is on screen at
 * a time, so this is replaced rather than added to, and a page without CSS has none at all.
 */
const STYLE_ID = 'page-styles'

/**
 * Apply the page's CSS, replacing whatever the previous page had.
 *
 * Appended to the head, so these rules come after the app's own stylesheets and win a tie on order --
 * which is what a per-page override is for. It is not scoped to the article: the field is documented
 * as "CSS rules to add to the page", and a page that wants to restyle the header or the sidebar for
 * its own visit is the reason it exists.
 *
 * @param {string} css
 */
function applyStyles(css) {
  const existing = document.getElementById(STYLE_ID)
  if (!css?.trim()) {
    existing?.remove()
    return
  }
  const el = existing ?? document.createElement('style')
  el.id = STYLE_ID
  el.textContent = css
  if (!existing) {
    document.head.appendChild(el)
  }
}

/**
 * Run one of the page's scripts.
 *
 * A `<script>` element rather than `new Function(code)()`, for three reasons. It runs the code as a
 * classic script at top level, so `var`, a function declaration or a `const` the author expects to
 * find from an inline handler in the content lands where they expect it. It throws nowhere this
 * caller can see -- a broken page script is reported as an uncaught error on `window`, the way a
 * broken script in a document is, instead of taking the page view's own code down with it. And under
 * a Content-Security-Policy it needs `script-src 'unsafe-inline'` rather than `'unsafe-eval'`, which
 * is the lesser of the two to have to allow.
 *
 * The element is removed the moment it has run: insertion is what executes it and it is inert from
 * then on, so leaving it behind would only pile up one dead element per navigation.
 *
 * @param {string} code
 */
function execute(code) {
  if (!code?.trim()) {
    return
  }
  const el = document.createElement('script')
  el.type = 'text/javascript'
  el.textContent = code
  document.body.appendChild(el)
  el.remove()
}

/**
 * The page's own CSS and Javascript, on the page the reader is looking at.
 *
 * The three fields the properties panel writes -- `scriptCss`, `scriptJsLoad`, `scriptJsUnload` --
 * are stored per page and, until this existed, were never applied to anything: they came down with
 * every page and nothing read them. This is where they take effect, in the page view, because that is
 * where the page's content actually is.
 *
 * What runs when:
 *
 * - **CSS** is in force for as long as the page is on screen, the editor included -- an author
 *   writing rules for a page wants to see them applied to it, and the dialog patches the store as it
 *   is saved, so the change shows immediately.
 * - **`jsLoad`** runs once the page's content is in the document, which is the tick after the store
 *   changes: the element the script goes looking for has to exist by then.
 * - **`jsUnload`** runs before that content is destroyed -- walking to another page, opening the
 *   editor over it, or leaving the page view altogether. The code that runs is the one the page on
 *   screen came with, captured when its load script ran, since by the time a navigation gets here the
 *   store already holds the page arriving.
 *
 * What does NOT run either of them is the script itself changing. The properties panel writes these
 * fields into the page store as they are edited -- the panel opens over a page being read as well as
 * over one being written -- so a watcher on the code would run an author's Javascript the moment they
 * pressed Save in the editor dialog, against the page behind it and before it was saved anywhere.
 * Arriving at the page is the event; the code is read when it happens.
 *
 * A page nobody is reading runs nothing: not while the editor is over it -- what is on screen there is
 * a preview being typed into rather than the page -- not on a path with no page, and not on a locked
 * one, whose body the server never sent.
 *
 * A full document unload (a reload, a closed tab) is deliberately not one of the cases: the document
 * and everything the script did to it are going away regardless, and a `beforeunload` handler that
 * runs a page's arbitrary Javascript is a good way to make leaving the wiki slow.
 */
export function usePageScripts() {
  const editorStore = useEditorStore()
  const pageStore = usePageStore()
  const route = useRoute()

  /** The unload script of the page currently on screen, kept from when its load script ran. */
  let liveUnload = ''

  /** Whether there is a page on screen at all -- one that arrived, with a body to style or script. */
  const hasPage = computed(
    () => Boolean(pageStore.id) && !pageStore.notFound && !pageStore.isLocked
  )

  watch(() => (hasPage.value ? pageStore.scriptCss : ''), applyStyles, { immediate: true })

  /**
   * Whether the page on screen is being written rather than read.
   *
   * Two answers, because neither covers the other. `isActive` is the editor being opened over a page
   * from the page's own URL, which is how the Edit button does it -- the route never moves. The route
   * test is for arriving at `/_edit/<page>` or `/_create` directly, where the editor is what the
   * reader asked for but is not open yet: the page is fetched into the store first and the editor's
   * own configuration after that, and in the gap between the two nothing but the URL says that this
   * page is not simply being read. That gap is a round trip wide, so it is not one a later re-check
   * can close -- the script would have run long before.
   */
  const isEditing = computed(
    () => editorStore.isActive || /^\/_(edit|create)(\/|$)/.test(route.path)
  )

  /**
   * The page whose Javascript is live: its id while it is being read, and null while it is not -- no
   * page, a locked one, or the editor over it.
   */
  const liveId = computed(() => (hasPage.value && !isEditing.value ? pageStore.id : null))

  /*
    So the callback fires on arriving at a page, on leaving one, and on the editor opening and closing
    over one, and on nothing else.

    A `pre` watcher (the default), which is the whole reason the unload script still has a page to act
    on: it runs before the components re-render, so the store already describes the page arriving
    while the document still holds the one being left. (The URL has moved on by then too -- the router
    navigates first -- so a script reading `location` during unload sees where the reader is going.)
  */
  watch(
    liveId,
    (next) => {
      runUnload()
      if (!next) {
        return
      }
      // -> The tick that puts the new page's content in the document; the script runs against it
      nextTick(() => {
        /*
          Asked again rather than trusted from the watcher: a tick is long enough for the reader to
          have gone somewhere else, and this script is only ever meant to run against the page that is
          actually on screen when it does.
        */
        if (liveId.value !== next) {
          return
        }
        liveUnload = pageStore.scriptJsUnload
        execute(pageStore.scriptJsLoad)
      })
    },
    { immediate: true }
  )

  /** Run the on-screen page's unload script, once. */
  function runUnload() {
    const code = liveUnload
    liveUnload = ''
    execute(code)
  }

  // -> The page view itself going away: the search screen, the admin area, a profile page
  onScopeDispose(() => {
    runUnload()
    applyStyles('')
  })
}
