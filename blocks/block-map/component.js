import { LitElement, html, css, unsafeCSS } from 'lit'
// -> The ESM build by name: leaflet's `main` is still the UMD bundle, which rollup can only take
//    apart with a commonjs plugin, and it has no `exports` map to pick the module build for us
import * as L from 'leaflet/dist/leaflet-src.esm.js'
import leafletCss from 'leaflet/dist/leaflet.css'

/**
 * The marker, drawn rather than fetched.
 *
 * Leaflet's default icon is a pair of PNGs it builds a URL for at runtime, which does not survive
 * bundling — and an inline pin is one less request for a block that already asks for map tiles.
 */
const MARKER_SVG = `
  <svg viewBox="0 0 24 36" width="24" height="36" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z" fill="#c62828"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>
`

/**
 * Block Map
 */
export class BlockMapElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'map',
    name: 'Map',
    description: 'Shows a location on an OpenStreetMap map.',
    icon: 'geography',
    props: [
      {
        name: 'lat',
        type: 'number',
        label: 'Latitude',
        hint: 'Decimal degrees, e.g. 45.5019.',
        required: true
      },
      {
        name: 'lon',
        type: 'number',
        label: 'Longitude',
        hint: 'Decimal degrees, e.g. -73.5674.',
        required: true
      },
      {
        name: 'zoom',
        type: 'number',
        label: 'Zoom',
        hint: '1 is the whole world, 19 is a single building.',
        default: 13
      },
      {
        name: 'height',
        type: 'number',
        label: 'Height',
        hint: 'Height of the map in pixels.',
        default: 400
      },
      {
        name: 'label',
        type: 'string',
        label: 'Marker Label',
        hint: 'Shown in a popup when the marker is clicked. The marker is drawn either way.'
      }
    ]
  }

  static get styles() {
    return [
      unsafeCSS(leafletCss),
      css`
        :host {
          display: block;
        }

        /*
          The gap below a block lives on this element, not on :host.

          The app resets the margin on every element, and a rule in the page beats a :host rule in the
          shadow tree whatever its specificity -- so a margin set on the host is simply dropped. Set
          inside the shadow root it is out of that rule's reach, and collapses out through the host,
          which carries no padding or border of its own.
        */
        .map,
        .error {
          margin-bottom: 16px;
        }

        .map {
          width: 100%;
          border-radius: 5px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background-color: #f2efe9;
        }
        :host-context(body.body--dark) .map {
          border-color: rgba(255, 255, 255, 0.15);
          background-color: #16130f;
        }

        /* -> The tiles are somebody else's work and the licence asks for the credit to be visible */
        .leaflet-container .leaflet-control-attribution {
          font-size: 10px;
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
       * Latitude in decimal degrees
       * @type {number}
       */
      lat: { type: Number },

      /**
       * Longitude in decimal degrees
       * @type {number}
       */
      lon: { type: Number },

      /**
       * Zoom level, 1 (world) to 19 (building)
       * @type {number}
       */
      zoom: { type: Number },

      /**
       * Height of the map in pixels
       * @type {number}
       */
      height: { type: Number },

      /**
       * Popup text for the marker
       * @type {string}
       */
      label: { type: String },

      // Internal Properties
      _error: { state: true }
    }
  }

  constructor() {
    super()
    this.lat = null
    this.lon = null
    this.zoom = 13
    this.height = 400
    this.label = ''
    this._error = ''
    this._map = null
  }

  firstUpdated() {
    const lat = Number(this.lat)
    const lon = Number(this.lon)
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      Math.abs(lat) > 90 ||
      Math.abs(lon) > 180
    ) {
      this._error =
        'This map needs a latitude between -90 and 90 and a longitude between -180 and 180.'
      return
    }

    const container = this.renderRoot.querySelector('.map')
    this._map = L.map(container, {
      center: [lat, lon],
      zoom: Math.min(Math.max(Number(this.zoom) || 13, 1), 19),
      // -> A map in the middle of an article must not swallow the wheel while the reader is scrolling
      //    past it. Clicking the map is the reader saying they meant to use it.
      scrollWheelZoom: false
    })
    this._map.on('click', () => this._map.scrollWheelZoom.enable())
    this._map.on('mouseout', () => this._map.scrollWheelZoom.disable())

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this._map)

    const marker = L.marker([lat, lon], {
      icon: L.divIcon({
        html: MARKER_SVG,
        className: '',
        iconSize: [24, 36],
        iconAnchor: [12, 36],
        popupAnchor: [0, -32]
      }),
      // -> The map is a picture of a place, not a form: there is nothing to be gained by moving it
      keyboard: false
    }).addTo(this._map)
    if (this.label) {
      marker.bindPopup(this.label)
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    // -> Leaflet keeps listeners on window and a resize observer, which outlive the element otherwise
    this._map?.remove()
    this._map = null
  }

  render() {
    if (this._error) {
      return html`<div class="error">${this._error}</div>`
    }
    return html`<div class="map" style="height: ${Number(this.height) || 400}px"></div>`
  }
}

window.customElements.define('block-map', BlockMapElement)
