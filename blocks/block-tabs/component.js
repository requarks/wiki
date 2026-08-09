import { LitElement, html, css } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { DarkMode } from '../shared/theme.js'

/**
 * Asked of a block that might be hiding the element the event was dispatched on.
 *
 * The app sends it at a heading before scrolling to it — see `helpers/anchors.js` — so that a heading
 * inside a panel that is not showing is opened rather than scrolled at. Matched by name only: a block
 * answers it or ignores it, and neither side has to know about the other.
 */
const REVEAL_EVENT = 'block-reveal'

/** Icons already fetched, by `prefix:name`, so a page of tabs asks for each one once. */
const iconCache = new Map()

/**
 * Fetch an icon as inline SVG.
 *
 * Inline rather than an `<img>` so the drawing takes the colour of the tab it sits in — Iconify's
 * SVGs paint with `currentColor`, which an image cannot see. The instance serves them from its own
 * `/_icons`, cached hard, so this is a local request.
 */
async function fetchIcon(reference) {
  if (iconCache.has(reference)) {
    return iconCache.get(reference)
  }
  const [prefix, name] = reference.split(':')
  if (!prefix || !name) {
    return ''
  }
  const promise = fetch(`/_icons/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`)
    .then((resp) => (resp.ok ? resp.text() : ''))
    .catch(() => '')
  iconCache.set(reference, promise)
  return promise
}

/**
 * Block Tabs
 */
export class BlockTabsElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   *
   * `template` is the body the picker writes into the page along with the opening line. A block that
   * has one is fenced with `:::`, so that the `::block-tab` children inside it are read as blocks of
   * their own rather than as the end of this one.
   */
  static definition = {
    block: 'tabs',
    name: 'Tabs',
    description: 'Groups content into tabbed panels.',
    icon: 'resume-template',
    template: `::block-tab{label="First tab"}
Content of the first tab.
::

::block-tab{label="Second tab"}
Content of the second tab.
::`
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /*
        One raised card: the border and the rounded corners belong to the outer box, and clipping to
        it is what rounds the strip's top corners and the panel's bottom ones without either of them
        having to know where it sits.

        -> It also carries the gap below the block. On this element rather than :host: see block-index.
      */
      .tabs {
        margin-bottom: 16px;
        border: 1px solid var(--tabs-border);
        border-radius: 6px;
        overflow: hidden;
        box-shadow:
          0 1px 3px rgb(0 0 0 / 0.1),
          0 1px 2px rgb(0 0 0 / 0.06);
      }
      :host([dark]) .tabs {
        box-shadow:
          0 1px 3px rgb(0 0 0 / 0.5),
          0 1px 2px rgb(0 0 0 / 0.35);
      }

      /*
        The whole row is the unselected surface, tabs and the space past the last one alike, so the
        gradient is drawn once here and the tabs sit on it rather than repeating it. The line along
        the bottom is the panel's top edge; the tabs are pulled down onto it so the active one can
        paint over its own stretch and open the seam into the panel.
      */
      .strip {
        display: flex;
        flex-wrap: wrap;
        margin: 0;
        padding: 0;
        border-bottom: 1px solid var(--tabs-border);
        background-image: var(--tabs-strip-bg);
      }

      .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: -1px;
        padding: 10px 18px;
        border: 0;
        border-right: 1px solid var(--tabs-border);
        border-bottom: 1px solid transparent;
        border-top: 3px solid transparent;
        background-color: transparent;
        color: var(--tabs-inactive-fg);
        font: inherit;
        font-weight: 500;
        line-height: 1.4;
        cursor: pointer;
        transition:
          background-color 0.15s ease,
          color 0.15s ease;
      }
      .tab:hover:not(.is-active) {
        background-color: rgb(255 255 255 / 0.5);
        color: var(--tabs-active-fg);
      }
      :host([dark]) .tab:hover:not(.is-active) {
        background-color: rgb(255 255 255 / 0.05);
      }
      .tab:focus-visible {
        outline: 2px solid var(--tabs-active-fg);
        outline-offset: -3px;
      }

      /* -> Flat panel colour, which is what lifts it out of the row's gradient */
      .tab.is-active {
        border-top-color: var(--tabs-active-fg);
        border-bottom-color: var(--tabs-panel-bg);
        background-color: var(--tabs-panel-bg);
        background-image: none;
        color: var(--tabs-active-fg);
      }

      .tab svg {
        width: 1.15em;
        height: 1.15em;
        flex-shrink: 0;
      }

      .panel {
        padding: 16px 20px;
        background-color: var(--tabs-panel-bg);
      }

      /* -> The panel owns the spacing, so the content inside it does not add its own at the edges */
      ::slotted(block-tab) {
        margin-bottom: 0;
      }

      :host {
        --tabs-border: #e0e0e0;
        --tabs-strip-bg: linear-gradient(to bottom, #fdfdfd, #eeeeee);
        --tabs-inactive-fg: #424242;
        --tabs-active-fg: var(--q-primary, #1976d2);
        --tabs-panel-bg: #fff;
      }
      :host([dark]) {
        --tabs-border: rgba(255, 255, 255, 0.15);
        --tabs-strip-bg: linear-gradient(to bottom, #1b212a, #12161d);
        --tabs-inactive-fg: rgba(255, 255, 255, 0.7);
        --tabs-panel-bg: #1e232a;
      }
    `
  }

  static get properties() {
    return {
      _tabs: { state: true },
      _active: { state: true }
    }
  }

  constructor() {
    super()
    this._tabs = []
    this._active = 0
    // -> Bound once, so that removing the listener later takes the same function that was added
    this._onReveal = this._onReveal.bind(this)
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * Read the panels the page gave this block, and start showing the first.
   *
   * The panels stay in the light DOM, slotted in below the strip: their content is page content and
   * is styled by the article's own stylesheet, the way an included page is.
   */
  _collectTabs() {
    const panels = [...this.querySelectorAll(':scope > block-tab')]
    this._tabs = panels.map((panel, index) => {
      this._trimEdgeMargins(panel)
      return {
        panel,
        label: panel.getAttribute('label') || `Tab ${index + 1}`,
        icon: panel.getAttribute('icon') || '',
        svg: ''
      }
    })
    this._showActive()
    this._loadIcons()
  }

  /**
   * Drop the outermost margins of a panel's content.
   *
   * The panel supplies the padding; the content adding its own on top of it leaves a gap under the
   * strip that reads as a mistake — a heading, whose margin is the largest of any element, most of
   * all. Set on the element rather than in the stylesheet because the content is slotted: it lives in
   * the page, styled by the page, and `::slotted()` reaches only the panel itself, never inside it.
   */
  _trimEdgeMargins(panel) {
    panel.firstElementChild?.style.setProperty('margin-top', '0')
    panel.lastElementChild?.style.setProperty('margin-bottom', '0')
  }

  /**
   * Keep the strip on screen when something inside a panel is scrolled to.
   *
   * A heading carries a `scroll-margin-top` so it does not land flush against the top edge, but that
   * margin knows nothing about the strip standing above it — following a link to a heading in a tab
   * would scroll the tabs themselves out of view, leaving the reader in a panel with no way to see
   * which one they were in. Set on the elements because the content is slotted, and measured because
   * the strip is as tall as the labels wrapped onto however many rows.
   */
  _applyScrollMargin() {
    const strip = this.renderRoot.querySelector('.strip')
    if (!strip) {
      return
    }
    const margin = `${strip.offsetHeight + 20}px`
    for (const { panel } of this._tabs) {
      for (const child of panel.children) {
        child.style.setProperty('scroll-margin-top', margin)
      }
    }
  }

  _showActive() {
    this._tabs.forEach(({ panel }, index) => {
      panel.style.display = index === this._active ? 'block' : 'none'
    })
  }

  async _loadIcons() {
    for (const tab of this._tabs.filter((t) => t.icon)) {
      tab.svg = await fetchIcon(tab.icon)
      this.requestUpdate()
    }
  }

  _select(index) {
    this._active = index
    this._showActive()
  }

  /**
   * Open the panel holding a given node, if it is one of these.
   *
   * Both ways in end up here: the app asking for a heading it is about to scroll to, and the reader
   * arriving on a URL whose fragment names a heading in a panel that is not the first.
   */
  _reveal(node) {
    const index = this._tabs.findIndex(({ panel }) => panel.contains(node))
    if (index >= 0 && index !== this._active) {
      this._select(index)
    }
    return index >= 0
  }

  _onReveal(event) {
    this._reveal(event.target)
  }

  /** The panel holding the heading the URL points at, if the URL points at one. */
  _revealFromHash() {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ''))
    const target = id ? document.getElementById(id) : null
    if (target) {
      this._reveal(target)
    }
  }

  /**
   * Left and right walk the strip, as they do in every other set of tabs — the panels are a single
   * stop in the tab order, so the arrow keys are how a keyboard reaches the other ones.
   */
  _onKeydown(event) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) {
      return
    }
    event.preventDefault()
    const next = (this._active + step + this._tabs.length) % this._tabs.length
    this._select(next)
    this.renderRoot.querySelectorAll('.tab')[next]?.focus()
  }

  updated() {
    this._applyScrollMargin()
  }

  connectedCallback() {
    super.connectedCallback()
    this._collectTabs()
    // -> On arrival, and again whenever the fragment changes under a reader using back and forward
    this._revealFromHash()
    this._onHashChange = () => this._revealFromHash()
    window.addEventListener('hashchange', this._onHashChange)
    this.addEventListener(REVEAL_EVENT, this._onReveal)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('hashchange', this._onHashChange)
    this.removeEventListener(REVEAL_EVENT, this._onReveal)
  }

  render() {
    if (this._tabs.length < 1) {
      return html`<slot></slot>`
    }
    return html`
      <div class="tabs">
        <div class="strip" role="tablist" @keydown="${this._onKeydown}">
          ${this._tabs.map(
            (tab, index) => html`
              <button
                type="button"
                role="tab"
                class="tab ${index === this._active ? 'is-active' : ''}"
                aria-selected="${index === this._active}"
                tabindex="${index === this._active ? 0 : -1}"
                @click="${() => this._select(index)}">
                ${tab.svg ? unsafeSVG(tab.svg) : null}${tab.label}
              </button>
            `
          )}
        </div>
        <div class="panel" role="tabpanel"><slot></slot></div>
      </div>
    `
  }
}

window.customElements.define('block-tabs', BlockTabsElement)
