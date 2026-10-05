import { LitElement, html, css, nothing } from 'lit'
import { styleMap } from 'lit/directives/style-map.js'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { load as parseYaml } from 'js-yaml'
import { resolveFilePath } from '../shared/files.js'
import { fetchIcon, iconImageUrl } from '../shared/icons.js'
import { DarkMode } from '../shared/theme.js'

/**
 * The accent a card's `color` may name: Tailwind's palette at shade 500, copied from
 * `tailwindcss/theme.css`.
 *
 * Copied rather than read off `--color-*-500`, because Tailwind only emits the theme variables the
 * app's own stylesheet uses — most of these are not declared on any page, and a name that resolved
 * on one build and not the next is worse than a list that is fixed.
 */
const COLORS = {
  red: 'oklch(63.7% 0.237 25.331)',
  orange: 'oklch(70.5% 0.213 47.604)',
  amber: 'oklch(76.9% 0.188 70.08)',
  yellow: 'oklch(79.5% 0.184 86.047)',
  lime: 'oklch(76.8% 0.233 130.85)',
  green: 'oklch(72.3% 0.219 149.579)',
  emerald: 'oklch(69.6% 0.17 162.48)',
  teal: 'oklch(70.4% 0.14 182.503)',
  cyan: 'oklch(71.5% 0.143 215.221)',
  sky: 'oklch(68.5% 0.169 237.323)',
  blue: 'oklch(62.3% 0.214 259.815)',
  indigo: 'oklch(58.5% 0.233 277.117)',
  violet: 'oklch(60.6% 0.25 292.717)',
  purple: 'oklch(62.7% 0.265 303.9)',
  fuchsia: 'oklch(66.7% 0.295 322.15)',
  pink: 'oklch(65.6% 0.241 354.308)',
  rose: 'oklch(64.5% 0.246 16.439)',
  slate: 'oklch(55.4% 0.046 257.417)',
  gray: 'oklch(55.1% 0.027 264.364)',
  zinc: 'oklch(55.2% 0.016 285.938)',
  neutral: 'oklch(55.6% 0 none)',
  stone: 'oklch(55.3% 0.013 58.071)',
  mauve: 'oklch(54.2% 0.034 322.5)',
  olive: 'oklch(58% 0.031 107.3)',
  mist: 'oklch(56% 0.021 213.5)',
  taupe: 'oklch(54.7% 0.021 43.1)'
}

/**
 * The schemes a card may link to.
 *
 * A closed list, because the body is text that anybody who may edit the page can write, and an href
 * is somewhere a script can hide: `javascript:` on a card would be a way round `write:scripts`. The
 * scheme is read off the parsed URL rather than off the text, since the URL parser drops tabs and
 * newlines from the middle of one — `java	script:` is `javascript:` by the time a browser follows it.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * What a card's `url` becomes as an href, or null for one it may not link to.
 *
 * Relative addresses are resolved against the page the block is on, as any link in it would be.
 */
function hrefOf(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return null
  }
  let url
  try {
    url = new URL(text, globalThis.location?.href)
  } catch {
    return null
  }
  return SAFE_PROTOCOLS.has(url.protocol) ? text : null
}

/**
 * Whether an href is a page of this wiki, and so the router's to open rather than the browser's.
 *
 * The wiki's own `/_` routes are server endpoints — a file under `/_files/` is a download, not a page
 * — so those load for real.
 */
function isWikiPage(href) {
  return href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/_')
}

/** A YAML value as text: an empty string for one left out, and a number or a boolean spelled out. */
function textOf(value) {
  return value === undefined || value === null ? '' : String(value)
}

/** A card's `tags`: a list, or a single tag written as a string. Empty entries are dropped. */
function tagsOf(value) {
  const list = Array.isArray(value) ? value : [value]
  return list.map((tag) => textOf(tag).trim()).filter(Boolean)
}

/**
 * Block Links Grid
 *
 * A grid of cards, each one a link, listed as YAML in the block's body:
 *
 *     ::block-links-grid
 *     ```yaml
 *     - title: Page A
 *       url: /page-a
 *     ```
 *     ::
 */
export class BlockLinksGridElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'links-grid',
    name: 'Links Grid',
    description: 'A custom grid of cards, each linking to a page or an external URL.',
    icon: 'grid',
    template: `\`\`\`yaml
- title: Getting Started
  url: /getting-started
  description: Everything you need on your first day.
  icon: 'mdi:rocket-launch-outline'
  color: blue
- title: Guides
  url: /guides
  description: Step-by-step instructions for common tasks.
  icon: 'mdi:book-open-variant'
  color: amber
  tags:
    - How-to
    - Reference
\`\`\``,
    /*
      The body is a source an author types, edited as one: YAML on the left, this block on the right.
      As for block-infobox, it is also the only way to edit the block in the Visual editor, which
      parses a block whose body is a single fence as an atom.
    */
    contentEditor: 'code',
    props: [
      {
        name: 'minWidth',
        type: 'string',
        label: 'Min Card Width',
        hint: 'Narrowest a card may be, as a CSS length. The grid fits as many as the width allows.',
        default: '300px'
      },
      {
        name: 'maxWidth',
        type: 'string',
        label: 'Max Card Width',
        hint: 'Widest a card may be, as a CSS length. 1fr shares the leftover space between cards.',
        default: '1fr'
      },
      {
        name: 'maxHeight',
        type: 'string',
        label: 'Max Card Height',
        hint: 'Tallest a card may be, as a CSS length. A picture is cropped shorter to fit; the writing under it is not. Empty means no limit.'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /*
        The gap below the block lives here rather than on :host, which the app's margin reset in the
        page would beat. See block-index.

        The columns themselves come from the props, as an inline style on this element.
      */
      ul {
        display: grid;
        gap: 0.75rem;
        padding: 0;
        margin: 0 0 16px;
        list-style: none;
      }

      /*
        Drawn as block-index draws a row: the same ground, the same hairline right and bottom, the
        same shadow. Clipped so a picture at the top takes the card's rounded corners.
      */
      /* -> The cap comes from the maxHeight prop, set on the list by render() */
      li {
        display: flex;
        max-height: var(--card-max-height, none);
        overflow: hidden;
        background-color: #fafafa;
        background-image: linear-gradient(to bottom, #fff, #fafafa);
        border: 1px solid rgba(0, 0, 0, 0.05);
        border-radius: 5px;
        box-shadow: 0 3px 8px 0 rgba(116, 129, 141, 0.1);
        transition: box-shadow 0.15s ease;
      }
      :host([dark]) li {
        background-color: #222;
        background-image: linear-gradient(to bottom, #161b22, #0d1117);
        border-color: rgba(0, 0, 0, 0.5);
        box-shadow: 0 3px 8px 0 rgba(0, 0, 0, 0.25);
      }
      /*
        -> The width block-index gives its left border, in the colour the card asked for. Repeated
           under :host([dark]), whose border-color above outranks a bare li.has-accent and would
           otherwise paint the accent over in the dark theme's hairline.
      */
      li.has-accent,
      :host([dark]) li.has-accent {
        border-left: 5px solid var(--card-accent);
      }
      li:hover {
        box-shadow: 0 4px 14px 0 rgba(116, 129, 141, 0.25);
      }
      :host([dark]) li:hover {
        background-image: linear-gradient(to bottom, #1e232a, #161b22);
        box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.45);
      }

      /* -> The whole card is the link, so everything below is laid out inside the anchor */
      a {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
        color: var(--q-primary);
        text-decoration: none;
      }
      a:focus-visible {
        outline: 2px solid var(--q-primary);
        outline-offset: -2px;
        border-radius: 5px;
      }

      /*
        Cropped to fill, at a fixed shape so a row of cards carrying pictures of different sizes
        still lines up. On a card with nothing but the picture it grows to fill the card instead,
        which is as tall as whatever else shares its row.

        The picture is what gives way to a card's max height, and the writing is not: it shrinks
        (min-height: 0 is what lets an image with an aspect ratio go below the height that ratio
        gives it) while .body holds its own height, so a capped card still shows its title.
      */
      .cover {
        display: block;
        flex: 0 1 auto;
        min-height: 0;
        width: 100%;
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }
      li.is-image-only .cover {
        flex: 1 1 auto;
      }

      /*
        A grid rather than a row, for the sake of the tags: they sit under the description and line
        up with its left edge, but the icon is centred on the title and description alone. So the
        icon and the writing share the first row, and the tags take the second row of the writing's
        column, which the icon does not span. A card without an icon has the one column.

        align-content centres the rows as a group when the card is stretched taller than they are,
        which is what the row of a flex box used to do.
      */
      .body {
        display: grid;
        flex: 1 0 auto;
        grid-template-columns: minmax(0, 1fr);
        align-items: center;
        align-content: center;
        column-gap: 14px;
        padding: 0.75rem 1rem;
      }
      .body.has-icon {
        grid-template-columns: auto minmax(0, 1fr);
      }
      .body > .text,
      .body > .tags {
        grid-column: -2;
      }

      /*
        Sized and spaced as block-index's, so the two blocks side by side read as one family. Drawn in
        the card's accent when it has one, so the icon and the border beside it are the same colour,
        and in the link's primary otherwise. An Iconify SVG paints with currentColor; an img: icon
        keeps its own colours.
      */
      .icon {
        display: flex;
        flex: none;
        align-items: center;
        width: 1.75em;
        color: var(--card-accent, var(--q-primary));
      }
      .icon svg,
      .icon img {
        width: 1.75em;
        height: 1.75em;
      }

      .text {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        min-width: 0;
      }
      .title {
        font-weight: 500;
        overflow-wrap: anywhere;
      }
      /* -> The lightened brand shade on a dark card, as block-index does. See its note on .text */
      :host([dark]) .title {
        color: var(--color-primary-light);
      }
      .description {
        color: #666;
        font-size: 0.8em;
        overflow-wrap: anywhere;
      }
      :host([dark]) .description {
        color: rgba(255, 255, 255, 0.6);
      }

      /*
        The card's accent, or primary on a card without one, as the icon is. The writing is the
        accent darkened in the light theme and lightened in the dark one: a shade 500 on a pale wash
        of itself is too faint to read for the lighter hues, amber and yellow above all.
      */
      .tags {
        --badge: var(--card-accent, var(--q-primary));
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }
      .tags span {
        padding: 1px 8px;
        border: 1px solid color-mix(in oklch, var(--badge) 35%, transparent);
        border-radius: 999px;
        background-color: color-mix(in oklch, var(--badge) 12%, transparent);
        color: color-mix(in oklch, var(--badge) 70%, black);
        font-size: 0.7em;
        font-weight: 500;
        line-height: 1.6;
        white-space: nowrap;
      }
      :host([dark]) .tags span {
        background-color: color-mix(in oklch, var(--badge) 20%, transparent);
        color: color-mix(in oklch, var(--badge) 60%, white);
      }

      .error {
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
       * Narrowest a card may be, as a CSS length
       * @type {string}
       */
      minWidth: { type: String },

      /**
       * Widest a card may be, as a CSS length or a fraction
       * @type {string}
       */
      maxWidth: { type: String },

      /**
       * Tallest a card may be, as a CSS length, or empty for no limit
       * @type {string}
       */
      maxHeight: { type: String },

      // Internal Properties
      _cards: { state: true },
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.minWidth = '300px'
    this.maxWidth = '1fr'
    this.maxHeight = ''
    this._cards = []
    this._error = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * Read the cards out of the block's body.
   *
   * A fenced code block is the way to write it: markdown reads a line opening with `-` as a list of
   * its own and hands this the text with the indentation gone, which is no longer the YAML that was
   * typed. The text of the body is tried anyway, so a single flat card written without a fence works.
   */
  connectedCallback() {
    super.connectedCallback()
    const source = (this.querySelector('pre') ?? this).textContent ?? ''
    if (!source.trim()) {
      return
    }
    let parsed
    try {
      parsed = parseYaml(source)
    } catch (err) {
      this._error = `These cards could not be read: ${err.reason ?? err.message}. The list has to go inside a fenced code block.`
      return
    }
    if (!Array.isArray(parsed)) {
      this._error = 'A links grid is a list of cards, each one starting with "- url:".'
      return
    }
    const cards = []
    const refused = []
    parsed.forEach((entry, index) => {
      const href = entry && typeof entry === 'object' ? hrefOf(entry.url) : null
      if (!href) {
        refused.push(index + 1)
        return
      }
      cards.push({
        href,
        title: textOf(entry.title),
        description: textOf(entry.description),
        // -> A bare path is a file from the file manager, as it is in block-gallery
        image: entry.image ? resolveFilePath(textOf(entry.image)) : '',
        icon: textOf(entry.icon),
        tags: tagsOf(entry.tags),
        accent: COLORS[textOf(entry.color).trim().toLowerCase()] ?? null
      })
    })
    // -> Named by position, since a card with no usable url may well have nothing else to go by
    if (refused.length > 0) {
      this._error = `${refused.length > 1 ? 'Cards' : 'Card'} ${refused.join(', ')} ${refused.length > 1 ? 'have' : 'has'} no url, or one that is not a page, a web address, an email address or a phone number.`
    }
    this._cards = cards
    this._loadIcons()
  }

  /**
   * Fetch the icons the cards carry, all at once. The shared cache collapses repeats, and a failure
   * is an empty string — a card whose icon could not be had is drawn without one.
   */
  async _loadIcons() {
    await Promise.all(
      this._cards.map(async (card) => {
        if (card.icon && !iconImageUrl(card.icon)) {
          card.svg = await fetchIcon(card.icon)
        }
      })
    )
    // -> The cards were mutated rather than replaced, which Lit has no way of noticing on its own
    this.requestUpdate()
  }

  _icon(card) {
    const image = iconImageUrl(card.icon)
    return html`<span class="icon">
      ${image ? html`<img src="${image}" alt="" />` : card.svg ? unsafeSVG(card.svg) : null}
    </span>`
  }

  /*
    -> A card that is only a picture has no words for its link, so it is named by where it goes. One
       with writing is named by that writing, which is what a screen reader then reads, description
       included.
  */
  _card(card) {
    const hasText = card.title || card.description
    const hasBody = hasText || card.icon || card.tags.length > 0
    const classes = [
      card.accent ? 'has-accent' : '',
      card.image && !hasBody ? 'is-image-only' : ''
    ].join(' ')
    return html`<li
      class="${classes}"
      style="${styleMap(card.accent ? { '--card-accent': card.accent } : {})}">
      <a
        href="${card.href}"
        aria-label="${hasBody ? nothing : card.href}"
        @click="${this._navigate}">
        ${card.image ? html`<img class="cover" src="${card.image}" alt="" />` : null}
        ${
          hasBody
            ? html`<div class="body ${card.icon ? 'has-icon' : ''}">
                ${card.icon ? this._icon(card) : null}
                ${
                  hasText
                    ? html`<div class="text">
                        ${card.title ? html`<span class="title">${card.title}</span>` : null}
                        ${
                          card.description
                            ? html`<span class="description">${card.description}</span>`
                            : null
                        }
                      </div>`
                    : null
                }
                ${
                  card.tags.length > 0
                    ? html`<div class="tags">
                        ${card.tags.map((tag) => html`<span>${tag}</span>`)}
                      </div>`
                    : null
                }
              </div>`
            : null
        }
      </a>
    </li>`
  }

  render() {
    /*
      min() on the narrow end, so a column never asks for more than the block has: a 300px minimum on
      a 280px phone would otherwise push the card out past the edge of the page.
    */
    const columns = `repeat(auto-fit, minmax(min(${this.minWidth || '300px'}, 100%), ${this.maxWidth || '1fr'}))`
    return html`
      ${this._error ? html`<div class="error">${this._error}</div>` : null}
      ${
        this._cards.length > 0
          ? html`<ul
              style="${styleMap({
                gridTemplateColumns: columns,
                // -> Left off entirely when empty, so the rule falls back to no limit
                '--card-max-height': this.maxHeight || undefined
              })}">
              ${this._cards.map((card) => this._card(card))}
            </ul>`
          : null
      }
    `
  }

  /**
   * A page of this wiki opens through the router, as a link in the article would. Anything else —
   * another site, a file, a click with a modifier asking for a new tab — is left to the browser.
   */
  _navigate(e) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return
    }
    const href = e.currentTarget.getAttribute('href')
    if (!isWikiPage(href)) {
      return
    }
    e.preventDefault()
    WIKI_ROUTER.push(href)
  }
}

window.customElements.define('block-links-grid', BlockLinksGridElement)
