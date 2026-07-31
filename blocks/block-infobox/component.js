import { LitElement, html, css } from 'lit'
import { load as parseYaml } from 'js-yaml'

/**
 * Yes and no, drawn rather than spelled out.
 *
 * A column of "true"/"false" is read word by word; a tick and a cross are read at a glance, which is
 * what an infobox is for. Inline, because they are the same two pictures on every infobox there is,
 * and labelled, since the shape alone means nothing to a screen reader.
 */
const YES_SVG = html`
  <svg viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="Yes" class="yes">
    <path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
`

const NO_SVG = html`
  <svg viewBox="0 0 24 24" width="18" height="18" role="img" aria-label="No" class="no">
    <path
      fill="currentColor"
      d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
`

/**
 * One value, as it is shown.
 *
 * A list reads as one line, since an infobox row is a line: "French, English" rather than a bullet
 * list squeezed into half a column.
 */
function valueOf(value) {
  if (typeof value === 'boolean') {
    return value ? YES_SVG : NO_SVG
  }
  if (Array.isArray(value)) {
    // -> Joined by hand rather than with `join`, so that a boolean among them is still drawn
    return value.map((entry, index) => html`${index > 0 ? ', ' : ''}${valueOf(entry)}`)
  }
  return String(value)
}

/**
 * The rows a value turns into.
 *
 * A nested mapping becomes a group of its own with a heading, which is how an infobox shows a cluster
 * of related facts. Anything else is a single row.
 */
function rowsOf(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).map(([label, nested]) => ({ label, value: nested }))
  }
  return [{ value }]
}

/**
 * Block Infobox
 */
export class BlockInfoboxElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'infobox',
    name: 'Infobox',
    description: 'A summary box beside the text, filled in from a list of facts.',
    icon: 'data-sheet',
    template: `City: Montreal
Country: Canada
Metro: true
"Key with space": foo-bar`,
    props: [
      {
        name: 'name',
        type: 'string',
        label: 'Name',
        hint: 'Heading at the top of the box.',
        required: true
      },
      {
        name: 'image',
        type: 'string',
        label: 'Image URL',
        hint: 'Path or URL of a picture to show under the heading.'
      },
      {
        name: 'imageCaption',
        type: 'string',
        label: 'Image Caption',
        hint: 'Shown under the picture.'
      }
    ]
  }

  static get styles() {
    return css`
      /*
        Floated, so the article runs down its left and closes under it — the whole point of an
        infobox. The margin carries !important because the app resets the margin of everything in a
        page, and a rule in the page beats a :host rule however specific; a declaration marked
        important in a shadow tree is the one thing that outranks it. See block-index for the usual
        way round this, which does not work on a float: a float collapses no margins.
      */
      :host {
        display: block;
        float: right;
        clear: right;
        width: 320px;
        max-width: 100%;
        margin: 4px 0 16px 24px !important;
        /*
          A layer of its own, above the article's own decoration. A heading draws its rule as an
          absolutely positioned pseudo-element spanning the whole column, and a positioned element
          paints over a float whichever way round the two are written — so the rule ran straight
          across the box. This is the right way round anyway: the box is a card sitting on the page,
          and the rule belongs to the text it is sitting on.
        */
        position: relative;
        z-index: 1;
      }

      /* -> Below a certain width the column cannot spare 320px, and a full-width card reads better */
      @media (max-width: 800px) {
        :host {
          float: none;
          width: auto;
          margin: 0 0 16px !important;
        }
      }

      .infobox {
        border: 1px solid var(--infobox-border);
        border-radius: 6px;
        background-color: var(--infobox-bg);
        font-size: 0.85em;
        line-height: 1.45;
        overflow: hidden;
      }

      .name {
        padding: 10px 12px;
        border-bottom: 1px solid var(--infobox-border);
        background-color: var(--infobox-head);
        font-size: 1.1em;
        font-weight: 600;
        text-align: center;
      }

      figure {
        margin: 0;
        padding: 12px 12px 0;
        text-align: center;
      }

      img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 4px;
      }

      figcaption {
        padding-top: 6px;
        font-size: 0.9em;
        opacity: 0.75;
      }

      dl {
        display: grid;
        grid-template-columns: minmax(6em, auto) 1fr;
        gap: 0;
        margin: 0;
        padding: 0;
      }

      dt,
      dd {
        margin: 0;
        padding: 7px 12px;
        border-top: 1px solid var(--infobox-rule);
      }
      dl > :is(dt, dd):is(:first-child, :nth-child(2)) {
        border-top: 0;
      }

      dt {
        font-weight: 600;
        overflow-wrap: anywhere;
      }

      dd {
        overflow-wrap: anywhere;
      }

      /* -> A nested mapping: its own heading across both columns, then its rows under it */
      .group {
        grid-column: 1 / -1;
        padding: 7px 12px;
        border-top: 1px solid var(--infobox-rule);
        background-color: var(--infobox-head);
        font-weight: 600;
        text-align: center;
      }

      .yes {
        color: var(--q-positive, #02c39a);
        vertical-align: -3px;
      }

      .no {
        color: var(--q-negative, #c10015);
        vertical-align: -3px;
      }

      .error {
        padding: 10px 12px;
        color: var(--q-negative, #c10015);
      }

      :host {
        --infobox-border: #d5d5d5;
        --infobox-bg: #f8f9fa;
        --infobox-head: #eaecf0;
        --infobox-rule: #e3e5e8;
      }
      :host-context(body.body--dark) {
        --infobox-border: rgba(255, 255, 255, 0.15);
        --infobox-bg: #161b22;
        --infobox-head: #1e232a;
        --infobox-rule: rgba(255, 255, 255, 0.1);
      }
    `
  }

  static get properties() {
    return {
      /**
       * Heading at the top of the box
       * @type {string}
       */
      name: { type: String },

      /**
       * Path or URL of a picture
       * @type {string}
       */
      image: { type: String },

      /**
       * Caption under the picture
       * @type {string}
       */
      imageCaption: { type: String },

      // Internal Properties
      _entries: { state: true },
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.name = ''
    this.image = ''
    this.imageCaption = ''
    this._entries = []
    this._error = ''
  }

  /**
   * Read the facts out of the block's body.
   *
   * The body has been through markdown by the time it gets here, so what is left of `city: Montreal`
   * is its text — which is all YAML needs. Markdown does leave its mark: a value written with
   * emphasis or a link keeps the words and loses the markup, and anything markdown reads as
   * structure of its own (a line opening with `-`, `#` or `>`) arrives rearranged. A fenced code
   * block is the way out of that, since its contents reach here exactly as they were typed.
   */
  /**
   * Hand the first line of the column back its place at the top.
   *
   * The content stylesheet drops the top margin of the first element in a page, because the space
   * above it belongs to the container. A floated infobox at the very top takes that reset with it and
   * leaves the heading behind it holding a full margin — so the heading, which is what a reader sees
   * as the start of the page, sits an inch below the box beside it. Passed on to whatever follows,
   * since that is the element the rule was written for.
   *
   * Two pixels rather than none: the box's own top margin and border sit in that space, and the two
   * together put the rule under a page title on the rule under the box's name — the line the eye
   * follows across from one to the other.
   */
  _alignWithTop() {
    if (this.previousElementSibling) {
      return
    }
    this.nextElementSibling?.style.setProperty('margin-top', '2px')
  }

  connectedCallback() {
    super.connectedCallback()
    this._alignWithTop()
    const source = (this.querySelector('pre') ?? this).textContent ?? ''
    if (!source.trim()) {
      return
    }
    let parsed
    try {
      parsed = parseYaml(source)
    } catch (err) {
      // -> Naming the fence, because it is the answer nine times out of ten: markdown reads an
      //    indented line as structure of its own and hands this the text without the indentation
      this._error = `This infobox could not be read: ${err.reason ?? err.message}. Anything indented — a list, or a nested group — has to go inside a fenced code block.`
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      this._error = 'An infobox is a list of "key: value" lines.'
      return
    }
    this._entries = Object.entries(parsed)
  }

  render() {
    return html`
      <aside class="infobox">
        <div class="name">${this.name}</div>
        ${this.image
          ? html`
              <figure>
                <img src="${this.image}" alt="${this.imageCaption || this.name}" />
                ${this.imageCaption ? html`<figcaption>${this.imageCaption}</figcaption>` : null}
              </figure>
            `
          : null}
        ${this._error ? html`<div class="error">${this._error}</div>` : null}
        ${this._entries.length > 0
          ? html`
              <dl>
                ${this._entries.map(([label, value]) => {
                  const rows = rowsOf(value)
                  const isGroup = rows.length > 1 || rows[0].label !== undefined
                  return html`
                    ${isGroup ? html`<div class="group">${label}</div>` : null}
                    ${rows.map(
                      (row) => html`
                        <dt>${isGroup ? row.label : label}</dt>
                        <dd>${valueOf(row.value)}</dd>
                      `
                    )}
                  `
                })}
              </dl>
            `
          : null}
      </aside>
    `
  }
}

window.customElements.define('block-infobox', BlockInfoboxElement)
