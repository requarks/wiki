<template>
  <!--
    A real <textarea> with a highlighted copy of its own text painted underneath, rather than an
    editor library. The textarea's text is transparent, so what you read is the <pre> and what you
    type into is the textarea, and the two stay registered because they share every metric that
    affects where a glyph lands (see the style block).

    Keeping the textarea is the point: native undo/redo, selection, spellcheck control, mobile
    keyboards, form semantics and screen-reader behaviour all come for free, which neither a
    contenteditable nor a canvas-drawn editor gives you.
  -->
  <div
    class="util-code-editor"
    :class="{ 'util-code-editor--square': square }"
    :style="{ height: `${minHeight}px`, '--util-code-editor-gutter': gutterWidth }">
    <pre class="util-code-editor-view" aria-hidden="true"><code v-html="highlighted" /></pre>
    <textarea
      ref="inputEl"
      class="util-code-editor-input"
      :value="modelValue"
      :aria-label="ariaLabel"
      spellcheck="false"
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      @input="onInput"
      @scroll="onScroll"
      @keydown.tab.exact.prevent="onTab" />
  </div>
</template>

<script setup>
/**
 * Small code field for hand-entering CSS, HTML, JavaScript, JSON or YAML.
 *
 * Deliberately basic: no bracket matching, autocomplete, folding, multiple cursors or find. The
 * places this appears are short config fields, and the editor it replaces cost 83 kB gzipped to
 * provide those.
 *
 * Not in `components/shared/`, despite being a form control: that library is registered eagerly, so
 * a `w-*` component here would pull the highlighter into the main bundle for every visitor. Imported
 * per call site instead, it stays in the lazy chunks of the few screens that use it.
 */
import { computed, ref } from 'vue'

// -> `lib/core` plus named languages, NOT the `highlight.js` root: that root registers all ~190
//    languages (563 kB gzipped) and is why the page renderer's chunk is the size it is
import hljs from 'highlight.js/lib/core'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

// PROPS

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  /** `css` | `html` | `javascript` | `json` | `yaml`; anything else renders unhighlighted. */
  language: {
    type: String,
    default: 'plaintext'
  },
  /** Height of the field in px. Content beyond it scrolls. */
  minHeight: {
    type: Number,
    default: 150
  },
  /** Accessible name, since a code field rarely has a visible <label>. */
  ariaLabel: {
    type: String,
    default: null
  },
  /**
   * Sharp corners, for a field that spans its container edge to edge.
   *
   * Rounded corners read as a control inset in a surface; where the editor IS the surface -- filling
   * the width of a dialog between its toolbar and its buttons -- they cut across the dialog's own
   * edge instead. Named as `WChip` and `WAvatar` name the same idea.
   */
  square: {
    type: Boolean,
    default: false
  }
})

// EMITS

const emit = defineEmits(['update:modelValue'])

// STATE

const inputEl = ref(null)

/*
  Registered once for the module, not per instance: hljs keeps a single global registry, so repeating
  this per component would just overwrite the same entries.
*/
hljs.registerLanguage('css', css)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)

/*
  The `language` prop names the language the way the call sites already do; `html` is hljs's `xml`.
  A name that is absent here (`plaintext`, or anything unregistered) is escaped and left alone rather
  than throwing, so a new call site cannot break the field by asking for a language nobody added.
*/
const HLJS_LANGUAGES = {
  css: 'css',
  html: 'xml',
  javascript: 'javascript',
  json: 'json',
  yaml: 'yaml'
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;' }

/*
  hljs emits nothing but `<span class="…">`, `</span>` and escaped text, which is what makes this
  three-branch match sufficient.
*/
const HLJS_TOKENS = /<span class="[^"]*">|<\/span>|[^<]+/g

/**
 * Split highlighted HTML into one string per source line, keeping the spans balanced.
 *
 * A token can legitimately run across a newline -- a block comment, a template literal, a YAML
 * block scalar -- and its span then contains the break. Wrapping each line in an element of its own
 * therefore cannot just cut the string at "\n": the open spans have to be closed at the end of each
 * line and reopened at the start of the next, or the line elements nest inside one another and the
 * numbering collapses to a single row.
 */
function splitHighlightedLines(html) {
  const lines = []
  /** The opening tags currently in effect, innermost last. */
  const open = []
  let current = ''

  for (const [token] of html.matchAll(HLJS_TOKENS)) {
    if (token === '</span>') {
      open.pop()
      current += token
    } else if (token.startsWith('<span')) {
      open.push(token)
      current += token
    } else {
      // -> Text is the only branch that can hold a newline
      const parts = token.split('\n')
      for (const [index, part] of parts.entries()) {
        if (index > 0) {
          current += '</span>'.repeat(open.length)
          lines.push(current)
          current = open.join('')
        }
        current += part
      }
    }
  }

  lines.push(current)
  return lines
}

// COMPUTED

const lines = computed(() => {
  const value = props.modelValue ?? ''
  const language = HLJS_LANGUAGES[props.language]
  const html = language
    ? // -> Partial code is the normal state in a field being typed into, so illegal syntax must not
      //   abort the highlight and blank the view
      hljs.highlight(value, { language, ignoreIllegals: true }).value
    : value.replace(/[&<>]/g, (c) => ESCAPES[c])

  return splitHighlightedLines(html)
})

/*
  One block element per line, carrying its own number as a data attribute for the gutter to draw with
  `content: attr()`. Built as a single string rather than a v-for so the whole view is one innerHTML
  write per keystroke instead of a element-by-element patch.

  A trailing newline needs no special case here, unlike a plain <pre>: `'a\n'` splits into two lines,
  the second empty, which is exactly the line the caret is sitting on.
*/
const highlighted = computed(() =>
  lines.value
    .map(
      (line, index) => `<span class="util-code-editor-line" data-line="${index + 1}">${line}</span>`
    )
    .join('')
)

// -> Wide enough for the highest line number the field currently holds. `ch` is the width of a digit
//    in the gutter's own font, which is why the container carries the mono font too
const gutterWidth = computed(() => `calc(${String(lines.value.length).length}ch + 1.35rem)`)

// METHODS

function onInput(ev) {
  emit('update:modelValue', ev.target.value)
}

// -> The view is the element that scrolls out of sight, so it has to follow the one with the scrollbar
function onScroll(ev) {
  const view = ev.target.previousElementSibling
  view.scrollTop = ev.target.scrollTop
}

/*
  Tab indents by two, as the editor this replaces did.
  Shift+Tab is deliberately NOT handled, so it still moves focus and a keyboard user is never trapped
  in the field.
*/
function onTab(ev) {
  const el = ev.target
  const { selectionStart: start, selectionEnd: end, value } = el
  emit('update:modelValue', `${value.slice(0, start)}  ${value.slice(end)}`)
  // -> Vue writes the new value into the element, which drops the caret at the end unless it is put
  //    back; the plain input path never needs this because the DOM already holds what was emitted
  requestAnimationFrame(() => {
    el.selectionStart = start + 2
    el.selectionEnd = start + 2
  })
}

/*
  Exposed so a host can put the caret in the field -- the scripts dialog focuses it on open. A method
  rather than an `autofocus` prop, because focus is an action taken at a moment, not a state of the
  component: a dialog that reopens with the same props has to be able to ask again.
*/
defineExpose({
  focus() {
    inputEl.value?.focus()
  }
})
</script>

<style lang="scss">
/*
  Unscoped, but every selector is under `.util-code-editor`. The highlighted markup arrives through
  `v-html` and so carries no scope attribute, which a scoped rule could only reach through `:deep()`
  on every line of the palette below.
*/
.util-code-editor {
  position: relative;
  overflow: hidden;
  border-radius: 5px;
  /* -> Same resting and focus edge as the other form controls; see `.w-input-control` */
  border: 1px solid rgb(0 0 0 / 0.24);
  background-color: #fff;
  transition: border-color 0.36s cubic-bezier(0.4, 0, 0.2, 1);
  /*
    The text metrics live here as well as on the layers, for the `ch` in the gutter width: `ch` is
    relative to the element's own font, so measured against the page font the gutter would be sized
    for the wrong glyph.
  */
  font-family: var(--font-mono);
  font-size: 13px;

  /*
    The gutter's stripe, drawn on the container rather than inside the scrolling layer, so it stays
    put while the numbers within it scroll -- which is what a gutter does.
  */
  background-image: linear-gradient(
    to right,
    #f6f8fa 0,
    #f6f8fa var(--util-code-editor-gutter),
    rgb(0 0 0 / 0.09) var(--util-code-editor-gutter),
    rgb(0 0 0 / 0.09) calc(var(--util-code-editor-gutter) + 1px),
    transparent calc(var(--util-code-editor-gutter) + 1px)
  );

  &:focus-within {
    border-color: var(--color-primary);
  }
}

/*
  -> A prop rather than a class the caller passes: the radius above is a single-class rule in an
     unlayered stylesheet, so an override would come down to which file the bundler happened to emit
     last. The component owning both states is the only version that cannot silently flip.
*/
.util-code-editor--square {
  border-radius: 0;
}

/*
  The two layers, and the reason this component works at all: any difference between them in a
  property that affects glyph position -- font, size, line height, letter spacing, tab size, padding,
  wrapping -- shows up as the highlight drifting out from under the text, further with every line.
  Change one, change both.
*/
.util-code-editor-view,
.util-code-editor-input {
  position: absolute;
  inset: 0;
  margin: 0;
  /* -> Text starts clear of the gutter on BOTH layers, or the two disagree by the gutter's width */
  padding: 8px 10px 8px calc(var(--util-code-editor-gutter) + 8px);
  border: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.5;
  tab-size: 2;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.util-code-editor-view {
  overflow: hidden;
  /* -> Clicks belong to the textarea underneath, including the click that places the caret */
  pointer-events: none;
  color: #24292f;
}

/*
  One block per source line, each drawing its own number.

  The number is an absolutely positioned pseudo-element on the line rather than a row in a parallel
  gutter list, which is what keeps it correct under soft wrapping: a line that wraps to three rows is
  one block three rows tall, and its number sits at the top of that block -- beside the row the line
  actually starts on. A parallel list would drift by one row per wrap.

  Being a pseudo-element also means the numbers cannot be selected or copied: the layer is
  `aria-hidden` and unclickable, and the textarea underneath is what a selection actually addresses.
*/
.util-code-editor-line {
  display: block;
  position: relative;

  /* -> An empty block would be zero rows high, so a blank line would collapse and take its number
        with it. Matches the `line-height` above; the two have to move together. */
  min-height: 1.5em;

  &::before {
    content: attr(data-line);
    position: absolute;
    /*
      Out into the stripe the container paints. 8px of the offset only cancels the text's own left
      padding, which lands the number hard against the divider; the other 10px is the gap that keeps
      it off. No width or `text-align` needed -- an absolutely positioned box with `right` set and no
      width shrinks to its content, so the digits right-align across lines by themselves, and because
      the offset is constant while the gutter grows in `ch`, the gap holds at any number of digits.
    */
    right: calc(100% + 18px);
    color: rgb(0 0 0 / 0.38);
  }
}

.util-code-editor-input {
  overflow: auto;
  resize: none;
  outline: none;
  background-color: transparent;
  /* -> The text is read off the layer below; only the caret and the selection band come from here */
  color: transparent;
  caret-color: #24292f;

  &::selection {
    background-color: rgb(25 118 210 / 0.28);
  }
}

/*
  Token palette. Two flat sets keyed off `body--dark` rather than a per-theme stylesheet: switching
  appearance is then a class on <body>, which is what lets the three editors on admin/theme recolour
  the instant the dark-mode toggle on that same page is thrown -- no fetch, no re-init, no JS.
*/
.util-code-editor {
  .hljs-comment,
  .hljs-quote {
    color: #6a737d;
    font-style: italic;
  }
  .hljs-keyword,
  .hljs-selector-tag,
  .hljs-literal,
  .hljs-doctag,
  .hljs-formula {
    color: #d73a49;
  }
  .hljs-string,
  .hljs-regexp,
  .hljs-addition,
  .hljs-selector-attr,
  .hljs-selector-pseudo {
    color: #032f62;
  }
  .hljs-number,
  .hljs-variable,
  .hljs-template-variable,
  .hljs-symbol,
  .hljs-bullet,
  .hljs-attr,
  .hljs-meta {
    color: #005cc5;
  }
  .hljs-title,
  .hljs-section,
  .hljs-selector-id,
  .hljs-selector-class {
    color: #6f42c1;
  }
  .hljs-built_in,
  .hljs-type,
  .hljs-attribute,
  .hljs-property,
  .hljs-params {
    color: #e36209;
  }
  .hljs-name,
  .hljs-tag {
    color: #22863a;
  }
  .hljs-deletion {
    color: #b31d28;
  }
  .hljs-emphasis {
    font-style: italic;
  }
  .hljs-strong {
    font-weight: 600;
  }
}

body.body--dark {
  .util-code-editor {
    border-color: rgb(255 255 255 / 0.3);
    background-color: $dark-5;
    background-image: linear-gradient(
      to right,
      $dark-4 0,
      $dark-4 var(--util-code-editor-gutter),
      rgb(255 255 255 / 0.12) var(--util-code-editor-gutter),
      rgb(255 255 255 / 0.12) calc(var(--util-code-editor-gutter) + 1px),
      transparent calc(var(--util-code-editor-gutter) + 1px)
    );

    &:focus-within {
      border-color: var(--color-primary);
    }
  }

  .util-code-editor-view {
    color: #e6edf3;
  }

  .util-code-editor-line::before {
    color: rgb(255 255 255 / 0.34);
  }

  .util-code-editor-input {
    caret-color: #e6edf3;
  }

  .util-code-editor {
    .hljs-comment,
    .hljs-quote {
      color: #8b949e;
    }
    .hljs-keyword,
    .hljs-selector-tag,
    .hljs-literal,
    .hljs-doctag,
    .hljs-formula {
      color: #ff7b72;
    }
    .hljs-string,
    .hljs-regexp,
    .hljs-addition,
    .hljs-selector-attr,
    .hljs-selector-pseudo {
      color: #a5d6ff;
    }
    .hljs-number,
    .hljs-variable,
    .hljs-template-variable,
    .hljs-symbol,
    .hljs-bullet,
    .hljs-attr,
    .hljs-meta {
      color: #79c0ff;
    }
    .hljs-title,
    .hljs-section,
    .hljs-selector-id,
    .hljs-selector-class {
      color: #d2a8ff;
    }
    .hljs-built_in,
    .hljs-type,
    .hljs-attribute,
    .hljs-property,
    .hljs-params {
      color: #ffa657;
    }
    .hljs-name,
    .hljs-tag {
      color: #7ee787;
    }
    .hljs-deletion {
      color: #ffa198;
    }
  }
}
</style>
