/**
 * Installs a `Temporal` polyfill on browsers that don't implement it natively yet (Safari, as of
 * mid-2026). The import is dynamic and guarded, so browsers with native support never download it.
 *
 * Must run before anything that touches `Temporal` — it is awaited first in `main.js`.
 */
export async function initializeTemporal () {
  if (typeof globalThis.Temporal !== 'undefined') {
    return
  }

  // -> Patches globalThis.Temporal, Intl.DateTimeFormat and Date.prototype.toTemporalInstant
  await import('temporal-polyfill/global')
}
