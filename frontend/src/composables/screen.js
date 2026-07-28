import { ref } from 'vue'

/**
 * Reactive viewport breakpoint state.
 *
 * Replaces `$q.screen`, scoped to the two things the app asked it: whether the viewport is at or
 * above a breakpoint, and the matching `gt.*` shorthand.
 *
 * Breakpoints match `css/tailwind.css`, which in turn matches the ones the templates were written
 * against -- note `sm` starts at 600px here, not Tailwind's stock 640px.
 */
const BREAKPOINTS = {
  sm: 600,
  md: 1024,
  lg: 1440,
  xl: 1920
}

/**
 * One shared listener per breakpoint for the whole app, rather than one per calling component:
 * every consumer wants the same answer, and matchMedia listeners are not free.
 */
const queries = new Map()

function queryFor(minWidth) {
  if (!queries.has(minWidth)) {
    const mql = window.matchMedia(`(min-width: ${minWidth}px)`)
    const state = ref(mql.matches)
    mql.addEventListener('change', (ev) => {
      state.value = ev.matches
    })
    queries.set(minWidth, state)
  }
  return queries.get(minWidth)
}

export function useScreen() {
  return {
    /**
     * `gt.sm` is true above the breakpoint's own range, i.e. at `md` and wider -- the same meaning
     * the old `$q.screen.gt.*` had, so call sites read identically.
     */
    gt: {
      get xs() {
        return queryFor(BREAKPOINTS.sm).value
      },
      get sm() {
        return queryFor(BREAKPOINTS.md).value
      },
      get md() {
        return queryFor(BREAKPOINTS.lg).value
      },
      get lg() {
        return queryFor(BREAKPOINTS.xl).value
      }
    },
    /** True at or above the named breakpoint. */
    gte: {
      get sm() {
        return queryFor(BREAKPOINTS.sm).value
      },
      get md() {
        return queryFor(BREAKPOINTS.md).value
      },
      get lg() {
        return queryFor(BREAKPOINTS.lg).value
      },
      get xl() {
        return queryFor(BREAKPOINTS.xl).value
      }
    }
  }
}

/**
 * True at or above `minWidth` px. Used by `WDrawer` for its `showIfAbove` behaviour.
 * @param {number} minWidth
 */
export function useMinWidth(minWidth) {
  // -> The ref is shared app-wide and intentionally outlives any single component, so there is
  //    nothing to tear down here; at most one matchMedia listener exists per breakpoint.
  return queryFor(minWidth)
}
