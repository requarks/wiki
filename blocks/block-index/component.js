import { LitElement, html, css } from 'lit'
import treeQuery from './tree.graphql'

/**
 * Block Index
 */
export class BlockIndexElement extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
        margin-bottom: 16px;
      }

      ul {
        padding: 0;
        margin: 0;
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
      :host-context(body.body--dark) li {
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
      :host-context(body.body--dark) li:hover {
        background-image: linear-gradient(to bottom,#1e232a, #161b22);
        border-left-color: var(--q-primary);
      }
      li a {
        display: flex;
        color: var(--q-primary);
        padding: 1rem;
        text-decoration: none;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        position: relative;
      }
      li a > span {
        display: block;
        color: #666;
        font-size: .8em;
        font-weight: normal;
        pointer-events: none;
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
      :host-context(body.body--dark) li a > svg path {
        fill: rgba(255,255,255,.2);
      }
      li:hover a > svg path, :host-context(body.body--dark) li:hover a > svg path {
        fill: color-mix(in srgb, currentColor 50%, transparent);
      }

      .no-links {
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
  }

  async connectedCallback() {
    super.connectedCallback()
    try {
      const resp = await APOLLO_CLIENT.query({
        query: treeQuery,
        variables: {
          siteId: WIKI_STATE.site.id,
          locale: WIKI_STATE.page.locale,
          parentPath: this.path,
          limit: this.limit,
          orderBy: this.orderBy,
          orderByDirection: this.orderByDirection,
          depth: this.depth,
          ...this.tags && { tags: this.tags.split(',').map(t => t.trim()).filter(t => t) },
        }
      })
      this._pages = resp.data.tree.map(p => ({
        ...p,
        href: p.folderPath ? `/${p.folderPath}/${p.fileName}` : `/${p.fileName}`
      }))
    } catch (err) {
      console.warn(err)
    }
    this._loading = false
  }

  render() {
    return this._pages.length > 0 || this._loading ? html`
      <ul>
        ${this._pages.map(p =>
          html`<li>
            <a href="${p.href}" @click="${this._navigate}">
              ${p.title}
              ${p.description ? html`<span>${p.description}</span>` : null}
              <svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 48 48" width="48px" height="48px">
                <path d="M 24 4 C 12.972292 4 4 12.972292 4 24 C 4 32.465211 9.2720863 39.722981 16.724609 42.634766 A 1.50015 1.50015 0 1 0 17.816406 39.841797 C 11.48893 37.369581 7 31.220789 7 24 C 7 14.593708 14.593708 7 24 7 A 1.50015 1.50015 0 1 0 24 4 z M 32.734375 6.1816406 A 1.50015 1.50015 0 0 0 32.033203 9.0136719 C 37.368997 11.880008 41 17.504745 41 24 C 41 33.406292 33.406292 41 24 41 A 1.50015 1.50015 0 1 0 24 44 C 35.027708 44 44 35.027708 44 24 C 44 16.385255 39.733331 9.7447579 33.453125 6.3710938 A 1.50015 1.50015 0 0 0 32.734375 6.1816406 z M 25.484375 16.484375 A 1.50015 1.50015 0 0 0 24.439453 19.060547 L 27.878906 22.5 L 16.5 22.5 A 1.50015 1.50015 0 1 0 16.5 25.5 L 27.878906 25.5 L 24.439453 28.939453 A 1.50015 1.50015 0 1 0 26.560547 31.060547 L 32.560547 25.060547 A 1.50015 1.50015 0 0 0 32.560547 22.939453 L 26.560547 16.939453 A 1.50015 1.50015 0 0 0 25.484375 16.484375 z"/>
              </svg>
            </a>
          </li>`
        )}
      </ul>
    ` : html`
      <div class="no-links">${this.noResultMsg}</div>
    `
  }

  _navigate (e) {
    e.preventDefault()
    WIKI_ROUTER.push(e.target.getAttribute('href'))
  }

  // createRenderRoot() {
  //   return this;
  // }
}

window.customElements.define('block-index', BlockIndexElement)
