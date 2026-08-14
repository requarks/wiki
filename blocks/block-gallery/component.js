import { LitElement, html, css } from 'lit'

import { DarkMode } from '../shared/theme.js'

/** Where an uploaded file is served from, and so what a bare path in the body is taken to mean. */
const FILES_PREFIX = '/_files/'

/**
 * An address that already says where it points: a full URL, a protocol-relative one, a data URI —
 * or one of the wiki's own `/_` routes, `/_files/` among them.
 */
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/_)/i

/** Icons, as the path of a 24x24 MDI glyph. */
const ICONS = {
  previous: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
  next: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
  close:
    'M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z'
}

/**
 * The address a line of the body points at.
 *
 * Anything that names its own location is left exactly as written. Everything else is a path into the
 * file manager, which is where the images on a wiki page live — so `photos/summer.jpg` and
 * `/photos/summer.jpg` both mean `/_files/photos/summer.jpg`, and an author can paste the path the
 * file manager shows without having to remember the prefix. Wiki routes are spared that: they all
 * start with `/_`, and `/_files/` is one of them, so a path already carrying the prefix is not given
 * a second one.
 */
function resolveSource(value) {
  const address = value.trim()
  if (ABSOLUTE.test(address)) {
    return address
  }
  return FILES_PREFIX + address.replace(/^\/+/, '')
}

/**
 * The box the block actually scrolls in.
 *
 * The article has its own scroller rather than the window — the shell stays put and the column moves
 * — so that is the element a lightbox has to hold still while it is open. Same walk as
 * `helpers/anchors.js` on the frontend, for the same reason.
 */
function scrollerOf(el) {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (/(auto|scroll|overlay)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1) {
      return node
    }
  }
  return document.scrollingElement ?? document.documentElement
}

/**
 * What to call an image, for a screen reader and for a browser drawing the alt text of one that did
 * not load. The file name is all a list of addresses carries.
 */
function labelFor(address) {
  const path = address.split(/[?#]/)[0]
  const name = path.split('/').filter(Boolean).at(-1) ?? address
  try {
    return decodeURIComponent(name)
  } catch {
    // -> A stray `%` in a file name, which is not an escape and not worth failing over
    return name
  }
}

/**
 * Block Gallery
 *
 * A grid of thumbnails from a list of addresses, and a lightbox over the whole site to look at any
 * one of them full size. The list is the block's body, one address per line:
 *
 *     ::block-gallery
 *     https://example.com/photo-1.jpg
 *     /photos/photo-2.jpg
 *     ::
 */
export class BlockGalleryElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'gallery',
    name: 'Image Gallery',
    description: 'Displays a grid of images, each opening full size in a lightbox.',
    icon: 'image',
    props: [
      {
        name: 'thumbnailSize',
        type: 'number',
        label: 'Thumbnail Size',
        hint: 'Smallest a thumbnail may be, in pixels. The grid fits as many as the width allows.',
        default: 180
      },
      {
        name: 'fit',
        type: 'select',
        label: 'Thumbnail Fit',
        options: ['cover', 'contain'],
        hint: 'Whether a thumbnail is cropped to fill its tile, or shown whole inside it.',
        default: 'cover'
      }
    ],
    template: `https://example.com/photo-1.jpg
https://example.com/photo-2.jpg`
  }

  static get styles() {
    return css`
      :host {
        display: block;

        --gallery-border: #e0e0e0;
        --gallery-tile-bg: #f1f3f5;
        --gallery-fg: #424242;
      }
      :host([dark]) {
        --gallery-border: rgba(255, 255, 255, 0.15);
        --gallery-tile-bg: #12161d;
        --gallery-fg: rgba(255, 255, 255, 0.7);
      }

      /*
        The grid, and the gap below the block. On this element rather than :host: see block-index.

        -> min() rather than the thumbnail size on its own, so a gallery asked for at 300 on a phone
           is one column the width of the phone instead of pushing the page sideways.
      */
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(var(--gallery-thumb), 100%), 1fr));
        gap: 8px;
        margin-bottom: 16px;
      }

      .tile {
        display: block;
        padding: 0;
        border: 1px solid var(--gallery-border);
        border-radius: 5px;
        overflow: hidden;
        background-color: var(--gallery-tile-bg);
        aspect-ratio: 1;
        cursor: zoom-in;
      }
      .tile:focus-visible {
        outline: 2px solid var(--q-primary, #1976d2);
        outline-offset: 2px;
      }

      .tile img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: var(--gallery-fit);
        /* -> The alt text of an image that did not load, which has no room to be centred in */
        font-size: 12px;
        color: var(--gallery-fg);
        transition: transform 200ms ease;
      }
      .tile:hover img {
        transform: scale(1.05);
      }
      @media (prefers-reduced-motion: reduce) {
        .tile img {
          transition: none;
        }
        .tile:hover img {
          transform: none;
        }
      }

      /*
        The lightbox is a modal dialog, which is what puts it over the whole site.

        An element in the top layer is drawn above the page whatever the block is nested in -- where a
        fixed-position overlay in the shadow root is still clipped by the first ancestor with a
        transform, a filter or an overflow of its own, and the app has all three between the page and
        a block. Opened this way it also comes with most of what a lightbox has to do anyway: Escape
        closes it, the page behind cannot be tabbed into or clicked, and focus returns to the
        thumbnail that was opened. Scrolling is the exception -- see _holdPage below.
      */
      .lightbox {
        width: 100vw;
        max-width: 100vw;
        height: 100vh;
        max-height: 100vh;
        margin: 0;
        padding: 0;
        border: 0;
        background-color: transparent;
        overflow: hidden;
        opacity: 0;
        transition:
          opacity 150ms ease,
          overlay 150ms allow-discrete,
          display 150ms allow-discrete;
      }
      .lightbox[open] {
        opacity: 1;
      }
      /* -> Where the fade starts from. Without it the dialog is simply there, which is no worse. */
      @starting-style {
        .lightbox[open] {
          opacity: 0;
        }
      }
      /*
        -> A shade lighter than a flat backdrop would be, since the blur is doing some of the work of
           putting the page away. Not much lighter: dark enough on its own that a browser without
           backdrop-filter loses the softness and nothing else.
      */
      .lightbox::backdrop {
        background-color: rgb(0 0 0 / 0.82);
        backdrop-filter: blur(18px);
      }

      /*
        The clickable ground the image sits on: anywhere off the image closes the lightbox.

        -> border-box, because the padding is what keeps the image clear of the chevrons over it and
           a content-box stage is the width of the dialog plus that padding, which pushes what it is
           centring off to one side. The app's own reset does not reach in here.
      */
      .stage {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 4rem;
        cursor: zoom-out;
      }
      @media (max-width: 640px) {
        .stage {
          padding: 3.5rem 0.5rem;
        }
      }

      .stage img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        cursor: default;
      }

      .chrome {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background-color: rgb(255 255 255 / 0.1);
        color: #fff;
        cursor: pointer;
      }
      .chrome:hover {
        background-color: rgb(255 255 255 / 0.25);
      }
      .chrome:focus-visible {
        outline: 2px solid #fff;
        outline-offset: 2px;
      }
      .chrome svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
      }

      .chrome.is-close {
        top: 12px;
        right: 12px;
      }
      .chrome.is-previous {
        top: 50%;
        left: 12px;
        transform: translateY(-50%);
      }
      .chrome.is-next {
        top: 50%;
        right: 12px;
        transform: translateY(-50%);
      }

      .counter {
        position: absolute;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 10px;
        border-radius: 12px;
        background-color: rgb(0 0 0 / 0.5);
        color: rgb(255 255 255 / 0.85);
        font-size: 13px;
        line-height: 1;
      }

      .error {
        margin-bottom: 16px;
        padding: 1rem;
        border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
        border-radius: 5px;
        color: var(--q-negative, #c10015);
      }
    `
  }

  static get properties() {
    return {
      /**
       * Smallest a thumbnail may be, in pixels
       * @type {number}
       */
      thumbnailSize: { type: Number },

      /**
       * How a thumbnail fills its tile: `cover` or `contain`
       * @type {string}
       */
      fit: { type: String },

      // Internal Properties
      _images: { state: true },
      /** Which image the lightbox is showing, or -1 while it is closed. */
      _index: { state: true }
    }
  }

  constructor() {
    super()
    this.thumbnailSize = 180
    this.fit = 'cover'
    this._images = []
    this._index = -1
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
    /** What the page was doing before the lightbox held it still. See `_holdPage`. */
    this._held = null
  }

  get _dialog() {
    return this.renderRoot?.querySelector('.lightbox') ?? null
  }

  /**
   * Read the list of images out of the block's body.
   *
   * The body has been through markdown by the time it gets here, which for a list of addresses leaves
   * the addresses themselves: linkified or not, the text of the paragraph is what was typed. It is
   * split on whitespace rather than on line endings alone, so a body whose lines markdown joined into
   * one still reads as the list it was written as.
   *
   * Images markdown drew for itself are collected too, since `![](photo.jpg)` is the other way an
   * author writes an image and arrives here as an `img` carrying no text at all. A fenced code block
   * wins outright, as everywhere else: it is the way to hand a block a body markdown has not touched.
   */
  firstUpdated() {
    const fence = this.querySelector('pre')
    const source = ((fence ?? this).textContent ?? '').trim()
    const found = source.split(/\s+/).filter(Boolean).map(resolveSource)
    if (!fence) {
      for (const image of this.querySelectorAll('img')) {
        found.push(resolveSource(image.getAttribute('src') ?? ''))
      }
    }
    // -> An address written once and drawn twice -- as a link and as the image it points at -- is one
    //    photo, and the order they were written in is the order the gallery shows them in
    this._images = [...new Set(found)]
  }

  /** Keep the neighbours of what is showing ready, so a chevron is a step rather than a load. */
  _preloadNeighbours() {
    for (const step of [-1, 1]) {
      const image = new Image()
      image.src = this._images[this._wrap(this._index + step)]
    }
  }

  /** An index brought back into the gallery, so that the last photo is followed by the first. */
  _wrap(index) {
    const count = this._images.length
    return (index + count) % count
  }

  async _show(index) {
    this._index = index
    // -> Shown only once the image it is showing has been rendered, so the lightbox never opens empty
    await this.updateComplete
    this._dialog?.showModal()
    this._holdPage(true)
    this._preloadNeighbours()
  }

  /**
   * Stop the page moving under the lightbox, and let it go again afterwards.
   *
   * The one thing a modal dialog does not do for itself: the page behind it cannot be clicked or
   * tabbed into, but a wheel still scrolls it — so the reader closes the lightbox somewhere other
   * than where they opened it. The offset is put back along with the overflow, because an element
   * that has spent a moment not scrolling does not reliably keep the position it was scrolled to.
   *
   * Nothing of this is visible while it happens: the backdrop covers the page it is done to.
   */
  _holdPage(held) {
    if (held) {
      const scroller = scrollerOf(this)
      this._held = { scroller, overflow: scroller.style.overflow, top: scroller.scrollTop }
      scroller.style.overflow = 'hidden'
      return
    }
    if (this._held) {
      const { scroller, overflow, top } = this._held
      scroller.style.overflow = overflow
      scroller.scrollTop = top
      this._held = null
    }
  }

  _step(delta) {
    this._index = this._wrap(this._index + delta)
    this._preloadNeighbours()
  }

  _previous() {
    this._step(-1)
  }

  _next() {
    this._step(1)
  }

  _close() {
    this._dialog?.close()
  }

  /** However it was closed — the X, a click beside the image, or Escape, which is the dialog's own. */
  _onClose() {
    this._index = -1
    this._holdPage(false)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // -> A block taken off the page while its lightbox is open would otherwise leave the article
    //    unable to scroll, with nothing left to close
    this._holdPage(false)
  }

  /** Escape is the dialog's own; the arrow keys are what a gallery adds to it. */
  _onKeydown(ev) {
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault()
      this._previous()
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault()
      this._next()
    }
  }

  /**
   * A click on the ground the image sits on, rather than on the image or a button over it.
   *
   * The dialog itself is included: it is the whole viewport, and a stage narrower than the window --
   * which is what a portrait window leaves -- puts the edges of the backdrop there.
   */
  _onStageClick(ev) {
    if (ev.target === ev.currentTarget || ev.target.classList.contains('stage')) {
      this._close()
    }
  }

  _icon(path) {
    return html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`
  }

  /**
   * The lightbox, empty until it is opened.
   *
   * The dialog itself is always in the shadow tree, since it is what `showModal` is called on, but
   * nothing inside it is built for a lightbox nobody has opened — an image the reader may never ask
   * for is a photo fetched per gallery on every page it appears on.
   */
  _renderLightbox() {
    const address = this._images[this._index]
    return html`
      <dialog
        class="lightbox"
        aria-label="Image viewer"
        @click=${this._onStageClick}
        @keydown=${this._onKeydown}
        @close=${this._onClose}>
        ${
          address
            ? html`
                <div class="stage">
                  <img src=${address} alt=${labelFor(address)} />
                </div>
                ${
                  this._images.length > 1
                    ? html`
                        <button
                          class="chrome is-previous"
                          type="button"
                          title="Previous image"
                          aria-label="Previous image"
                          @click=${this._previous}>
                          ${this._icon(ICONS.previous)}
                        </button>
                        <button
                          class="chrome is-next"
                          type="button"
                          title="Next image"
                          aria-label="Next image"
                          @click=${this._next}>
                          ${this._icon(ICONS.next)}
                        </button>
                        <div class="counter">${this._index + 1} / ${this._images.length}</div>
                      `
                    : null
                }
                <!-- -> Focused on opening, so the lightbox is closable from the keyboard straight away -->
                <button
                  class="chrome is-close"
                  type="button"
                  autofocus
                  title="Close"
                  aria-label="Close"
                  @click=${this._close}>
                  ${this._icon(ICONS.close)}
                </button>
              `
            : null
        }
      </dialog>
    `
  }

  render() {
    if (this._images.length < 1) {
      return html`
        <div class="error">
          This gallery is empty. Its images go in the body of the block, one address per line.
        </div>
      `
    }

    const size = Number(this.thumbnailSize)
    const style = [
      `--gallery-thumb: ${Number.isFinite(size) && size > 0 ? size : 180}px`,
      `--gallery-fit: ${this.fit === 'contain' ? 'contain' : 'cover'}`
    ].join('; ')

    return html`
      <div class="gallery" style=${style}>
        ${this._images.map(
          (address, index) => html`
            <button
              class="tile"
              type="button"
              title=${labelFor(address)}
              aria-label="View ${labelFor(address)} full size"
              @click=${() => this._show(index)}>
              <img src=${address} alt=${labelFor(address)} loading="lazy" decoding="async" />
            </button>
          `
        )}
      </div>
      ${this._renderLightbox()}
    `
  }
}

window.customElements.define('block-gallery', BlockGalleryElement)
