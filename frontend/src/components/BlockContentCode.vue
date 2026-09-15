<template>
  <div class="block-content-code">
    <section class="block-content-code-pane">
      <header class="block-content-code-bar">{{ t('editor.blockContent.source') }}</header>
      <div ref="monacoEl" class="block-content-code-editor" />
    </section>
    <section class="block-content-code-pane block-content-code-pane--preview">
      <header class="block-content-code-bar">{{ t('editor.blockContent.preview') }}</header>
      <div class="block-content-code-preview page-contents">
        <div v-if="state.empty" class="block-content-code-empty">
          {{ t('editor.blockContent.previewEmpty') }}
        </div>
        <!--
          Kept in the tree rather than torn out, so the element the block drew is not rebuilt from
          nothing every time the source goes momentarily empty.
        -->
        <div v-show="!state.empty" ref="previewEl" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import * as monaco from 'monaco-editor'
import { debounce } from 'es-toolkit/function'

import { useCommonStore } from '@/stores/common'

/**
 * Source on the left, the block itself on the right — the body editor for every block whose content
 * is code an author types.
 *
 * Which is most of them that have a body at all: a Mermaid diagram, a PlantUML or Kroki source, a TeX
 * formula, an infobox's YAML. All of them store their body as one fenced source, all of them read it
 * back out of a `<pre>` in their light DOM, and none of them could be edited in the Visual editor at
 * all before this — a block holding a single fence is parsed as an ATOM there (`bodyIsContent` in
 * `editor/visual/parse.js`), so there was no caret to put in it and nothing but the Parameters form
 * to open over it.
 *
 * `BlockContentDrawio` is the other shape of body editor and the reason the registry exists: a
 * drawing is edited on a canvas. This one is the shape everything else takes. See
 * `BlockContentEditorOverlay` for the contract both implement.
 *
 * **The preview is the real block, not a rendering of one.** The same custom element the page draws,
 * given the same attributes and the same `<pre>` the renderer would have left it — which is what the
 * Visual editor's node view does for a block in the document, for the same reason: a second
 * implementation of what a diagram looks like is a second thing to be wrong.
 */

// PROPS

const props = defineProps({
  /** The block's body: the source between the fences, without them. */
  modelValue: {
    type: String,
    default: ''
  },
  /** The block's own parameters, which the preview is drawn with. */
  params: {
    type: Object,
    default: () => ({})
  },
  /** The block as the API describes it. `block` is the half that matters — it names the element. */
  block: {
    type: Object,
    default: () => ({})
  },
  /**
   * The info string of the fence the source came out of (`mermaid`, `latex`, `yaml`, …), for the
   * highlighting. Only the ones Monaco knows are used; see `monacoLanguage`.
   */
  lang: {
    type: String,
    default: ''
  }
})

// EMITS

const emit = defineEmits(['update:modelValue', 'save'])

/** How long the author stops typing for before the block is drawn again. */
const PREVIEW_DELAY = 600

// STORES

const commonStore = useCommonStore()

// I18N

const { t } = useI18n()

// DATA

const monacoEl = ref(null)
const previewEl = ref(null)

const state = reactive({
  empty: !props.modelValue.trim()
})

let editor = null

// METHODS

/**
 * The fence's language as a Monaco one, or plain text.
 *
 * Most of these languages are nobody's but their own tool's — Monaco has no Mermaid, no PlantUML, no
 * Kroki and no TeX — so the list is asked rather than assumed. An id Monaco does not know is not an
 * error there, it simply highlights nothing, but asking is what keeps `yaml` and `xml` working
 * without a map of every name that happens to match.
 */
function monacoLanguage() {
  const lang = props.lang.trim().toLowerCase()
  const known = monaco.languages.getLanguages().some((entry) => entry.id === lang)
  return known ? lang : 'plaintext'
}

/**
 * The block, drawn from the source as it stands.
 *
 * A fresh element every time, because a block reads its body once — `firstUpdated`, in every one of
 * them — so the only way to redraw one is to make another. Cheap for a diagram; for the two that talk
 * to a server it is a request, which is what the debounce below is for.
 */
function renderPreview() {
  const source = props.modelValue.trim()
  state.empty = !source
  if (!source || !previewEl.value) {
    return
  }
  const name = props.block?.block ?? ''
  if (!name) {
    return
  }
  const tag = `block-${name}`
  const element = document.createElement(tag)
  /*
    Only the parameters that are actually set, which is what the page itself carries: `blockValues`
    fills in a blank for every prop the author left alone, and handing those to the element as empty
    attributes is not the same as leaving them off.
  */
  for (const [key, value] of Object.entries(props.params ?? {})) {
    if (value === undefined || value === null || value === '') {
      continue
    }
    // -> A prop name a block declares is not necessarily a valid attribute name; a malformed one
    //    should cost its own parameter and not the whole preview
    try {
      element.setAttribute(key, String(value))
    } catch {
      /* ignored */
    }
  }
  /*
    The `<pre>` is not decoration: every one of these blocks takes its source from
    `querySelector('pre')` and falls back to its own text, and the fallback is the path that means
    "this was not fenced" — `block-diagram` says so in its error message. So the preview hands it the
    same shape the renderer does.
  */
  const pre = document.createElement('pre')
  pre.textContent = source
  element.append(pre)
  previewEl.value.replaceChildren(element)

  // -> Nothing draws until the element is upgraded, and a block is only fetched when a page uses it
  if (!customElements.get(tag)) {
    commonStore.loadBlocks([tag])
  }
}

const renderPreviewSoon = debounce(renderPreview, PREVIEW_DELAY)

// LIFECYCLE

onMounted(() => {
  // -> The markdown editor's theme, defined again here because that component may never have mounted
  monaco.editor.defineTheme('wikijs', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#070a0d',
      'editor.lineHighlightBackground': '#0d1117',
      'editorLineNumber.foreground': '#546e7a',
      'editorGutter.background': '#0d1117'
    }
  })

  editor = monaco.editor.create(monacoEl.value, {
    automaticLayout: true,
    fontSize: 14,
    language: monacoLanguage(),
    lineNumbersMinChars: 3,
    minimap: { enabled: false },
    padding: { top: 10, bottom: 10 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    theme: 'wikijs',
    value: props.modelValue,
    // -> Off: a diagram's source is structured by its indentation, and wrapping a long line of it
    //    where the pane happens to end reads as a line of its own
    wordWrap: 'off'
  })

  editor.onDidChangeModelContent(() => {
    emit('update:modelValue', editor.getValue())
    renderPreviewSoon()
  })

  /*
    The same gesture as everywhere else in the app, and the overlay's Apply does the same thing. An
    editor with a save of its own is what `@save` is for -- see the contract in the overlay.
  */
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    emit('save')
  })

  editor.focus()
  renderPreview()
})

/*
  The parameters can change under the preview: the Visual editor's own Parameters form is a different
  overlay, but a block opened here twice in a session is not, and the preview has to be drawn with
  what it is now rather than with what it was.
*/
watch(() => props.params, renderPreviewSoon, { deep: true })

onBeforeUnmount(() => {
  renderPreviewSoon.cancel()
  /*
    The editor first and its model second, as the two other Monaco sites in the app do. Monaco keeps
    models in a registry of its own, so one left behind outlives the component that made it -- but
    disposing it while the editor still holds it takes the editor's own teardown down with it
    (`Model is disposed!`, out of an observer reading the version id as it unwinds).
  */
  const model = editor?.getModel()
  editor?.dispose()
  model?.dispose()
  editor = null
})
</script>

<style lang="scss">
.block-content-code {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;

  // -> Side by side is the point of this screen, but there is no room for two columns on a phone
  @media (max-width: $breakpoint-sm-max) {
    flex-direction: column;
  }

  &-pane {
    display: flex;
    flex-direction: column;
    flex: 1 1 50%;
    min-width: 0;
    min-height: 0;

    &--preview {
      @at-root .body--light & {
        background-color: #fff;
        border-left: 1px solid $grey-4;
      }
      @at-root .body--dark & {
        background-color: $dark-5;
        border-left: 1px solid $dark-2;
      }

      @media (max-width: $breakpoint-sm-max) {
        border-left: 0;
      }
    }
  }

  &-bar {
    flex: 0 0 auto;
    padding: 0.35rem 0.75rem;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;

    @at-root .body--light & {
      background-color: $grey-3;
      color: $grey-7;
      border-bottom: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      color: $grey-5;
      border-bottom: 1px solid $dark-2;
    }
  }

  /*
    Both halves are flex items of a column with a bar above them, so each needs `min-height: 0` of its
    own: without it the box is sized by its content, and Monaco asking for the height of a box as tall
    as itself resolves to nothing at all.
  */
  &-editor {
    flex: 1 1 auto;
    min-height: 0;
  }

  &-preview {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: 1rem;
  }

  &-empty {
    font-style: italic;
    opacity: 0.6;
  }
}
</style>
