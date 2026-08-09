import { LitElement, html, css } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { mathjax } from '@mathjax/src/js/mathjax.js'
import { TeX } from '@mathjax/src/js/input/tex.js'
import { SVG } from '@mathjax/src/js/output/svg.js'
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js'
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/js/svg.js'
import { MathJaxMhchemFontExtension } from '@mathjax/mathjax-mhchem-font-extension/js/svg.js'
/*
  Every TeX package the block understands, imported for its side effect: a configuration registers
  itself under its name, and `PACKAGES` below is what then switches it on.

  This is the set MathJax's own "all packages" bundle carries, less three of them. `html` is left out
  because it exists to put HTML into the page from inside TeX — a link, a class, a style attribute —
  which is not what a formula is for. `noerrors` and `noundefined` are left out because both answer a
  mistake by drawing something: the unreadable source in place of the formula, or a black box where a
  macro should have been. Without them the error reaches this file, which has a panel to say so in.

  Nothing here loads anything at run time. `require` and `autoload` are absent for that reason: both
  fetch a package the moment TeX asks for one, which cannot work in a bundle — the block is a single
  file served from /_blocks, with no MathJax install behind it to fetch from.
*/
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js'
import '@mathjax/src/js/input/tex/action/ActionConfiguration.js'
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js'
import '@mathjax/src/js/input/tex/amscd/AmsCdConfiguration.js'
import '@mathjax/src/js/input/tex/bbox/BboxConfiguration.js'
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js'
import '@mathjax/src/js/input/tex/braket/BraketConfiguration.js'
import '@mathjax/src/js/input/tex/bussproofs/BussproofsConfiguration.js'
import '@mathjax/src/js/input/tex/cancel/CancelConfiguration.js'
import '@mathjax/src/js/input/tex/cases/CasesConfiguration.js'
import '@mathjax/src/js/input/tex/centernot/CenternotConfiguration.js'
import '@mathjax/src/js/input/tex/color/ColorConfiguration.js'
import '@mathjax/src/js/input/tex/colortbl/ColortblConfiguration.js'
import '@mathjax/src/js/input/tex/empheq/EmpheqConfiguration.js'
import '@mathjax/src/js/input/tex/enclose/EncloseConfiguration.js'
import '@mathjax/src/js/input/tex/extpfeil/ExtpfeilConfiguration.js'
import '@mathjax/src/js/input/tex/gensymb/GensymbConfiguration.js'
import '@mathjax/src/js/input/tex/mathtools/MathtoolsConfiguration.js'
import '@mathjax/src/js/input/tex/mhchem/MhchemConfiguration.js'
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js'
import '@mathjax/src/js/input/tex/physics/PhysicsConfiguration.js'
import '@mathjax/src/js/input/tex/textcomp/TextcompConfiguration.js'
import '@mathjax/src/js/input/tex/textmacros/TextMacrosConfiguration.js'
import '@mathjax/src/js/input/tex/unicode/UnicodeConfiguration.js'
import '@mathjax/src/js/input/tex/upgreek/UpgreekConfiguration.js'
import '@mathjax/src/js/input/tex/verb/VerbConfiguration.js'

import { DarkMode } from '../shared/theme.js'

const PACKAGES = [
  'base',
  'action',
  'ams',
  'amscd',
  'bbox',
  'boldsymbol',
  'braket',
  'bussproofs',
  'cancel',
  'cases',
  'centernot',
  'color',
  'colortbl',
  'empheq',
  'enclose',
  'extpfeil',
  'gensymb',
  'mathtools',
  'mhchem',
  'newcommand',
  'physics',
  'textcomp',
  'textmacros',
  'unicode',
  'upgreek',
  'verb'
]

/**
 * MathJax, set up once for the page.
 *
 * Off the document entirely: the SVG output measures nothing in the DOM — it has the metrics of every
 * glyph in the font it draws with — so a formula can be typeset against a document MathJax makes up
 * for itself and handed back as markup. That is what makes it usable from inside a shadow root, which
 * MathJax has no notion of and where its own stylesheet in the page would not reach.
 */
const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const output = new SVG({
  fontData: MathJaxNewcmFont,
  /*
    Each formula carries its own glyph definitions. The alternative, one cache for the page, is a
    single hidden `svg` in the document that every formula points into — and a reference from inside a
    shadow root does not resolve to it, so every letter would come out blank.
  */
  fontCache: 'local'
})

/*
  mhchem's bonds, arrows and brackets are glyphs of their own, in a font variant the text font has no
  reason to carry. Added here rather than fetched: MathJax's own build loads this on demand the first
  time a `\ce` turns up, which is the one thing a bundled block cannot do.
*/
output.font.addExtension(MathJaxMhchemFontExtension)

const document_ = mathjax.document('', {
  InputJax: new TeX({
    packages: PACKAGES,
    // -> Handing the error on rather than drawing it: see the panel in `render`
    formatError: (jax, err) => {
      throw err
    }
  }),
  OutputJax: output
})

/**
 * Block MathJax
 */
export class BlockMathjaxElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'mathjax',
    name: 'MathJax',
    description:
      'Typesets a TeX formula, including chemical equations written with mhchem — \\ce{} and \\pu{}.',
    icon: 'sigma',
    /*
      Fenced, and not as a nicety: TeX is made of the characters markdown reads as its own. A lone
      backslash goes missing, `_` and `^` open emphasis, `\\` at the end of a line is a break, and the
      typographer rewrites quotes and dashes inside the source. Inside a fence it arrives as typed.
    */
    template: `\`\`\`latex
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\`\`\``,
    props: [
      {
        name: 'caption',
        type: 'string',
        label: 'Caption',
        hint: 'Shown under the formula.'
      },
      {
        name: 'align',
        type: 'select',
        label: 'Alignment',
        options: ['center', 'left'],
        default: 'center'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /* -> The gap below the block. On this element rather than :host: see block-index. */
      .formula,
      .error {
        margin-bottom: 16px;
      }

      .formula {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      .formula.is-left {
        align-items: flex-start;
      }

      /*
        A formula wider than the column scrolls rather than shrinks, the way a display equation in the
        text does — see .katex-display in css/_page-contents.scss. Shrinking is the wrong answer for
        something read symbol by symbol: a long derivation would end up a grey smear.
      */
      .drawing {
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        /* -> Room for the scrollbar to appear without it sitting on the descenders */
        padding: 0.2em 0;
      }

      /*
        The drawing takes the colour of the text around it: MathJax paints its glyphs in currentColor,
        so dark mode needs nothing here — unlike a block that picks its own colours.
      */
      svg {
        display: block;
      }

      .caption {
        color: #424242;
        font-size: 0.8em;
        text-align: center;
      }
      :host([dark]) .caption {
        color: rgba(255, 255, 255, 0.7);
      }

      .error {
        color: var(--q-negative, #c10015);
        border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
        border-radius: 5px;
        padding: 1rem;
        white-space: pre-wrap;
      }
    `
  }

  static get properties() {
    return {
      /**
       * Text shown under the formula
       * @type {string}
       */
      caption: { type: String },

      /**
       * Where the formula sits in the column, `center` or `left`
       * @type {string}
       */
      align: { type: String },

      // Internal Properties
      _svg: { state: true },
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.caption = ''
    this.align = 'center'
    this._svg = ''
    this._error = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * Typeset the source, or say why it could not be.
   */
  _typeset(source, fenced) {
    try {
      const container = document_.convert(source, { display: true })
      const drawing = adaptor.firstChild(container)
      /*
        The formula named for a reader who cannot see it. MathJax's own answer to this is a MathML
        copy of the expression alongside the drawing, which needs its stylesheet in the page to stay
        hidden and its speech engine to read well — neither of which a block in a shadow root has. The
        source is what is left, and it is what the author wrote: imperfectly read aloud, but the
        drawing already carries role="img", and an image with no name at all is worse.
      */
      adaptor.setAttribute(drawing, 'aria-label', source)
      this._svg = adaptor.outerHTML(drawing)
      this._error = ''
    } catch (err) {
      this._svg = ''
      this._error = `This formula could not be typeset: ${err.message ?? err}`
      if (!fenced) {
        this._error +=
          '\n\nThe source has to go inside a fenced code block, or markdown rewrites it before this block sees it.'
      }
    }
  }

  firstUpdated() {
    /*
      The source is the block's body, taken from the fence markdown left behind. `textContent` is what
      undoes the escaping that put `&amp;` and `&lt;` in the markup, and gives back what was typed.
    */
    const fence = this.querySelector('pre')
    const source = ((fence ?? this).textContent ?? '').trim()
    if (!source) {
      this._error =
        'This formula is empty. Its TeX source goes in the body of the block, inside a fenced code block.'
      return
    }
    this._typeset(source, Boolean(fence))
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    return html`
      <div class="formula ${this.align === 'left' ? 'is-left' : ''}">
        <div class="drawing">${unsafeSVG(this._svg)}</div>
        ${this.caption ? html`<div class="caption">${this.caption}</div>` : null}
      </div>
    `
  }
}

window.customElements.define('block-mathjax', BlockMathjaxElement)
