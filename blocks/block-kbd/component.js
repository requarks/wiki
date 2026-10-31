import { LitElement, html, css } from 'lit'
import { DarkMode } from '../shared/theme.js'

/**
 * What a key is called, by what an author may type for it (lowercased), on each kind of keyboard.
 *
 * Written the way documentation is usually written -- `Ctrl+S` for "save", meant for everyone -- so
 * on an Apple keyboard `Ctrl` is the Command key, which is the one that saves there. An author who
 * means the Control key itself on a Mac writes `Control`, which stays ⌃. `Mod` is the neutral name for
 * "Command on a Mac, Ctrl elsewhere", for anyone who prefers to say so outright.
 *
 * Each entry is `[shown, spoken]`: the symbol a Mac prints on its keycaps is not something a screen
 * reader says sensibly, so the name goes alongside it.
 */
const APPLE_KEYS = {
  ctrl: ['⌘', 'Command'],
  cmd: ['⌘', 'Command'],
  command: ['⌘', 'Command'],
  mod: ['⌘', 'Command'],
  meta: ['⌘', 'Command'],
  control: ['⌃', 'Control'],
  alt: ['⌥', 'Option'],
  option: ['⌥', 'Option'],
  opt: ['⌥', 'Option'],
  shift: ['⇧', 'Shift']
}
const PC_KEYS = {
  ctrl: ['Ctrl', 'Control'],
  control: ['Ctrl', 'Control'],
  cmd: ['Ctrl', 'Control'],
  command: ['Ctrl', 'Control'],
  mod: ['Ctrl', 'Control'],
  alt: ['Alt', 'Alt'],
  option: ['Alt', 'Alt'],
  opt: ['Alt', 'Alt'],
  shift: ['Shift', 'Shift'],
  meta: ['Win', 'Windows']
}
/** Keys that read the same on every keyboard, drawn as the arrows printed on them. */
const COMMON_KEYS = {
  up: ['↑', 'Up'],
  down: ['↓', 'Down'],
  left: ['←', 'Left'],
  right: ['→', 'Right'],
  esc: ['Esc', 'Escape'],
  escape: ['Esc', 'Escape']
}

/** Whether the reader is on an Apple keyboard. */
function onApple() {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/**
 * One chord, `Ctrl+Shift+P`, as its keys. A `+` is a key of its own where it cannot be a separator:
 * alone, or after another one (`Ctrl++`).
 */
function parseChord(chord) {
  const keys = []
  let rest = chord
  while (rest) {
    const match = /^(\+|[^+]+)(?:\+|$)/.exec(rest)
    keys.push(match[1].trim())
    rest = rest.slice(match[0].length)
  }
  return keys.filter(Boolean)
}

/**
 * Block Kbd
 *
 * A keyboard shortcut in a line of text, drawn as keycaps for the reader's own keyboard:
 * `:block-kbd[Ctrl+Shift+P]` in markdown, `block-kbd:[Ctrl+Shift+P]` in AsciiDoc. A space separates
 * the chords of a sequence, `Ctrl+K Ctrl+S`.
 *
 * The shortcut is the element's own text rather than a prop, so `Ctrl+Shift+P` is still there, as
 * written, before this component has loaded and on a site that switched the block off.
 */
export class BlockKbdElement extends LitElement {
  /**
   * Metadata for the admin area and the editor's block picker. Collected at build time into
   * `compiled/blocks.manifest.json`, which the server reads to register the block. Values must be
   * plain literals. See `props` in `block-index` for what the picker does with that list.
   */
  static definition = {
    block: 'kbd',
    name: 'Keyboard Shortcut',
    description:
      "A keyboard shortcut in a line of text, drawn as keys for the reader's own keyboard.",
    icon: 'enter-key',
    inline: true,
    // -> The value an editor starts it with, between the brackets
    template: 'Ctrl+S',
    props: [
      {
        name: 'platform',
        type: 'select',
        label: 'Keyboard',
        hint: 'Whose keys are drawn. On a Mac, Ctrl is shown as ⌘ and Alt as ⌥; write Control for the Mac Control key itself.',
        options: [
          { label: "The reader's", value: 'auto' },
          { label: 'Mac', value: 'mac' },
          { label: 'Windows / Linux', value: 'pc' },
          { label: 'As written', value: 'none' }
        ],
        default: 'auto'
      }
    ]
  }

  static get styles() {
    return css`
      :host {
        display: inline;
        --kbd-border: rgba(0, 0, 0, 0.22);
        --kbd-edge: rgba(0, 0, 0, 0.32);
        --kbd-bg: #f6f8fa;
        --kbd-fg: #1f2328;
      }
      :host([dark]) {
        --kbd-border: rgba(255, 255, 255, 0.18);
        --kbd-edge: rgba(255, 255, 255, 0.3);
        --kbd-bg: #21262d;
        --kbd-fg: #e6edf3;
      }

      .shortcut {
        font: inherit;
        white-space: nowrap;
      }

      /*
        A keycap: a raised edge along the bottom, which is what tells a key from a code span at a
        glance. Inline-block with only text in it, so it sits on the line's baseline.
      */
      .key {
        display: inline-block;
        min-width: 1.1em;
        padding: 0 0.35em;
        border: 1px solid var(--kbd-border);
        border-bottom-width: 2px;
        border-bottom-color: var(--kbd-edge);
        border-radius: 4px;
        background-color: var(--kbd-bg);
        color: var(--kbd-fg);
        font-family: inherit;
        font-size: 0.82em;
        line-height: 1.45;
        text-align: center;
      }

      .plus {
        padding: 0 0.15em;
        opacity: 0.6;
        font-size: 0.82em;
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
       * `auto`, `mac`, `pc` or `none`
       * @type {string}
       */
      platform: { type: String },

      // Internal Properties
      _source: { state: true }
    }
  }

  constructor() {
    super()
    this.platform = 'auto'
    this._source = ''
    // -> Puts `dark` on this element for the styles above to key off
    this._darkMode = new DarkMode(this)
  }

  /**
   * The shortcut, read before the first render rather than after it (as `firstUpdated` would), so
   * the first frame is the keys and not the "empty" marker.
   */
  willUpdate() {
    if (!this.hasUpdated) {
      this._source = (this.textContent ?? '').trim()
    }
  }

  /** A key as it is drawn here, and what a screen reader says for it. */
  _key(name, apple) {
    if (this.platform === 'none') {
      return [name, name]
    }
    const known =
      (apple ? APPLE_KEYS : PC_KEYS)[name.toLowerCase()] ?? COMMON_KEYS[name.toLowerCase()]
    if (known) {
      return known
    }
    // -> Capitalised, as every keycap prints it: `p` is P, and `enter` is Enter
    const shown = name[0].toUpperCase() + name.slice(1)
    return [shown, shown]
  }

  render() {
    const chords = this._source.split(/\s+/).filter(Boolean).map(parseChord)
    if (chords.every((keys) => keys.length < 1)) {
      return html`<span class="error" title="This shortcut names no keys.">(empty shortcut)</span>`
    }
    const apple = this.platform === 'mac' || (this.platform === 'auto' && onApple())
    const drawn = chords.map((keys) => keys.map((key) => this._key(key, apple)))
    // -> Apple prints a chord as its symbols run together, ⌘⇧P; everybody else joins them with +
    const joiner = apple && this.platform !== 'none' ? null : html`<span class="plus">+</span>`
    const spoken = drawn.map((keys) => keys.map(([, name]) => name).join(' ')).join(', then ')

    return html`<kbd class="shortcut" aria-label=${spoken}
      >${drawn.map(
        (keys, index) =>
          html`${index > 0 ? ' ' : ''}${keys.map(
            ([shown, name], keyIndex) =>
              html`${keyIndex > 0 ? joiner : ''}<kbd class="key" title=${name !== shown ? name : ''}
                  >${shown}</kbd
                >`
          )}`
      )}</kbd
    >`
  }
}

window.customElements.define('block-kbd', BlockKbdElement)
