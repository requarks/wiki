/**
 * Publishes the device pixel ratio as `--w-dpr` on the document root.
 *
 * Hairline rules (`.w-hairline`, see css/tailwind.css) scale themselves by `1 / var(--w-dpr)` so
 * the painted line is exactly one *device* pixel rather than one CSS pixel.
 *
 * Without this a 1px CSS rule is 1 device pixel at 100% scaling but 1.5 at 150%, so rules render
 * noticeably heavier on a fractionally-scaled display -- measured at ~48% more ink at 150%. Rules
 * drawn by different mechanisms, or seen at different zoom levels, then disagree about how thick
 * "1px" is. Pinning the paint to one device pixel makes the weight identical at every scale.
 *
 * There is no CSS unit for a device pixel, so the ratio has to come from script. It changes when
 * the user zooms or drags the window to a monitor with a different scaling factor, so it is
 * re-read rather than sampled once at boot.
 */
export function initializeHairlines() {
  let query = null

  function apply() {
    const dpr = window.devicePixelRatio || 1
    document.documentElement.style.setProperty('--w-dpr', String(dpr))

    /*
      Watch for this exact ratio ceasing to hold. A `(resolution: Xdppx)` query flips the moment
      the ratio moves, which is the only reliable notification -- there is no devicepixelratio
      event, and `resize` does not fire for every zoom step in every browser.
    */
    query?.removeEventListener('change', apply)
    query = window.matchMedia(`(resolution: ${dpr}dppx)`)
    query.addEventListener('change', apply)
  }

  apply()
}
