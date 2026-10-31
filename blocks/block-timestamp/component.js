import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'

const LENGTHS = ['short', 'medium', 'long', 'full']

/**
 * How the shown text is worded, by `format`. Relative wording is built separately.
 *
 * A `full` time stops at `long`: the full form spells the zone out ("Central European Standard
 * Time"), which in the middle of a sentence is longer than the rest of it.
 */
const FORMATS = {
  datetime: (style) => ({ dateStyle: style, timeStyle: style === 'full' ? 'long' : style }),
  date: (style) => ({ dateStyle: style }),
  time: (style) => ({ timeStyle: style === 'full' ? 'long' : style })
}

/**
 * A moment as the reader's locale writes it in their own timezone, down to the minute or the second.
 *
 * `dateStyle` and `timeStyle` are what give each locale its own shape -- `03.11.2026` in German rather
 * than `3. Nov. 2026` -- and they cannot be told to leave the seconds out, nor combined with the
 * `hour` / `minute` options that could. So the seconds are taken back out of the formatted parts,
 * with the one separator that belongs to them: the punctuation in front (`:` in `9:05:37`, `.` in
 * Finnish `9.05.37`), or, where that carries the minute's own unit word, the seconds' unit word after
 * them (Korean `9시 5분 37초`, Thai `05 นาที 37 วินาที`).
 */
function formatMoment(instant, options, precision) {
  const parts = new Intl.DateTimeFormat(undefined, options).formatToParts(instant.epochMilliseconds)
  const at = precision === 'second' ? -1 : parts.findIndex((part) => part.type === 'second')
  if (at >= 0) {
    const before = parts[at - 1]
    const separator = before?.type === 'literal' && !/\p{L}/u.test(before.value) ? at - 1 : at + 1
    parts.splice(Math.min(at, separator), 2)
  }
  return parts.map((part) => part.value).join('')
}

/**
 * The units a relative time is worded in, largest first, with how many seconds each is. Months and
 * years are averages: "in 3 months" is a figure of speech, not a calendar computation.
 */
const RELATIVE_UNITS = [
  ['year', 365.25 * 86400],
  ['month', 30.44 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1]
]

/** A value that parsed but cannot be placed, with a message worth showing as it is. */
class TimestampError extends Error {}

/**
 * Block Timestamp
 *
 * A moment in a line of text, shown in the reader's own timezone and locale:
 * `:block-timestamp[2026-11-03T14:00Z]` in markdown, `block-timestamp:[2026-11-03T14:00Z]` in
 * AsciiDoc.
 *
 * The ISO value is the element's own text rather than a prop. That is what a reader sees before this
 * component has loaded, and what is left when an administrator switches the block off -- unambiguous,
 * if not friendly.
 */
export class BlockTimestampElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'timestamp',
    name: 'Timestamp',
    description: "A date and time in a line of text, shown in the reader's own timezone.",
    icon: 'timezone',
    inline: true,
    // -> The value an editor starts it with, between the brackets
    template: '2026-01-01T12:00:00Z',
    props: [
      {
        name: 'format',
        type: 'select',
        label: 'Format',
        hint: 'What is shown. Relative reads as "in 3 days" or "2 hours ago", and keeps itself up to date.',
        options: [
          { label: 'Date and time', value: 'datetime' },
          { label: 'Date only', value: 'date' },
          { label: 'Time only', value: 'time' },
          { label: 'Relative', value: 'relative' }
        ],
        default: 'datetime'
      },
      {
        name: 'length',
        type: 'select',
        label: 'Length',
        hint: 'How much is spelled out, from 11/3/26 (short) to Tuesday, November 3, 2026 (full).',
        options: ['short', 'medium', 'long', 'full'],
        default: 'medium'
      },
      {
        name: 'precision',
        type: 'select',
        label: 'Precision',
        hint: 'The smallest unit shown. Seconds are rarely worth the room they take in a sentence.',
        options: [
          { label: 'Minute', value: 'minute' },
          { label: 'Second', value: 'second' }
        ],
        default: 'minute'
      },
      {
        name: 'timezone',
        type: 'string',
        label: 'Written In',
        hint: 'IANA name, e.g. Europe/Paris, that a value with no offset of its own is read in. The reader always sees their own timezone.',
        default: 'UTC'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: inline;
        --timestamp-underline: rgba(0, 0, 0, 0.35);
      }
      :host([dark]) {
        --timestamp-underline: rgba(255, 255, 255, 0.4);
      }

      /* -> Dotted, like an abbreviation: there is more to it on hover */
      time {
        border-bottom: 1px dotted var(--timestamp-underline);
        cursor: help;
      }

      .error {
        color: var(--q-negative, #c10015);
        border-bottom: 1px dashed currentColor;
        cursor: help;
        font-family: monospace;
      }
    `
  }

  static get properties() {
    return {
      /**
       * `datetime`, `date`, `time` or `relative`
       * @type {string}
       */
      format: { type: String },

      /**
       * `short`, `medium`, `long` or `full`
       * @type {string}
       */
      length: { type: String },

      /**
       * `minute` or `second`, the smallest unit shown
       * @type {string}
       */
      precision: { type: String },

      /**
       * The IANA timezone a value without an offset is read in
       * @type {string}
       */
      timezone: { type: String },

      // Internal Properties
      _now: { state: true }
    }
  }

  constructor() {
    super()
    this.format = 'datetime'
    this.length = 'medium'
    this.precision = 'minute'
    this.timezone = 'UTC'
    this._source = ''
    this._now = null
    this._timer = null
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * The value, as the moment it names.
   *
   * Three shapes are accepted, and they mean different things:
   *
   * - **With an offset** (`2026-11-03T14:00Z`, `…-05:00`, a `[Zone]` annotation after it) -- an
   *   exact moment, the same one for every reader, shown on each reader's own clock.
   * - **Without one** (`2026-11-03T14:00`) -- a wall-clock time in `timezone`, which is what turns
   *   it into a moment. The same rule `block-countdown` reads its date by.
   * - **A date alone** (`2026-11-03`) -- the same day everywhere. It has no moment to convert, so it
   *   is shown as written, and never with a time.
   *
   * @returns {{ instant: Temporal.Instant } | { date: Temporal.PlainDate }}
   */
  _parse() {
    const source = this._source
    if (/^[+-]?\d{4,6}-\d{2}-\d{2}$/.test(source)) {
      return { date: Temporal.PlainDate.from(source) }
    }
    try {
      return { instant: Temporal.Instant.from(source) }
    } catch {
      // -> No offset, so a wall-clock time -- read in a zone that has to exist, or it is the wrong moment
      const zone = this.timezone?.trim() || 'UTC'
      try {
        Temporal.Now.zonedDateTimeISO(zone)
      } catch {
        throw new TimestampError(`"${zone}" is not a known timezone.`)
      }
      return { instant: Temporal.PlainDateTime.from(source).toZonedDateTime(zone).toInstant() }
    }
  }

  /**
   * "in 3 days", "2 hours ago", in the largest unit that is at least one whole of itself, and never
   * a unit smaller than `smallest` -- a date alone is "today", not "now".
   */
  _relative(seconds, smallest = 'second') {
    const words = new Intl.RelativeTimeFormat(undefined, {
      numeric: 'auto',
      style: this.length === 'short' ? 'short' : 'long'
    })
    const units = RELATIVE_UNITS.slice(
      0,
      RELATIVE_UNITS.findIndex(([unit]) => unit === smallest) + 1
    )
    const [unit, size] = units.find(([, size]) => Math.abs(seconds) >= size) ?? units.at(-1)
    return words.format(Math.round(seconds / size), unit)
  }

  /**
   * What is shown, what the tooltip spells out, and the `datetime` a machine reads.
   */
  _describe() {
    const parsed = this._parse()
    const length = LENGTHS.includes(this.length) ? this.length : 'medium'
    const pick = FORMATS[this.format] ?? FORMATS.datetime

    if (parsed.date) {
      const days = parsed.date.since(Temporal.Now.plainDateISO(), { largestUnit: 'day' }).days
      return {
        machine: parsed.date.toString(),
        text:
          this.format === 'relative'
            ? this._relative(days * 86400, 'day')
            : parsed.date.toLocaleString(undefined, { dateStyle: length }),
        title: parsed.date.toLocaleString(undefined, { dateStyle: 'full' })
      }
    }

    const { instant } = parsed
    const precision = this.precision === 'second' ? 'second' : 'minute'
    const seconds = instant.since(this._now ?? Temporal.Now.instant()).total('second')
    return {
      // -> To the second regardless of precision: this is for machines, which lose nothing by it
      machine: instant.toString({ smallestUnit: 'second' }),
      text:
        this.format === 'relative'
          ? this._relative(seconds, precision)
          : formatMoment(instant, pick(length), precision),
      // -> The full moment, with the zone named, so a reader can tell it is their own clock
      title: formatMoment(instant, { dateStyle: 'full', timeStyle: 'long' }, precision)
    }
  }

  /**
   * The value, read before the first render rather than after it (as `firstUpdated` would), so the
   * first frame is the date and not the "empty" marker.
   */
  willUpdate() {
    if (!this.hasUpdated) {
      this._source = (this.textContent ?? '').trim()
    }
  }

  connectedCallback() {
    super.connectedCallback()
    // -> Only a relative time goes out of date while it is on the screen
    if (this.format === 'relative') {
      this._timer = setInterval(() => {
        this._now = Temporal.Now.instant()
      }, 30_000)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    clearInterval(this._timer)
    this._timer = null
  }

  render() {
    let described
    try {
      described = this._describe()
    } catch (err) {
      const shown = this._source || '(empty timestamp)'
      let error = 'This timestamp is empty.'
      if (err instanceof TimestampError) {
        error = err.message
      } else if (this._source) {
        error =
          'This is not a date this block can read. Write it as ISO 8601, e.g. 2026-11-03T14:00Z.'
      }
      return html`<span class="error" title=${error}>${shown}</span>`
    }
    return html`<time datetime=${described.machine} title=${described.title}
      >${described.text}</time
    >`
  }
}

window.customElements.define('block-timestamp', BlockTimestampElement)
