import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

import { useUserStore } from '@/stores/user'

/**
 * The page view's chrome giving way to the article as it is scrolled.
 *
 * Four bars sit above the article and stay there -- the site header, the breadcrumbs, the page header
 * and the Article / Talk / Links strip. On a desktop they are a quarter of the window; on a phone they
 * are a third of it, and held sideways most of it. Scrolling down puts some of them away and shrinks
 * the page header; scrolling back up, or reaching the top, brings them back. How much goes depends on
 * how much room there is -- see `tier` below. The strip always stays: it is the only way back from a
 * discussion to the page.
 *
 * The bars COLLAPSE rather than slide over the article. The article column is a scroll container of
 * its own under them (see `pages/Index.vue`), so a bar that took no room would mean moving it into
 * that column and padding the article around it, and every anchor jump would land underneath it. A
 * bar that gives up its height instead hands that height to the column: the content travels up with
 * the bar, which reads as the chrome scrolling away with the page.
 *
 * One state for the whole app, like the breakpoints in `composables/screen.js`: the site header is
 * the layout's and the rest is the page view's, and all of them have to agree on it.
 */

/*
  The three sizes the chrome collapses differently at.

  - `phone`: a phone by width, or any window under 500px high -- which is a phone on its side, where the
    bars as they stand leave around a third of the screen to the article. Everything that can go goes,
    and the page header is cut to one line of small type.
  - `tablet`: up to where the sidebar takes a column of its own (`SIDEBAR_OVERLAY_BELOW` in
    `layouts/MainLayout.vue`). The site header goes as well, and the page header is one line a size up.
  - `desktop`: from there. The site header STAYS: it spans the sidebar's column too, which would grow
    and shift under it, and at this size it is not what is crowding the article. The breadcrumbs go and
    the page header comes down a size, keeping its description.

    And only for a reader who asked for it -- Collapse Header on Scroll, under Accessibility in their
    profile, off to start with (`userStore.collapseHeaderOnScroll`). On a screen with room to spare, a
    header growing and shrinking at every change of direction is a distraction that buys little, where
    on a phone or a tablet the room it gives back is a third of the screen, so there it is not asked.

  The page header's sizes for each are in `css/_page-chrome.scss`, keyed on `data-chrome-tier`.
*/
const PHONE_QUERY = '(max-width: 599.98px), (max-height: 500px)'
const DESKTOP_QUERY = '(min-width: 1200px)'

/** Within this many pixels of the top the chrome is always out: there is nothing above to make room for. */
const TOP_ZONE = 32

/** Pixels travelled down in one go before the chrome goes, so a nudge does not hide it. */
const HIDE_AFTER = 12

/**
 * Pixels travelled UP before it comes back. More than the way down: a reader reading drifts back a
 * line now and then, and the chrome jumping in over the text each time is exactly what this removes.
 */
const REVEAL_AFTER = 36

/**
 * How much more there has to be to scroll than the chrome gives back, before it collapses at all. A page
 * barely taller than the window would stop overflowing once the bars went, its scroll position would
 * snap to the top, and the top brings them back -- a flicker on every scroll.
 */
const MIN_OVERFLOW = 240

/**
 * How long scroll events are ignored after the state flips: the transition (0.2s) changes the column's
 * height, and near the end of a page that clamps the scroll position -- which arrives as a scroll UP,
 * and would bring the chrome straight back.
 */
const SETTLE_MS = 300

function mediaRef(query) {
  const mql = window.matchMedia(query)
  const state = ref(mql.matches)
  mql.addEventListener('change', (ev) => {
    state.value = ev.matches
  })
  return state
}

const isPhone = mediaRef(PHONE_QUERY)
const isDesktop = mediaRef(DESKTOP_QUERY)

/** `phone`, `tablet` or `desktop` -- see above. A short window is a phone regardless of its width. */
const tier = computed(() => {
  if (isPhone.value) {
    return 'phone'
  }
  return isDesktop.value ? 'desktop' : 'tablet'
})

/** What the scroll says. */
const wantsCollapsed = ref(false)

/** Whatever needs the chrome on screen for now -- the phone search row while it is open, say. */
const holds = reactive(new Set())

/**
 * Whether this size collapses at all -- on a desktop, only by the reader's choice. Read off the store
 * inside the getter, which first runs once the app is mounted: at import time there may not be a pinia
 * to ask yet.
 */
const isAllowed = computed(() => tier.value !== 'desktop' || useUserStore().collapseHeaderOnScroll)

/** Whether the chrome is collapsed: the breadcrumbs away and the page header shrunk. */
const isCollapsed = computed(() => isAllowed.value && wantsCollapsed.value && holds.size === 0)

/** Whether the site header is away as well, which it never is on a desktop. */
const isSiteHeaderCollapsed = computed(() => isCollapsed.value && tier.value !== 'desktop')

/** Bring the chrome back. For focus arriving in a hidden bar, a route change, a view switch. */
function expand() {
  wantsCollapsed.value = false
}

/**
 * The shared state, for the bars themselves.
 *
 * @returns {{
 *   tier: import('vue').ComputedRef<'phone' | 'tablet' | 'desktop'>,
 *   isCollapsed: import('vue').ComputedRef<boolean>,
 *   isSiteHeaderCollapsed: import('vue').ComputedRef<boolean>,
 *   expand: () => void
 * }}
 */
export function useCollapsingChrome() {
  return { tier, isCollapsed, isSiteHeaderCollapsed, expand }
}

/**
 * Keep the chrome out for as long as `getter` is true -- and bring it back the moment it turns true.
 * Released on unmount.
 *
 * @param {() => boolean} getter
 */
export function holdChromeWhile(getter) {
  const key = Symbol('hold')
  watch(
    getter,
    (val) => {
      if (val) {
        holds.add(key)
        expand()
      } else {
        holds.delete(key)
      }
    },
    { immediate: true }
  )
  onBeforeUnmount(() => holds.delete(key))
}

/**
 * Drive the state from a scroll container -- the page view's article column.
 *
 * @param {() => HTMLElement | null | undefined} getScroller The element that scrolls. Watched, so it may
 *   come and go (the editor replaces it, a missing page has none).
 */
export function trackChromeScroll(getScroller) {
  let el = null
  let lastTop = 0
  let travel = 0
  let settleUntil = 0
  let frame = 0

  function set(val) {
    if (wantsCollapsed.value === val) {
      return
    }
    wantsCollapsed.value = val
    travel = 0
    settleUntil = performance.now() + SETTLE_MS
  }

  function update() {
    frame = 0
    if (!el) {
      return
    }
    const max = el.scrollHeight - el.clientHeight
    // -> Clamped, so iOS's rubber band past either end is not read as a change of direction
    const top = Math.min(Math.max(el.scrollTop, 0), Math.max(max, 0))
    const delta = top - lastTop
    lastTop = top

    if (performance.now() < settleUntil) {
      travel = 0
      return
    }
    if (top <= TOP_ZONE) {
      set(false)
      return
    }
    if (delta === 0) {
      return
    }
    if (Math.sign(delta) !== Math.sign(travel)) {
      travel = 0
    }
    travel += delta
    if (travel > HIDE_AFTER && max > MIN_OVERFLOW) {
      set(true)
    } else if (travel < -REVEAL_AFTER) {
      set(false)
    }
  }

  function onScroll() {
    if (!frame) {
      frame = requestAnimationFrame(update)
    }
  }

  function detach() {
    el?.removeEventListener('scroll', onScroll)
    if (frame) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    el = null
  }

  watch(
    () => getScroller() ?? null,
    (next) => {
      detach()
      expand()
      if (next) {
        el = next
        lastTop = el.scrollTop
        travel = 0
        el.addEventListener('scroll', onScroll, { passive: true })
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    detach()
    expand()
  })
}

/**
 * Publish an element's own height as `--chrome-h` on it, for a bar that collapses by pulling itself up
 * by that much (`margin-top: calc(-1 * var(--chrome-h))`). Measured because the breadcrumbs wrap onto as
 * many lines as the path needs.
 *
 * @param {() => HTMLElement | null | undefined} getEl
 */
export function exposeChromeHeight(getEl) {
  let observer = null
  watch(
    () => getEl() ?? null,
    (el) => {
      observer?.disconnect()
      observer = null
      if (el) {
        observer = new ResizeObserver(([entry]) => {
          const height = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
          el.style.setProperty('--chrome-h', `${height}px`)
        })
        observer.observe(el)
      }
    },
    { immediate: true, flush: 'post' }
  )
  onBeforeUnmount(() => observer?.disconnect())
}
