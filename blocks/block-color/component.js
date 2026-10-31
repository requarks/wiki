import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'

/**
 * Block Color
 *
 * A colour code in a line of text, with a swatch of the colour in front of it:
 * `:block-color[#ff6600]` in markdown, `block-color:[#ff6600]` in AsciiDoc.
 *
 * The code is the element's own text rather than a prop. That is what a reader sees before this
 * component has loaded, and what is left when an administrator switches the block off, so the
 * sentence still reads either way.
 */
export class BlockColorElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'color',
    name: 'Color',
    description: 'A colour code in a line of text, with a swatch of the colour beside it.',
    icon: 'fill-color',
    inline: true,
    // -> The value an editor starts it with, between the brackets
    template: '#1976d2',
    props: []
  }

  static get styles() {
    return css`
      :host {
        display: inline;
        --color-border: rgba(0, 0, 0, 0.2);
        --color-bg: rgba(0, 0, 0, 0.04);
      }
      :host([dark]) {
        --color-border: rgba(255, 255, 255, 0.25);
        --color-bg: rgba(255, 255, 255, 0.06);
      }

      /*
        Aligned by baseline, so the box takes the baseline of its TEXT and the code sits on the line
        with the words around it. With the items centred, its baseline was the first item's -- the
        swatch, which has no text and so reports its bottom edge -- and the whole box rode high.
      */
      .color {
        display: inline-flex;
        align-items: baseline;
        gap: 0.35em;
        padding: 0 0.35em;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg);
        font-family: monospace;
        font-size: 0.9em;
        line-height: 1.5;
        white-space: nowrap;
        vertical-align: baseline;
      }

      /*
        The colour is painted over a checkerboard, so that one with an alpha channel reads as
        see-through rather than as a lighter shade of itself. The border is what keeps white visible
        on a white page and black on a dark one.
      */
      .swatch {
        /* -> Centred on the text instead, and out of the baseline the box is measured by */
        align-self: center;
        display: inline-block;
        width: 0.9em;
        height: 0.9em;
        border: 1px solid var(--color-border);
        border-radius: 2px;
        background:
          linear-gradient(var(--swatch), var(--swatch)),
          repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 0.5em 0.5em;
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
      // Internal Properties
      _value: { state: true }
    }
  }

  constructor() {
    super()
    this._value = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * The value, read before the first render rather than after it (as `firstUpdated` would), so the
   * first frame is the swatch and not the "empty" marker.
   */
  willUpdate() {
    if (!this.hasUpdated) {
      this._value = (this.textContent ?? '').trim()
    }
  }

  render() {
    /*
      Asked of the browser rather than matched against a pattern, so every colour CSS can draw is
      accepted -- `rgb()`, `hsl()`, `oklch()`, a named colour -- and nothing it cannot draw reaches
      the style below.
    */
    if (!CSS.supports('color', this._value)) {
      const shown = this._value || '(empty colour)'
      return html`<span class="error" title="This is not a colour CSS can draw.">${shown}</span>`
    }
    return html`<span class="color"
      ><span class="swatch" style="--swatch: ${this._value}" aria-hidden="true"></span
      >${this._value}</span
    >`
  }
}

window.customElements.define('block-color', BlockColorElement)
