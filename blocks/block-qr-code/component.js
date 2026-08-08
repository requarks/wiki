import { LitElement, html, css } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { renderSVG } from 'uqr'

/**
 * Block QR Code
 */
export class BlockQrCodeElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'qr-code',
    name: 'QR Code',
    description: 'Shows a QR code for a link or a piece of text.',
    icon: 'qr',
    props: [
      {
        name: 'value',
        type: 'string',
        label: 'Content',
        hint: 'Text or URL to encode. The address of this page when left empty.'
      },
      {
        name: 'size',
        type: 'number',
        label: 'Size',
        hint: 'Width of the code in pixels.',
        default: 180
      },
      {
        name: 'caption',
        type: 'string',
        label: 'Caption',
        hint: 'Shown under the code.'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /* -> The gap below the block. On this element rather than :host: see block-index. */
      .qr {
        margin-bottom: 16px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 5px;
        /*
          White in both themes, and padded: a code is read by a camera looking for dark squares on a
          light field, so inverting it for dark mode would make it harder to scan, not easier.
        */
        background-color: #fff;
      }
      :host-context(body.body--dark) .qr {
        border-color: rgba(255, 255, 255, 0.15);
      }

      /* -> The drawing is sized here, so the box grows by its own padding rather than eating into it */
      .qr svg {
        display: block;
        width: var(--qr-size);
        height: auto;
      }

      .caption {
        max-width: var(--qr-size);
        color: #424242;
        font-size: 0.8em;
        text-align: center;
        overflow-wrap: anywhere;
      }

      .error {
        color: var(--q-negative, #c10015);
        border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
        border-radius: 5px;
        padding: 1rem;
        margin-bottom: 16px;
      }
    `
  }

  static get properties() {
    return {
      /**
       * Text or URL to encode
       * @type {string}
       */
      value: { type: String },

      /**
       * Width of the code in pixels
       * @type {number}
       */
      size: { type: Number },

      /**
       * Text shown under the code
       * @type {string}
       */
      caption: { type: String },

      // Internal Properties
      _svg: { state: true },
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.value = ''
    this.size = 180
    this.caption = ''
    this._svg = ''
    this._error = ''
  }

  /**
   * What the code stands for.
   *
   * An empty `value` means this page, which is the common case — a printed page, or a screen someone
   * wants to carry on their phone. Taken from the address bar rather than built from the site config,
   * so it is the URL the reader is actually looking at, and without the fragment, which points at a
   * place on the page rather than at the page.
   */
  _encoded() {
    return this.value?.trim() || `${window.location.origin}${window.location.pathname}`
  }

  connectedCallback() {
    super.connectedCallback()
    try {
      // -> Drawn at a fixed scale and sized by CSS, so the same markup is crisp at any width
      this._svg = renderSVG(this._encoded(), { border: 1, pixelSize: 8 })
    } catch {
      // -> Every symbol size has a ceiling, and a long enough string clears the largest of them
      this._error = 'This is too long to fit in a QR code.'
    }
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    const size = `${Math.min(Math.max(Number(this.size) || 180, 80), 600)}px`
    return html`
      <div class="qr" style="--qr-size: ${size}">
        ${unsafeSVG(this._svg)}
        ${this.caption ? html`<div class="caption">${this.caption}</div>` : null}
      </div>
    `
  }
}

window.customElements.define('block-qr-code', BlockQrCodeElement)
