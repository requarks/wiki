import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'

/** A crossed-out eye, drawn rather than fetched: it is the same picture on every spoiler there is. */
const EYE_OFF_SVG = html`
  <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
    <path
      fill="currentColor"
      d="M2 5.27 3.28 4 20 20.72 18.73 22l-3.08-3.08A11.4 11.4 0 0 1 12 19.5c-5 0-9.27-3.11-11-7.5a12.2 12.2 0 0 1 4.06-5.17zm10 3.23a3.5 3.5 0 0 1 3.5 3.5c0 .47-.1.92-.27 1.33l-4.56-4.56c.41-.17.86-.27 1.33-.27M12 4.5c5 0 9.27 3.11 11 7.5a12.1 12.1 0 0 1-3.19 4.53l-2.72-2.72c.26-.55.41-1.16.41-1.81a5.5 5.5 0 0 0-5.5-5.5c-.65 0-1.26.15-1.81.41L7.96 4.96A11.4 11.4 0 0 1 12 4.5M6.5 12a5.5 5.5 0 0 0 5.5 5.5c.42 0 .83-.05 1.22-.14l-6.58-6.58c-.09.39-.14.8-.14 1.22" />
  </svg>
`

/**
 * Block Spoiler
 */
export class BlockSpoilerElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'spoiler',
    name: 'Spoiler',
    description: 'Hides content behind a cover until it is clicked.',
    icon: 'visualy-impaired',
    template: 'The content to hide.',
    props: [
      {
        name: 'label',
        type: 'string',
        label: 'Label',
        hint: 'Heading on the cover.',
        default: 'Spoiler'
      },
      {
        name: 'hint',
        type: 'string',
        label: 'Hint',
        hint: 'Line under the label.',
        default: 'Click to show content'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /*
        The content is laid out either way and only hidden from view, so the box is exactly as tall
        covered as it is revealed and nothing below it moves when a reader opens it. Hiding it by
        visibility is what does that: display:none would collapse the box, and a blur or a mask leaves
        the text on screen for anyone who looks closely enough at the pixels.
      */
      .spoiler {
        position: relative;
        margin-bottom: 16px;
        min-height: 76px;
        padding: 16px 20px;
        border: 1px solid var(--spoiler-border);
        border-radius: 6px;
        background-color: var(--spoiler-bg);
      }
      .spoiler.is-covered .content {
        visibility: hidden;
      }

      .cover {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        width: 100%;
        padding: 8px;
        border: 0;
        border-radius: 5px;
        background-color: transparent;
        color: var(--spoiler-fg);
        font: inherit;
        text-align: center;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .cover:hover {
        background-color: var(--spoiler-hover);
      }
      .cover:focus-visible {
        outline: 2px solid var(--q-primary, #1976d2);
        outline-offset: -4px;
      }

      .label {
        font-weight: 500;
        letter-spacing: 0.02em;
      }

      .hint {
        font-size: 0.8em;
        opacity: 0.75;
      }

      :host {
        --spoiler-border: #e0e0e0;
        --spoiler-bg: #f5f5f5;
        --spoiler-fg: #424242;
        --spoiler-hover: rgba(0, 0, 0, 0.04);
      }
      :host([dark]) {
        --spoiler-border: rgba(255, 255, 255, 0.15);
        --spoiler-bg: #161b22;
        --spoiler-fg: rgba(255, 255, 255, 0.75);
        --spoiler-hover: rgba(255, 255, 255, 0.06);
      }
    `
  }

  static get properties() {
    return {
      /**
       * Heading on the cover
       * @type {string}
       */
      label: { type: String },

      /**
       * Line under the label
       * @type {string}
       */
      hint: { type: String },

      // Internal Properties
      _covered: { state: true }
    }
  }

  constructor() {
    super()
    this.label = 'Spoiler'
    this.hint = 'Click to show content'
    this._covered = true
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * Drop the outermost margins of the content, the way `block-tabs` does: the box supplies the
   * padding, and a heading adding its own on top of it would push the cover's text off centre.
   */
  _trimEdgeMargins() {
    this.firstElementChild?.style.setProperty('margin-top', '0')
    this.lastElementChild?.style.setProperty('margin-bottom', '0')
  }

  connectedCallback() {
    super.connectedCallback()
    this._trimEdgeMargins()
  }

  render() {
    return html`
      <div class="spoiler ${this._covered ? 'is-covered' : ''}">
        <div class="content"><slot></slot></div>
        ${this._covered
          ? html`
              <button
                type="button"
                class="cover"
                aria-expanded="false"
                @click="${() => {
                  this._covered = false
                }}">
                ${EYE_OFF_SVG}
                <span class="label">${this.label}</span>
                <span class="hint">${this.hint}</span>
              </button>
            `
          : null}
      </div>
    `
  }
}

window.customElements.define('block-spoiler', BlockSpoilerElement)
