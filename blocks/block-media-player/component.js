import { LitElement, html, css } from 'lit'

/**
 * Block Media Player
 */
export class BlockMediaPlayerElement extends LitElement {
  static get styles() {
    return css`
      :host {
        display: block;
      }

      .container {
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
      src: { type: String },

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
          <source src="${this.src}" type="video/mp4">
        </video>
      </div>
    `
  }
}

window.customElements.define('block-media-player', BlockMediaPlayerElement)
