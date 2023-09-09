import { LitElement, html, css } from 'lit'
import treeQuery from './folderByPath.graphql'

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
      :host-context(body.body--dark) {
        background-color: #F00;
      }

      ul {
        padding: 0;
        margin: 0;
        list-style: none;
      }

      li {
        background-color: #fafafa;
        background-image: linear-gradient(180deg,#fff,#fafafa);
        border-right: 1px solid #eee;
        border-bottom: 1px solid #eee;
        border-left: 5px solid #e0e0e0;
        box-shadow: 0 3px 8px 0 rgba(116,129,141,.1);
        padding: 0;
        border-radius: 5px;
        font-weight: 500;
      }
      li:hover {
        background-image: linear-gradient(180deg,#fff,#f6fbfe);
        border-left-color: #2196f3;
        cursor: pointer;
      }
      li + li {
        margin-top: .5rem;
      }
      li a {
        display: block;
        color: #1976d2;
        padding: 1rem;
        text-decoration: none;
      }
    `
  }

  static get properties() {
    return {
      /**
       * The base path to fetch pages from
       * @type {string}
       */
      path: {type: String},

      /**
       * A comma-separated list of tags to filter with
       * @type {string}
       */
      tags: {type: String},

      /**
       * The maximum number of items to fetch
       * @type {number}
       */
      limit: {type: Number}
    }
  }

  constructor() {
    super()
    this.pages = []
  }

  async connectedCallback() {
    super.connectedCallback()
    const resp = await APOLLO_CLIENT.query({
      query: treeQuery,
      variables: {
        siteId: WIKI_STORES.site.id,
        locale: 'en',
        parentPath: ''
      }
    })
    this.pages = resp.data.tree
    this.requestUpdate()
  }

  render() {
    return html`
      <ul>
        ${this.pages.map(p =>
          html`<li><a href="#">${p.title}</a></li>`
        )}
      </ul>
      <slot></slot>
    `
  }

  // createRenderRoot() {
  //   return this;
  // }
}

window.customElements.define('block-index', BlockIndexElement)
