import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'
import { toneColor } from '../shared/tones.js'

/**
 * `70%`, `7/10`, or a bare `70` read as a percentage. A count (`7/10`) keeps its two numbers, so the
 * label can say "7/10" where that is what the author counted in.
 *
 * @returns {{ ratio: number, done?: number, total?: number } | null} `ratio` from 0 to 1, clamped: a
 *          task 120% done is a full bar, not one running out of its track.
 */
function parseProgress(source) {
  const number = String.raw`(\d+(?:\.\d+)?)`
  const percent = new RegExp(String.raw`^${number}\s*%?$`).exec(source)
  if (percent) {
    return { ratio: Math.min(Number.parseFloat(percent[1]) / 100, 1) }
  }
  const count = new RegExp(String.raw`^${number}\s*/\s*${number}$`).exec(source)
  const done = count && Number.parseFloat(count[1])
  const total = count && Number.parseFloat(count[2])
  if (!count || total <= 0) {
    return null
  }
  return { ratio: Math.min(done / total, 1), done, total }
}

/**
 * Block Progress
 *
 * A small progress bar in a line of text, for a status page or a roadmap:
 * `:block-progress[70%]` or `:block-progress[7/10]` in markdown, `block-progress:[70%]` in AsciiDoc.
 *
 * The figure is the element's own text rather than a prop, so `70%` is still there, as written,
 * before this component has loaded and on a site that switched the block off.
 */
export class BlockProgressElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'progress',
    name: 'Progress',
    description: 'A small progress bar in a line of text, from a percentage or a count like 7/10.',
    icon: 'todo-list',
    inline: true,
    // -> The value an editor starts it with, between the brackets
    template: '50%',
    props: [
      {
        name: 'color',
        type: 'select',
        label: 'Color',
        hint: "Taken from the site's theme.",
        options: [
          { label: 'Primary', value: 'primary' },
          { label: 'Positive', value: 'positive' },
          { label: 'Negative', value: 'negative' },
          { label: 'Warning', value: 'warning' },
          { label: 'Info', value: 'info' },
          { label: 'Grey', value: 'grey' }
        ],
        default: 'primary'
      },
      {
        name: 'label',
        type: 'select',
        label: 'Label',
        hint: 'What is written after the bar. As written keeps a count as a count, 7/10.',
        options: [
          { label: 'Percentage', value: 'percent' },
          { label: 'As written', value: 'value' },
          { label: 'None', value: 'none' }
        ],
        default: 'percent'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: inline;
        --progress-track: rgba(0, 0, 0, 0.1);
      }
      :host([dark]) {
        --progress-track: rgba(255, 255, 255, 0.14);
      }

      /*
        Aligned by baseline, so the box takes the baseline of its label and sits on the line with the
        words around it; the bar, which has no text to have one, is centred on the label instead. With
        no label at all, the bar is all there is and its bottom edge is the baseline.
      */
      .progress {
        display: inline-flex;
        align-items: baseline;
        gap: 0.4em;
        white-space: nowrap;
      }

      .track {
        align-self: center;
        display: inline-block;
        width: 5em;
        height: 0.5em;
        border-radius: 999px;
        background-color: var(--progress-track);
        overflow: hidden;
      }

      .fill {
        display: block;
        height: 100%;
        border-radius: inherit;
        background-color: var(--tone);
      }

      .label {
        font-size: 0.85em;
        font-variant-numeric: tabular-nums;
        opacity: 0.8;
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
       * `primary`, `positive`, `negative`, `warning`, `info` or `grey`
       * @type {string}
       */
      color: { type: String },

      /**
       * `percent`, `value` or `none`
       * @type {string}
       */
      label: { type: String },

      // Internal Properties
      _source: { state: true }
    }
  }

  constructor() {
    super()
    this.color = 'primary'
    this.label = 'percent'
    this._source = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * The figure, read before the first render rather than after it (as `firstUpdated` would), so the
   * first frame is the bar and not the "empty" marker.
   */
  willUpdate() {
    if (!this.hasUpdated) {
      this._source = (this.textContent ?? '').trim()
    }
  }

  render() {
    const progress = parseProgress(this._source)
    if (!progress) {
      const shown = this._source || '(empty progress)'
      const error = this._source
        ? 'This is not a figure this block can read. Write a percentage, e.g. 70%, or a count, e.g. 7/10.'
        : 'This progress bar is empty.'
      return html`<span class="error" title=${error}>${shown}</span>`
    }
    const percent = new Intl.NumberFormat(undefined, {
      style: 'percent',
      maximumFractionDigits: 0
    }).format(progress.ratio)
    const label =
      this.label === 'none'
        ? null
        : this.label === 'value' && progress.total
          ? `${progress.done}/${progress.total}`
          : percent

    return html`<span
      class="progress"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${Math.round(progress.ratio * 100)}
      aria-valuetext=${label ?? percent}
      title=${this._source}
      ><span class="track"
        ><span
          class="fill"
          style="width: ${progress.ratio * 100}%; --tone: ${toneColor(this.color)}"></span></span
      >${label ? html`<span class="label">${label}</span>` : null}</span
    >`
  }
}

window.customElements.define('block-progress', BlockProgressElement)
