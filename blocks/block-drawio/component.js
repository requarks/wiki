import { LitElement, html, css } from 'lit'
import { deflateRaw } from 'pako'
import { DarkMode } from '../shared/theme.js'

/**
 * The draw.io that answers when the block names no server.
 *
 * Two hosts, because draw.io publishes two deployments of the same application: `viewer` is the one
 * that opens a diagram read-only from a link, `embed` the one the editor talks to over postMessage
 * (see `BlockContentDrawio.vue`). A self-hosted draw.io is one deployment doing both, which is why the
 * `server` prop replaces both and defaults to neither.
 */
const PUBLIC_VIEWER = 'https://viewer.diagrams.net'

/** How many bytes are turned into characters at a time, below. */
const CHUNK_SIZE = 0x8000

/**
 * A drawing as draw.io writes it into a link fragment.
 *
 * This is `Graph.compress` from draw.io itself, and every step of it matters to the other end:
 * percent-encode, raw deflate (no zlib header, unlike Kroki's), then base64. The percent-encoding
 * comes FIRST and is not a transport detail — draw.io decompresses and then `decodeURIComponent`s, so
 * a diagram deflated without it comes back mangled at every non-ASCII character.
 *
 * `btoa` takes a string, and spreading a whole drawing into `String.fromCharCode` at once overflows
 * the stack somewhere in the tens of thousands of bytes — hence a chunk at a time, as `block-kroki`
 * does for the same reason.
 */
function compressForUrl(xml) {
  const bytes = deflateRaw(encodeURIComponent(xml))
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

/**
 * Block Draw.io
 */
export class BlockDrawioElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'drawio',
    name: 'Draw.io',
    description: 'A diagram drawn in draw.io, stored as its own XML and edited on a canvas.',
    icon: 'web-design',
    /*
      Fenced, and `xml` because that is what a draw.io document is — so an author reading the page
      source gets it highlighted, and markdown keeps its hands off it. Without the fence a drawing is
      a document full of `<` and `_` and lines beginning with spaces, every one of which means
      something to markdown.
    */
    template: `\`\`\`xml
<mxfile>
  <diagram name="Page-1">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" page="1" pageWidth="850" pageHeight="1100">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
\`\`\``,
    /*
      The body is a drawing, so it is edited on a canvas rather than typed: this names the editor the
      markdown editor offers above the block, as a second lens beside "Edit Block Parameters". The key
      is resolved to a component by `BlockContentEditorOverlay`; nothing about draw.io reaches the
      block system itself.
    */
    contentEditor: 'drawio',
    props: [
      {
        name: 'server',
        type: 'string',
        label: 'Server',
        hint: 'A self-hosted draw.io to draw and display with. The public diagrams.net services when left empty.'
      },
      {
        name: 'height',
        type: 'number',
        label: 'Height',
        hint: 'How tall the diagram is, in pixels.',
        default: 420
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
        The frame carries the border rather than the iframe: draw.io's lightbox paints its own
        background over the whole box, so a border on the iframe itself is drawn under it at the
        corners.
      */
      .frame {
        width: 100%;
        max-width: 100%;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 5px;
        overflow: hidden;
        background-color: #fff;
      }
      :host([dark]) .frame {
        border-color: rgba(255, 255, 255, 0.12);
        background-color: #18191a;
      }

      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
      }

      .caption {
        font-size: 0.8em;
        opacity: 0.7;
      }

      .error {
        padding: 12px;
        border-radius: 5px;
        border: 1px solid #c10015;
        color: #c10015;
        font-size: 0.9em;
      }
    `
  }

  static get properties() {
    return {
      /** A self-hosted draw.io, standing in for both public services. */
      server: { type: String },
      /** How tall the frame is, in pixels. */
      height: { type: Number },
      /** Shown under the diagram. */
      caption: { type: String },
      /** `left` or `center`. */
      align: { type: String },

      _source: { state: true }
    }
  }

  constructor() {
    super()
    this.server = ''
    this.height = 420
    this.caption = ''
    this.align = 'left'
    this._source = ''
    /*
      The lightbox reads its theme from the URL at load, so the frame is rebuilt when the reader
      switches — which for a read-only diagram costs nothing, unlike doing the same to the editor.
    */
    this._darkMode = new DarkMode(this)
  }

  connectedCallback() {
    super.connectedCallback()
    this._readSource()
  }

  /**
   * The drawing, out of the body markdown left behind.
   *
   * `textContent` on the `<pre>` is what undoes the escaping the fence went through — the same three
   * lines every source block in this wiki uses.
   */
  _readSource() {
    const fence = this.querySelector('pre')
    this._source = ((fence ?? this).textContent ?? '').trim()
  }

  /**
   * The link the frame opens.
   *
   * `lightbox=1` is draw.io's read-only viewer: no editing, no menus, just the drawing with zoom and
   * a layers control. `edit=_blank` is deliberately absent — the pencil it adds opens the diagram in
   * a copy of draw.io that has nowhere to save to, and the way to change a drawing here is the page.
   */
  _url() {
    const server = (this.server || '').trim().replace(/\/+$/, '') || PUBLIC_VIEWER
    const params = new URLSearchParams({
      lightbox: '1',
      nav: '1',
      ui: this._darkMode.isDark ? 'dark' : 'kennedy'
    })
    return `${server}/?${params.toString()}#R${encodeURIComponent(compressForUrl(this._source))}`
  }

  render() {
    if (!this._source) {
      return html`
        <div class="error">
          This diagram is empty. Draw one with the Edit Content link above the block in the editor.
        </div>
      `
    }
    const height = Number(this.height) > 0 ? Number(this.height) : 420
    return html`
      <div class="diagram ${this.align === 'center' ? 'is-center' : ''}">
        <div class="frame" style="height: ${height}px">
          <iframe
            src=${this._url()}
            title=${this.caption || 'Diagram'}
            loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen></iframe>
        </div>
        ${this.caption ? html`<div class="caption">${this.caption}</div>` : ''}
      </div>
    `
  }
}

window.customElements.define('block-drawio', BlockDrawioElement)
