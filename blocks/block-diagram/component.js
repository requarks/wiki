import { LitElement, html, css } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import mermaid from 'mermaid'
import { DarkMode } from '../shared/theme.js'

/**
 * A number for the next drawing, so every one of them gets an id of its own.
 *
 * Mermaid names the SVG it produces and writes that name into the CSS it embeds in it, so two
 * diagrams sharing an id would style each other. A counter rather than a random name: the ids are
 * scoped to one page load, and a run of them is easier to recognise in the inspector.
 */
let drawingCount = 0

/**
 * The drawing in progress, so that only ever one of them is.
 *
 * Mermaid is configured globally — `initialize` sets the library up, not a call to it — so two
 * diagrams on a page asking for different themes would each set theirs and then be drawn in whichever
 * one was set last. Queued, a diagram has the library to itself from the moment it configures it to
 * the moment it is handed back an SVG.
 */
let queue = Promise.resolve()

/**
 * Configure mermaid and draw one diagram with it, once whatever is ahead of it is done.
 */
function drawInTurn(config, id, source) {
  const drawing = queue.then(() => {
    mermaid.initialize(config)
    return mermaid.render(id, source)
  })
  // -> Whether it worked or not, since a diagram that could not be drawn must not hold up the rest
  queue = drawing.then(
    () => {},
    () => {}
  )
  return drawing
}

/**
 * Block Diagram
 */
export class BlockDiagramElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'diagram',
    name: 'Diagram',
    description: 'Draws a Mermaid diagram — flowchart, sequence, class, state, ER, gantt and more.',
    icon: 'workflow',
    /*
      A fenced block, and not only for the syntax highlighting: markdown would otherwise have its way
      with the source before this ever sees it. `-->` survives, but the typographer turns `--` into a
      dash, an indented line reads as a code block of its own, and `%%` comments and `#` labels are
      claimed as structure. Inside a fence the text arrives exactly as it was typed.
    */
    template: `\`\`\`mermaid
flowchart LR
  A[Start] --> B{Ready?}
  B -->|Yes| C[Ship it]
  B -->|No| A
\`\`\``,
    props: [
      {
        name: 'caption',
        type: 'string',
        label: 'Caption',
        hint: 'Shown under the diagram.'
      },
      {
        name: 'theme',
        type: 'select',
        label: 'Theme',
        options: ['auto', 'default', 'dark', 'neutral', 'forest'],
        hint: 'auto follows the light or dark theme the reader is using.',
        default: 'auto'
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
        Mermaid sizes the drawing itself — it writes a max-width on the SVG at the width the diagram
        came out to, so a small one is left at its own size and a large one shrinks to the column. Only
        the height is settled here, so that shrinking keeps the shapes in proportion.
      */
      svg {
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
       * Text shown under the diagram
       * @type {string}
       */
      caption: { type: String },

      /**
       * Mermaid theme, or `auto` to follow the reader's
       * @type {string}
       */
      theme: { type: String },

      /**
       * Where the drawing sits in the column, `left` or `center`
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
    this.theme = 'auto'
    this.align = 'left'
    this._svg = ''
    this._error = ''
    /*
      Two jobs at once: `dark` on this element is what the caption colour keys off, and the callback
      is what redraws the diagram itself, since mermaid picks its colours as it draws and writes them
      into the SVG. Only `auto` has anything to follow -- a diagram asked for a theme by name keeps
      it either way -- and only once there is a source to draw, which `firstUpdated` reads.
    */
    this._darkMode = new DarkMode(this, {
      onChange: () => {
        if (this.theme === 'auto' && this._source) {
          this._draw()
        }
      }
    })
    /** The drawing being waited on, so a stale one cannot land after a newer one. */
    this._drawing = 0
    /** The source, and whether it came out of a fence. Both read from the body once, on first render. */
    this._source = ''
    this._fenced = false
  }

  /**
   * The theme to draw in.
   *
   * `auto` follows the app, which every other block does in CSS off the `dark` attribute the same
   * controller sets — a diagram cannot, because mermaid picks its colours while it draws and writes
   * them into the SVG.
   */
  _theme() {
    if (this.theme && this.theme !== 'auto') {
      return this.theme
    }
    return this._darkMode.isDark ? 'dark' : 'default'
  }

  /**
   * Draw the source, or say why it could not be drawn.
   */
  async _draw() {
    const drawing = ++this._drawing
    const config = {
      startOnLoad: false,
      // -> A page is authored by whoever may edit it, so the text in a diagram is treated as text:
      //    HTML in a label is escaped and `click` directives do nothing
      securityLevel: 'strict',
      // -> Mermaid's own answer to a broken diagram is to append a drawing of a bomb to the body,
      //    outside this element and past the page's styling. The message below is this block's job.
      suppressErrorRendering: true,
      theme: this._theme(),
      // -> The page's own font, so a diagram reads as part of the text around it. Mermaid measures
      //    its labels in the same font, so the boxes come out the right size for it.
      fontFamily: 'inherit'
    }
    try {
      const { svg } = await drawInTurn(config, `block-diagram-${++drawingCount}`, this._source)
      // -> A theme toggle can start a second drawing while this one is still going
      if (drawing !== this._drawing) {
        return
      }
      this._svg = svg
      this._error = ''
    } catch (err) {
      if (drawing !== this._drawing) {
        return
      }
      this._svg = ''
      /*
        Mermaid says what it could not read and where, which is the useful half. The other half is
        the fence, because a diagram that renders in every other tool and not here is nearly always a
        source markdown got to first — see `template`.
      */
      this._error = `This diagram could not be drawn: ${err.message ?? err}`
      if (!this._fenced) {
        this._error +=
          '\n\nThe source has to go inside a fenced code block, or markdown rewrites it before this block sees it.'
      }
    }
  }

  firstUpdated() {
    /*
      The source is the block's body, taken from the fence markdown left behind. `textContent` is what
      undoes the escaping that put `--&gt;` in the markup, and gives back what the author typed.
    */
    const fence = this.querySelector('pre')
    this._fenced = Boolean(fence)
    this._source = ((fence ?? this).textContent ?? '').trim()
    if (!this._source) {
      this._error =
        'This diagram is empty. Its source goes in the body of the block, inside a fenced code block.'
      return
    }
    this._draw()
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    return html`
      <div class="diagram ${this.align === 'center' ? 'is-center' : ''}">
        ${unsafeSVG(this._svg)}
        ${this.caption ? html`<div class="caption">${this.caption}</div>` : null}
      </div>
    `
  }
}

window.customElements.define('block-diagram', BlockDiagramElement)
