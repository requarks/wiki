import { LitElement, html, css } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { fetchIcon, iconImageUrl } from '../shared/icons.js'
import { DarkMode } from '../shared/theme.js'

/**
 * An attribute that means "off" when it says so.
 *
 * MDC writes every prop with a value, and Lit's own Boolean converter reads any string at all as
 * true — `showIcons="false"` included. The picker never writes that one, since it leaves a prop out
 * while it holds its default, but a page written by hand can say it and means it.
 */
const boolean = {
  converter: {
    fromAttribute: (value) => value !== null && value !== 'false',
    toAttribute: (value) => (value ? 'true' : null)
  }
}

/**
 * What to draw for a page carrying no icon of its own.
 *
 * The same one the app gives a new page (`DEFAULT_PAGE_ICON` in the page store), so that a listing
 * mixing pages made in the editor with pages made through the API still lines up down the left.
 */
const DEFAULT_PAGE_ICON = 'mdi:file-document-outline'

/**
 * Block Index
 */
export class BlockIndexElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals.
   *
   * `props` is what the picker turns into a form, and therefore what an author can set from the
   * editor: one entry per attribute worth writing into the page, in the order they should be asked
   * for. It mirrors `static get properties()` below — that one tells Lit how to read an attribute at
   * runtime, this one describes it to a person — so a property meant to be authored belongs in both.
   * It is also what survives being saved: the renderer strips any attribute a block does not declare.
   *
   * A `boolean` prop must default to false, unless the block reads the attribute itself. MDC writes
   * attributes as strings and Lit reads any attribute that is present as true, so `showThing="false"`
   * would come out true — the picker leaves a prop out entirely when it still holds its default,
   * which is what keeps false meaning false. A block declaring the converter `block-asciinema` and
   * `block-youtube` share is free of that, and so free to default a prop to true: `false` written out
   * is then read back as false, which is the only case the stock converter gets wrong.
   */
  static definition = {
    block: 'index',
    name: 'Index',
    description: 'Displays a list of pages contained in a folder.',
    icon: 'index',
    props: [
      {
        name: 'path',
        type: 'string',
        label: 'Path',
        hint: 'Folder to list pages from, without a leading slash. Empty means the site root.'
      },
      {
        name: 'tags',
        type: 'string',
        label: 'Tags',
        hint: 'Comma-separated list of tags a page must carry.'
      },
      {
        name: 'limit',
        type: 'number',
        label: 'Limit',
        hint: 'Maximum number of pages to list.',
        default: 10
      },
      {
        name: 'orderBy',
        type: 'select',
        label: 'Order By',
        options: ['title', 'fileName', 'createdAt', 'updatedAt'],
        default: 'title'
      },
      {
        name: 'orderByDirection',
        type: 'select',
        label: 'Direction',
        options: ['asc', 'desc'],
        default: 'asc'
      },
      {
        name: 'depth',
        type: 'number',
        label: 'Depth',
        hint: 'How many folders below the path to include. 0 is the folder itself.',
        default: 0
      },
      {
        name: 'showIcons',
        type: 'boolean',
        label: 'Show Icons',
        hint: "Draw each page's icon to the left of its title.",
        // -> Stated, so that a toggle switched on and then off again writes nothing into the page
        default: false
      },
      {
        name: 'noResultMsg',
        type: 'string',
        label: 'Empty Message',
        hint: 'Shown when the query matches no pages.',
        default: 'No pages matching your query.'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /*
        The gap below a block lives on this element, not on :host.

        The app resets the margin on every element, and a rule in the page beats a :host rule in the
        shadow tree whatever its specificity -- so a margin set on the host is simply dropped. Set
        inside the shadow root it is out of that rule's reach, and collapses out through the host,
        which carries no padding or border of its own.
      */
      ul {
        padding: 0;
        margin: 0 0 16px;
        list-style: none;
        display: grid;
        grid-auto-flow: row;
        grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 0.5rem;
      }
      @media (min-width: 1024px) {
        ul {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      li {
        background-color: #fafafa;
        background-image: linear-gradient(to bottom,#fff,#fafafa);
        border-right: 1px solid rgba(0,0,0,.05);
        border-bottom: 1px solid rgba(0,0,0,.05);
        border-left: 5px solid rgba(0,0,0,.1);
        box-shadow: 0 3px 8px 0 rgba(116,129,141,.1);
        padding: 0;
        border-radius: 5px;
        font-weight: 500;
        display: flex;
        align-items: stretch;
        justify-content: stretch;
      }
      :host([dark]) li {
        background-color: #222;
        background-image: linear-gradient(to bottom,#161b22, #0d1117);
        border-right: 1px solid rgba(0,0,0,.5);
        border-bottom: 1px solid rgba(0,0,0,.5);
        border-left: 5px solid rgba(255,255,255,.2);
        box-shadow: 0 3px 8px 0 rgba(0,0,0,.25);
      }
      li:hover {
        background-color: var(--q-primary);
        background-image: linear-gradient(to bottom,#fff,rgba(255,255,255,.95));
        border-left-color: var(--q-primary);
        cursor: pointer;
      }
      :host([dark]) li:hover {
        background-image: linear-gradient(to bottom,#1e232a, #161b22);
        border-left-color: var(--q-primary);
      }
      /*
        -> The row runs across rather than down, so an icon can sit beside the writing rather than
           above it. The title and its description stack inside .text, which is the column the
           anchor itself used to be.
      */
      li a {
        display: flex;
        color: var(--q-primary);
        /* -> Vertical only: the horizontal inset is what the arrow's own offset is set against */
        padding: 0.75rem 1rem;
        text-decoration: none;
        flex: 1;
        flex-direction: row;
        align-items: center;
        gap: 14px;
        position: relative;
      }
      .text {
        display: flex;
        flex-direction: column;
        justify-content: center;
        /* -> The row less the icon. min-width is what lets a long title wrap inside the card
              rather than pushing the row wider than it. */
        flex: 1;
        min-width: 0;
      }
      .text span {
        display: block;
        color: #666;
        font-size: .8em;
        font-weight: normal;
        pointer-events: none;
      }

      /*
        The page's own icon. Sized in em so it keeps its place beside writing at whatever size the
        article is set in, and left to take the anchor's colour: an Iconify SVG paints with
        currentColor, which is the whole reason it is inlined rather than pointed at with an an <img>.
      */
      /*
        -> The width is on the slot as well as on the drawing, so a row whose icon could not be had
           keeps its place in the column rather than sliding its writing left of every other row's.
      */
      .icon {
        display: flex;
        align-items: center;
        flex: none;
        width: 1.75em;
      }
      .icon svg,
      .icon img {
        width: 1.75em;
        height: 1.75em;
      }
      li a > svg {
        width: 32px;
        position: absolute;
        right: 16px;
        pointer-events: none;
      }
      li a > svg path {
        fill: rgba(0,0,0,.2);
      }
      :host([dark]) li a > svg path {
        fill: rgba(255,255,255,.2);
      }
      li:hover a > svg path, :host([dark]) li:hover a > svg path {
        fill: color-mix(in srgb, currentColor 50%, transparent);
      }

      .no-links {
        margin-bottom: 16px;
        color: var(--q-negative);
        border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
        border-radius: 5px;
        padding: 1rem;
      }
    `
  }

  static get properties() {
    return {
      /**
       * The base path to fetch pages from
       * @type {string}
       */
      path: { type: String },

      /**
       * A comma-separated list of tags to filter with
       * @type {string}
       */
      tags: { type: String },

      /**
       * The maximum number of items to fetch
       * @type {number}
       */
      limit: { type: Number },

      /**
       * Ordering (createdAt, fileName, title, updatedAt)
       * @type {string}
       */
      orderBy: { type: String },

      /**
       * Ordering direction (asc, desc)
       * @type {string}
       */
      orderByDirection: { type: String },

      /**
       * Maximum folder depth to fetch
       * @type {number}
       */
      depth: { type: Number },

      /**
       * A fallback message if no results are returned
       * @type {string}
       */
      noResultMsg: { type: String },

      /**
       * Whether each page's icon is drawn beside its title
       * @type {boolean}
       */
      showIcons: boolean,

      // Internal Properties
      _loading: { state: true },
      _pages: { state: true }
    }
  }

  constructor() {
    super()
    this._loading = true
    this._pages = []
    this.path = ''
    this.tags = ''
    this.limit = 10
    this.orderBy = 'title'
    this.orderByDirection = 'asc'
    this.depth = 0
    this.noResultMsg = 'No pages matching your query.'
    this.showIcons = false
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  async connectedCallback() {
    super.connectedCallback()
    try {
      // -> The app's own HTTP client, so a signed-in reader's token comes along and the listing is
      //    the one they would get anywhere else. Only pages they may open come back.
      const pages = await API_CLIENT.get(`sites/${WIKI_STATE.site.id}/tree/pages`, {
        searchParams: {
          locale: WIKI_STATE.page.locale,
          path: this.path,
          limit: this.limit,
          orderBy: this.orderBy,
          orderByDirection: this.orderByDirection,
          depth: this.depth,
          tags: this.tags
        }
      }).json()
      this._pages = pages.map((p) => ({ ...p, href: `/${p.path}` }))
      if (this.showIcons) {
        await this._loadIcons()
      }
    } catch (err) {
      console.warn(err)
    }
    this._loading = false
  }

  /**
   * Fetch the icons the listing is about to draw.
   *
   * All of them at once rather than one after another, since the shared cache collapses the repeats:
   * a listing of pages that never had an icon chosen for them is one request for the default, however
   * many rows there are. An `img:` icon is a file to point at and needs nothing fetched.
   *
   * Failures are already an empty string, so a row whose icon could not be had is a row without one.
   */
  async _loadIcons() {
    await Promise.all(
      this._pages.map(async (page) => {
        const reference = page.icon || DEFAULT_PAGE_ICON
        if (!iconImageUrl(reference)) {
          page.svg = await fetchIcon(reference)
        }
      })
    )
    // -> The pages were mutated rather than replaced, which Lit has no way of noticing on its own
    this.requestUpdate()
  }

  /** One page's icon: an inlined SVG, or an `<img>` for a reference that names a file. */
  _icon(page) {
    const image = iconImageUrl(page.icon || DEFAULT_PAGE_ICON)
    return html`<span class="icon">
      ${image ? html`<img src="${image}" alt="" />` : page.svg ? unsafeSVG(page.svg) : null}
    </span>`
  }

  render() {
    return this._pages.length > 0 || this._loading
      ? html`
          <ul>
            ${this._pages.map(
              (p) =>
                html`<li>
                  <a href="${p.href}" @click="${this._navigate}">
                    ${this.showIcons ? this._icon(p) : null}
                    <div class="text">
                      ${p.title} ${p.description ? html`<span>${p.description}</span>` : null}
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      width="48px"
                      height="48px">
                      <path
                        d="M 24 4 C 12.972292 4 4 12.972292 4 24 C 4 32.465211 9.2720863 39.722981 16.724609 42.634766 A 1.50015 1.50015 0 1 0 17.816406 39.841797 C 11.48893 37.369581 7 31.220789 7 24 C 7 14.593708 14.593708 7 24 7 A 1.50015 1.50015 0 1 0 24 4 z M 32.734375 6.1816406 A 1.50015 1.50015 0 0 0 32.033203 9.0136719 C 37.368997 11.880008 41 17.504745 41 24 C 41 33.406292 33.406292 41 24 41 A 1.50015 1.50015 0 1 0 24 44 C 35.027708 44 44 35.027708 44 24 C 44 16.385255 39.733331 9.7447579 33.453125 6.3710938 A 1.50015 1.50015 0 0 0 32.734375 6.1816406 z M 25.484375 16.484375 A 1.50015 1.50015 0 0 0 24.439453 19.060547 L 27.878906 22.5 L 16.5 22.5 A 1.50015 1.50015 0 1 0 16.5 25.5 L 27.878906 25.5 L 24.439453 28.939453 A 1.50015 1.50015 0 1 0 26.560547 31.060547 L 32.560547 25.060547 A 1.50015 1.50015 0 0 0 32.560547 22.939453 L 26.560547 16.939453 A 1.50015 1.50015 0 0 0 25.484375 16.484375 z" />
                    </svg>
                  </a>
                </li>`
            )}
          </ul>
        `
      : html` <div class="no-links">${this.noResultMsg}</div> `
  }

  /*
    -> `currentTarget` is the anchor the handler is bound to; `target` is whatever was clicked, which
       is the anchor only for a click that landed on the title. The rest of the row got there by
       being marked `pointer-events: none`, one declaration at a time -- an icon is one more thing
       inside the anchor, and asking the element it was bound to is what makes that unnecessary.
  */
  _navigate(e) {
    e.preventDefault()
    WIKI_ROUTER.push(e.currentTarget.getAttribute('href'))
  }

  // createRenderRoot() {
  //   return this;
  // }
}

window.customElements.define('block-index', BlockIndexElement)
