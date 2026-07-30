<template>
  <div class="editor-markdown">
    <div class="editor-markdown-main">
      <div class="editor-markdown-sidebar">
        <!-- ------------------------------------------------------- -->
        <!-- SIDE TOOLBAR -->
        <!-- ------------------------------------------------------- -->
        <w-btn icon="mdi:link-variant-plus" padding="sm sm" flat @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertLink') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:image-plus-outline" padding="sm sm" flat>
          <!--
            Only two of the three rows dismiss the menu, which is what the original did: the first
            opens the file manager over the top of it. `auto-close` was on the list, where it has
            never meant anything -- the list component has no such prop, so it rendered as a stray
            attribute -- and the closing was done by a Quasar directive that cannot see a w-menu.
          -->
          <w-menu ref="assetMenuRef" anchor="top right" self="top left">
            <w-list separator>
              <w-item clickable @click="insertAssets">
                <w-item-section side>
                  <w-icon name="la:folder-open" color="positive" />
                </w-item-section>
                <w-item-section><w-item-label>From File Manager...</w-item-label></w-item-section>
              </w-item>
              <w-item clickable @click="getAssetFromClipboard(); assetMenuRef.hide()">
                <w-item-section side>
                  <w-icon name="la:clipboard" color="brown" />
                </w-item-section>
                <w-item-section><w-item-label>From Clipboard...</w-item-label></w-item-section>
              </w-item>
              <w-item clickable @click="notImplemented(); assetMenuRef.hide()">
                <w-item-section side>
                  <w-icon name="la:cloud-download-alt" color="blue" />
                </w-item-section>
                <w-item-section><w-item-label>From Remote URL...</w-item-label></w-item-section>
              </w-item>
            </w-list>
          </w-menu>
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertAssets') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:code-json" padding="sm sm" flat @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertCodeBlock') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:table-large-plus" padding="sm sm" flat @click="insertTable">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertTable') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:tab-plus" padding="sm sm" flat @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertTabset') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:toy-brick-plus" padding="sm sm" flat @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertBlock') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:chart-multiline" padding="sm sm" flat @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertDiagram') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:book-plus" padding="sm sm" flat @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertFootnote') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:cookie-plus" padding="sm sm" @click="notImplemented" flat>
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertEmoji') }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:line-scan" padding="sm sm" flat @click="insertHorizontalBar">
          <w-tooltip anchor="center right" self="center left">{{ t('editor.markup.insertHorizontalBar') }}</w-tooltip>
        </w-btn>
        <w-space />
        <span class="editor-markdown-type">Markdown</span>
      </div>
      <div class="editor-markdown-mid">
        <!-- ------------------------------------------------------- -->
        <!-- TOP TOOLBAR -->
        <!-- ------------------------------------------------------- -->
        <div class="editor-markdown-toolbar">
          <w-btn icon="mdi:format-bold" padding="xs sm" flat @click="toggleMarkup({ start: `**` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.bold') }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-italic"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `*` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.italic') }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-strikethrough"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `~~` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.strikethrough') }}</w-tooltip>
          </w-btn>
          <w-btn icon="mdi:format-header-pound" padding="xs sm" flat>
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.header') }}</w-tooltip>
            <w-menu auto-close>
              <w-list separator>
                <w-item v-for="lvl in 6" clickable @click="setHeaderLine(lvl)">
                  <w-item-section side>
                    <w-icon :name="HEADER_ICONS[lvl - 1]" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.headerLevel', { level: lvl }) }}</w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <w-btn
            icon="mdi:format-subscript"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `~` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.subscript') }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-superscript"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `^` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.superscript') }}</w-tooltip>
          </w-btn>
          <w-btn icon="mdi:alpha-t-box-outline" padding="xs sm" flat>
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.blockquoteAdmonitions') }}</w-tooltip>
            <w-menu auto-close>
              <w-list separator>
                <w-item clickable @click="insertBeforeEachLine({ content: `> `})">
                  <w-item-section side><w-icon name="mdi:format-quote-close" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.blockquote') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, after: `{.is-info}`})">
                  <w-item-section side>
                    <w-icon name="mdi:information-box" color="blue-7" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionInfo') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, after: `{.is-success}`})">
                  <w-item-section side>
                    <w-icon name="mdi:check-circle" color="positive" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionSuccess') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, after: `{.is-warning}`})">
                  <w-item-section side>
                    <w-icon name="mdi:alert-box" color="orange" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionWarning') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, after: `{.is-danger}`})">
                  <w-item-section side>
                    <w-icon name="mdi:close-box" color="negative" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionDanger') }}</w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <w-btn
            icon="mdi:format-list-bulleted"
            padding="xs sm"
            flat
            @click="insertBeforeEachLine({ content: `- `})">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.unorderedList') }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-list-numbered"
            padding="xs sm"
            flat
            @click="insertBeforeEachLine({ content: `1. `})">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.orderedList') }}</w-tooltip>
          </w-btn>
          <w-btn icon="mdi:format-list-checks" padding="xs sm" flat>
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.taskList') }}</w-tooltip>
            <w-menu auto-close>
              <w-list separator>
                <w-item clickable @click="insertBeforeEachLine({ content: `- [ ] `})">
                  <w-item-section side><w-icon name="mdi:checkbox-blank-outline" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.taskListUnchecked') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertBeforeEachLine({ content: `- [x] `})">
                  <w-item-section side><w-icon name="mdi:checkbox-outline" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.taskListChecked') }}</w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <w-btn icon="mdi:code-tags" padding="xs sm" flat @click='toggleMarkup({ start: "`" })'>
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.inlineCode') }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:keyboard-variant"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `<kbd>`, end: `</kbd>` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.markup.keyboardKey') }}</w-tooltip>
          </w-btn>
        </div>
        <!-- ------------------------------------------------------- -->
        <!-- MONACO EDITOR -->
        <!-- ------------------------------------------------------- -->
        <div class="editor-markdown-editor"><div ref="monacoRef" /></div>
      </div>
      <transition name="editor-markdown-preview">
        <div class="editor-markdown-preview" v-if="state.previewShown">
          <div class="editor-markdown-preview-toolbar">
            <strong><em>{{ t('editor.renderPreview') }}</em></strong>
            <w-separator class="ml-4 mr-2" vertical inset />
            <w-btn
              icon="mdi:arrow-vertical-lock"
              padding="xs sm"
              flat
              @click="state.previewScrollSync = !state.previewScrollSync"
              :color="state.previewScrollSync ? `primary` : null">
              <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.toggleScrollSync') }}</w-tooltip>
            </w-btn>
            <w-btn
              icon="mdi:eye-off-outline"
              padding="xs sm"
              flat
              @click="state.previewShown = false">
              <w-tooltip anchor="top middle" self="bottom middle">{{ t('editor.togglePreviewPane') }}</w-tooltip>
            </w-btn>
          </div>
          <!--
            The render goes directly into the element carrying `page-contents`, exactly as the page
            view does it. The wrapper div this replaces made the headings grandchildren of that
            element, so content rules written against its direct children -- the page title's rule
            reaching out to the sidebar -- applied on one surface and not the other. Its `ref` was
            never read; the scroll-sync and block loading both use the container.
          -->
          <div
            class="editor-markdown-preview-content page-contents"
            ref="editorPreviewContainerRef"
            v-html="pageStore.render" />
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, shallowRef, nextTick, onMounted, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { enhanceRenderedContent } from '@/helpers/renderedContent'

import { debounce } from 'es-toolkit/function'
import * as monaco from 'monaco-editor'
import { Position, Range } from 'monaco-editor'
import { MarkdownRenderer } from '@/renderers/markdown'


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

/*
  Listed rather than built as `mdi:format-header-${lvl}`: a concatenated icon name is invisible to
  the build-time icon scan, so it would ship as six blank squares.
*/
const HEADER_ICONS = [
  'mdi:format-header-1',
  'mdi:format-header-2',
  'mdi:format-header-3',
  'mdi:format-header-4',
  'mdi:format-header-5',
  'mdi:format-header-6'
]

const assetMenuRef = ref(null)

const state = reactive({
  previewShown: true,
  previewScrollSync: true
})

// METHODS

function insertAssets() {
  siteStore.openFileManager({ insertMode: true })
}

function insertAssetClb(opts) {
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

function insertTable() {
  siteStore.$patch({
    overlay: 'TableEditor'
  })
}

/**
 * Set current line as header
 */
function setHeaderLine(lvl, focus = true) {
  const curLine = editor.getPosition().lineNumber
  let lineContent = editor.getModel().getLineContent(curLine)
  const lineLength = lineContent.length
  if (lineContent.startsWith('#')) {
    lineContent = lineContent.replace(/^(#+ )/, '')
  }
  lineContent = '#'.repeat(lvl) + ' ' + lineContent
  editor.executeEdits('', [
    {
      range: new Range(curLine, 1, curLine, lineLength + 1),
      text: lineContent,
      forceMoveMarkers: true
    }
  ])
  if (focus) {
    editor.focus()
  }
}

/**
 * Get the header lever of the current line
 */
function getHeaderLevel() {
  const curLine = editor.getPosition().lineNumber
  const lineContent = editor.getModel().getLineContent(curLine)
  let lvl = 0
  const result = lineContent.match(/^(#+) /)
  if (result) {
    lvl = (result?.[1] ?? '').length
  }
  return lvl
}

/**
 * Insert content at cursor
 */
function insertAtCursor({ content, focus = true }) {
  const cursor = editor.getPosition()
  editor.executeEdits('', [
    {
      range: new Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
      text: content,
      forceMoveMarkers: true
    }
  ])
  if (focus) {
    editor.focus()
  }
}

/**
 * Insert content after current line
 */
function insertAfter({ content, newLine, focus = true }) {
  const curLine = editor.getPosition().lineNumber
  const lineLength = editor.getModel().getLineContent(curLine).length
  editor.executeEdits('', [
    {
      range: new Range(curLine, lineLength + 1, curLine, lineLength + 1),
      text: newLine ? `\n\n${content}\n` : `\n${content}`,
      forceMoveMarkers: true
    }
  ])
  if (focus) {
    editor.focus()
    editor.revealLineInCenterIfOutsideViewport(editor.getPosition().lineNumber)
  }
}

/**
 * Insert content before current line
 */
function insertBeforeEachLine({ content, after, focus = true }) {
  const edits = []
  for (const selection of editor.getSelections()) {
    const lineCount = selection.endLineNumber - selection.startLineNumber + 1
    const lines = Array.from({ length: lineCount }, (_, l) => l + selection.startLineNumber)
    for (const line of lines) {
      let lineContent = editor.getModel().getLineContent(line)
      const lineLength = lineContent.length
      if (lineContent.startsWith(content)) {
        lineContent = lineContent.substring(content.length)
      }
      edits.push({
        range: new Range(line, 1, line, lineLength + 1),
        text: `${content}${lineContent}`,
        forceMoveMarkers: true
      })
    }
    if (after) {
      const lastLine = lines.at(-1)
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
function insertHorizontalBar() {
  insertAfter({ content: '---', newLine: true })
}

/**
 * Toggle Markup at selection
 */
async function toggleMarkup({ start, end }) {
  if (!end) {
    end = start
  }
  if (!editor.getSelection()) {
    return notify({
      type: 'negative',
      message: t('editor.markup.noSelectionError')
    })
  }

  const edits = []

  for (const selection of editor.getSelections()) {
    const selectedText = editor.getModel().getValueInRange(selection)
    if (!selectedText) {
      const wordObj = editor.getModel().getWordAtPosition(selection.getPosition())
      const wordRange = new Range(
        selection.startLineNumber,
        wordObj.startColumn,
        selection.endLineNumber,
        wordObj.endColumn
      )
      if (wordObj.word.startsWith(start) && wordObj.word.endsWith(end)) {
        edits.push({
          range: wordRange,
          text: wordObj.word.substring(start.length, wordObj.word.length - end.length)
        })
      } else {
        edits.push({ range: wordRange, text: `${start}${wordObj.word}${end}` })
      }
    } else if (selectedText.startsWith(start) && selectedText.endsWith(end)) {
      edits.push({
        range: selection,
        text: selectedText.substring(start.length, selectedText.length - end.length)
      })
    } else {
      edits.push({ range: selection, text: `${start}${selectedText}${end}` })
    }
  }

  editor.executeEdits('', edits)
}

function processContent(newContent) {
  /*
    A render that throws must not become a render that is empty.

    `pageSave` sends whatever is in the store, and the server replaces the stored HTML with it -- so
    patching a failed render in blanks the published page, and patching nothing keeps the last good
    one. Loud rather than silent, because the preview is then showing something other than the source.
  */
  let html
  try {
    html = md.render(newContent)
  } catch (err) {
    console.error(err)
    notify({
      type: 'negative',
      message: t('editor.renderFailed'),
      caption: err.message
    })
    return
  }

  pageStore.$patch({
    render: html
  })
  nextTick(() => {
    for (const block of editorPreviewContainerRef.value.querySelectorAll(':not(:defined)')) {
      commonStore.loadBlocks([block.tagName.toLowerCase()])
    }
    // -> The render was just replaced, so the copy buttons went with it
    enhanceRenderedContent(editorPreviewContainerRef.value)
  })
}

function openEditorSettings() {
  siteStore.$patch({ overlay: 'EditorMarkdownConfig' })
}

async function getAssetFromClipboard() {
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
      const imageType = item.types.find((t) => t.startsWith('image/'))
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
    return notify({
      type: 'negative',
      message: 'Unable to copy from Clipboard',
      caption: err.message
    })
  }
}

function reloadEditorContent() {
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
    wordPattern:
      /([*_]{1,2}|~~|`+)?[\p{Alphabetic}\p{Number}\p{Nonspacing_Mark}]+(_+[\p{Alphabetic}\p{Number}\p{Nonspacing_Mark}]+)*\1/gu
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
    run(ed) {
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
    run(ed) {
      toggleMarkup({ start: '*' })
    }
  })

  editor.addAction({
    id: 'markdown.extension.editing.increaseHeaderLevel',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow],
    label: 'Increase Header Level',
    precondition: '',
    run(ed) {
      let lvl = getHeaderLevel()
      if (lvl >= 6) {
        lvl = 5
      }
      setHeaderLine(lvl + 1)
    }
  })
  editor.addAction({
    id: 'markdown.extension.editing.decreaseHeaderLevel',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow],
    label: 'Decrease Header Level',
    precondition: '',
    run(ed) {
      let lvl = getHeaderLevel()
      if (lvl <= 1) {
        lvl = 2
      }
      setHeaderLine(lvl - 1)
    }
  })

  editor.addAction({
    id: 'save',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    label: 'Save',
    precondition: '',
    run(ed) {}
  })

  // -> Handle content change
  editor.onDidChangeModelContent(
    debounce((ev) => {
      editorStore.$patch({
        lastChangeTimestamp: Temporal.Now.instant()
      })
      pageStore.$patch({
        content: editor.getValue(),
        // -> What the author has typed IS the source, whatever the load did or did not deliver; see
        //    the guard in `pageSave`
        contentLoaded: true
      })
      processContent(pageStore.content)
    }, 500)
  )

  // -> Handle cursor movement
  editor.onDidChangeCursorPosition(
    debounce((ev) => {
      if (!state.previewScrollSync || !state.previewShown) {
        return
      }
      const currentLine = editor.getPosition().lineNumber
      if (currentLine < 3) {
        editorPreviewContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        const exactEl = editorPreviewContainerRef.value.querySelector(
          `[data-line='${currentLine}']`
        )
        if (exactEl) {
          exactEl.scrollIntoView({
            behavior: 'smooth'
          })
        } else {
          const closestLine = md.getClosestPreviewLine(currentLine)
          if (closestLine) {
            const closestEl = editorPreviewContainerRef.value.querySelector(
              `[data-line='${closestLine}']`
            )
            if (closestEl) {
              closestEl.scrollIntoView({
                behavior: 'smooth'
              })
            }
          }
        }
      }
    }, 500)
  )

  // -> Handle asset drop
  editor.getContainerDomNode().addEventListener('drop', (ev) => {
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

function notImplemented() {
  notify({
    type: 'negative',
    message: 'Not implemented'
  })
}
</script>

<style lang="scss">
@use 'sass:color';

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
    color: rgba(255, 255, 255, 0.4);
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
    &-enter-active,
    &-leave-active {
      transition: max-width 0.5s ease;
      max-width: 50vw;
      .editor-code-preview-content {
        width: 50vw;
        overflow: hidden;
      }
    }
    &-enter,
    &-leave-to {
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
          color: #fff !important;
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
            background-color: rgba($teal-5, 0.1);
          }
        }
      }
    }
  }
  &-toolbar {
    background-color: $primary;
    border-left: 60px solid color.adjust($primary, $lightness: -5%);
    color: #fff;
    height: 32px;
  }
  &-sidebar {
    background-color: $dark-4;
    border-top: 32px solid color.adjust($primary, $lightness: -10%);
    color: #fff;
    width: 56px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: 12px 0;
  }
}
</style>
