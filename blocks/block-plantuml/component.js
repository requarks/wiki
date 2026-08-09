import { LitElement, html, css } from 'lit'
import { deflateRaw } from 'pako'
import { DarkMode } from '../shared/theme.js'

/** The default server, which is the one PlantUML runs for everybody. */
const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml'

/**
 * PlantUML's own alphabet for the text it carries in a URL.
 *
 * Base64 by shape but not by order — digits first, then the letters, and `-_` for the last two — so
 * the standard encoders cannot be used and this is done by hand below.
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_'

/**
 * A diagram source as it goes into a PlantUML URL: deflated, then written in that alphabet.
 *
 * Raw deflate with no zlib header, which is what the server's decoder expects. Three bytes at a time
 * become four characters; a group short of three is padded with zeros, and the server disregards what
 * the padding decodes to.
 *
 * The result is about 1.4 characters per character of source, so a very large diagram can outgrow what
 * a server will accept in a URL. That is a limit of this transport, and the way past it is the
 * server's POST endpoint, which is not implemented here.
 */
function encodeForUrl(source) {
  const bytes = deflateRaw(new TextEncoder().encode(source), { level: 9 })
  let encoded = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i]
    const b2 = bytes[i + 1] ?? 0
    const b3 = bytes[i + 2] ?? 0
    encoded += ALPHABET[b1 >> 2]
    encoded += ALPHABET[((b1 & 0x3) << 4) | (b2 >> 4)]
    encoded += ALPHABET[((b2 & 0xf) << 2) | (b3 >> 6)]
    encoded += ALPHABET[b3 & 0x3f]
  }
  return encoded
}

/**
 * Block PlantUML
 */
export class BlockPlantumlElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'plantuml',
    name: 'PlantUML',
    description:
      'Draws a PlantUML diagram — sequence, class, state, activity, mindmap, gantt and the rest.',
    icon: 'polyline',
    /*
      Fenced, and named `plantuml` so the source is what it says it is. The fence is also what keeps
      markdown off it: `->` survives, but `--` becomes a dash, a line opening with `*` or `#` is read
      as a list or a heading, and an indented line becomes a code block of its own.

      Passed to the server exactly as written, `@startuml` included — which is why a `@startmindmap`
      or a `@startgantt` works here too. Wrapping it in `@startuml` on the author's behalf would rule
      every one of those out.
    */
    template: `\`\`\`plantuml
@startuml
Alice -> Bob : hello
Bob --> Alice : hi
@enduml
\`\`\``,
    props: [
      {
        name: 'server',
        type: 'string',
        label: 'Server',
        hint: 'PlantUML server to draw with. The public one when left empty.',
        // -> Written out rather than taken from DEFAULT_SERVER above: the manifest is read out of this
        //    file's syntax tree at build time, where a name is just a name
        default: 'https://www.plantuml.com/plantuml'
      },
      {
        name: 'format',
        type: 'select',
        label: 'Format',
        options: ['svg', 'png'],
        hint: 'svg stays sharp at any size; png is there for a server with svg switched off.',
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
        The drawing sits on white in both themes, padded, the way a QR code does. PlantUML draws in
        black on nothing at all, so on a dark page a diagram left to the page's background is black on
        black — and its own colours, where a diagram has them, are picked to sit on paper.
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
       * PlantUML server to draw with
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
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.server = DEFAULT_SERVER
    this.format = 'svg'
    this.caption = ''
    this.align = 'left'
    this._src = ''
    this._error = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * Where the drawing comes from.
   *
   * An `img` rather than markup fetched and inlined, because that is the one way of asking that needs
   * nothing of the server beyond the picture: no CORS headers, which a PlantUML behind somebody's own
   * proxy may well not send. It also means the browser caches the drawing like any other image.
   */
  _url(source) {
    const server = (this.server?.trim() || DEFAULT_SERVER).replace(/\/+$/, '')
    const format = this.format === 'png' ? 'png' : 'svg'
    return `${server}/${format}/${encodeForUrl(source)}`
  }

  /**
   * Say what went wrong, having been told only that the image did not load.
   *
   * Not the case of a diagram PlantUML cannot read: it answers those with a picture saying so, and a
   * browser draws it whatever status came with it — so a mistake in the source shows up as the
   * server's own message where the diagram would have been, which is the best place for it.
   *
   * What is left is a server that did not answer, or answered with something that is not an image: a
   * wrong address, a host that cannot be reached from where the reader is, a login page. The request
   * is made a second time to tell those apart, and to read `X-PlantUML-Diagram-Error` if it is there.
   * Best effort — a server that sends no CORS headers refuses this second request, and the message
   * below stands as it is. Nothing about drawing a diagram depends on any of it.
   */
  async _explain(url) {
    // -> Resolved against the page, since a server may perfectly well be a path on this wiki
    const absolute = new URL(url, window.location.href)
    this._error = `The diagram could not be drawn by ${absolute.origin}.`
    try {
      const response = await fetch(absolute)
      const reason = response.headers.get('x-plantuml-diagram-error')
      if (reason) {
        this._error = `PlantUML could not read this diagram: ${reason}`
      } else if (!response.ok) {
        this._error = `The server answered ${response.status} ${response.statusText} for this diagram.`
      }
    } catch {
      // -> Unreachable, blocked, or simply not a PlantUML server; the message above says as much
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
        'This diagram is empty. Its source goes in the body of the block, inside a ```plantuml fence.'
      if (this.querySelector('img')) {
        // -> The renderer's own PlantUML option claims that fence and draws it before this block is
        //    ever built, leaving an image where the source should be
        this._error +=
          '\n\nThe PlantUML option in the markdown editor settings is on, and it has already turned this fence into a diagram of its own. Switch it off to draw through this block.'
      }
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
      <div class="diagram ${this.align === 'center' ? 'is-center' : ''}">
        <div class="sheet">
          <img
            src="${this._src}"
            alt="${this.caption || 'PlantUML diagram'}"
            @error="${() => this._explain(this._src)}" />
        </div>
        ${this.caption ? html`<div class="caption">${this.caption}</div>` : null}
      </div>
    `
  }
}

window.customElements.define('block-plantuml', BlockPlantumlElement)
