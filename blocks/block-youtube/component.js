import { LitElement, html, css } from 'lit'

/**
 * An attribute that means "off" when it says so.
 *
 * MDC writes every prop with a value — `autoplay="false"` is what the block picker produces for a
 * toggle that was switched on and off again — and Lit's own Boolean converter reads any string at all
 * as true, that one included.
 *
 * It is also what lets a prop here default to ON, which the note in `block-index` rules out for a
 * block using the stock converter: `controls` is left out of the markup while it holds its default,
 * and written as `controls="false"` the moment it does not, which this reads back correctly.
 */
const boolean = {
  converter: {
    fromAttribute: (value) => value !== null && value !== 'false',
    toAttribute: (value) => (value ? 'true' : null)
  }
}

/** Every YouTube host a link can arrive on, including the one their own privacy mode hands out. */
const HOSTS = /^(?:www\.|m\.)?youtube(?:-nocookie)?\.com$/

/** The paths that carry the id in them, rather than in `?v=`. */
const ID_PATHS = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/

/** What a video id is made of. Length is not checked: that is YouTube's to change, not ours. */
const ID = /^[A-Za-z0-9_-]+$/

/** A timestamp as YouTube writes it in a share link: `90`, `1m30s`, `1h2m3s`. */
const TIMESTAMP = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/

/**
 * The video a link points at, or null for a link that points at no video.
 *
 * Every shape YouTube hands out: `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/`. A bare id
 * is taken as one too — it is what an author who copied the id rather than the link will paste, and
 * there is nothing else an eleven-character word could be meant as here.
 */
function videoId(source) {
  const value = source.trim()
  if (!value) {
    return null
  }
  if (ID.test(value)) {
    return value
  }
  // -> A link written without a scheme is still a link; `new URL` disagrees, so it is given one
  const url = URL.parse(value) ?? URL.parse(`https://${value}`)
  if (!url) {
    return null
  }
  const host = url.hostname.toLowerCase()
  const id =
    host === 'youtu.be'
      ? url.pathname.slice(1).split('/')[0]
      : !HOSTS.test(host)
        ? null
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : (ID_PATHS.exec(url.pathname)?.[1] ?? null)
  return id && ID.test(id) ? id : null
}

/**
 * Where in the video a link says to start, in seconds. 0 for one that does not say.
 *
 * `t` is what the "copy link at current time" button adds, and it arrives either as a plain count of
 * seconds or as `1m30s`. `start` is the same thing spelled the way the embed parameter is.
 */
function linkStart(source) {
  const url = URL.parse(source.trim()) ?? URL.parse(`https://${source.trim()}`)
  const value = url?.searchParams.get('t') ?? url?.searchParams.get('start') ?? ''
  if (/^\d+$/.test(value)) {
    return Number(value)
  }
  const parts = TIMESTAMP.exec(value)
  if (!parts || !parts.slice(1).some(Boolean)) {
    return 0
  }
  return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
}

/**
 * Block YouTube
 *
 * A YouTube player, from the address of a video. Nothing is fetched until the frame is scrolled near,
 * and the frame is the only thing here: the player, its controls and everything it does are YouTube's,
 * driven by the parameters below.
 */
export class BlockYoutubeElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'youtube',
    name: 'YouTube Player',
    description: 'Embeds a YouTube video.',
    icon: 'youtube',
    props: [
      {
        name: 'url',
        type: 'string',
        label: 'Video URL',
        hint: 'Address of the video, as YouTube gives it — a watch, youtu.be or shorts link.',
        required: true
      },
      {
        name: 'width',
        type: 'number',
        label: 'Width',
        hint: 'Width of the player in pixels. Empty fills the width of the page.'
      },
      {
        name: 'height',
        type: 'number',
        label: 'Height',
        hint: 'Height of the player in pixels. Empty keeps the widescreen shape.'
      },
      {
        name: 'autoplay',
        type: 'boolean',
        label: 'Autoplay',
        hint: 'Start as soon as the page is opened. Browsers only allow that muted, so it is.',
        default: false
      },
      {
        name: 'controls',
        type: 'boolean',
        label: 'Show Controls',
        hint: 'Show the play bar over the video.',
        default: true
      },
      {
        name: 'fs',
        type: 'boolean',
        label: 'Allow Fullscreen',
        hint: 'Offer the fullscreen button.',
        default: true
      },
      {
        name: 'loop',
        type: 'boolean',
        label: 'Loop',
        hint: 'Start again on reaching the end.',
        default: false
      },
      {
        name: 'start',
        type: 'number',
        label: 'Start At',
        hint: 'Seconds into the video to start at. 0 uses the time in the URL, if it carries one.',
        default: 0
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /*
        The frame's box, and the gap below the block. On this element rather than :host: see
        block-index.

        -> A max-width rather than a plain width, so a player asked for at 1280 on a phone is the
           width of the phone instead of pushing the page sideways. The aspect ratio then keeps it
           widescreen at whatever width it ends up with, which is what a fixed height would not.
      */
      .player {
        max-width: 100%;
        margin-bottom: 16px;
        border-radius: 5px;
        overflow: hidden;
        background-color: #000;
      }

      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
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
       * Address of the video
       * @type {string}
       */
      url: { type: String },

      /**
       * Width of the player in pixels
       * @type {number}
       */
      width: { type: Number },

      /**
       * Height of the player in pixels
       * @type {number}
       */
      height: { type: Number },

      /**
       * Whether to start without being asked
       * @type {boolean}
       */
      autoplay: boolean,

      /**
       * Whether the play bar is shown
       * @type {boolean}
       */
      controls: boolean,

      /**
       * Whether the fullscreen button is offered
       * @type {boolean}
       */
      fs: boolean,

      /**
       * Whether to start again at the end
       * @type {boolean}
       */
      loop: boolean,

      /**
       * Seconds into the video to start at
       * @type {number}
       */
      start: { type: Number }
    }
  }

  constructor() {
    super()
    this.url = ''
    this.width = null
    this.height = null
    this.autoplay = false
    this.controls = true
    this.fs = true
    this.loop = false
    this.start = 0
  }

  /** A prop given a usable number, or null for one left empty. */
  _size(value) {
    const size = Number(value)
    return Number.isFinite(size) && size > 0 ? size : null
  }

  /**
   * The address of the player, with what it was asked for.
   *
   * Only the parameters that were actually changed: an option left out is YouTube's own default,
   * which is the one that goes on being maintained.
   */
  _embedUrl(id) {
    const params = new URLSearchParams()
    if (this.autoplay) {
      params.set('autoplay', '1')
      /*
        -> Muted, because that is the only way it plays. Every browser refuses to start a video with
           sound before the reader has interacted with the page, and refuses silently: the player
           simply sits there, which reads as a block that is broken rather than one being overruled.
      */
      params.set('mute', '1')
    }
    if (!this.controls) {
      params.set('controls', '0')
    }
    if (!this.fs) {
      params.set('fs', '0')
    }
    if (this.loop) {
      params.set('loop', '1')
      // -> A single video loops only as a playlist of itself; `loop` alone does nothing to one
      params.set('playlist', id)
    }
    const start = this._size(this.start) ?? linkStart(this.url)
    if (start > 0) {
      params.set('start', String(start))
    }
    const query = params.toString()
    return `https://www.youtube.com/embed/${id}${query ? `?${query}` : ''}`
  }

  render() {
    const id = videoId(this.url ?? '')
    if (!id) {
      return html`
        <div class="error">
          ${
            this.url?.trim()
              ? `${this.url} is not the address of a YouTube video.`
              : 'This player needs the address of a YouTube video.'
          }
        </div>
      `
    }

    const width = this._size(this.width)
    const height = this._size(this.height)
    /*
      A height that was asked for wins outright; without one the frame is widescreen, which is the
      shape all but the oldest videos are. Letterboxing inside the frame is YouTube's business either
      way -- the player fits the video to whatever box it is given.
    */
    const style = [
      width ? `width: ${width}px` : 'width: 100%',
      height ? `height: ${height}px` : 'aspect-ratio: 16 / 9'
    ].join('; ')

    return html`
      <div class="player" style=${style}>
        <iframe
          src=${this._embedUrl(id)}
          title="YouTube video player"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          ?allowfullscreen=${this.fs}></iframe>
      </div>
    `
  }
}

window.customElements.define('block-youtube', BlockYoutubeElement)
