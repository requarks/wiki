/**
 * Date and duration rendering for the admin tables, in the reader's own locale.
 *
 * Shared because three screens had grown their own copy of the same walk down a units table — one of
 * them under a different name — and the copies had already started to drift. What stays local to a
 * screen is ABSOLUTE formatting: the scheduler spells out seconds because a job's timing is the point,
 * where the instances table does not, and anything a user chose a pattern for goes through
 * `userStore.formatDate()` instead.
 *
 * `Intl` rather than a formatting library: the browser already knows how the reader's locale words
 * "3 minutes ago" and "1h 4m 32s", which is what luxon's `toRelative()` and `Duration.toHuman()` were
 * here for.
 */

/*
  Largest first, so the first unit the difference clears is the one it reads best in. `week` is
  deliberately absent, so output reads e.g. "21 days ago".
*/
const RELATIVE_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1]
]

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/**
 * How long ago a moment was, or how far off it still is.
 *
 * Reads both ways on purpose: past for history, future for a job still waiting its turn.
 *
 * @param {string|null} value An ISO instant, as the API returns.
 * @returns {string} e.g. `3 minutes ago`, `in 2 days`, or `---` for nothing at all.
 */
export function relativeDate(value) {
  if (!value) {
    return '---'
  }
  const seconds = Temporal.Instant.from(value).until(Temporal.Now.instant()).total('seconds')
  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsPerUnit || unit === 'second') {
      return relativeTimeFormat.format(-Math.round(seconds / secondsPerUnit), unit)
    }
  }
}

/** Narrow, largest-first and skipping empty units — "1h 4m 32s", or "820ms" for a quick job. */
const DURATION_UNITS = ['hour', 'minute', 'second', 'millisecond']
const durationListFormat = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit' })

/**
 * How long something took.
 *
 * @param {string|null} start An ISO instant.
 * @param {string|null} end An ISO instant.
 * @returns {string} e.g. `1h 4m 32s`, or `---` when either end is missing.
 */
export function humanizeDuration(start, end) {
  if (!start || !end) {
    return '---'
  }
  const dur = Temporal.Instant.from(start).until(Temporal.Instant.from(end)).round({
    largestUnit: 'hour',
    smallestUnit: 'millisecond'
  })
  const parts = DURATION_UNITS.filter((unit) => dur[`${unit}s`] > 0).map((unit) =>
    new Intl.NumberFormat(undefined, {
      style: 'unit',
      unit,
      unitDisplay: 'narrow'
    }).format(dur[`${unit}s`])
  )
  // -> Something that took under a millisecond still has to render as something
  return parts.length > 0 ? durationListFormat.format(parts) : '0ms'
}
