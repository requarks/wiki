import { LitElement, html, css, unsafeCSS } from 'lit'
import { create } from 'asciinema-player'
// -> The player's stylesheet, as a string. It is what draws the terminal, and a <link> in the page
//    cannot reach into this shadow root — see the `cssAsString` plugin in rollup.config.mjs.
import playerCss from 'asciinema-player/dist/bundle/asciinema-player.css'

/**
 * An attribute that means "off" when it says so.
 *
 * MDC writes every prop with a value — `autoPlay="false"` is what the block picker produces for a
 * toggle that was switched on and off again — and Lit's own Boolean converter reads any string at all
 * as true, that one included.
 */
const boolean = {
  converter: {
    fromAttribute: (value) => value !== null && value !== 'false',
    toAttribute: (value) => (value ? 'true' : null)
  }
}

/**
 * Block Asciinema
 */
export class BlockAsciinemaElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'asciinema',
    name: 'Terminal Recording',
    description: 'Plays an asciinema recording — a .cast file — in a terminal player.',
    icon: 'run-command',
    props: [
      {
        name: 'src',
        type: 'string',
        label: 'Recording URL',
        hint: 'Path or URL of the .cast file to play.',
        required: true
      },
      {
        name: 'theme',
        type: 'select',
        label: 'Theme',
        options: [
          'asciinema',
          'dracula',
          'gruvbox-dark',
          'monokai',
          'nord',
          'seti',
          'solarized-dark',
          'solarized-light',
          'tango'
        ],
        hint: 'Terminal colours. All but solarized-light are dark.',
        default: 'asciinema'
      },
      {
        name: 'autoPlay',
        type: 'boolean',
        label: 'Play On Load',
        hint: 'Start as soon as the page is opened, rather than waiting to be asked.',
        // -> Stated, so that a toggle switched on and then off again writes nothing into the page
        default: false
      },
      {
        name: 'loop',
        type: 'boolean',
        label: 'Loop',
        hint: 'Start again on reaching the end.',
        default: false
      },
      {
        name: 'speed',
        type: 'number',
        label: 'Speed',
        hint: 'Playback rate. 2 plays twice as fast as it was recorded.',
        default: 1
      },
      {
        name: 'idleTimeLimit',
        type: 'number',
        label: 'Idle Time Limit',
        hint: 'Cap the pauses in the recording at this many seconds. Empty keeps them as recorded.'
      }
    ]
  }

  static get styles() {
    return [
      unsafeCSS(playerCss),
      css`
        :host {
          display: block;
        }

        /* -> The gap below the block. On this element rather than :host: see block-index. */
        .player,
        .error {
          margin-bottom: 16px;
        }

        .player {
          border-radius: 5px;
          /* -> The terminal paints its own background into the corners otherwise */
          overflow: hidden;
        }

        .error {
          color: var(--q-negative, #c10015);
          border: 1px dashed color-mix(in srgb, currentColor 50%, transparent);
          border-radius: 5px;
          padding: 1rem;
        }
      `
    ]
  }

  static get properties() {
    return {
      /**
       * Path or URL of the .cast file
       * @type {string}
       */
      src: { type: String },

      /**
       * Name of one of the player's terminal themes
       * @type {string}
       */
      theme: { type: String },

      /**
       * Whether to start without being asked
       * @type {boolean}
       */
      autoPlay: boolean,

      /**
       * Whether to start again at the end
       * @type {boolean}
       */
      loop: boolean,

      /**
       * Playback rate, 1 being the speed it was recorded at
       * @type {number}
       */
      speed: { type: Number },

      /**
       * Longest pause to play back, in seconds
       * @type {number}
       */
      idleTimeLimit: { type: Number },

      // Internal Properties
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.src = ''
    this.theme = 'asciinema'
    this.autoPlay = false
    this.loop = false
    this.speed = 1
    this.idleTimeLimit = null
    this._error = ''
    this._player = null
  }

  /**
   * What to give the player, out of what the author gave the block.
   *
   * Only the settings that were actually asked for: an option left out is the player's own default,
   * which is the one that gets maintained. A speed of zero or a negative one would stop the recording
   * dead, and a nonsense number would take the player with it, so that one is bounded.
   */
  _options() {
    const speed = Number(this.speed)
    const idle = Number(this.idleTimeLimit)
    return {
      theme: this.theme || 'asciinema',
      autoPlay: this.autoPlay,
      loop: this.loop,
      speed: Number.isFinite(speed) && speed > 0 ? Math.min(speed, 10) : 1,
      ...(Number.isFinite(idle) && idle > 0 ? { idleTimeLimit: idle } : {}),
      // -> A recording is as wide as the terminal it was made in, which is rarely this column's width
      fit: 'width'
    }
  }

  /**
   * Fetch the recording, and say so in the block if it cannot be had.
   *
   * The player is given this rather than the address itself, for the sake of what happens when the
   * address is wrong. Handed a URL it fetches the file on its own, and a fetch that fails leaves an
   * empty terminal sitting there with the reason in the console — where an author who mistyped a path
   * will not see it. Fetching it here is the only way to get hold of that failure, which is the
   * common one: a typo, a file that has moved, or a host that sends no CORS headers.
   *
   * The response is handed over whole, which is a source the player takes as it comes; there is
   * nothing to be gained by reading it here, and it lets the player stream a long recording.
   */
  async _fetch(src) {
    try {
      const response = await fetch(src)
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`.trim())
      }
      return response
    } catch (err) {
      this._error = `This recording could not be loaded from ${src} — ${err.message}`
      throw err
    }
  }

  firstUpdated() {
    const src = this.src?.trim()
    if (!src) {
      this._error = 'This player needs the address of a .cast recording.'
      return
    }
    /*
      A function rather than the recording itself, so that nothing is fetched until it is played —
      which is the player's own behaviour, and the right one: a page carrying a recording should not
      pull the whole thing down before anybody has asked to watch it.
    */
    this._player = create(
      { data: () => this._fetch(src) },
      this.renderRoot.querySelector('.player'),
      this._options()
    )
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // -> The player keeps listeners on window and a resize observer, which outlive the element
    this._player?.dispose()
    this._player = null
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    return html`<div class="player"></div>`
  }
}

window.customElements.define('block-asciinema', BlockAsciinemaElement)
