import { ref } from 'vue'

/**
 * The thin progress bar along the top edge of the viewport, shown while a page is on its way.
 *
 * Module singleton, rendered by `<page-progress-bar>` in App.vue. Nothing here knows how far along a
 * load actually is -- a route change and a page fetch report no progress -- so the bar creeps towards
 * the end on its own and only reaches it when every piece of work that started it has said it is done.
 *
 * Several things may hold it at once: the router holds it from `beforeEach` to `afterEach`, and the
 * page view then holds it again for the fetch of the page itself. Those two do not overlap -- the
 * page view only hears about the route once the router has finished with it -- so finishing waits
 * `SETTLE` ms for somebody else to pick it up, and the reader sees one run rather than two.
 */

/** Progress from 0 to 1. */
export const progress = ref(0)

/** Whether the bar is on screen. Goes false once it has filled, which is what fades it out. */
export const isActive = ref(false)

/**
 * Bumped at the start of each run, for the component to key the bar on. A new run gets a new
 * element, so it starts from nothing rather than sliding backwards from the end of the last one.
 */
export const run = ref(0)

/** How long a finished load waits for another one to take over before the bar completes. */
const SETTLE = 100

/** How often the bar creeps forward while nothing has finished. */
const TRICKLE_INTERVAL = 200

/** Never reached by creeping alone, so that the bar has somewhere left to go when the load ends. */
const TRICKLE_CEILING = 0.92

/** How long the bar sits full before fading, so that the end of it is seen. Matches its CSS. */
const FILL_DURATION = 200

let holders = 0
let trickleTimer = null
let settleTimer = null
let fadeTimer = null

function trickle() {
  // -> A tenth of what is left each time: quick at first, slower the longer the load takes
  progress.value += (TRICKLE_CEILING - progress.value) * 0.1
}

function complete() {
  settleTimer = null
  clearInterval(trickleTimer)
  trickleTimer = null
  progress.value = 1
  fadeTimer = setTimeout(() => {
    fadeTimer = null
    isActive.value = false
  }, FILL_DURATION)
}

export const pageProgress = {
  /**
   * Show the bar, or keep it going when it already is.
   *
   * @returns A function that ends this hold on it. Calling it more than once does nothing, so it is
   *   safe in a `finally` and in an error path both.
   */
  start() {
    holders++
    clearTimeout(settleTimer)
    settleTimer = null

    if (trickleTimer === null) {
      // -> Idle, or fading out from the last run: either way this is a new one
      clearTimeout(fadeTimer)
      fadeTimer = null
      run.value++
      progress.value = 0.1
      isActive.value = true
      trickleTimer = setInterval(trickle, TRICKLE_INTERVAL)
    }

    let released = false
    return () => {
      if (released) {
        return
      }
      released = true
      holders--
      if (holders === 0) {
        settleTimer = setTimeout(complete, SETTLE)
      }
    }
  }
}
