import { LitElement, html, css } from 'lit'
import { deflate } from 'pako'
import { DarkMode } from '../shared/theme.js'

/** The default server, which is the one Kroki runs for everybody. */
const DEFAULT_SERVER = 'https://kroki.io'

/**
 * Everything Kroki draws, as it is named in a URL.
 *
 * Kroki is a front end to a shelf of diagram tools rather than one of its own, so unlike PlantUML the
 * language has to be named alongside the source — the same text is a valid diagram in more than one
 * of these. `diagramsnet` is the one Kroki documents that is left out: the public server answers 503
 * for it.
 */
const TYPES = [
  'actdiag',
  'blockdiag',
  'bpmn',
  'bytefield',
  'c4plantuml',
  'd2',
  'dbml',
  'ditaa',
  'erd',
  'excalidraw',
  'graphviz',
  'mermaid',
  'nomnoml',
  'nwdiag',
  'packetdiag',
  'pikchr',
  'plantuml',
  'rackdiag',
  'seqdiag',
  'structurizr',
  'svgbob',
  'symbolator',
  'tikz',
  'umlet',
  'vega',
  'vegalite',
  'wavedrom',
  'wireviz'
]

/** How many bytes are turned into characters at a time, below. */
const CHUNK_SIZE = 0x8000

/**
 * A diagram source as it goes into a Kroki URL: deflated, then written as base64url.
 *
 * Zlib deflate — with the two-byte header, unlike PlantUML's raw stream — and then plain base64 with
 * `-` and `_` for the two characters that mean something else in a URL. The padding is dropped: Kroki
 * decodes with or without it, and `=` at the end of a path segment is noise.
 *
 * `btoa` takes a string, and spreading a whole diagram into `String.fromCharCode` at once overflows
 * the stack somewhere in the tens of thousands of bytes — hence a chunk at a time.
 *
 * The result is about 1.4 characters per character of source, so a very large diagram can outgrow what
 * a server will accept in a URL. That is a limit of this transport, and the way past it is Kroki's
 * POST endpoint, which is not implemented here.
 */
function encodeForUrl(source) {
  const bytes = deflate(new TextEncoder().encode(source), { level: 9 })
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * Block Kroki
 */
export class BlockKrokiElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'kroki',
    name: 'Kroki',
    description:
      'Draws a diagram through a Kroki server — Graphviz, D2, BPMN, Vega, Structurizr, TikZ and two dozen more.',
    icon: 'tree-structure',
    /*
      Fenced, and named `kroki` whatever the diagram language turns out to be, since that is the block
      reading it. The fence is also what keeps markdown off the source: `--` becomes a dash, a line
      opening with `*` or `#` is read as a list or a heading, an indented line becomes a code block of
      its own, and `_` opens emphasis.
    */
    template: `\`\`\`kroki
digraph G {
  Hello -> World
}
\`\`\``,
    props: [
      {
        name: 'type',
        type: 'select',
        label: 'Diagram type',
        // -> Written out rather than taken from TYPES above: the manifest is read out of this file's
        //    syntax tree at build time, where a name is just a name
        options: [
          'actdiag',
          'blockdiag',
          'bpmn',
          'bytefield',
          'c4plantuml',
          'd2',
          'dbml',
          'ditaa',
          'erd',
          'excalidraw',
          'graphviz',
          'mermaid',
          'nomnoml',
          'nwdiag',
          'packetdiag',
          'pikchr',
          'plantuml',
          'rackdiag',
          'seqdiag',
          'structurizr',
          'svgbob',
          'symbolator',
          'tikz',
          'umlet',
          'vega',
          'vegalite',
          'wavedrom',
          'wireviz'
        ],
        hint: 'The language the source is written in. Kroki cannot tell from the text alone.',
        default: 'graphviz'
      },
      {
        name: 'server',
        type: 'string',
        label: 'Server',
        hint: 'Kroki server to draw with. The public one when left empty.',
        default: 'https://kroki.io'
      },
      {
        name: 'format',
        type: 'select',
        label: 'Format',
        options: ['svg', 'png'],
        hint: 'svg stays sharp at any size; png is there for the few types that draw nothing else.',
        default: 'svg'
      },
      {
        name: 'caption',
        type: 'string',
        label: 'Caption',
        hint: 'Shown under the diagram.'
      },
      {
        name: 'align',
        type: 'select',
        label: 'Alignment',
        options: ['left', 'center'],
        default: 'left'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /* -> The gap below the block. On this element rather than :host: see block-index. */
      .diagram,
      .error {
        margin-bottom: 16px;
      }

      .diagram {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .diagram.is-center {
        align-items: center;
      }

      /*
        The drawing sits on white in both themes, padded, the way a QR code does. Most of what Kroki
        draws with draws in black on nothing at all, so on a dark page a diagram left to the page's
        background is black on black — and its own colours, where a diagram has them, are picked to
        sit on paper.
      */
      .sheet {
        max-width: 100%;
        padding: 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 5px;
        background-color: #fff;
        /* -> A diagram wider than the column scrolls rather than shrinking to illegibility */
        overflow-x: auto;
      }
      :host([dark]) .sheet {
        border-color: rgba(255, 255, 255, 0.15);
      }

      img {
        display: block;
        /* -> Its own size, up to the width of the column */
        max-width: 100%;
        height: auto;
      }

      /*
        The fallback for a drawing that has no size of its own: see _measure below. The sheet takes
        the column instead of hugging the picture, which gives the picture a width to scale against —
        which is what a browser does with any image that has a shape and no size. The height is then
        bounded, since a tall shape scaled to the width of a column runs to several screens, and the
        drawing is fitted inside what that leaves.
      */
      .diagram.is-unsized .sheet {
        align-self: stretch;
      }
      .diagram.is-unsized img {
        width: 100%;
        max-height: 60vh;
        object-fit: contain;
      }

      .caption {
        color: #424242;
        font-size: 0.8em;
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
       * The diagram language the source is written in
       * @type {string}
       */
      type: { type: String },

      /**
       * Kroki server to draw with
       * @type {string}
       */
      server: { type: String },

      /**
       * Image format to ask the server for, `svg` or `png`
       * @type {string}
       */
      format: { type: String },

      /**
       * Text shown under the diagram
       * @type {string}
       */
      caption: { type: String },

      /**
       * Where the diagram sits in the column, `left` or `center`
       * @type {string}
       */
      align: { type: String },

      // Internal Properties
      _src: { state: true },
      _unsized: { state: true },
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.type = 'graphviz'
    this.server = DEFAULT_SERVER
    this.format = 'svg'
    this.caption = ''
    this.align = 'left'
    this._src = ''
    this._unsized = false
    this._error = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * Catch a drawing that came out with no size at all.
   *
   * An SVG carrying a `viewBox` and no `width` has a shape but no size, and a box that shrinks to fit
   * its contents has nothing to resolve against — so the picture lays out at zero and the block draws
   * an empty white square. d2, pikchr, blockdiag and seqdiag write their SVG that way; graphviz,
   * mermaid, ditaa and most of the rest give theirs a size and are left alone.
   *
   * Read after the load rather than guessed at beforehand, since the file itself cannot be inspected:
   * the server it came from need not allow this page to fetch it. Both measurements are needed — a
   * block inside a closed spoiler or an unselected tab measures zero throughout, and is not this.
   */
  _measure(img) {
    if (img.clientWidth === 0 && this.renderRoot.querySelector('.sheet')?.clientWidth > 0) {
      this._unsized = true
    }
  }

  /**
   * Where the drawing comes from.
   *
   * An `img` rather than markup fetched and inlined, because that is the one way of asking that needs
   * nothing of the server beyond the picture: kroki.io sends no CORS headers at all, so a `fetch` for
   * the same URL is refused. It also means the browser caches the drawing like any other image.
   */
  _url(source) {
    const server = (this.server?.trim() || DEFAULT_SERVER).replace(/\/+$/, '')
    const type = TYPES.includes(this.type) ? this.type : 'graphviz'
    const format = this.format === 'png' ? 'png' : 'svg'
    return `${server}/${type}/${format}/${encodeForUrl(source)}`
  }

  /**
   * Say what went wrong, having been told only that the image did not load.
   *
   * Not the case of a diagram Kroki cannot read, nor of a type that does not match the source: asked
   * for an image, Kroki answers both with an image saying so, and a browser draws it whatever status
   * came with it — so a mistake in the source shows up as the tool's own message where the diagram
   * would have been, which is the best place for it. (Asked for anything else, as a `fetch` is by
   * default, the same server answers `400` and a line of text. The `Accept` header is the difference,
   * and it is another reason this block draws through an `img`.)
   *
   * What is left is a server that did not answer, or answered with something that is not an image: a
   * wrong address, a host that cannot be reached from where the reader is, a login page. The request
   * is made a second time to tell those apart. Best effort — kroki.io sends no CORS headers at all, so
   * that second request is refused there and the message below stands as it is. Nothing about drawing
   * a diagram depends on any of it.
   */
  async _explain(url) {
    // -> Resolved against the page, since a server may perfectly well be a path on this wiki
    const absolute = new URL(url, window.location.href)
    this._error = `The diagram could not be drawn by ${absolute.origin}.`
    try {
      const response = await fetch(absolute)
      if (!response.ok) {
        this._error = `The server answered ${response.status} ${response.statusText} for this diagram.`
      }
    } catch {
      // -> Unreachable, blocked, or simply not a Kroki server; the message above says as much
      this._error += ' Check the server address, and that the page may reach it.'
    }
  }

  firstUpdated() {
    /*
      The source is the block's body, taken from the fence markdown left behind. `textContent` is what
      undoes the escaping that put `--&gt;` in the markup, and gives back what the author typed.
    */
    const fence = this.querySelector('pre')
    const source = ((fence ?? this).textContent ?? '').trim()
    if (!source) {
      this._error =
        'This diagram is empty. Its source goes in the body of the block, inside a ```kroki fence.'
      return
    }
    this._src = this._url(source)
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    /*
      Nothing at all until the URL exists, which is the first thing `firstUpdated` does — and it runs
      after this. An `img` rendered without one carries `src=""`, which a browser resolves to the page
      itself, fetches, fails to read as an image, and reports as a failed diagram.
    */
    if (!this._src) {
      return null
    }
    return html`
      <div
        class="diagram ${this.align === 'center' ? 'is-center' : ''} ${
          this._unsized ? 'is-unsized' : ''
        }">
        <div class="sheet">
          <img
            src="${this._src}"
            alt="${this.caption || `${this.type} diagram`}"
            @load="${(e) => this._measure(e.target)}"
            @error="${() => this._explain(this._src)}" />
        </div>
        ${this.caption ? html`<div class="caption">${this.caption}</div>` : null}
      </div>
    `
  }
}

window.customElements.define('block-kroki', BlockKrokiElement)
