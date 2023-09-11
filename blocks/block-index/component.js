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
      li + li {
        margin-top: .5rem;
      }
      li a {
        display: block;
        color: var(--q-primary);
        padding: 1rem;
        text-decoration: none;
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
          html`<li><a href="${p.href}" @click="${this._navigate}">${p.title}</a></li>`
        )}
      </ul>
      <slot></slot>
    ` : html`
      <div class="no-links">${this.noResultMsg}</div>
      <slot></slot>
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
