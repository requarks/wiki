import { LitElement, html, css } from 'lit'

/**
 * Block Media Player
 */
export class BlockMediaPlayerElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'media-player',
    name: 'Media Player',
    description: 'Plays an audio or video file inline.',
    icon: 'widescreen',
    props: [
      {
        name: 'src',
        type: 'string',
        label: 'Source URL',
        hint: 'Path or URL of the audio or video file to play.',
        required: true
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      /* -> The gap below the block. On this element rather than :host: see block-index. */
      .container {
        margin-bottom: 16px;
        overflow: hidden;
        border-radius: 5px;
        position: relative;
      }
    `
  }

  static get properties() {
    return {
      /**
       * Source URL
       * @type {string}
       */
      src: { type: String }

      // Internal Properties
      // _loading: { state: true }
    }
  }

  constructor() {
    super()
  }

  async connectedCallback() {
    super.connectedCallback()
  }

  // get _video() {
  //   return this.renderRoot?.querySelector('.video-display') ?? null
  // }

  // _playPause () {
  //   if (this._video.paused) {
  //     this._video.play()
  //   } else {
  //     this._video.pause()
  //   }
  // }

  // _fullScreen () {
  //   if (this._video.requestFullscreen) {
  //     this._video.requestFullscreen()
  //   } else if (this._video.webkitRequestFullscreen) {
  //     this._video.webkitRequestFullscreen()
  //   }
  // }

  render() {
    return html`
      <div class="container">
        <video class="video-display" controls>
          <source src="${this.src}" type="video/mp4" />
        </video>
      </div>
    `
  }
}

window.customElements.define('block-media-player', BlockMediaPlayerElement)
