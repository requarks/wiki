import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'
import { toneColor } from '../shared/tones.js'

/**
 * Block Badge
 *
 * A short status label in a line of text -- Beta, Deprecated, v3.2+:
 * `:block-badge[Beta]{color="warning"}` in markdown, `block-badge:[Beta, color=warning]` in AsciiDoc.
 *
 * The label is the element's own text rather than a prop, so it still reads as a word in the sentence
 * before this component has loaded and on a site that switched the block off.
 */
export class BlockBadgeElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'badge',
    name: 'Badge',
    description: 'A short status label in a line of text, such as Beta, New or Deprecated.',
    icon: 'tags',
    inline: true,
    // -> The value an editor starts it with, between the brackets
    template: 'New',
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
        name: 'variant',
        type: 'select',
        label: 'Style',
        hint: 'Soft is a tint that sits quietly in the text; solid stands out from it.',
        options: [
          { label: 'Soft', value: 'soft' },
          { label: 'Solid', value: 'solid' },
          { label: 'Outline', value: 'outline' }
        ],
        default: 'soft'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: inline;
      }

      /*
        An inline-block holding nothing but text, so its baseline is the text's and the label sits on
        the line with the words around it. Smaller and bolder than they are, and a hair apart, which
        is what makes it read as a label rather than as an emphasised word.
      */
      .badge {
        display: inline-block;
        padding: 0 0.5em;
        border: 1px solid transparent;
        border-radius: 999px;
        font-size: 0.75em;
        font-weight: 600;
        letter-spacing: 0.02em;
        line-height: 1.6;
        white-space: nowrap;
      }

      .badge.is-soft {
        background-color: color-mix(in srgb, var(--tone) 14%, transparent);
        color: color-mix(in srgb, var(--tone) 85%, black);
      }
      :host([dark]) .badge.is-soft {
        background-color: color-mix(in srgb, var(--tone) 22%, transparent);
        color: color-mix(in srgb, var(--tone) 70%, white);
      }

      .badge.is-solid {
        background-color: var(--tone);
        color: #fff;
      }

      .badge.is-outline {
        border-color: var(--tone);
        color: var(--tone);
      }
      :host([dark]) .badge.is-outline {
        color: color-mix(in srgb, var(--tone) 70%, white);
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
       * `soft`, `solid` or `outline`
       * @type {string}
       */
      variant: { type: String },

      // Internal Properties
      _label: { state: true }
    }
  }

  constructor() {
    super()
    this.color = 'primary'
    this.variant = 'soft'
    this._label = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * The label, read before the first render rather than after it (as `firstUpdated` would), so the
   * first frame is the badge and not the "empty" marker.
   */
  willUpdate() {
    if (!this.hasUpdated) {
      this._label = (this.textContent ?? '').trim()
    }
  }

  render() {
    if (!this._label) {
      return html`<span class="error" title="This badge has no label.">(empty badge)</span>`
    }
    const variant = ['soft', 'solid', 'outline'].includes(this.variant) ? this.variant : 'soft'
    return html`<span class="badge is-${variant}" style="--tone: ${toneColor(this.color)}"
      >${this._label}</span
    >`
  }
}

window.customElements.define('block-badge', BlockBadgeElement)
