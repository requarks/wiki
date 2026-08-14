import { LitElement, html, css } from 'lit'
import {
  getDocument,
  GlobalWorkerOptions,
  OutputScale,
  PasswordException,
  RenderingCancelledException,
  TextLayer
} from 'pdfjs-dist/build/pdf.mjs'

import { DarkMode } from '../shared/theme.js'

/*
  Where the parsing happens.

  `worker.js` in this directory is compiled to `block-pdf.worker.js` alongside this bundle, so the
  address is this file's own, one name over. Resolved from `import.meta.url` rather than written as
  `/_blocks/...`: the block knows where it was loaded from, and nothing else here has to agree with
  the server about a path.

  Everything pdf.js does with a document happens behind this: reading its structure, decoding its
  images, turning glyph runs into drawing operations. Left on the page's thread -- which is what
  pdf.js falls back to when the worker cannot be reached -- a document of any size locks the wiki up
  while it loads.
*/
GlobalWorkerOptions.workerSrc = new URL('block-pdf.worker.js', import.meta.url).href

/*
  Where the data files pdf.js fetches for itself live, put there by the build's `blockAssets` step.

  Nothing below is loaded until a document turns out to need it, which is why they are files rather
  than part of the bundle -- and why they can be listed unconditionally here. Each covers a case that
  is otherwise a silently half-drawn page:

  - `cmaps` are the predefined CJK character maps, for a document naming one instead of embedding it.
  - `standard_fonts` are the base 14 fonts, for a reader whose system has nothing to answer with.
  - `wasm` decodes JPEG 2000 and JBIG2 images -- the compression scanners tend to produce.
  - `iccs` is the CMYK profile, without which those colours are converted by approximation.
*/
const DATA_URL = new URL('block-pdf/', import.meta.url).href

/**
 * An attribute that means "off" when it says so.
 *
 * MDC writes every prop with a value — `hideToolbar="false"` is what the block picker produces for a
 * toggle that was switched on and off again — and Lit's own Boolean converter reads any string at all
 * as true, that one included.
 */
const boolean = {
  converter: {
    fromAttribute: (value) => value !== null && value !== 'false',
    toAttribute: (value) => (value ? 'true' : null)
  }
}

/** The zoom steps, and so also what the toolbar's list offers besides the two fitting modes. */
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

const MIN_SCALE = 0.1
const MAX_SCALE = 10

/** The space around a page, and between one page and the next. */
const PAGE_GAP = 12

/**
 * How far either side of what is on screen to keep drawn.
 *
 * A page is drawn when it comes within a page of the viewport and thrown away again once it is this
 * many pages past it. Every drawn page is a canvas holding its own pixels, so a document read end to
 * end would otherwise accumulate all of them; a couple of pages of slack is what makes scrolling back
 * a few lines free rather than a redraw.
 */
const KEEP_PAGES = 2

/*
  What a single page's canvas may cost, before the device's pixel ratio is honoured any further.

  These are pdf.js's own viewer defaults. A canvas past them is drawn at a lower resolution and
  scaled up by CSS instead, which is a soft loss of sharpness -- where asking a browser for a canvas
  larger than it will allocate is a hard failure, and a page zoomed to 300% on a retina display is
  already asking for one.
*/
const MAX_CANVAS_PIXELS = 2 ** 25
const MAX_CANVAS_DIM = 32767

/** Icons, as the path of a 24x24 MDI glyph. */
const ICONS = {
  previous: 'M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z',
  next: 'M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z',
  zoomOut: 'M19,13H5V11H19V13Z',
  zoomIn: 'M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z',
  open: 'M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z'
}

/**
 * Block PDF
 *
 * A continuous viewer: every page of the document is laid out at once, and the ones near the
 * viewport are drawn. Parsing runs in a worker and pdf.js's own data files are served alongside the
 * block — see `DATA_URL` above and `assets.json` beside this file — so a document is read here the
 * way it would be in a desktop reader, rather than to the extent a single bundle allows.
 */
export class BlockPdfElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'pdf',
    name: 'PDF Viewer',
    description: 'Displays a PDF document in a viewer, page by page.',
    icon: 'pdf',
    props: [
      {
        name: 'src',
        type: 'string',
        label: 'Document URL',
        hint: 'Path or URL of the PDF file to display.',
        required: true
      },
      {
        name: 'page',
        type: 'number',
        label: 'Opening Page',
        hint: 'Page to open the document at.',
        default: 1
      },
      {
        name: 'zoom',
        type: 'select',
        label: 'Zoom',
        options: ['page-width', 'page-fit', '50%', '75%', '100%', '125%', '150%', '200%', '300%'],
        hint: 'Size to draw the pages at. The reader can change it.',
        default: 'page-width'
      },
      {
        name: 'height',
        type: 'number',
        label: 'Height',
        hint: 'Height of the viewer in pixels. 0 lets it grow to the whole document instead.',
        default: 1024
      },
      {
        name: 'hideToolbar',
        type: 'boolean',
        label: 'Hide Toolbar',
        hint: 'Leave out the page and zoom controls.',
        // -> Stated, so that a toggle switched on and then off again writes nothing into the page
        default: false
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;

        --pdf-border: #e0e0e0;
        --pdf-toolbar-bg: linear-gradient(to bottom, #fdfdfd, #eeeeee);
        --pdf-toolbar-fg: #424242;
        --pdf-canvas-bg: #f1f3f5;
        --pdf-page-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
      }
      :host([dark]) {
        --pdf-border: rgba(255, 255, 255, 0.15);
        --pdf-toolbar-bg: linear-gradient(to bottom, #1b212a, #12161d);
        --pdf-toolbar-fg: rgba(255, 255, 255, 0.7);
        --pdf-canvas-bg: #12161d;
        --pdf-page-shadow: 0 1px 4px rgb(0 0 0 / 0.6);
      }

      /*
        One raised box, with the toolbar and the pages clipped to its corners.

        -> It also carries the gap below the block. On this element rather than :host: see block-index.
      */
      .viewer {
        margin-bottom: 16px;
        border: 1px solid var(--pdf-border);
        border-radius: 6px;
        overflow: hidden;
        box-shadow:
          0 1px 3px rgb(0 0 0 / 0.1),
          0 1px 2px rgb(0 0 0 / 0.06);
      }
      :host([dark]) .viewer {
        box-shadow:
          0 1px 3px rgb(0 0 0 / 0.5),
          0 1px 2px rgb(0 0 0 / 0.35);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        border-bottom: 1px solid var(--pdf-border);
        background-image: var(--pdf-toolbar-bg);
        color: var(--pdf-toolbar-fg);
        font-size: 13px;
        line-height: 1;
      }

      .spacer {
        flex: 1 1 auto;
      }

      .tool {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        text-decoration: none;
        cursor: pointer;
      }
      .tool:hover:not(:disabled) {
        background-color: rgb(0 0 0 / 0.07);
        color: var(--q-primary, #1976d2);
      }
      :host([dark]) .tool:hover:not(:disabled) {
        background-color: rgb(255 255 255 / 0.1);
      }
      .tool:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .tool svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
      }

      .pager {
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }

      /* -> A number input wide enough for four digits, without the spinner taking half of it */
      .pager input {
        width: 4ch;
        padding: 4px 2px;
        border: 1px solid var(--pdf-border);
        border-radius: 4px;
        background-color: rgb(255 255 255 / 0.6);
        color: inherit;
        font: inherit;
        text-align: center;
        appearance: textfield;
        -moz-appearance: textfield;
      }
      .pager input::-webkit-inner-spin-button,
      .pager input::-webkit-outer-spin-button {
        appearance: none;
        margin: 0;
      }
      :host([dark]) .pager input {
        background-color: rgb(0 0 0 / 0.25);
      }

      select {
        max-width: 9rem;
        padding: 4px 6px;
        border: 1px solid var(--pdf-border);
        border-radius: 4px;
        background-color: rgb(255 255 255 / 0.6);
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      :host([dark]) select {
        background-color: rgb(0 0 0 / 0.25);
      }

      /*
        The scrolling surface.

        -> scrollbar-gutter keeps the width the pages are fitted to from changing the moment the
           scrollbar appears, which at "fit width" is a measurement that decides the very layout that
           brings the scrollbar in.
      */
      .scroller {
        position: relative;
        overflow: auto;
        scrollbar-gutter: stable;
        background-color: var(--pdf-canvas-bg);
      }

      .pages {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: ${PAGE_GAP}px;
        padding: ${PAGE_GAP}px;
        min-width: min-content;
      }

      .page {
        position: relative;
        flex: none;
        background-color: #fff;
        box-shadow: var(--pdf-page-shadow);

        /* -> What pdf.js sizes the text layer against; see setLayerDimensions in its source. */
        --scale-factor: 1;
        --user-unit: 1;
        --total-scale-factor: calc(var(--scale-factor) * var(--user-unit));
        --scale-round-x: 1px;
        --scale-round-y: 1px;
      }

      .page canvas {
        display: block;
        width: 100%;
        height: 100%;
      }

      .status {
        padding: 2rem 1rem;
        color: var(--pdf-toolbar-fg);
        text-align: center;
        font-size: 13px;
      }

      .error {
        margin-bottom: 16px;
        padding: 1rem;
        border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
        border-radius: 5px;
        color: var(--q-negative, #c10015);
      }

      /*
        The text layer: a transparent copy of the page's words, positioned over the drawing so they
        can be selected and searched for. Lifted from pdf.js's own stylesheet, which is 160 kB of
        viewer chrome this block has no other use for.
      */
      .textLayer {
        position: absolute;
        inset: 0;
        overflow: clip;
        z-index: 1;
        opacity: 1;
        line-height: 1;
        text-align: initial;
        letter-spacing: normal;
        word-spacing: normal;
        text-size-adjust: none;
        forced-color-adjust: none;
        transform-origin: 0 0;
        caret-color: CanvasText;

        --min-font-size: 1;
        --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
        --min-font-size-inv: calc(1 / var(--min-font-size));
      }

      .textLayer :is(span, br) {
        position: absolute;
        color: transparent;
        white-space: pre;
        cursor: text;
        transform-origin: 0% 0%;
        user-select: text;
      }

      .textLayer > :not(.markedContent),
      .textLayer .markedContent span:not(.markedContent) {
        z-index: 1;

        --font-height: 0;
        --scale-x: 1;
        --rotate: 0deg;
        font-size: calc(var(--text-scale-factor) * var(--font-height));
        transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
      }

      .textLayer .markedContent {
        display: contents;
      }

      .textLayer span[role='img'] {
        user-select: none;
        cursor: default;
      }

      .textLayer ::selection {
        background: color-mix(in srgb, AccentColor, transparent 50%);
        color: transparent;
      }

      .textLayer br::selection {
        background: transparent;
      }
    `
  }

  static get properties() {
    return {
      /**
       * Path or URL of the PDF file
       * @type {string}
       */
      src: { type: String },

      /**
       * Page to open the document at
       * @type {number}
       */
      page: { type: Number },

      /**
       * `page-width`, `page-fit`, or a percentage
       * @type {string}
       */
      zoom: { type: String },

      /**
       * Height of the viewer in pixels, 0 to grow to the document
       * @type {number}
       */
      height: { type: Number },

      /**
       * Whether to leave out the page and zoom controls
       * @type {boolean}
       */
      hideToolbar: boolean,

      // Internal Properties
      _error: { state: true },
      _loading: { state: true },
      _progress: { state: true },
      _pageCount: { state: true },
      _currentPage: { state: true },
      _scale: { state: true },
      _zoom: { state: true }
    }
  }

  constructor() {
    super()
    this.src = ''
    this.page = 1
    this.zoom = 'page-width'
    this.height = 1024
    this.hideToolbar = false

    this._error = ''
    this._loading = false
    this._progress = 0
    this._pageCount = 0
    this._currentPage = 1
    this._scale = 1
    this._zoom = 'page-width'

    this._darkMode = new DarkMode(this)

    /** The address the loaded document was fetched from, so a re-render is not a reload. */
    this._loadedSrc = null
    this._loadingTask = null
    this._doc = null
    /** One entry per page, in order. See `_buildPages`. */
    this._pages = []
    this._observer = null
    this._resizeObserver = null
    this._resizeFrame = null
  }

  get _scroller() {
    return this.renderRoot?.querySelector('.scroller') ?? null
  }

  get _pagesEl() {
    return this.renderRoot?.querySelector('.pages') ?? null
  }

  /** Whether the viewer scrolls within itself, rather than being as tall as the document. */
  get _hasInnerScroll() {
    return this.height > 0
  }

  connectedCallback() {
    super.connectedCallback()
    /*
      Moved, rather than newly built: leaving took the document and both observers with it, and the
      shadow tree they were watching is still here to be watched again. `hasUpdated` is what tells the
      two apart -- on a first connection there is no shadow tree yet, and `firstUpdated` does this.
    */
    if (this.hasUpdated) {
      this._setupObservers()
      this._load()
    }
  }

  firstUpdated() {
    this._zoom = this._parseZoom(this.zoom)
    this._setupObservers()
  }

  _setupObservers() {
    /*
      -> The scroller is the scrolling ancestor to measure against, unless the block was told to grow
         to the document, in which case the page itself is.
    */
    this._observer = new IntersectionObserver((entries) => this._onVisibility(entries), {
      root: this._hasInnerScroll ? this._scroller : null
    })
    this._resizeObserver = new ResizeObserver(() => this._onResize())
    if (this._scroller) {
      this._resizeObserver.observe(this._scroller)
    }
  }

  updated(changed) {
    if (changed.has('zoom') && this.zoom !== undefined) {
      const parsed = this._parseZoom(this.zoom)
      if (parsed !== this._zoom) {
        this._setZoom(parsed)
      }
    }
    if (changed.has('src')) {
      this._load()
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    this._teardown()
    this._observer?.disconnect()
    this._observer = null
    this._resizeObserver?.disconnect()
    this._resizeObserver = null
  }

  /**
   * Read what the author wrote in the `zoom` prop.
   *
   * Either of the two fitting modes, or a percentage — `150%`, and `150` for an author who left the
   * sign off. Anything else is the default rather than an error: a viewer that will not open because
   * of the zoom would be a poor trade.
   */
  _parseZoom(value) {
    const zoom = String(value ?? '').trim()
    if (zoom === 'page-fit') {
      return 'page-fit'
    }
    const percentage = Number.parseFloat(zoom)
    if (Number.isFinite(percentage) && percentage > 0) {
      return Math.min(Math.max(percentage / 100, MIN_SCALE), MAX_SCALE)
    }
    return 'page-width'
  }

  /** What the toolbar's list is showing, in the vocabulary of the `zoom` prop. */
  get _zoomValue() {
    return typeof this._zoom === 'number' ? `${Math.round(this._zoom * 100)}%` : this._zoom
  }

  /**
   * Open the document.
   *
   * The address is resolved against the page it is written on, so that a relative one means what an
   * author writing a link would expect. pdf.js is left to fetch it: it asks for the file in ranges
   * where the server offers them, which is what lets a long document start showing before the whole
   * of it has arrived.
   */
  async _load() {
    const src = this.src?.trim()
    if (src === this._loadedSrc) {
      return
    }
    this._teardown()
    this._loadedSrc = src
    this._error = ''
    this._pageCount = 0
    this._currentPage = 1
    this._progress = 0

    if (!src) {
      this._error = 'This viewer needs the address of a PDF file.'
      return
    }

    let url
    try {
      url = new URL(src, window.location.href).href
    } catch {
      this._error = `${src} is not an address this viewer can open.`
      return
    }

    this._loading = true
    const task = getDocument({
      url,
      // -> pdf.js compiles some fonts and patterns with `eval` where it is allowed to; a wiki is the
      //    kind of place that turns that off, and the slower path draws the same thing.
      isEvalSupported: false,
      cMapUrl: `${DATA_URL}cmaps/`,
      standardFontDataUrl: `${DATA_URL}standard_fonts/`,
      wasmUrl: `${DATA_URL}wasm/`,
      iccUrl: `${DATA_URL}iccs/`
    })
    this._loadingTask = task
    task.onProgress = ({ loaded, total }) => {
      this._progress = total > 0 ? Math.min(loaded / total, 1) : 0
    }

    try {
      const doc = await task.promise
      // -> The block was detached, or asked for another document, while this one was being fetched
      if (this._loadingTask !== task) {
        doc.destroy()
        return
      }
      this._doc = doc
      this._pageCount = doc.numPages
      const first = await doc.getPage(1)
      this._baseSize = this._rawSize(first.getViewport({ scale: 1 }))
      this._loading = false
      await this.updateComplete
      this._buildPages()
      const opening = this._openingPage()
      // -> Page 1 is where a viewer already is. Saying so anyway would be harmless in a scroller of
      //    its own, but a block grown to the whole document scrolls the wiki page to obey, dragging
      //    the reader down past whatever was written above the block the moment it finishes loading.
      if (opening > 1) {
        this._goToPage(opening)
      }
    } catch (err) {
      if (this._loadingTask !== task) {
        return
      }
      this._loading = false
      this._error = this._explain(err, src)
    }
  }

  /** The page the author asked the document to open at, within the document it turned out to be. */
  _openingPage() {
    const page = Number(this.page)
    if (!Number.isFinite(page)) {
      return 1
    }
    return Math.min(Math.max(Math.trunc(page), 1), this._pageCount)
  }

  /** What went wrong, said to whoever is reading the page rather than to a console. */
  _explain(err, src) {
    if (err instanceof PasswordException) {
      return 'This document is password-protected, and cannot be shown here.'
    }
    if (err?.name === 'InvalidPDFException') {
      return `The file at ${src} is not a PDF, or is damaged.`
    }
    // -> What pdf.js raises for a response it could not use, `missing` being its word for a 404
    if (err?.name === 'ResponseException') {
      return err.missing
        ? `No PDF was found at ${src}.`
        : `The server would not serve ${src} — ${err.message}`
    }
    return `This document could not be loaded from ${src} — ${err?.message ?? err}`
  }

  /** A page's size before any zoom, in PDF units carried over as they are written. */
  _rawSize(viewport) {
    const { pageWidth, pageHeight } = viewport.rawDims
    return { width: pageWidth, height: pageHeight, userUnit: viewport.userUnit || 1 }
  }

  /**
   * Lay the whole document out at once.
   *
   * Every page gets its box straight away, so the scrollbar is the length of the document from the
   * first moment rather than growing as pages arrive. Their sizes are the first page's until each one
   * has been drawn and can say otherwise — asking the worker for all of them up front is a round trip
   * per page, and a document whose pages are not all the same size is the rare one.
   *
   * The pages are built by hand rather than rendered from a template: they hold a canvas that must
   * survive every re-render of the toolbar above them, and pdf.js writes into both of them itself.
   */
  _buildPages() {
    const container = this._pagesEl
    if (!container) {
      return
    }
    container.replaceChildren()
    this._pages = []

    for (let num = 1; num <= this._pageCount; num++) {
      const el = document.createElement('div')
      el.className = 'page'
      el.dataset.page = String(num)

      const canvas = document.createElement('canvas')
      const textLayerEl = document.createElement('div')
      textLayerEl.className = 'textLayer'
      el.append(canvas, textLayerEl)
      container.append(el)

      this._pages.push({
        num,
        el,
        canvas,
        textLayerEl,
        raw: this._baseSize,
        visible: false,
        drawn: false,
        renderTask: null,
        textLayer: null,
        /*
          Bumped every time the page is let go of, so that a draw already in flight can tell that what
          it was drawing for is gone -- a zoom, a scroll far enough away, or the document itself being
          closed. Nothing else can stop it: the work up to the first `renderTask` is a request to the
          worker, and there is no handle on that to cancel.
        */
        epoch: 0
      })
    }

    this._scale = this._resolveScale()
    for (const entry of this._pages) {
      this._sizePage(entry)
      this._observer?.observe(entry.el)
    }
  }

  /** Give a page the box its current size and the current zoom put it in. */
  _sizePage(entry) {
    const total = this._scale * entry.raw.userUnit
    entry.el.style.setProperty('--scale-factor', this._scale)
    entry.el.style.setProperty('--user-unit', entry.raw.userUnit)
    entry.el.style.width = `${Math.floor(total * entry.raw.width)}px`
    entry.el.style.height = `${Math.floor(total * entry.raw.height)}px`
  }

  /**
   * The zoom, as a number.
   *
   * The fitting modes are measured against the first page, which is what the pages were laid out to
   * before any of them had been read — fitting each page to itself would leave a document scrolling
   * through a different size every page.
   */
  _resolveScale() {
    if (typeof this._zoom === 'number') {
      return this._zoom
    }
    const scroller = this._scroller
    const base = this._baseSize
    if (!scroller || !base) {
      return 1
    }
    const width = scroller.clientWidth - PAGE_GAP * 2
    if (width <= 0) {
      return 1
    }
    const scale =
      this._zoom === 'page-fit'
        ? Math.min(
            width / base.width,
            ((this._hasInnerScroll ? scroller.clientHeight : window.innerHeight) - PAGE_GAP * 2) /
              base.height
          )
        : width / base.width
    return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE)
  }

  /**
   * Redraw at whatever the zoom now resolves to, keeping the reader where they were.
   *
   * Everything drawn is thrown away rather than scaled: a canvas stretched to a new size is a blurred
   * page, and the text over it would be positioned for the old one.
   */
  _applyScale() {
    const scale = this._resolveScale()
    // -> A resize of a few pixels resolves to a scale a few thousandths different, which is not worth
    //    redrawing the document over
    if (Math.abs(scale - this._scale) < 0.001) {
      return
    }
    const anchor = this._currentPage
    this._scale = scale
    for (const entry of this._pages) {
      this._releasePage(entry)
      this._sizePage(entry)
    }
    this._goToPage(anchor)
    this._syncRendering()
  }

  _setZoom(zoom) {
    this._zoom = zoom
    this._applyScale()
  }

  /** Step to the next zoom level up or down from wherever the current one landed. */
  _stepZoom(direction) {
    const levels = direction > 0 ? ZOOM_LEVELS : [...ZOOM_LEVELS].reverse()
    const next = levels.find((level) =>
      direction > 0 ? level > this._scale + 0.001 : level < this._scale - 0.001
    )
    if (next) {
      this._setZoom(next)
    }
  }

  _onResize() {
    if (typeof this._zoom !== 'number') {
      // -> Coalesced: a drag of a window edge is a stream of these, and each one would redraw
      cancelAnimationFrame(this._resizeFrame)
      this._resizeFrame = requestAnimationFrame(() => this._applyScale())
    }
  }

  _onVisibility(entries) {
    for (const observed of entries) {
      const entry = this._pages[Number(observed.target.dataset.page) - 1]
      if (entry) {
        entry.visible = observed.isIntersecting
      }
    }
    this._trackCurrentPage()
    this._syncRendering()
  }

  /**
   * Name the page the reader is actually looking at.
   *
   * The one taking up the most of the viewport, rather than the topmost one showing: scrolled to the
   * top of a page, the page above is still intersecting by the sliver the gap between them leaves,
   * and naming that one would have the counter reading a page behind all the way down the document.
   *
   * Measured here rather than taken from the rectangles the observer hands over, which are only
   * delivered for a page whose intersecting-ness has just changed — so a page that has scrolled off
   * behind another still carries the area it had when it filled the screen, and goes on winning.
   */
  _trackCurrentPage() {
    const root = this._hasInnerScroll
      ? this._scroller?.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight }
    if (!root) {
      return
    }

    let showing = null
    let mostCovered = 0
    for (const entry of this._pages) {
      if (!entry.visible) {
        continue
      }
      const box = entry.el.getBoundingClientRect()
      // -> Height alone: the pages are in one column, so nothing is ever beside anything else
      const covered = Math.min(box.bottom, root.bottom) - Math.max(box.top, root.top)
      if (covered > mostCovered) {
        mostCovered = covered
        showing = entry
      }
    }
    if (showing) {
      this._currentPage = showing.num
    }
  }

  /**
   * Draw what is in front of the reader, and let go of what is well behind them.
   *
   * The page after the last visible one and the page before the first are drawn too, so that
   * scrolling on arrives at a page that is already there rather than at a blank one.
   */
  _syncRendering() {
    if (this._pages.length < 1) {
      return
    }
    const visible = this._pages.filter((entry) => entry.visible).map((entry) => entry.num)
    const anchor = visible.length > 0 ? visible : [this._currentPage]
    const from = Math.max(1, Math.min(...anchor) - 1)
    const to = Math.min(this._pageCount, Math.max(...anchor) + 1)

    for (const entry of this._pages) {
      if (entry.num >= from && entry.num <= to) {
        this._renderPage(entry)
      } else if (entry.num < from - KEEP_PAGES || entry.num > to + KEEP_PAGES) {
        this._releasePage(entry)
      }
    }
  }

  /**
   * Draw one page, and lay its text over it.
   *
   * The canvas is drawn at the device's pixel ratio and shown at the page's size, which is what keeps
   * a page sharp on a retina display — bounded by `limitCanvas`, pdf.js's own reckoning of what a
   * browser will actually allocate.
   */
  async _renderPage(entry) {
    const doc = this._doc
    if (entry.drawn || !doc) {
      return
    }
    const epoch = entry.epoch
    entry.drawn = true

    try {
      const page = await doc.getPage(entry.num)
      if (entry.epoch !== epoch) {
        return
      }

      const viewport = page.getViewport({ scale: this._scale })
      const raw = this._rawSize(viewport)
      // -> Now that the page itself has been read, its box can stop being the first page's guess
      if (raw.width !== entry.raw.width || raw.height !== entry.raw.height) {
        entry.raw = raw
        this._sizePage(entry)
      }

      const outputScale = new OutputScale()
      outputScale.limitCanvas(viewport.width, viewport.height, MAX_CANVAS_PIXELS, MAX_CANVAS_DIM)
      const canvas = entry.canvas
      canvas.width = Math.floor(viewport.width * outputScale.sx)
      canvas.height = Math.floor(viewport.height * outputScale.sy)

      const renderTask = page.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        viewport,
        transform: outputScale.scaled ? [outputScale.sx, 0, 0, outputScale.sy, 0, 0] : null,
        background: '#ffffff'
      })
      entry.renderTask = renderTask
      await renderTask.promise
      entry.renderTask = null
      if (entry.epoch !== epoch) {
        return
      }

      const textLayer = new TextLayer({
        textContentSource: page.streamTextContent({
          includeMarkedContent: true,
          disableNormalization: true
        }),
        container: entry.textLayerEl,
        viewport
      })
      entry.textLayer = textLayer
      await textLayer.render()
    } catch (err) {
      // -> A cancelled draw is the ordinary way a page in flight is abandoned, not a failure
      if (!(err instanceof RenderingCancelledException) && err?.name !== 'AbortException') {
        console.warn(`block-pdf: page ${entry.num} could not be drawn — ${err?.message ?? err}`)
      }
      entry.renderTask = null
      entry.drawn = false
    }
  }

  /** Give back everything one page is holding, leaving its box where it was. */
  _releasePage(entry) {
    entry.epoch++
    entry.renderTask?.cancel()
    entry.renderTask = null
    entry.textLayer?.cancel()
    entry.textLayer = null
    entry.textLayerEl.replaceChildren()
    // -> Zeroing a canvas is what actually frees its pixels; clearing it only paints over them
    entry.canvas.width = 0
    entry.canvas.height = 0
    entry.drawn = false
  }

  /** Drop the document, and everything drawn from it. */
  _teardown() {
    for (const entry of this._pages) {
      this._releasePage(entry)
      this._observer?.unobserve(entry.el)
    }
    this._pages = []
    this._pagesEl?.replaceChildren()
    this._loadingTask?.destroy()
    this._loadingTask = null
    this._doc = null
    this._baseSize = null
    this._loading = false
    // -> So that opening the same address again is a reload rather than nothing at all
    this._loadedSrc = null
  }

  _goToPage(num) {
    const entry = this._pages[num - 1]
    if (!entry) {
      return
    }
    this._currentPage = entry.num
    if (this._hasInnerScroll) {
      this._scroller.scrollTop = entry.el.offsetTop - PAGE_GAP
    } else {
      entry.el.scrollIntoView({ block: 'start' })
    }
  }

  _onPageInput(ev) {
    const num = Number.parseInt(ev.target.value, 10)
    if (Number.isFinite(num) && num >= 1 && num <= this._pageCount) {
      this._goToPage(num)
    } else {
      ev.target.value = String(this._currentPage)
    }
  }

  _onZoomSelect(ev) {
    this._setZoom(this._parseZoom(ev.target.value))
  }

  _previousPage() {
    this._goToPage(Math.max(this._currentPage - 1, 1))
  }

  _nextPage() {
    this._goToPage(Math.min(this._currentPage + 1, this._pageCount))
  }

  _zoomIn() {
    this._stepZoom(1)
  }

  _zoomOut() {
    this._stepZoom(-1)
  }

  _icon(path) {
    return html` <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg> `
  }

  _renderToolbar() {
    return html`
      <div class="toolbar">
        <div class="pager">
          <button
            class="tool"
            type="button"
            title="Previous page"
            aria-label="Previous page"
            ?disabled=${this._currentPage <= 1}
            @click=${this._previousPage}>
            ${this._icon(ICONS.previous)}
          </button>
          <input
            type="number"
            min="1"
            max=${this._pageCount}
            aria-label="Page number"
            .value=${String(this._currentPage)}
            @change=${this._onPageInput} />
          <span>/ ${this._pageCount || '—'}</span>
          <button
            class="tool"
            type="button"
            title="Next page"
            aria-label="Next page"
            ?disabled=${this._currentPage >= this._pageCount}
            @click=${this._nextPage}>
            ${this._icon(ICONS.next)}
          </button>
        </div>

        <span class="spacer"></span>

        <button
          class="tool"
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          ?disabled=${this._scale <= ZOOM_LEVELS[0]}
          @click=${this._zoomOut}>
          ${this._icon(ICONS.zoomOut)}
        </button>
        <!--
          -> Which one is showing is set on the options rather than on the select: Lit writes an
             attribute or property on an element before it fills in its children, so a .value binding here
             would be assigned while the list is still empty and come back as nothing.
        -->
        <select aria-label="Zoom" @change=${this._onZoomSelect}>
          <option value="page-width" .selected=${this._zoomValue === 'page-width'}>
            Fit width
          </option>
          <option value="page-fit" .selected=${this._zoomValue === 'page-fit'}>Fit page</option>
          ${ZOOM_LEVELS.map(
            (level) => html`
              <option value="${level * 100}%" .selected=${this._zoomValue === `${level * 100}%`}>
                ${level * 100}%
              </option>
            `
          )}
        </select>
        <button
          class="tool"
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          ?disabled=${this._scale >= ZOOM_LEVELS.at(-1)}
          @click=${this._zoomIn}>
          ${this._icon(ICONS.zoomIn)}
        </button>

        <span class="spacer"></span>

        <a
          class="tool"
          href=${this.src}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in a new tab"
          aria-label="Open in a new tab">
          ${this._icon(ICONS.open)}
        </a>
      </div>
    `
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    return html`
      <div class="viewer">
        ${this.hideToolbar ? null : this._renderToolbar()}
        <div class="scroller" style=${this._hasInnerScroll ? `height: ${this.height}px` : ''}>
          <div class="pages"></div>
          ${
            this._loading
              ? html`
                  <div class="status">
                    Loading the
                    document${this._progress > 0 ? ` — ${Math.round(this._progress * 100)}%` : ''}…
                  </div>
                `
              : null
          }
        </div>
      </div>
    `
  }
}

window.customElements.define('block-pdf', BlockPdfElement)
