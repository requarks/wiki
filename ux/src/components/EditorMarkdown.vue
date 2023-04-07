<template lang="pug">
.editor-markdown
  .editor-markdown-main
    .editor-markdown-sidebar
      //--------------------------------------------------------
      //- SIDE TOOLBAR
      //--------------------------------------------------------
      q-btn(
        icon='mdi-link-variant-plus'
        padding='sm sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertLink') }}
      q-btn(
        icon='mdi-image-plus-outline'
        padding='sm sm'
        flat
        @click='insertAssets'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertAssets') }}
      q-btn(
        icon='mdi-code-json'
        padding='sm sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertCodeBlock') }}
      q-btn(
        icon='mdi-table-large-plus'
        padding='sm sm'
        flat
        @click='insertTable'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertTable') }}
      q-btn(
        icon='mdi-tab-plus'
        padding='sm sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertTabset') }}
      q-btn(
        icon='mdi-chart-multiline'
        padding='sm sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertDiagram') }}
      q-btn(
        icon='mdi-book-plus'
        padding='sm sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertFootnote') }}
      q-btn(
        icon='mdi-cookie-plus'
        padding='sm sm'
        flat
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertEmoji') }}
      q-btn(
        icon='mdi-line-scan'
        padding='sm sm'
        flat
        @click='insertHorizontalBar'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertHorizontalBar') }}
      q-space
      span.editor-markdown-type Markdown
    .editor-markdown-mid
      //--------------------------------------------------------
      //- TOP TOOLBAR
      //--------------------------------------------------------
      .editor-markdown-toolbar
        q-btn(
          icon='mdi-format-bold'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: `**` })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.bold') }}
        q-btn(
          icon='mdi-format-italic'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: `*` })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.italic') }}
        q-btn(
          icon='mdi-format-strikethrough'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: `~~` })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.strikethrough') }}
        q-btn(
          icon='mdi-format-header-pound'
          padding='xs sm'
          flat
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.header') }}
          q-menu(auto-close)
            q-list(separator)
              q-item(
                v-for='lvl in 6'
                clickable
                @click='setHeaderLine(lvl)'
                )
                q-item-section(side)
                  q-icon(:name='`mdi-format-header-` + lvl')
                q-item-section {{ t('editor.markup.headerLevel', { level: lvl }) }}
        q-btn(
          icon='mdi-format-subscript'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: `~` })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.subscript') }}
        q-btn(
          icon='mdi-format-superscript'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: `^` })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.superscript') }}
        q-btn(
          icon='mdi-alpha-t-box-outline'
          padding='xs sm'
          flat
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.blockquoteAdmonitions') }}
          q-menu(auto-close)
            q-list(separator)
              q-item(clickable, @click='insertBeforeEachLine({ content: `> `})')
                q-item-section(side)
                  q-icon(name='mdi-format-quote-close')
                q-item-section {{ t('editor.markup.blockquote') }}
              q-item(clickable, @click='insertBeforeEachLine({ content: `> `, after: `{.is-info}`})')
                q-item-section(side)
                  q-icon(name='mdi-information-box', color='blue-7')
                q-item-section {{ t('editor.markup.admonitionInfo') }}
              q-item(clickable, @click='insertBeforeEachLine({ content: `> `, after: `{.is-success}`})')
                q-item-section(side)
                  q-icon(name='mdi-check-circle', color='positive')
                q-item-section {{ t('editor.markup.admonitionSuccess') }}
              q-item(clickable, @click='insertBeforeEachLine({ content: `> `, after: `{.is-warning}`})')
                q-item-section(side)
                  q-icon(name='mdi-alert-box', color='orange')
                q-item-section {{ t('editor.markup.admonitionWarning') }}
              q-item(clickable, @click='insertBeforeEachLine({ content: `> `, after: `{.is-danger}`})')
                q-item-section(side)
                  q-icon(name='mdi-close-box', color='negative')
                q-item-section {{ t('editor.markup.admonitionDanger') }}
        q-btn(
          icon='mdi-format-list-bulleted'
          padding='xs sm'
          flat
          @click='insertBeforeEachLine({ content: `- `})'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.unorderedList') }}
        q-btn(
          icon='mdi-format-list-numbered'
          padding='xs sm'
          flat
          @click='insertBeforeEachLine({ content: `1. `})'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.orderedList') }}
        q-btn(
          icon='mdi-format-list-checks'
          padding='xs sm'
          flat
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.taskList') }}
          q-menu(auto-close)
            q-list(separator)
              q-item(clickable, @click='insertBeforeEachLine({ content: `- [ ] `})')
                q-item-section(side)
                  q-icon(name='mdi-checkbox-blank-outline')
                q-item-section {{ t('editor.markup.taskListUnchecked') }}
              q-item(clickable, @click='insertBeforeEachLine({ content: `- [x] `})')
                q-item-section(side)
                  q-icon(name='mdi-checkbox-outline')
                q-item-section {{ t('editor.markup.taskListChecked') }}
        q-btn(
          icon='mdi-code-tags'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: "`" })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.inlineCode') }}
        q-btn(
          icon='mdi-keyboard-variant'
          padding='xs sm'
          flat
          @click='toggleMarkup({ start: `<kbd>`, end: `</kbd>` })'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.markup.keyboardKey') }}
        q-btn(
          v-if='!state.previewShown'
          icon='mdi-eye-arrow-right-outline'
          padding='xs sm'
          flat
          @click='state.previewShown = true'
          )
          q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.togglePreviewPane') }}
      //--------------------------------------------------------
      //- CODEMIRROR
      //--------------------------------------------------------
      .editor-markdown-editor
        textarea(ref='cmRef')
    transition(name='editor-markdown-preview')
      .editor-markdown-preview(v-if='state.previewShown')
        .editor-markdown-preview-toolbar
          strong: em {{ t('editor.renderPreview') }}
          q-separator.q-ml-md.q-mr-sm(vertical, inset)
          q-btn(
            icon='mdi-arrow-vertical-lock'
            padding='xs sm'
            flat
            @click='state.previewScrollSync = !state.previewScrollSync'
            :color='state.previewScrollSync ? `primary` : null'
            )
            q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.toggleScrollSync') }}
          q-btn(
            icon='mdi-eye-off-outline'
            padding='xs sm'
            flat
            @click='state.previewShown = false'
            )
            q-tooltip(anchor='top middle' self='bottom middle') {{ t('editor.togglePreviewPane') }}
        .editor-markdown-preview-content.contents(ref='editorPreviewContainer')
          div(
            ref='editorPreview'
            v-html='state.previewHTML'
            )
</template>

<script setup>
import { reactive, ref, shallowRef, nextTick, onBeforeMount, onMounted, watch } from 'vue'
import { useMeta, useQuasar, setCssVar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { get, flatten, last, times, startsWith, debounce } from 'lodash-es'
import { DateTime } from 'luxon'

import { useEditorStore } from 'src/stores/editor'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// Code Mirror
import CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'
import '../css/codemirror.scss'

// Language
import 'codemirror/mode/markdown/markdown.js'

// Addons
import 'codemirror/addon/selection/active-line.js'
import 'codemirror/addon/display/fullscreen.js'
import 'codemirror/addon/display/fullscreen.css'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/addon/search/searchcursor.js'
import 'codemirror/addon/hint/show-hint.js'
import 'codemirror/addon/fold/foldcode.js'
import 'codemirror/addon/fold/foldgutter.js'
import 'codemirror/addon/fold/foldgutter.css'

// Markdown Renderer
import { MarkdownRenderer } from 'src/renderers/markdown'

// QUASAR

const $q = useQuasar()

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// STATE

const cm = shallowRef(null)
const cmRef = ref(null)

const state = reactive({
  previewShown: true,
  previewHTML: '',
  previewScrollSync: true
})

const md = new MarkdownRenderer({})

// Platform detection
const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// METHODS

function insertAssets () {
  siteStore.$patch({
    overlay: 'FileManager'
  })
}

function insertTable () {
  siteStore.$patch({
    overlay: 'TableEditor'
  })
}

/**
 * Set current line as header
 */
function setHeaderLine (lvl) {
  const curLine = cm.value.doc.getCursor('head').line
  let lineContent = cm.value.doc.getLine(curLine)
  const lineLength = lineContent.length
  if (startsWith(lineContent, '#')) {
    lineContent = lineContent.replace(/^(#+ )/, '')
  }
  lineContent = times(lvl, n => '#').join('') + ' ' + lineContent
  cm.value.doc.replaceRange(lineContent, { line: curLine, ch: 0 }, { line: curLine, ch: lineLength })
}

/**
 * Get the header lever of the current line
 */
function getHeaderLevel (cm) {
  const curLine = cm.doc.getCursor('head').line
  const lineContent = cm.doc.getLine(curLine)
  let lvl = 0
  const result = lineContent.match(/^(#+) /)
  if (result) {
    lvl = get(result, '[1]', '').length
  }
  return lvl
}

/**
 * Insert content at cursor
 */
function insertAtCursor ({ content }) {
  const cursor = cm.value.doc.getCursor('head')
  cm.value.doc.replaceRange(content, cursor)
}

/**
 * Insert content after current line
 */
function insertAfter ({ content, newLine }) {
  const curLine = cm.value.doc.getCursor('to').line
  const lineLength = cm.value.doc.getLine(curLine).length
  cm.value.doc.replaceRange(newLine ? `\n${content}\n` : content, { line: curLine, ch: lineLength + 1 })
}

/**
 * Insert content before current line
 */
function insertBeforeEachLine ({ content, after }) {
  let lines = []
  if (!cm.value.doc.somethingSelected()) {
    lines.push(cm.value.doc.getCursor('head').line)
  } else {
    lines = flatten(cm.value.doc.listSelections().map(sl => {
      const range = Math.abs(sl.anchor.line - sl.head.line) + 1
      const lowestLine = (sl.anchor.line > sl.head.line) ? sl.head.line : sl.anchor.line
      return times(range, l => l + lowestLine)
    }))
  }
  lines.forEach(ln => {
    let lineContent = cm.value.doc.getLine(ln)
    const lineLength = lineContent.length
    if (startsWith(lineContent, content)) {
      lineContent = lineContent.substring(content.length)
    }
    cm.value.doc.replaceRange(content + lineContent, { line: ln, ch: 0 }, { line: ln, ch: lineLength })
  })
  if (after) {
    const lastLine = last(lines)
    cm.value.doc.replaceRange(`\n${after}\n`, { line: lastLine, ch: cm.value.doc.getLine(lastLine).length + 1 })
  }
}

/**
 * Insert an Horizontal Bar
 */
function insertHorizontalBar () {
  insertAfter({ content: '---', newLine: true })
}

/**
 * Toggle Markup at selection
 */
function toggleMarkup ({ start, end }) {
  if (!end) { end = start }
  if (!cm.value.doc.somethingSelected()) {
    return $q.notify({
      type: 'negative',
      message: t('editor.markup.noSelectionError')
    })
  }
  cm.value.doc.replaceSelections(cm.value.doc.getSelections().map(s => start + s + end))
}

const onCmInput = debounce(processContent, 600)

function processContent (newContent) {
  state.previewHTML = md.render(newContent)
}

// MOUNTED

onMounted(async () => {
  // -> Setup Editor View
  editorStore.$patch({
    hideSideNav: true
  })

  // -> Initialize CodeMirror
  cm.value = CodeMirror.fromTextArea(cmRef.value, {
    tabSize: 2,
    mode: 'text/markdown',
    theme: 'wikijs-dark',
    lineNumbers: true,
    lineWrapping: true,
    line: true,
    styleActiveLine: true,
    highlightSelectionMatches: {
      annotateScrollbar: true
    },
    viewportMargin: 50,
    inputStyle: 'contenteditable',
    allowDropFileTypes: ['image/jpg', 'image/png', 'image/svg', 'image/jpeg', 'image/gif'],
    // direction: siteConfig.rtl ? 'rtl' : 'ltr',
    foldGutter: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
  })

  cm.value.setValue(pageStore.content)
  cm.value.on('change', c => {
    editorStore.$patch({
      lastChangeTimestamp: DateTime.utc()
    })
    pageStore.$patch({
      content: c.getValue()
    })
    onCmInput(pageStore.content)
  })

  cm.value.setSize(null, '100%')

  // -> Set Keybindings
  const keyBindings = {
    'F11' (c) {
      c.setOption('fullScreen', !c.getOption('fullScreen'))
    },
    'Esc' (c) {
      if (c.getOption('fullScreen')) {
        c.setOption('fullScreen', false)
      }
    },
    [`${CtrlKey}-S`] (c) {
      // save()
      return false
    },
    [`${CtrlKey}-B`] (c) {
      toggleMarkup({ start: '**' })
      return false
    },
    [`${CtrlKey}-I`] (c) {
      toggleMarkup({ start: '*' })
      return false
    },
    [`${CtrlKey}-Alt-Right`] (c) {
      let lvl = getHeaderLevel(c)
      if (lvl >= 6) { lvl = 5 }
      setHeaderLine(lvl + 1)
      return false
    },
    [`${CtrlKey}-Alt-Left`] (c) {
      let lvl = getHeaderLevel(c)
      if (lvl <= 1) { lvl = 2 }
      setHeaderLine(lvl - 1)
      return false
    }
  }
  cm.value.setOption('extraKeys', keyBindings)
  // this.cm.on('inputRead', this.autocomplete)

  // // Handle cursor movement
  // this.cm.on('cursorActivity', c => {
  //   this.positionSync(c)
  //   this.scrollSync(c)
  // })

  // // Handle special paste
  // this.cm.on('paste', this.onCmPaste)

  // // Render initial preview
  processContent(pageStore.content)
  nextTick(() => {
    cm.value.refresh()
    cm.value.focus()
  })

  // this.$root.$on('editorInsert', opts => {
  //   switch (opts.kind) {
  //     case 'IMAGE':
  //       let img = `![${opts.text}](${opts.path})`
  //       if (opts.align && opts.align !== '') {
  //         img += `{.align-${opts.align}}`
  //       }
  //       this.insertAtCursor({
  //         content: img
  //       })
  //       break
  //     case 'BINARY':
  //       this.insertAtCursor({
  //         content: `[${opts.text}](${opts.path})`
  //       })
  //       break
  //     case 'DIAGRAM':
  //       const selStartLine = this.cm.getCursor('from').line
  //       const selEndLine = this.cm.getCursor('to').line + 1
  //       this.cm.doc.replaceSelection('```diagram\n' + opts.text + '\n```\n', 'start')
  //       this.processMarkers(selStartLine, selEndLine)
  //       break
  //   }
  // })
  // // Handle save conflict
  // this.$root.$on('saveConflict', () => {
  //   this.toggleModal(`editorModalConflict`)
  // })
  // this.$root.$on('overwriteEditorContent', () => {
  //   this.cm.setValue(this.$store.get('editor/content'))
  // })
})

onBeforeMount(() => {
  // if (editor.value) {
  // editor.value.destroy()
  // }
})
</script>

<style lang="scss">
$editor-height: calc(100vh - 64px - 94px - 2px);
$editor-height-mobile: calc(100vh - 112px - 16px);

.editor-markdown {
  &-main {
    display: flex;
    width: 100%;
  }
  &-mid {
    background-color: $dark-6;
    flex: 1 1 50%;
    display: block;
    height: $editor-height;
    position: relative;
    border-right: 5px solid $primary;
  }
  &-editor {
    display: block;
    height: calc(100% - 32px);
    position: relative;
    // @include until($tablet) {
    //   height: $editor-height-mobile;
    // }
  }
  &-type {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding-bottom: 1rem;
    color: rgba(255,255,255, .4);
    font-weight: 500;
  }
  &-preview {
    flex: 1 1 50%;
    position: relative;
    height: $editor-height;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-2;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
    // @include until($tablet) {
    //   display: none;
    // }
    &-enter-active, &-leave-active {
      transition: max-width .5s ease;
      max-width: 50vw;
      .editor-code-preview-content {
        width: 50vw;
        overflow:hidden;
      }
    }
    &-enter, &-leave-to {
      max-width: 0;
    }
    &-toolbar {
      color: $grey-8;
      height: 32px;
      display: flex;
      align-items: center;
      padding: 0 1rem;

      @at-root .body--light & {
        background-color: $grey-3;
      }
      @at-root .body--dark & {
        background-color: $dark-2;
        color: $grey-6;
      }
    }
    &-content {
      height: $editor-height;
      overflow-y: scroll;
      padding: 1rem;
      width: calc(100% + 17px);
      // -ms-overflow-style: none;
      // &::-webkit-scrollbar {
      //   width: 0px;
      //   background: transparent;
      // }
      // @include until($tablet) {
      //   height: $editor-height-mobile;
      // }
      > div {
        outline: none;
      }
      p.line {
        overflow-wrap: break-word;
      }
      .tabset {
        background-color: $teal-7;
        color: $teal-2 !important;
        padding: 5px 12px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 5px 0 0 0;
        font-style: italic;
        &::after {
          display: none;
        }
        &-header {
          background-color: $teal-5;
          color: #FFF !important;
          padding: 5px 12px;
          font-size: 14px;
          font-weight: 500;
          margin-top: 0 !important;
          &::after {
            display: none;
          }
        }
        &-content {
          border-left: 5px solid $teal-5;
          background-color: $teal-1;
          padding: 0 15px 15px;
          overflow: hidden;
          @at-root .theme--dark & {
            background-color: rgba($teal-5, .1);
          }
        }
      }
    }
  }
  &-toolbar {
    background-color: $primary;
    border-left: 40px solid darken($primary, 5%);
    color: #FFF;
    height: 32px;
  }
  &-sidebar {
    background-color: $dark-4;
    border-top: 32px solid darken($primary, 10%);
    color: #FFF;
    width: 56px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: 12px 0;
  }
  &-sysbar {
    padding-left: 0;
    &-locale {
      background-color: rgba(255,255,255,.25);
      display:inline-flex;
      padding: 0 12px;
      height: 24px;
      width: 63px;
      justify-content: center;
      align-items: center;
    }
  }
  // ==========================================
  // CODE MIRROR
  // ==========================================
  .CodeMirror {
    height: auto;
    font-family: 'Roboto Mono', monospace;
    font-size: .9rem;
    .cm-header-1 {
      font-size: 1.5rem;
    }
    .cm-header-2 {
      font-size: 1.25rem;
    }
    .cm-header-3 {
      font-size: 1.15rem;
    }
    .cm-header-4 {
      font-size: 1.1rem;
    }
    .cm-header-5 {
      font-size: 1.05rem;
    }
    .cm-header-6 {
      font-size: 1.025rem;
    }
  }
  .CodeMirror-wrap pre.CodeMirror-line, .CodeMirror-wrap pre.CodeMirror-line-like {
    word-break: break-word;
  }
  .CodeMirror-focused .cm-matchhighlight {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQI12NgYGBgkKzc8x9CMDAwAAAmhwSbidEoSQAAAABJRU5ErkJggg==);
    background-position: bottom;
    background-repeat: repeat-x;
  }
  .cm-matchhighlight {
    background-color: $grey-8;
  }
  .CodeMirror-selection-highlight-scrollbar {
    background-color: $green-6;
  }
}
// HINT DROPDOWN
.CodeMirror-hints {
  position: absolute;
  z-index: 10;
  overflow: hidden;
  list-style: none;
  margin: 0;
  padding: 1px;
  box-shadow: 2px 3px 5px rgba(0,0,0,.2);
  border: 1px solid $grey-7;
  background: $grey-9;
  font-family: 'Roboto Mono', monospace;
  font-size: .9rem;
  max-height: 150px;
  overflow-y: auto;
  min-width: 250px;
  max-width: 80vw;
}
.CodeMirror-hint {
  margin: 0;
  padding: 0 4px;
  white-space: pre;
  color: #FFF;
  cursor: pointer;
}
li.CodeMirror-hint-active {
  background: $blue-5;
  color: #FFF;
}
</style>
