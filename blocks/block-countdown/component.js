import { LitElement, html, css } from 'lit'

/**
 * Block Countdown
 */
export class BlockCountdownElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'countdown',
    name: 'Countdown',
    description: 'Counts down to a date and time.',
    icon: 'timer',
    props: [
      {
        name: 'date',
        type: 'string',
        label: 'Target Date',
        hint: 'ISO date and time, e.g. 2026-12-25T09:00. Read in the timezone below unless it carries an offset of its own.',
        required: true
      },
      {
        name: 'timezone',
        type: 'string',
        label: 'Timezone',
        hint: "IANA name, e.g. Europe/Paris. The reader's own timezone when empty.",
        default: 'UTC'
      },
      {
        name: 'label',
        type: 'string',
        label: 'Label',
        hint: 'What is being counted down to. Shown above the numbers.'
      },
      {
        name: 'expiredMsg',
        type: 'string',
        label: 'Ended Message',
        hint: 'Shown once the target has passed.',
        default: 'The countdown has ended.'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /*
        The gap below a block lives on this element, not on :host.

        The app resets the margin on every element, and a rule in the page beats a :host rule in the
        shadow tree whatever its specificity -- so a margin set on the host is simply dropped. Set
        inside the shadow root it is out of that rule's reach, and collapses out through the host,
        which carries no padding or border of its own.
      */
      .countdown,
      .error {
        margin-bottom: 16px;
      }

      .countdown {
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 5px;
        padding: 1rem;
        text-align: center;
        background-image: linear-gradient(to bottom, #fff, #fafafa);
      }
      :host-context(body.body--dark) .countdown {
        border-color: rgba(255, 255, 255, 0.15);
        background-image: linear-gradient(to bottom, #161b22, #0d1117);
      }

      .label {
        font-weight: 500;
        font-size: 1.1em;
        margin-bottom: 0.75rem;
      }

      .segments {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.5rem;
      }

      .segment {
        min-width: 72px;
        padding: 0.5rem 0.75rem;
        border-radius: 5px;
        background-color: rgba(0, 0, 0, 0.04);
      }
      :host-context(body.body--dark) .segment {
        background-color: rgba(255, 255, 255, 0.06);
      }

      .value {
        font-size: 2rem;
        font-weight: 500;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
        color: var(--q-primary, #1976d2);
      }

      .unit {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.7;
      }

      .target {
        margin-top: 0.75rem;
        font-size: 0.8em;
        opacity: 0.7;
      }

      .ended {
        font-weight: 500;
      }

      .error {
        color: var(--q-negative, #c10015);
        border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
        border-radius: 5px;
        padding: 1rem;
      }
    `
  }

  static get properties() {
    return {
      /**
       * Target date and time, ISO 8601
       * @type {string}
       */
      date: { type: String },

      /**
       * IANA timezone the target is expressed in
       * @type {string}
       */
      timezone: { type: String },

      /**
       * What the countdown is for
       * @type {string}
       */
      label: { type: String },

      /**
       * Shown once the target has passed
       * @type {string}
       */
      expiredMsg: { type: String },

      // Internal Properties
      _remaining: { state: true },
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.date = ''
    this.timezone = 'UTC'
    this.label = ''
    this.expiredMsg = 'The countdown has ended.'
    this._remaining = null
    this._error = ''
    this._target = null
    this._timer = null
  }

  /**
   * Resolve the target into a zoned instant.
   *
   * A date carrying its own offset — `2026-12-25T09:00-05:00`, or a trailing `Z` — is an exact moment
   * and the timezone only decides how it is displayed. Without one it is a wall-clock time, which is
   * what an author writing "the ninth of December at nine" means, and the timezone is what turns it
   * into a moment. Both then count down to the same instant for every reader, wherever they are.
   */
  _resolveTarget(zone) {
    try {
      return Temporal.Instant.from(this.date).toZonedDateTimeISO(zone)
    } catch {
      return Temporal.PlainDateTime.from(this.date).toZonedDateTime(zone)
    }
  }

  _tick() {
    const now = Temporal.Now.zonedDateTimeISO(this._target.timeZoneId)
    if (Temporal.ZonedDateTime.compare(now, this._target) >= 0) {
      this._remaining = null
      this._stop()
      return
    }
    // -> Through ZonedDateTime rather than Instant, so that a day is a day across a DST change and
    //    not always exactly 24 hours
    this._remaining = now.until(this._target, { largestUnit: 'day', smallestUnit: 'second' })
  }

  _stop() {
    clearInterval(this._timer)
    this._timer = null
  }

  connectedCallback() {
    super.connectedCallback()
    // -> An empty timezone means the reader's own, which is also what an unknown one must not
    //    silently become: a countdown to the wrong moment is worse than a visible mistake
    const zone = this.timezone?.trim() || Temporal.Now.timeZoneId()
    try {
      Temporal.Now.zonedDateTimeISO(zone)
    } catch {
      this._error = `"${zone}" is not a known timezone.`
      return
    }
    try {
      this._target = this._resolveTarget(zone)
    } catch {
      this._error = `"${this.date}" is not a date this can count down to.`
      return
    }
    this._tick()
    if (this._remaining) {
      this._timer = setInterval(() => this._tick(), 1000)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._stop()
  }

  _segment(value, unit) {
    return html`
      <div class="segment">
        <div class="value">${value}</div>
        <div class="unit">${value === 1 ? unit : `${unit}s`}</div>
      </div>
    `
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    if (!this._target) {
      return null
    }
    /*
      Spelled out field by field rather than with `dateStyle` / `timeStyle`, which cannot be combined
      with `timeZoneName` — and the zone is the point: a reader in another country needs to see which
      clock the target is on, not just a time that does not match their own.
    */
    const at = this._target.toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    })
    return html`
      <div class="countdown">
        ${this.label ? html`<div class="label">${this.label}</div>` : null}
        ${this._remaining
          ? html`
              <div class="segments">
                ${this._remaining.days > 0 ? this._segment(this._remaining.days, 'Day') : null}
                ${this._segment(this._remaining.hours, 'Hour')}
                ${this._segment(this._remaining.minutes, 'Minute')}
                ${this._segment(this._remaining.seconds, 'Second')}
              </div>
            `
          : html`<div class="ended">${this.expiredMsg}</div>`}
        <div class="target">${at}</div>
      </div>
    `
  }
}

window.customElements.define('block-countdown', BlockCountdownElement)
