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
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertLink') }}
      q-btn(
        icon='mdi-image-plus-outline'
        padding='sm sm'
        flat
        )
        q-menu(anchor='top right' self='top left')
          q-list(separator, auto-close)
            q-item(
              clickable
              @click='insertAssets'
              )
              q-item-section(side)
                q-icon(name='las la-folder-open', color='positive')
              q-item-section
                q-item-label From File Manager...
            q-item(
              clickable
              @click='getAssetFromClipboard'
              v-close-popup
              )
              q-item-section(side)
                q-icon(name='las la-clipboard', color='brown')
              q-item-section
                q-item-label From Clipboard...
            q-item(
              clickable
              @click='notImplemented'
              v-close-popup
              )
              q-item-section(side)
                q-icon(name='las la-cloud-download-alt', color='blue')
              q-item-section
                q-item-label From Remote URL...
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertAssets') }}
      q-btn(
        icon='mdi-code-json'
        padding='sm sm'
        flat
        @click='notImplemented'
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
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertTabset') }}
      q-btn(
        icon='mdi-toy-brick-plus'
        padding='sm sm'
        flat
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertBlock') }}
      q-btn(
        icon='mdi-chart-multiline'
        padding='sm sm'
        flat
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertDiagram') }}
      q-btn(
        icon='mdi-book-plus'
        padding='sm sm'
        flat
        @click='notImplemented'
        )
        q-tooltip(anchor='center right' self='center left') {{ t('editor.markup.insertFootnote') }}
      q-btn(
        icon='mdi-cookie-plus'
        padding='sm sm'
        @click='notImplemented'
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
      //--------------------------------------------------------
      //- MONACO EDITOR
      //--------------------------------------------------------
      .editor-markdown-editor
        div(ref='monacoRef')
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
        .editor-markdown-preview-content.page-contents(ref='editorPreviewContainerRef')
          div(
            ref='editorPreview'
            v-html='pageStore.render'
            )
</template>

<script setup>
import { reactive, ref, shallowRef, nextTick, onMounted, watch, onBeforeUnmount } from 'vue'
import { useMeta, useQuasar, setCssVar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { find, get, last, times, startsWith, debounce } from 'lodash-es'
import { DateTime } from 'luxon'
import * as monaco from 'monaco-editor'
import { Position, Range } from 'monaco-editor'

import { useCommonStore } from 'src/stores/common'
import { useEditorStore } from 'src/stores/editor'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// Markdown Renderer
import { MarkdownRenderer } from 'src/renderers/markdown'

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// STATE

let editor
let md
const monacoRef = ref(null)
const editorPreviewContainerRef = ref(null)

const state = reactive({
  previewShown: true,
  previewScrollSync: true
})

// METHODS

function insertAssets () {
  siteStore.openFileManager({ insertMode: true })
}

function insertAssetClb (opts) {
  const assetPath = opts.folderPath ? `${opts.folderPath}/${opts.fileName}` : opts.fileName
  let content = ''
  switch (opts.type) {
    case 'asset': {
      content = `![${opts.title}](${assetPath})`
      break
    }
    case 'page': {
      content = `[${opts.title}](${assetPath})`
      break
    }
  }
  insertAtCursor({ content, focus: false })
  setTimeout(() => {
    editor.focus()
  }, 500)
}

function insertTable () {
  siteStore.$patch({
    overlay: 'TableEditor'
  })
}

/**
* Set current line as header
*/
function setHeaderLine (lvl, focus = true) {
  const curLine = editor.getPosition().lineNumber
  let lineContent = editor.getModel().getLineContent(curLine)
  const lineLength = lineContent.length
  if (startsWith(lineContent, '#')) {
    lineContent = lineContent.replace(/^(#+ )/, '')
  }
  lineContent = times(lvl, n => '#').join('') + ' ' + lineContent
  editor.executeEdits('', [{
    range: new Range(curLine, 1, curLine, lineLength + 1),
    text: lineContent,
    forceMoveMarkers: true
  }])
  if (focus) {
    editor.focus()
  }
}

/**
* Get the header lever of the current line
*/
function getHeaderLevel () {
  const curLine = editor.getPosition().lineNumber
  const lineContent = editor.getModel().getLineContent(curLine)
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
function insertAtCursor ({ content, focus = true }) {
  const cursor = editor.getPosition()
  editor.executeEdits('', [{
    range: new Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
    text: content,
    forceMoveMarkers: true
  }])
  if (focus) {
    editor.focus()
  }
}

/**
* Insert content after current line
*/
function insertAfter ({ content, newLine, focus = true }) {
  const curLine = editor.getPosition().lineNumber
  const lineLength = editor.getModel().getLineContent(curLine).length
  editor.executeEdits('', [{
    range: new Range(curLine, lineLength + 1, curLine, lineLength + 1),
    text: newLine ? `\n\n${content}\n` : `\n${content}`,
    forceMoveMarkers: true
  }])
  if (focus) {
    editor.focus()
    editor.revealLineInCenterIfOutsideViewport(editor.getPosition().lineNumber)
  }
}

/**
* Insert content before current line
*/
function insertBeforeEachLine ({ content, after, focus = true }) {
  const edits = []
  for (const selection of editor.getSelections()) {
    const lineCount = selection.endLineNumber - selection.startLineNumber + 1
    const lines = times(lineCount, l => l + selection.startLineNumber)
    for (const line of lines) {
      let lineContent = editor.getModel().getLineContent(line)
      const lineLength = lineContent.length
      if (startsWith(lineContent, content)) {
        lineContent = lineContent.substring(content.length)
      }
      edits.push({
        range: new Range(line, 1, line, lineLength + 1),
        text: `${content}${lineContent}`,
        forceMoveMarkers: true
      })
    }
    if (after) {
      const lastLine = last(lines)
      const lineLength = editor.getModel().getLineContent(lastLine).length
      edits.push({
        range: new Range(lastLine, lineLength + 1, lastLine, lineLength + 1),
        text: `\n${after}`,
        forceMoveMarkers: true
      })
    }
  }

  editor.executeEdits('', edits)

  if (focus) {
    editor.focus()
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
async function toggleMarkup ({ start, end }) {
  if (!end) { end = start }
  if (!editor.getSelection()) {
    return $q.notify({
      type: 'negative',
      message: t('editor.markup.noSelectionError')
    })
  }

  const edits = []

  for (const selection of editor.getSelections()) {
    const selectedText = editor.getModel().getValueInRange(selection)
    if (!selectedText) {
      const wordObj = editor.getModel().getWordAtPosition(selection.getPosition())
      const wordRange = new Range(selection.startLineNumber, wordObj.startColumn, selection.endLineNumber, wordObj.endColumn)
      if (wordObj.word.startsWith(start) && wordObj.word.endsWith(end)) {
        edits.push({ range: wordRange, text: wordObj.word.substring(start.length, wordObj.word.length - end.length) })
      } else {
        edits.push({ range: wordRange, text: `${start}${wordObj.word}${end}` })
      }
    } else if (selectedText.startsWith(start) && selectedText.endsWith(end)) {
      edits.push({ range: selection, text: selectedText.substring(start.length, selectedText.length - end.length) })
    } else {
      edits.push({ range: selection, text: `${start}${selectedText}${end}` })
    }
  }

  editor.executeEdits('', edits)
}

function processContent (newContent) {
  pageStore.$patch({
    render: md.render(newContent)
  })
  nextTick(() => {
    for (const block of editorPreviewContainerRef.value.querySelectorAll(':not(:defined)')) {
      commonStore.loadBlocks([block.tagName.toLowerCase()])
    }
  })
}

function openEditorSettings () {
  siteStore.$patch({ overlay: 'EditorMarkdownConfig' })
}

async function getAssetFromClipboard () {
  try {
    const permission = await navigator.permissions.query({
      name: 'clipboard-read'
    })
    if (permission.state === 'denied') {
      throw new Error('Not allowed to read clipboard.')
    }
    const clipboardContents = await navigator.clipboard.read()
    let hasValidItem = false
    for (const item of clipboardContents) {
      const imageType = find(item.types, t => t.startsWith('image/'))
      if (imageType) {
        hasValidItem = true
        const blob = await item.getType(imageType)
        const blobUrl = editorStore.addPendingAsset(blob)
        insertAtCursor({
          content: `![](${blobUrl})`
        })
      }
    }
    if (!hasValidItem) {
      throw new Error('No supported content found in the Clipboard.')
    }
  } catch (err) {
    return $q.notify({
      type: 'negative',
      message: 'Unable to copy from Clipboard',
      caption: err.message
    })
  }
}

function reloadEditorContent () {
  editor.getModel().setValue(pageStore.content)
}

// MOUNTED

onMounted(async () => {
  // -> Setup Editor View
  editorStore.$patch({
    hideSideNav: true
  })

  md = new MarkdownRenderer(editorStore.editors.markdown)

  // -> Define Monaco Theme
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

  // Allow `*` in word pattern for quick styling (toggle bold/italic without selection)
  // original https://github.com/microsoft/vscode/blob/3e5c7e2c570a729e664253baceaf443b69e82da6/extensions/markdown-basics/language-configuration.json#L55
  monaco.languages.setLanguageConfiguration('markdown', {
    wordPattern: /([*_]{1,2}|~~|`+)?[\p{Alphabetic}\p{Number}\p{Nonspacing_Mark}]+(_+[\p{Alphabetic}\p{Number}\p{Nonspacing_Mark}]+)*\1/gu
  })

  // -> Initialize Monaco Editor
  editor = monaco.editor.create(monacoRef.value, {
    automaticLayout: true,
    cursorBlinking: 'blink',
    // cursorSmoothCaretAnimation: true,
    fontSize: 16,
    formatOnType: true,
    language: 'markdown',
    lineNumbersMinChars: 4,
    padding: { top: 10, bottom: 10 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    theme: 'wikijs',
    value: pageStore.content,
    wordWrap: 'on'
  })

  // TODO: For debugging, remove at some point...
  window.edInstance = editor

  // -> Define Formatting Actions
  editor.addAction({
    contextMenuGroupId: 'markdown.extension.editing',
    contextMenuOrder: 0,
    id: 'markdown.extension.editing.toggleBold',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
    label: 'Toggle bold',
    precondition: '',
    run (ed) {
      toggleMarkup({ start: '**' })
    }
  })

  editor.addAction({
    contextMenuGroupId: 'markdown.extension.editing',
    contextMenuOrder: 0,
    id: 'markdown.extension.editing.toggleItalic',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
    label: 'Toggle italic',
    precondition: '',
    run (ed) {
      toggleMarkup({ start: '*' })
    }
  })

  editor.addAction({
    id: 'markdown.extension.editing.increaseHeaderLevel',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow],
    label: 'Increase Header Level',
    precondition: '',
    run (ed) {
      let lvl = getHeaderLevel()
      if (lvl >= 6) { lvl = 5 }
      setHeaderLine(lvl + 1)
    }
  })
  editor.addAction({
    id: 'markdown.extension.editing.decreaseHeaderLevel',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow],
    label: 'Decrease Header Level',
    precondition: '',
    run (ed) {
      let lvl = getHeaderLevel()
      if (lvl <= 1) { lvl = 2 }
      setHeaderLine(lvl - 1)
    }
  })

  editor.addAction({
    id: 'save',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    label: 'Save',
    precondition: '',
    run (ed) {
    }
  })

  // -> Handle content change
  editor.onDidChangeModelContent(debounce(ev => {
    editorStore.$patch({
      lastChangeTimestamp: DateTime.utc()
    })
    pageStore.$patch({
      content: editor.getValue()
    })
    processContent(pageStore.content)
  }, 500))

  // -> Handle cursor movement
  editor.onDidChangeCursorPosition(debounce(ev => {
    if (!state.previewScrollSync || !state.previewShown) { return }
    const currentLine = editor.getPosition().lineNumber
    if (currentLine < 3) {
      editorPreviewContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      const exactEl = editorPreviewContainerRef.value.querySelector(`[data-line='${currentLine}']`)
      if (exactEl) {
        exactEl.scrollIntoView({
          behavior: 'smooth'
        })
      } else {
        const closestLine = md.getClosestPreviewLine(currentLine)
        if (closestLine) {
          const closestEl = editorPreviewContainerRef.value.querySelector(`[data-line='${closestLine}']`)
          if (closestEl) {
            closestEl.scrollIntoView({
              behavior: 'smooth'
            })
          }
        }
      }
    }
  }, 500))

  // -> Handle asset drop
  editor.getContainerDomNode().addEventListener('drop', ev => {
    ev.preventDefault()
    for (const file of ev.dataTransfer.files) {
      const blobUrl = editorStore.addPendingAsset(file)
      if (file.type.startsWith('image')) {
        insertAtCursor({
          content: `![${file.name}](${blobUrl})`
        })
      } else {
        insertAtCursor({
          content: `[${file.name}](${blobUrl})`
        })
      }
    }
  })

  // -> Post init

  editor.focus()

  nextTick(() => {
    processContent(pageStore.content)
  })

  EVENT_BUS.on('insertAsset', insertAssetClb)
  EVENT_BUS.on('openEditorSettings', openEditorSettings)
  EVENT_BUS.on('reloadEditorContent', reloadEditorContent)

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

onBeforeUnmount(() => {
  EVENT_BUS.off('insertAsset', insertAssetClb)
  EVENT_BUS.off('openEditorSettings', openEditorSettings)
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  if (editor) {
    editor.dispose()
  }
})

function notImplemented () {
  $q.notify({
    type: 'negative',
    message: 'Not implemented'
  })
}
</script>

<style lang="scss">
$editor-height: calc(100vh - 64px - 96px);
$editor-preview-height: calc(100vh - 64px - 96px - 32px);
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

    > div {
      height: 100%;
    }
  }
  &-type {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    padding-bottom: 1rem;
    color: rgba(255,255,255, .4);
    font-weight: 500;
  }
  &-preview {
    flex: 0 1 50%;
    position: relative;
    height: $editor-height;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-2;
    }
    @at-root .body--dark & {
      background-color: $dark-6;
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
      height: $editor-preview-height;
      overflow-y: scroll;
      padding: 1rem;
      max-width: calc(50vw - 57px);
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
    border-left: 60px solid darken($primary, 5%);
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
}
</style>
