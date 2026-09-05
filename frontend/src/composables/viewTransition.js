import { nextTick } from 'vue'

/**
 * Apply a change to the app as a single cross-fade, through the View Transition API.
 *
 * A page swap is not one paint. The title, the description, the breadcrumbs and the article are
 * separate pieces of the same screen, and each of them lands in whichever frame it is ready in -- so
 * for an instant the reader is looking at half of the page they left and half of the one arriving.
 * That is what this is for: the browser holds the old screen still, the callback makes the change,
 * and the two states are cross-faded rather than cut between.
 *
 * The update is awaited before the animation begins, so `update` may be async -- but keep it SHORT.
 * Rendering is suppressed for as long as it runs, which is exactly the point (nothing may repaint
 * half-swapped) and exactly the danger: a fetch in here freezes the interface for the length of the
 * round trip. Fetch first, then call this with the part that touches the DOM.
 *
 * Resolves once the DOM has been updated, NOT once the animation has finished -- what comes after a
 * page swap is more work on the content that just landed (loading its blocks, scrolling to the
 * heading in the URL), and none of that should wait on a fade.
 *
 * @param {() => void|Promise<void>} update Makes the change. Called exactly once, with or without a
 *   transition -- so this is safe to use as the only path.
 */
export async function withViewTransition(update) {
  // -> Vue renders on its own schedule, so the change is not in the DOM until the queue has flushed;
  //    without this the browser captures the new state before it exists and there is nothing to fade
  const applyAndRender = async () => {
    await update()
    await nextTick()
  }

  // -> Not in every browser yet (Safari and Firefox trail Chromium here), and nothing about this is
  //    load-bearing: without the API the change simply happens the way it did before
  if (!document.startViewTransition) {
    return applyAndRender()
  }

  const transition = document.startViewTransition(applyAndRender)
  /*
    `updateCallbackDone` rather than `finished`: it rejects with whatever `update` threw, which is
    what the caller wants to see, while `finished` swallows it and resolves anyway. `ready` is the
    third one and is deliberately untouched -- it REJECTS when a transition is skipped (a second
    navigation before this one settled), which is an ordinary outcome here rather than an error.
  */
  await transition.updateCallbackDone
}
