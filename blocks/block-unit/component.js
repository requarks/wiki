import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'

/**
 * The units this block reads, by every spelling an author may use for them.
 *
 * `factor` converts to the dimension's base unit (metre, kilogram, litre, km/h); temperature has no
 * factor, since it is not a scale but an offset, and is converted on its own. `intl` is the unit's
 * name for `Intl.NumberFormat`, which writes it in the reader's language -- `po` for inch in French.
 */
const UNITS = [
  { names: ['mm'], dimension: 'length', system: 'metric', factor: 0.001, intl: 'millimeter' },
  { names: ['cm'], dimension: 'length', system: 'metric', factor: 0.01, intl: 'centimeter' },
  { names: ['m'], dimension: 'length', system: 'metric', factor: 1, intl: 'meter' },
  { names: ['km'], dimension: 'length', system: 'metric', factor: 1000, intl: 'kilometer' },
  {
    names: ['in', 'inch', 'inches', '"', '″'],
    dimension: 'length',
    system: 'imperial',
    factor: 0.0254,
    intl: 'inch'
  },
  {
    names: ['ft', 'foot', 'feet', "'", '′'],
    dimension: 'length',
    system: 'imperial',
    factor: 0.3048,
    intl: 'foot'
  },
  {
    names: ['yd', 'yard', 'yards'],
    dimension: 'length',
    system: 'imperial',
    factor: 0.9144,
    intl: 'yard'
  },
  {
    names: ['mi', 'mile', 'miles'],
    dimension: 'length',
    system: 'imperial',
    factor: 1609.344,
    intl: 'mile'
  },
  { names: ['g'], dimension: 'mass', system: 'metric', factor: 0.001, intl: 'gram' },
  { names: ['kg'], dimension: 'mass', system: 'metric', factor: 1, intl: 'kilogram' },
  {
    names: ['oz', 'ounce', 'ounces'],
    dimension: 'mass',
    system: 'imperial',
    factor: 0.028349523125,
    intl: 'ounce'
  },
  {
    names: ['lb', 'lbs', 'pound', 'pounds'],
    dimension: 'mass',
    system: 'imperial',
    factor: 0.45359237,
    intl: 'pound'
  },
  { names: ['ml', 'mL'], dimension: 'volume', system: 'metric', factor: 0.001, intl: 'milliliter' },
  { names: ['l', 'L'], dimension: 'volume', system: 'metric', factor: 1, intl: 'liter' },
  {
    names: ['fl oz', 'fl. oz.', 'floz'],
    dimension: 'volume',
    system: 'imperial',
    factor: 0.0295735295625,
    intl: 'fluid-ounce'
  },
  {
    names: ['gal', 'gallon', 'gallons'],
    dimension: 'volume',
    system: 'imperial',
    factor: 3.785411784,
    intl: 'gallon'
  },
  {
    names: ['km/h', 'kph', 'kmh'],
    dimension: 'speed',
    system: 'metric',
    factor: 1,
    intl: 'kilometer-per-hour'
  },
  {
    names: ['mph', 'mi/h'],
    dimension: 'speed',
    system: 'imperial',
    factor: 1.609344,
    intl: 'mile-per-hour'
  },
  {
    names: ['°C', 'ºC', '℃', 'C', 'degC'],
    dimension: 'temperature',
    system: 'metric',
    intl: 'celsius'
  },
  {
    names: ['°F', 'ºF', '℉', 'F', 'degF'],
    dimension: 'temperature',
    system: 'imperial',
    intl: 'fahrenheit'
  }
]

/** Every spelling, matched exactly first and case-insensitively second -- `mL` and `ML` alike. */
function findUnit(name) {
  return (
    UNITS.find((unit) => unit.names.includes(name)) ??
    UNITS.find((unit) => unit.names.some((alias) => alias.toLowerCase() === name.toLowerCase()))
  )
}

/**
 * The units a dimension is shown in, per system, smallest first. A value is written in the largest
 * of them it is at least one of -- 30 cm reads as 11.8 in rather than 0.98 ft, and 2 km as 1.24 mi.
 * Yards are left out: they are a unit people read, not one they reach for.
 */
const LADDERS = {
  length: { metric: ['mm', 'cm', 'm', 'km'], imperial: ['in', 'ft', 'mi'] },
  mass: { metric: ['g', 'kg'], imperial: ['oz', 'lb'] },
  volume: { metric: ['ml', 'l'], imperial: ['fl oz', 'gal'] },
  speed: { metric: ['km/h'], imperial: ['mph'] },
  temperature: { metric: ['°C'], imperial: ['°F'] }
}

/**
 * The regions that measure in US customary units. Everywhere else is metric -- the UK included, which
 * mixes both but writes most things in metric.
 */
const IMPERIAL_REGIONS = new Set(['US', 'LR', 'MM'])

/** The reader's measurement system, from the region their browser's language names or implies. */
function readerSystem() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return IMPERIAL_REGIONS.has(region) ? 'imperial' : 'metric'
  } catch {
    return 'metric'
  }
}

/**
 * `25 km`, `-40 °C`, `3.5kg`, `6 ft`. The number is written with a `.` for its decimals, as it would
 * be in source; a thousands separator is not read, since `1,5` and `1,500` mean different things in
 * different places and the page cannot say which this is.
 */
function parseQuantity(source) {
  const match = /^([+-]?(?:\d+\.?\d*|\.\d+))\s*(.+)$/.exec(source)
  const unit = match && findUnit(match[2].trim())
  return unit ? { value: Number.parseFloat(match[1]), unit } : null
}

/** A quantity in another unit of the same dimension. */
function convert(value, from, to) {
  if (from.dimension === 'temperature') {
    const celsius = from.system === 'metric' ? value : ((value - 32) * 5) / 9
    return to.system === 'metric' ? celsius : (celsius * 9) / 5 + 32
  }
  return (value * from.factor) / to.factor
}

/**
 * Block Unit
 *
 * A measurement in a line of text, shown in the reader's own units -- metric or US customary,
 * worked out from the region of their browser's language:
 * `:block-unit[25 km]` in markdown, `block-unit:[25 km]` in AsciiDoc.
 *
 * The measurement is the element's own text rather than a prop, so `25 km` is still there, as
 * written, before this component has loaded and on a site that switched the block off.
 */
export class BlockUnitElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'unit',
    name: 'Measurement',
    description:
      "A distance, weight, volume, speed or temperature in a line of text, shown in the reader's own units.",
    icon: 'width',
    inline: true,
    // -> The value an editor starts it with, between the brackets
    template: '10 km',
    props: [
      {
        name: 'show',
        type: 'select',
        label: 'Show',
        hint: 'The other unit is always a tooltip away.',
        options: [
          { label: "The reader's units", value: 'reader' },
          { label: 'Both', value: 'both' }
        ],
        default: 'reader'
      },
      {
        name: 'system',
        type: 'select',
        label: 'Units',
        hint: "Whose units the reader's are, when not left to their browser to say.",
        options: [
          { label: "The reader's", value: 'auto' },
          { label: 'Metric', value: 'metric' },
          { label: 'US customary', value: 'imperial' }
        ],
        default: 'auto'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: inline;
        --unit-underline: rgba(0, 0, 0, 0.35);
      }
      :host([dark]) {
        --unit-underline: rgba(255, 255, 255, 0.4);
      }

      /* -> Dotted, like an abbreviation: the other unit is in the tooltip */
      .unit {
        border-bottom: 1px dotted var(--unit-underline);
        cursor: help;
        white-space: nowrap;
      }

      .error {
        color: var(--q-negative, #c10015);
        border-bottom: 1px dashed currentColor;
        cursor: help;
        font-family: monospace;
      }
    `
  }

  static get properties() {
    return {
      /**
       * `reader` or `both`
       * @type {string}
       */
      show: { type: String },

      /**
       * `auto`, `metric` or `imperial`
       * @type {string}
       */
      system: { type: String },

      // Internal Properties
      _source: { state: true }
    }
  }

  constructor() {
    super()
    this.show = 'reader'
    this.system = 'auto'
    this._source = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * The measurement, read before the first render rather than after it (as `firstUpdated` would), so
   * the first frame is the converted value and not the "empty" marker.
   */
  willUpdate() {
    if (!this.hasUpdated) {
      this._source = (this.textContent ?? '').trim()
    }
  }

  /**
   * The quantity in the given system: in the unit it was written in when that is the system's own,
   * and otherwise in whichever unit of the system reads naturally at that size, to three significant
   * digits -- 15.5 mi, 932 mi, 98.6 °F.
   */
  _format(value, unit, system) {
    const ladder = LADDERS[unit.dimension][system].map(findUnit)
    const target =
      unit.system === system
        ? unit
        : (ladder.findLast((step) => Math.abs(convert(value, unit, step)) >= 1) ?? ladder[0])
    return new Intl.NumberFormat(undefined, {
      style: 'unit',
      unit: target.intl,
      unitDisplay: 'short',
      // -> A figure the author wrote is shown as written; a converted one is rounded
      ...(unit === target ? { maximumFractionDigits: 20 } : { maximumSignificantDigits: 3 })
    }).format(convert(value, unit, target))
  }

  render() {
    const quantity = parseQuantity(this._source)
    if (!quantity) {
      const shown = this._source || '(empty measurement)'
      const error = this._source
        ? 'This is not a measurement this block can read. Write a number and a unit, e.g. 25 km.'
        : 'This measurement is empty.'
      return html`<span class="error" title=${error}>${shown}</span>`
    }
    const { value, unit } = quantity
    const reader = ['metric', 'imperial'].includes(this.system) ? this.system : readerSystem()
    const other = reader === 'metric' ? 'imperial' : 'metric'

    const shown = this._format(value, unit, reader)
    const alternative = this._format(value, unit, other)
    const text = this.show === 'both' ? `${shown} (${alternative})` : shown
    return html`<span class="unit" title=${alternative}>${text}</span>`
  }
}

window.customElements.define('block-unit', BlockUnitElement)
