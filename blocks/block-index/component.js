import { LitElement, html, css } from 'lit'
import { styleMap } from 'lit/directives/style-map.js'
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
 * The colors a page icon may be given in its properties (`iconColor`), as `[light, dark]`. A row
 * draws its icon and its left border in it, as a links-grid card does with its accent.
 *
 * The values of Tailwind's 500 and 400 shades, which is what the app draws the page's own header icon
 * in (`frontend/src/helpers/pageIconColors.js`). Written out rather than read from the app's
 * `--color-*` properties: those exist only for as long as some utility in the app happens to use
 * them, and a block cannot see which. A page with none — or one this list does not know — keeps the
 * link's primary color.
 */
const ICON_COLORS = {
  red: ['oklch(63.7% 0.237 25.331)', 'oklch(70.4% 0.191 22.216)'],
  orange: ['oklch(70.5% 0.213 47.604)', 'oklch(75% 0.183 55.934)'],
  amber: ['oklch(76.9% 0.188 70.08)', 'oklch(82.8% 0.189 84.429)'],
  yellow: ['oklch(79.5% 0.184 86.047)', 'oklch(85.2% 0.199 91.936)'],
  lime: ['oklch(76.8% 0.233 130.85)', 'oklch(84.1% 0.238 128.85)'],
  green: ['oklch(72.3% 0.219 149.579)', 'oklch(79.2% 0.209 151.711)'],
  emerald: ['oklch(69.6% 0.17 162.48)', 'oklch(76.5% 0.177 163.223)'],
  teal: ['oklch(70.4% 0.14 182.503)', 'oklch(77.7% 0.152 181.912)'],
  cyan: ['oklch(71.5% 0.143 215.221)', 'oklch(78.9% 0.154 211.53)'],
  sky: ['oklch(68.5% 0.169 237.323)', 'oklch(74.6% 0.16 232.661)'],
  blue: ['oklch(62.3% 0.214 259.815)', 'oklch(70.7% 0.165 254.624)'],
  indigo: ['oklch(58.5% 0.233 277.117)', 'oklch(67.3% 0.182 276.935)'],
  violet: ['oklch(60.6% 0.25 292.717)', 'oklch(70.2% 0.183 293.541)'],
  purple: ['oklch(62.7% 0.265 303.9)', 'oklch(71.4% 0.203 305.504)'],
  fuchsia: ['oklch(66.7% 0.295 322.15)', 'oklch(74% 0.238 322.16)'],
  pink: ['oklch(65.6% 0.241 354.308)', 'oklch(71.8% 0.202 349.761)'],
  rose: ['oklch(64.5% 0.246 16.439)', 'oklch(71.2% 0.194 13.428)'],
  slate: ['oklch(55.4% 0.046 257.417)', 'oklch(70.4% 0.04 256.788)'],
  gray: ['oklch(55.1% 0.027 264.364)', 'oklch(70.7% 0.022 261.325)']
}

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
        name: 'columns',
        type: 'select',
        label: 'Columns',
        options: ['1', '2', '3'],
        hint: 'Most columns to lay the pages out in. Narrower screens use fewer.',
        default: '2'
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
        name: 'usePageColors',
        type: 'boolean',
        label: 'Use Page Colors',
        hint: "Draw each page in the color chosen in its properties. Off, every page uses the site's primary color.",
        // -> True, which the `boolean` converter above is what makes safe: see the note on `props`
        default: true
      },
      {
        name: 'colorfulBorder',
        type: 'boolean',
        label: 'Colorful Border',
        hint: "Draw each page's left border in its color at all times, rather than only on hover.",
        default: false
      },
      {
        name: 'showTags',
        type: 'boolean',
        label: 'Show Page Tags',
        hint: "List each page's tags under its title.",
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

      /*
        The columns prop is a ceiling, not a count: the listing starts at one column and widens with
        the window, stopping at whatever the author asked for. A phone gets one column whichever value
        it carries, which is the whole reason the choice cannot simply be the number of columns -- a
        three-column listing on a 400px screen is three unreadable slivers.

        The second column arrives at the app's md breakpoint (--breakpoint-md in
        frontend/src/css/tailwind.css), which is the width the listing has always widened at. The
        third waits for 1600px, which is a width of this block's own rather than one of the shared
        ones: at lg (1440) a third of the article column, minus the sidebar beside it, leaves a title
        and its description with nowhere to go but two lines each.

        Matched off the host's attribute rather than read from a custom property, because the ceiling
        has to be applied per breakpoint -- and clamping one is math inside repeat(), which is not
        something an engine can be relied on to take.
      */
      @media (min-width: 1024px) {
        :host(:not([columns='1'])) ul {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (min-width: 1600px) {
        :host([columns='3']) ul {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }

      /*
        The row's accent: what its border turns on hover (or always, with colorfulBorder), the tint
        under its hover gradient, its icon, its arrow and its tags. The site's primary, unless the page
        has a color of its own and the block uses page colors -- render() then sets the page's pair of
        shades on the row and marks it .has-accent. See ICON_COLORS.
      */
      li {
        --accent: var(--q-primary);
      }
      li.has-accent {
        --accent: var(--accent-light);
      }
      :host([dark]) li.has-accent {
        --accent: var(--accent-dark);
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
      /* -> background-color is the faint tint the gradient lets through at its foot; the dark one is opaque */
      li:hover {
        background-color: var(--accent);
        background-image: linear-gradient(to bottom,#fff,rgba(255,255,255,.95));
        cursor: pointer;
      }
      :host([dark]) li:hover {
        background-image: linear-gradient(to bottom,#1e232a, #161b22);
      }
      /*
        -> The border in the accent: on hover, or all the time with colorfulBorder. Spelled out under
           :host([dark]) too, whose border-left above would otherwise outrank the bare selectors.
      */
      li:hover,
      :host([dark]) li:hover,
      ul.colorful-border li,
      :host([dark]) ul.colorful-border li {
        border-left-color: var(--accent);
      }
      /*
        -> A grid rather than a row, for the sake of the tags, laid out as a links-grid card's body:
           the icon and .text (the title over its description) share the first row, and the tags
           take the second row of the writing's column, which the icon does not span -- so the icon
           is centred on the title and description alone rather than on the whole height. A row
           without an icon has the one column. align-content centres the rows as a group when the
           row is stretched taller than they are, as align-items did for the flex row this was.
      */
      li a {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
        align-content: center;
        color: var(--q-primary);
        /*
          -> The right inset clears the arrow, which is positioned out of the flow and so takes no
             room in the row on its own: its 16px offset, its 32px width, and the same 14px gap the
             icon keeps on the left. Without it a long title or description runs under the arrow
             instead of wrapping before it.
        */
        padding: 0.75rem calc(16px + 32px + 14px) 0.75rem 1rem;
        text-decoration: none;
        flex: 1;
        column-gap: 14px;
        position: relative;
      }
      li a.has-icon {
        grid-template-columns: auto minmax(0, 1fr);
      }
      li a > .text,
      li a > .tags {
        grid-column: -2;
      }
      .text {
        display: flex;
        flex-direction: column;
        /* -> min-width is what lets a long title wrap inside the card rather than pushing the row
              wider than it */
        min-width: 0;
      }
      .description {
        display: block;
        color: #666;
        font-size: .8em;
        font-weight: normal;
        pointer-events: none;
      }
      /* -> The description grey links-grid uses on a dark card, since #666 is barely legible there */
      :host([dark]) .description {
        color: rgba(255,255,255,.6);
      }
      /*
        On a dark row the writing takes the app's lightened brand shade, the same one the interface
        gives a heading over a dark surface: primary is a mid-tone picked to read on white and is
        too dim against #161b22. --color-primary-light is a mix of --q-primary, so a re-themed
        site's own hue comes with it.

        On .text rather than on the anchor, so it is the title alone that lightens: the icon and the
        arrow are drawn in the accent rather than taking it from here.
      */
      :host([dark]) .text {
        color: var(--color-primary-light);
      }

      /*
        The page's tags, drawn as links-grid draws a card's: the accent as a pale wash with the
        writing darkened in the light theme and lightened in the dark one, since a shade 500 on a wash
        of itself is too faint to read for the lighter hues.
      */
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
        pointer-events: none;
      }
      .tags span {
        padding: 1px 8px;
        border: 1px solid color-mix(in oklch, var(--accent) 35%, transparent);
        border-radius: 999px;
        background-color: color-mix(in oklch, var(--accent) 12%, transparent);
        color: color-mix(in oklch, var(--accent) 70%, black);
        font-size: 0.7em;
        font-weight: 500;
        line-height: 1.6;
        white-space: nowrap;
      }
      :host([dark]) .tags span {
        background-color: color-mix(in oklch, var(--accent) 20%, transparent);
        color: color-mix(in oklch, var(--accent) 60%, white);
      }

      /*
        The page's own icon, in the accent. Sized in em so it keeps its place beside writing at
        whatever size the article is set in. An Iconify SVG paints with currentColor, which is the
        whole reason it is inlined rather than pointed at with an <img>.
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
        color: var(--accent);
      }
      .icon svg,
      .icon img {
        width: 1.75em;
        height: 1.75em;
      }
      /*
        -> Centred by hand: the static position of an absolute item in a grid is the grid's top
           corner, where the flex row this was centred it on its own.
      */
      li a > svg {
        width: 32px;
        position: absolute;
        top: 50%;
        right: 16px;
        transform: translateY(-50%);
        pointer-events: none;
      }
      li a > svg path {
        fill: rgba(0,0,0,.2);
      }
      :host([dark]) li a > svg path {
        fill: rgba(255,255,255,.2);
      }
      li:hover a > svg path, :host([dark]) li:hover a > svg path {
        fill: color-mix(in srgb, var(--accent) 50%, transparent);
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
       * Most columns to lay the pages out in (1, 2, 3)
       *
       * Declared for the sake of the pair -- an authored prop belongs in both lists -- and because
       * Lit would otherwise not know the attribute at all. Nothing in `render()` reads it: the layout
       * is the styles' business, and they match `:host([columns])` on the page's own attribute.
       *
       * @type {string}
       */
      columns: { type: String },

      /**
       * Whether each page's icon is drawn beside its title
       * @type {boolean}
       */
      showIcons: boolean,

      /**
       * Whether a page is drawn in the color chosen in its properties, rather than the site's primary
       * @type {boolean}
       */
      usePageColors: boolean,

      /**
       * Whether the left border is in the page's color at all times, rather than only on hover
       * @type {boolean}
       */
      colorfulBorder: boolean,

      /**
       * Whether each page's tags are listed under its title
       * @type {boolean}
       */
      showTags: boolean,

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
    this.columns = '2'
    this.showIcons = false
    this.usePageColors = true
    this.colorfulBorder = false
    this.showTags = false
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

  /**
   * The page's color as a pair of shades, or null where the row keeps the site's primary: a page with
   * none, or a block told not to use them.
   */
  _color(page) {
    return (this.usePageColors && ICON_COLORS[page.iconColor]) || null
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
          <ul class="${this.colorfulBorder ? 'colorful-border' : ''}">
            ${this._pages.map((p) => {
              const color = this._color(p)
              return html`<li
                  class="${color ? 'has-accent' : ''}"
                  style="${styleMap(color ? { '--accent-light': color[0], '--accent-dark': color[1] } : {})}">
                  <a
                    class="${this.showIcons ? 'has-icon' : ''}"
                    href="${p.href}"
                    @click="${this._navigate}">
                    ${this.showIcons ? this._icon(p) : null}
                    <div class="text">
                      ${p.title}
                      ${p.description ? html`<span class="description">${p.description}</span>` : null}
                    </div>
                    ${
                      this.showTags && p.tags?.length > 0
                        ? html`<div class="tags">${p.tags.map((tag) => html`<span>${tag}</span>`)}</div>`
                        : null
                    }
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
            })}
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
