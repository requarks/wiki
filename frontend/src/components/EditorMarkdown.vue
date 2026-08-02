<template>
  <div class="editor-markdown">
    <div class="editor-markdown-main">
      <div class="editor-markdown-sidebar">
        <!-- ------------------------------------------------------- -->
        <!-- SIDE TOOLBAR -->
        <!-- ------------------------------------------------------- -->
        <w-btn icon="mdi:link-variant-plus" padding="sm sm" flat @click="insertLink">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertLink')
          }}</w-tooltip>
        </w-btn>
        <!-- -> Straight to the File Manager. The menu this replaces offered two other sources: a remote
                URL, which was never implemented, and the clipboard — see `getAssetFromClipboard`, which
                now has no caller. -->
        <w-btn icon="mdi:image-plus-outline" padding="sm sm" flat @click="insertAssets">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertAssets')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:code-json" padding="sm sm" flat>
          <editor-code-block-menu anchor="top right" self="top left" @select="insertCodeBlock" />
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertCodeBlock')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:table-large-plus" padding="sm sm" flat @click="insertTable">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertTable')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:tab-plus" padding="sm sm" flat @click="insertTabset">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertTabset')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:toy-brick-plus" padding="sm sm" flat @click="insertBlock">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertBlock')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:book-plus" padding="sm sm" flat @click="insertFootnote">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertFootnote')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:emoticon-plus-outline" padding="sm sm" flat>
          <editor-emoji-menu anchor="top right" self="top left" @select="insertEmoji" />
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertEmoji')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:line-scan" padding="sm sm" flat @click="insertHorizontalBar">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertHorizontalBar')
          }}</w-tooltip>
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
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.bold')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-italic"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `*` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.italic')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-strikethrough"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `~~` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.strikethrough')
            }}</w-tooltip>
          </w-btn>
          <w-btn icon="mdi:format-header-pound" padding="xs sm" flat>
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.header')
            }}</w-tooltip>
            <w-menu auto-close>
              <w-list separator>
                <w-item v-for="lvl in 6" clickable @click="setHeaderLine(lvl)">
                  <w-item-section side>
                    <w-icon :name="HEADER_ICONS[lvl - 1]" />
                  </w-item-section>
                  <w-item-section>{{
                    t('editor.markup.headerLevel', { level: lvl })
                  }}</w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <w-btn
            icon="mdi:format-subscript"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `~` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.subscript')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-superscript"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `^` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.superscript')
            }}</w-tooltip>
          </w-btn>
          <w-btn icon="mdi:alpha-t-box-outline" padding="xs sm" flat>
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.blockquoteAdmonitions')
            }}</w-tooltip>
            <w-menu auto-close>
              <w-list separator>
                <w-item clickable @click="insertBeforeEachLine({ content: `> ` })">
                  <w-item-section side><w-icon name="mdi:format-quote-close" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.blockquote') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, before: `> [!NOTE]` })">
                  <w-item-section side>
                    <!--
                      A colour with a utility behind it. WIcon composes the class from this name, so
                      Tailwind never sees it while scanning and emits only the ones written out in
                      full somewhere in the app -- of the blues, that is this one. Asking for the 7
                      step, as this did, left the icon the colour of the menu text.

                      Nothing above may spell a class out either: the scanner reads comments too, and
                      would generate whatever this explanation quoted.
                    -->
                    <w-icon name="mdi:information-box" color="blue" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionInfo') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, before: `> [!TIP]` })">
                  <w-item-section side>
                    <w-icon name="mdi:check-circle" color="positive" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionSuccess') }}</w-item-section>
                </w-item>
                <!-- -> The same speech bubble the page draws an IMPORTANT admonition with -->
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, before: `> [!IMPORTANT]` })">
                  <w-item-section side>
                    <w-icon name="mdi:message-alert" color="purple" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionImportant') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, before: `> [!WARNING]` })">
                  <w-item-section side>
                    <w-icon name="mdi:alert-box" color="orange" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionWarning') }}</w-item-section>
                </w-item>
                <w-item
                  clickable
                  @click="insertBeforeEachLine({ content: `> `, before: `> [!CAUTION]` })">
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
            @click="insertBeforeEachLine({ content: `- ` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.unorderedList')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-list-numbered"
            padding="xs sm"
            flat
            @click="insertBeforeEachLine({ content: `1. ` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.orderedList')
            }}</w-tooltip>
          </w-btn>
          <w-btn icon="mdi:format-list-checks" padding="xs sm" flat>
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.taskList')
            }}</w-tooltip>
            <w-menu auto-close>
              <w-list separator>
                <w-item clickable @click="insertBeforeEachLine({ content: `- [ ] ` })">
                  <w-item-section side><w-icon name="mdi:checkbox-blank-outline" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.taskListUnchecked') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertBeforeEachLine({ content: `- [x] ` })">
                  <w-item-section side><w-icon name="mdi:checkbox-outline" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.taskListChecked') }}</w-item-section>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
          <w-btn icon="mdi:code-tags" padding="xs sm" flat @click="toggleMarkup({ start: '`' })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.inlineCode')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:keyboard-variant"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `<kbd>`, end: `</kbd>` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.keyboardKey')
            }}</w-tooltip>
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
            <strong
              ><em>{{ t('editor.renderPreview') }}</em></strong
            >
            <w-separator class="ml-4 mr-2" vertical inset />
            <w-btn
              icon="mdi:arrow-vertical-lock"
              padding="xs sm"
              flat
              @click="state.previewScrollSync = !state.previewScrollSync"
              :color="state.previewScrollSync ? `primary` : null">
              <w-tooltip anchor="top middle" self="bottom middle">{{
                t('editor.toggleScrollSync')
              }}</w-tooltip>
            </w-btn>
            <w-btn
              icon="mdi:eye-off-outline"
              padding="xs sm"
              flat
              @click="state.previewShown = false">
              <w-tooltip anchor="top middle" self="bottom middle">{{
                t('editor.togglePreviewPane')
              }}</w-tooltip>
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
import {
  computed,
  reactive,
  ref,
  shallowRef,
  nextTick,
  onMounted,
  watch,
  onBeforeUnmount
} from 'vue'
import { useI18n } from 'vue-i18n'

import { bindCollabEditor, startCollabSession, stopCollabSession } from '@/composables/collab'
import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { blockMarkdown } from '@/helpers/blocks'

import EditorCodeBlockMenu from '@/components/EditorCodeBlockMenu.vue'
import EditorEmojiMenu from '@/components/EditorEmojiMenu.vue'
import LinkPickerDialog from '@/components/LinkPickerDialog.vue'

import { useCollabStore } from '@/stores/collab'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { enhanceRenderedContent } from '@/helpers/renderedContent'

import { debounce } from 'es-toolkit/function'
import * as monaco from 'monaco-editor'
import { Position, Range } from 'monaco-editor'
import { MarkdownRenderer } from '@/renderers/markdown'

// STORES

const collabStore = useCollabStore()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// COMPUTED

/**
 * Whether this edit is shared with whoever else has the page open.
 *
 * Deliberately narrow. A page being created has no id to gather anyone around yet, and a suggestion is
 * one person's private draft of a page they may not write to — the server refuses a room for it, and
 * asking for one anyway would only produce a rejected socket on every keystroke of every suggestion.
 */
const collabEnabled = computed(
  () =>
    siteStore.features.collaborativeEditing &&
    userStore.authenticated &&
    editorStore.mode === 'edit' &&
    Boolean(pageStore.id)
)

// STATE

let editor
let md
/** Where the paste listener ended up, so it can be taken off the same node. See the note in onMounted. */
let pasteCaptureNode = null
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

/**
 * A fenced code block in the chosen language.
 *
 * Wraps the selection when there is one — marking a few lines and picking a language reads as "this is
 * code" — and otherwise opens an empty block with the caret on the line inside it, ready to type.
 *
 * The fence has to start a line of its own, so a cursor sitting mid-sentence breaks out of it first.
 */
function insertCodeBlock(language) {
  const model = editor.getModel()
  const selection = editor.getSelection()
  const selected = model.getValueInRange(selection)
  const startLine = model.getLineContent(selection.startLineNumber)
  const endLine = model.getLineContent(selection.endLineNumber)
  const before = startLine.slice(0, selection.startColumn - 1).trim().length > 0 ? '\n\n' : ''
  const after = endLine.slice(selection.endColumn - 1).trim().length > 0 ? '\n\n' : '\n'
  editor.executeEdits('', [
    {
      range: selection,
      text: `${before}\`\`\`${language}\n${selected}\n\`\`\`${after}`,
      forceMoveMarkers: true
    }
  ])
  if (!selected) {
    // -> Onto the empty line between the fences, which is the only place typing makes sense next
    const openerLine = selection.startLineNumber + (before ? 2 : 0)
    editor.setPosition({ lineNumber: openerLine + 1, column: 1 })
  }
  editor.focus()
}

/**
 * The chosen emoji, as its shortcode.
 *
 * `:tada:` rather than 🎉, because that is what the renderer replaces — see `renderers/markdown.js`,
 * where the emoji plugin's tokens are the only ones handed to twemoji. A raw character would survive
 * into the page and be drawn by whatever font the reader happens to have.
 */
function insertEmoji(shortcode) {
  insertAtCursor({ content: `:${shortcode}:` })
}

function insertBlock() {
  siteStore.$patch({
    overlay: 'BlockPicker'
  })
}

/**
 * The tabset, without going through the picker.
 *
 * A shortcut to picking Tabs from the block list and inserting it as it stands, so the markup is
 * built from the same definition rather than written out a second time here — a change to the block's
 * starter body reaches both. It still asks the server which blocks this site has: a shortcut to a
 * block an administrator switched off would insert something the page cannot draw.
 */
async function insertTabset() {
  try {
    const blocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
    const tabs = blocks.find((block) => block.block === `tabs` && block.isEnabled)
    if (!tabs) {
      notify({
        type: 'warning',
        message: t('editor.blockPicker.blockUnavailable')
      })
      return
    }
    insertBlockClb(blockMarkdown(tabs))
  } catch (err) {
    notify({
      type: 'negative',
      message: t('editor.blockPicker.loadFailed'),
      caption: err.message
    })
  }
}

/**
 * The block the picker built, on its own lines.
 *
 * MDC's block syntax only opens a component when `::` starts a line, so a cursor mid-sentence breaks
 * out of it first — the same rule the table follows.
 */
function insertBlockClb(markdown) {
  const position = editor.getPosition()
  const line = editor.getModel().getLineContent(position.lineNumber)
  const before = line.slice(0, position.column - 1).trim().length > 0 ? '\n\n' : ''
  const after = line.slice(position.column - 1).trim().length > 0 ? '\n\n' : '\n'
  insertAtCursor({ content: `${before}${markdown}${after}` })
}

function insertTable() {
  siteStore.$patch({
    overlay: 'TableEditor'
  })
}

/**
 * The table the overlay built, at the cursor.
 *
 * Kept on its own line: a table only parses as one when its first row starts a line, so inserting into
 * the middle of a sentence has to break out of it. The blank line after is what separates it from
 * whatever the cursor was sitting in front of.
 */
function insertTableClb(markdown) {
  const position = editor.getPosition()
  const line = editor.getModel().getLineContent(position.lineNumber)
  const before = line.slice(0, position.column - 1).trim().length > 0 ? '\n\n' : ''
  const after = line.slice(position.column - 1).trim().length > 0 ? '\n\n' : '\n'
  insertAtCursor({ content: `${before}${markdown}${after}` })
}

/**
 * Insert a link, from the shared picker.
 *
 * Whatever is selected becomes the link's text, so marking a phrase and pressing the button reads as
 * "make this a link". With nothing selected the picker's own answer supplies it: the title of the page
 * that was chosen, or the URL itself, which is at least something to type over.
 *
 * `{target="_blank"}` is markdown-it-attrs syntax, and `target` is one of the three attributes the
 * stored render is allowed to keep — see `renderers/markdown.js` and `models/rendering.ts`.
 */
/**
 * The number to give the next footnote.
 *
 * Markdown numbers footnotes in the order they are referenced, not by their labels, so these are
 * names rather than positions — but an author reading the source expects them to count up, and two
 * notes sharing a name would collapse into one. Anything the author named themselves is left alone
 * and simply counted past.
 */
function nextFootnoteLabel(text) {
  let highest = 0
  for (const [, label] of text.matchAll(/\[\^([^\]\s]+)\]/g)) {
    if (/^\d+$/.test(label)) {
      highest = Math.max(highest, Number.parseInt(label, 10))
    }
  }
  return String(highest + 1)
}

/**
 * A footnote: the marker where the cursor is, and the note itself at the foot of the source.
 *
 * Both halves in one edit, because either alone is broken — a marker with no note renders as literal
 * text, and a note nothing refers to renders as nothing at all. The cursor ends on the note, since
 * writing it is what the author was about to do; the marker is already where they left it.
 */
function insertFootnote() {
  const model = editor.getModel()
  const label = nextFootnoteLabel(model.getValue())
  const cursor = editor.getPosition()
  const lastLine = model.getLineCount()
  const lastLineLength = model.getLineContent(lastLine).length
  // -> On a line of its own at the end, one blank line clear of whatever the page ends with
  const lead = lastLineLength > 0 ? `\n\n` : ``

  editor.executeEdits('', [
    {
      range: new Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
      text: `[^${label}]`,
      forceMoveMarkers: true
    },
    {
      range: new Range(lastLine, lastLineLength + 1, lastLine, lastLineLength + 1),
      text: `${lead}[^${label}]: `,
      forceMoveMarkers: true
    }
  ])

  const noteLine = model.getLineCount()
  editor.setPosition({ lineNumber: noteLine, column: model.getLineContent(noteLine).length + 1 })
  editor.revealLineInCenterIfOutsideViewport(noteLine)
  editor.focus()
}

function insertLink() {
  dialog({ component: LinkPickerDialog }).onOk(({ href, openInNewTab, title }) => {
    const selection = editor.getSelection()
    const selected = editor.getModel().getValueInRange(selection)
    const label = selected || title || href
    const attributes = openInNewTab ? '{target="_blank"}' : ''
    /*
      One edit for both cases: a selection is replaced, and an empty selection -- which is all a bare
      cursor is -- inserts. `insertAtCursor` cannot do the first, since it builds its own empty range.
    */
    editor.executeEdits('', [
      {
        range: selection,
        text: `[${label}](${href})${attributes}`,
        forceMoveMarkers: true
      }
    ])
    editor.focus()
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
 *
 * `before` is a line of its own, put above the first of them — the `> [!NOTE]` that opens an
 * admonition. It rides along in that line's own edit rather than as an insertion of its own, so no
 * two edits in the batch start at the same position.
 */
function insertBeforeEachLine({ content, before, focus = true }) {
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
      const opening = before && line === lines[0] ? `${before}\n` : ''
      edits.push({
        range: new Range(line, 1, line, lineLength + 1),
        text: `${opening}${content}${lineContent}`,
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

/**
 * Take files the author brought in — pasted or dropped — and write markdown for them at the cursor.
 *
 * Nothing is uploaded here. Each one becomes a pending asset held against a `blob:` URL that the
 * markdown points at, and `UploadPendingAssetsDialog` sends them on save and rewrites those URLs to
 * wherever they actually landed. So the editor shows the image immediately and the page never stores a
 * blob URL.
 *
 * An image goes in as one, anything else as a link with its file name for text — a dropped PDF is a
 * link to a PDF, not a broken picture. The name is the image's alt text as well, which is both what the
 * handler this replaces did and better than nothing for a reader who cannot see it.
 */
function insertFilesAsAssets(files) {
  const markup = files.map((file) => {
    const blobUrl = editorStore.addPendingAsset(file)
    return `${file.type.startsWith('image/') ? '!' : ''}[${file.name}](${blobUrl})`
  })
  // -> One per line: two images on the same line is rarely what was meant by dropping two files
  insertAtCursor({ content: markup.join('\n') })
}

/** Whether a paste or drop is carrying files, as opposed to text. */
function hasFiles(transfer) {
  return (transfer?.files?.length ?? 0) > 0
}

/*
  Pasting a file inserts it; pasting anything else is left alone.

  Text wins when both are on the clipboard. Copying from a spreadsheet or a design tool puts a bitmap
  there ALONGSIDE the text, and an editor that answered those pastes with a screenshot would be
  infuriating -- so the image is only taken when there is no text to prefer.
*/
function onEditorPaste(event) {
  if (!hasFiles(event.clipboardData)) {
    return
  }
  if ((event.clipboardData.getData('text/plain') ?? '').trim().length > 0) {
    return
  }
  /*
    Taken over completely. `stopPropagation` as well as `preventDefault`, because this runs in capture
    ABOVE the editor: letting it travel on would hand the same files to Monaco's paste-as feature, which
    would answer the paste a second time in its own way.
  */
  event.preventDefault()
  event.stopPropagation()
  insertFilesAsAssets([...event.clipboardData.files])
}

/*
  A drop has to be claimed twice: `dragover` is what tells the browser this is a valid target -- without
  it there is no drop at all, just the browser navigating away to the file -- and `drop` is where it
  arrives.
*/
function onEditorDragOver(event) {
  if (!hasFiles(event.dataTransfer) && !(event.dataTransfer?.types ?? []).includes('Files')) {
    return
  }
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function onEditorDrop(event) {
  if (!hasFiles(event.dataTransfer)) {
    return
  }
  event.preventDefault()
  // -> Dropped text lands where it was dropped, and so should a file: the cursor moves to meet it
  const target = editor.getTargetAtClientPoint(event.clientX, event.clientY)
  if (target?.position) {
    editor.setPosition(target.position)
  }
  insertFilesAsAssets([...event.dataTransfer.files])
}

/**
 * Rewrite text that was already in the editor — the blob URLs of pending assets, once the upload has
 * given them real paths.
 *
 * Done as targeted edits rather than by putting the whole page back with `setValue`. Replacing the
 * model wholesale reads as "everything was deleted and everything was typed again", which throws away
 * the undo history and the caret, and in a collaborative session would land on everyone else as
 * exactly that — their own unsaved sentences deleted and retyped by someone who only uploaded an
 * image.
 */
function reloadEditorContent({ replacements = [] } = {}) {
  const model = editor.getModel()
  const edits = []
  for (const { from, to } of replacements) {
    // -> Literal, case-sensitive, whole-string matching: these are URLs, not patterns
    for (const match of model.findMatches(from, false, false, true, null, false)) {
      edits.push({ range: match.range, text: to })
    }
  }
  if (edits.length > 0) {
    editor.executeEdits('assets', edits)
  }
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

  /*
    Files arriving by paste or by drop.

    Paste is CAPTURED on the element above the editor, and that is the whole trick. Monaco's own
    paste-as feature (`CopyPasteController`) listens in the capture phase on the editor's container and
    calls `stopImmediatePropagation()` for every paste it claims -- which includes any paste carrying
    files. A listener on that container or below it, in either phase, is simply never reached. Capture
    runs outside-in, so one level up goes first and can decide before Monaco sees it.

    The drop half replaces a listener that could not fire either, for a different reason: without
    `dragover` claiming the target, the browser treats a file dropped on a page as a navigation and
    opens it, and the drop event never reaches anything here.
  */
  pasteCaptureNode = monacoRef.value.parentElement ?? monacoRef.value
  pasteCaptureNode.addEventListener('paste', onEditorPaste, true)
  monacoRef.value.addEventListener('dragover', onEditorDragOver)
  monacoRef.value.addEventListener('drop', onEditorDrop)

  // -> Live collaboration

  if (collabEnabled.value) {
    /*
      Read-only until the shared document has arrived, and only that first time.

      The binding below starts by making the editor say what the document says, so anything typed
      before it exists is about to be overwritten -- by an empty document, if the sync has not landed
      yet. The session gives up after a few seconds (a proxy that does not forward websocket upgrades
      is the usual reason) and the editor is released as an ordinary one, so this cannot strand an
      author in a page they are unable to type in.
    */
    editor.updateOptions({ readOnly: true })
    startCollabSession({ siteId: siteStore.id, pageId: pageStore.id })

    watch(
      () => collabStore.status,
      (status) => {
        if (status === 'connected') {
          bindCollabEditor(editor)
        }
        if (status !== 'connecting') {
          editor.updateOptions({ readOnly: false })
        }
        if (status === 'denied') {
          notify({
            type: 'warning',
            message: t('editor.collab.notAllowed')
          })
        }
      }
    )

    /*
      Somebody else saved the page. The editor state has already been put back to "nothing pending" by
      the session -- this is only so that the author is told why their Save button went quiet.
    */
    watch(
      () => collabStore.lastSave,
      (lastSave) => {
        if (lastSave && lastSave.authorId !== userStore.id) {
          notify({
            type: 'positive',
            message: t('editor.collab.savedBy', { name: lastSave.authorName })
          })
        }
      }
    )
  }

  // -> Post init

  editor.focus()

  nextTick(() => {
    processContent(pageStore.content)
  })

  EVENT_BUS.on('insertAsset', insertAssetClb)
  EVENT_BUS.on('insertTable', insertTableClb)
  EVENT_BUS.on('insertBlock', insertBlockClb)
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
  EVENT_BUS.off('insertTable', insertTableClb)
  EVENT_BUS.off('insertBlock', insertBlockClb)
  EVENT_BUS.off('openEditorSettings', openEditorSettings)
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  pasteCaptureNode?.removeEventListener('paste', onEditorPaste, true)
  monacoRef.value?.removeEventListener('dragover', onEditorDragOver)
  monacoRef.value?.removeEventListener('drop', onEditorDrop)
  // -> Before the editor goes: the binding is holding the model, and leaving the room is what takes
  //    this author's avatar out of everyone else's header
  stopCollabSession()
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
