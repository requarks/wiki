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
        <w-btn icon="mdi:format-list-group-plus" padding="sm sm" flat @click="insertDefinitionList">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertDefinitionList')
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
        <!-- -> Icons only: what goes in is a `:mdi:home:` shortcode, and the picker's other tab hands
                back an `img:` URL, which is not something that syntax can say -->
        <w-btn icon="mdi:seed-plus-outline" padding="sm sm" flat>
          <w-menu anchor="top right" self="top left" content-class="shadow-7">
            <icon-picker-dialog no-image @update:model-value="insertIcon" />
          </w-menu>
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertIcon')
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
          <w-btn
            icon="mdi:format-color-highlight"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `==` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.highlight')
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
          <w-btn icon="mdi:format-quote-close" padding="xs sm" flat>
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
          <!-- -> The only way back once the preview is closed: its own toggle goes with it -->
          <template v-if="!state.previewShown">
            <w-space />
            <w-btn
              icon="mdi:view-split-vertical"
              padding="xs sm"
              flat
              @click="state.previewShown = true">
              <w-tooltip anchor="top middle" self="bottom middle">{{
                t('editor.togglePreviewPane')
              }}</w-tooltip>
            </w-btn>
          </template>
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
  defineAsyncComponent,
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
import { useMinWidth } from '@/composables/screen'
import { isVisible } from '@/helpers/anchors'
import { assetPath } from '@/helpers/assets'
import { blockMarkdown } from '@/helpers/blocks'
import { blockOpeningLine, blockValues, findBlocks } from '@/helpers/markdownBlocks'
import { findEditableTables } from '@/helpers/markdownTable'

import EditorCodeBlockMenu from '@/components/EditorCodeBlockMenu.vue'
import EditorEmojiMenu from '@/components/EditorEmojiMenu.vue'
import IconPickerDialog from '@/components/IconPickerDialog.vue'
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
/** The "Edit Table" lens provider, which is registered against the language rather than this editor. */
let tableLensProvider = null
/** The "Edit Block Parameters" lens provider, registered the same way. */
let blockLensProvider = null
/**
 * The blocks this site has, as the API describes them — their props included.
 *
 * Read once with the list of disabled ones, since it is the same request. What the lens needs from it
 * is the props: a block whose definition is not here is one this editor cannot offer a form for.
 */
let siteBlocks = []
const monacoRef = ref(null)
const editorPreviewContainerRef = ref(null)

/**
 * Blocks this site has switched off, as the tags they are written as.
 *
 * The preview fetches a component for every element it does not recognise, so a disabled block would
 * draw here and then disappear the moment the page was saved — the server strips one that is not
 * enabled out of the render. Naming them lets the preview leave the element undefined, which is what
 * the saved page comes back as: the block gone, the content the author wrote inside it still there.
 *
 * Only what the site lists as off. A tag that is not in the list at all is a child block, which has no
 * switch of its own, or an unknown one — this decides nothing about either.
 */
const disabledBlockTags = ref(new Set())

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

/*
  How the preview follows the caret: the line being edited is put a SHORT WAY down the pane.

  Not at its top, which is what this replaces. The top is exact, and that is the problem with it -- it
  scrolls away everything written just above the caret, which is the paragraph the next one is being
  written against, so the author is left editing at the edge of a pane with no context on one side of
  it. Expressed as a fraction of the pane rather than a fixed inset so that a preview half the height
  gives up half as much of itself to the lines already written.

  `nearest` is not the answer either, at any offset: it leaves a line alone as long as it is visible
  anywhere, so a line sitting on the last row of the pane stays there, with what is being written pinned
  to the bottom edge and nothing after it in view. The position is computed and applied on every caret
  move, and costs nothing when the caret stays put -- the arithmetic lands on the offset the pane is
  already scrolled to and nothing moves. What used to make this thrash was the pane losing its scroll
  position to the re-render -- see `processContent` -- and animating up from the top of the document each
  time, not the alignment asked for here.

  Scrolling the container rather than asking an element to bring itself into view also means a wide block
  -- a table, a diagram -- is never scrolled sideways as a side effect of following the caret down the
  page.
*/
const PREVIEW_CONTEXT_ABOVE = 0.2

/**
 * Whether the window is wide enough to open the preview beside the source.
 *
 * 1024 is the app's `md` breakpoint (`css/tailwind.css`). Below it the two panes are half a small window
 * each, and the source is the one being typed into — so the preview starts closed and is opened when
 * wanted, from the toolbar button that takes its place.
 */
const isAtLeastMd = useMinWidth(1024)

const state = reactive({
  /*
    Read once, as a DEFAULT rather than a binding: past this first value the pane is the author's to open
    and close, and a bound one would slam it shut the moment a window was dragged narrower mid-edit.
  */
  previewShown: isAtLeastMd.value,
  previewScrollSync: true
})

// METHODS

function insertAssets() {
  siteStore.openFileManager({ insertMode: true })
}

/**
 * What the file manager handed back, as markdown at the cursor.
 *
 * Both kinds go in as paths from the site root: a file through `assetPath`, which is where the
 * reasoning about that form lives, and a page the way the link picker writes one.
 *
 * An image goes in as one and anything else as a link -- a PDF picked from the file manager is a link
 * to a PDF, not a broken picture -- which is the same distinction `insertFilesAsAssets` draws for a
 * file that arrives by drop.
 */
function insertAssetClb(opts) {
  let content = ''
  switch (opts.type) {
    case 'asset': {
      const isImage = opts.mimeType?.startsWith('image/')
      content = `${isImage ? '!' : ''}[${opts.title}](${assetPath(opts.folderPath, opts.fileName)})`
      break
    }
    case 'page': {
      const pagePath = opts.folderPath ? `${opts.folderPath}/${opts.fileName}` : opts.fileName
      content = `[${opts.title}](/${pagePath})`
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

/**
 * The picked icon, as the shortcode that draws it — `mdi:home` in, `:mdi:home:` out.
 *
 * The same delimiters an emoji uses, and the same insertion: the two are one syntax as far as the
 * source is concerned, told apart by the colon inside the reference. See `renderers/markdown.js`.
 */
function insertIcon(reference) {
  if (reference) {
    insertAtCursor({ content: `:${reference}:` })
  }
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
    const markdown = blockMarkdown(tabs)
    selectFirstTabLabel(markdown, insertBlockClb(markdown))
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
  /*
    Where the markup itself begins, for a caller that wants to put the cursor inside what it just
    inserted. Two lines below the cursor when it had to break out of a sentence first; otherwise on
    the cursor's own line, starting at the cursor's own column — which is column 1 only if nothing at
    all, indentation included, came before it.
  */
  return {
    lineNumber: position.lineNumber + (before ? 2 : 0),
    column: before ? 1 : position.column
  }
}

/**
 * Select the first tab's label in a tabset that has just been inserted.
 *
 * The tabset arrives with two tabs called "First tab" and "Second tab" (the block's own starter body,
 * see `block-tabs`), and naming them is the first thing anybody does — so the first of those is left
 * selected, to be typed over rather than hunted down and cleaned up.
 *
 * Located in the markup rather than in the document: the string is what this function was handed and
 * knows the shape of, whereas searching the model would find whichever copy came first — a page may
 * already hold a tabset whose first tab is still called "First tab". `d` is what makes the match
 * report where the label VALUE sits rather than where `label="…"` starts.
 *
 * Does nothing for a starter body with no label in it, which is a block template's to decide.
 */
function selectFirstTabLabel(markdown, start) {
  const match = markdown.match(/label="([^"]*)"/d)
  if (!match) {
    return
  }
  const [from, to] = match.indices[1]
  const lines = markdown.slice(0, from).split('\n')
  const lineNumber = start.lineNumber + lines.length - 1
  // -> Only the first line of the insert begins at the cursor's column; every later one begins at 1
  const column = (lines.length > 1 ? 1 : start.column) + lines.at(-1).length
  editor.setSelection(new Range(lineNumber, column, lineNumber, column + (to - from)))
  editor.revealLineInCenterIfOutsideViewport(lineNumber)
}

function insertTable() {
  siteStore.$patch({
    overlay: 'TableEditor',
    overlayOpts: {}
  })
}

/**
 * The same overlay, over a table already in the page — what the "Edit Table" lens above one does.
 *
 * The lens carries only the line it was drawn on, and the table is looked up again here rather than
 * taken from the lens: a lens is provided once and then moves with the text, so its argument is a line
 * number from whenever the document last settled. Reading the table back out of the model at the moment
 * of the click is what keeps the range and the source it hands over describing the same thing.
 */
function editTable(line) {
  const tables = findEditableTables(editor.getModel().getValue())
  const table = tables.find((entry) => entry.startLine <= line && line <= entry.endLine)
  if (!table) {
    return
  }
  siteStore.$patch({
    overlay: 'TableEditor',
    overlayOpts: {
      source: table.source,
      startLine: table.startLine,
      endLine: table.endLine
    }
  })
}

/** The block as this site describes it, or undefined for one it does not list. */
function blockDefinition(name) {
  return siteBlocks.find((block) => block.block === name)
}

/**
 * The parameters dialog, over a block already in the page — what the lens above one opens.
 *
 * The block is looked up again here rather than taken from the lens, for the reason `editTable` gives:
 * a lens is provided once and then moves with the text, so the line it carries is from whenever the
 * document last settled. The name it was drawn for is carried along and has to match too — where a
 * table spans lines and can be found by containment, a block's opening line is a single line, and an
 * edit above it would otherwise put a form for one block over another.
 */
function editBlock(line, name) {
  const found = findBlocks(editor.getModel().getValue()).find(
    (entry) => entry.line === line && entry.block === name
  )
  const definition = found && blockDefinition(found.block)
  if (!definition) {
    return
  }
  dialog({
    component: defineAsyncComponent(() => import('./BlockParamsDialog.vue')),
    componentProps: { definition, values: blockValues(found, definition) }
  }).onOk((values) => {
    /*
      The opening line and nothing else, so the body between the fences is left exactly as it was —
      which for a tabset is every tab in it. One undo takes the whole change back, and the caret lands
      on the line that moved rather than wherever it was before the dialog opened.
    */
    const model = editor.getModel()
    editor.executeEdits('block', [
      {
        range: new Range(found.line, 1, found.line, model.getLineMaxColumn(found.line)),
        text: blockOpeningLine(found, definition, values)
      }
    ])
    editor.setPosition(new Position(found.line, 1))
    editor.focus()
  })
}

/**
 * The table the overlay built: over the lines it was read from, or at the cursor when it is a new one.
 *
 * A new table is kept on its own line — a table only parses as one when its first row starts a line, so
 * inserting into the middle of a sentence has to break out of it, and the blank line after is what
 * separates it from whatever the cursor was sitting in front of.
 *
 * An edited one replaces exactly the lines it occupied, so nothing around it moves and one undo takes
 * the whole table back. The cursor lands at the top of it rather than staying wherever it was, which may
 * be inside the text that was just replaced.
 */
function insertTableClb({ markdown, replace = null }) {
  const model = editor.getModel()
  if (replace) {
    editor.executeEdits('table', [
      {
        range: new Range(
          replace.startLine,
          1,
          replace.endLine,
          model.getLineMaxColumn(replace.endLine)
        ),
        text: markdown
      }
    ])
    editor.setPosition(new Position(replace.startLine, 1))
    editor.focus()
    return
  }
  const position = editor.getPosition()
  const line = model.getLineContent(position.lineNumber)
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
 * A definition list skeleton, on lines of its own.
 *
 * Two entries rather than one, because the blank line BETWEEN them is the part of the notation nobody
 * guesses: a term is only a term when the next line starts with `: `, and two entries with no blank
 * line between them collapse into one term with two definitions.
 *
 * Placeholder words rather than empty lines for a related reason — an empty term and an empty
 * definition render as nothing at all, so the button would look like it had done nothing — and the
 * first of them is left selected, so the skeleton is typed over rather than cleaned up.
 */
function insertDefinitionList() {
  const term = t('editor.markup.definitionListTerm')
  const definition = t('editor.markup.definitionListDefinition')
  const skeleton = `${term}\n: ${definition}\n\n${term}\n: ${definition}`

  const model = editor.getModel()
  const position = editor.getPosition()
  const line = model.getLineContent(position.lineNumber)
  // -> A term has to start its own line, so a cursor mid-sentence breaks out of it first — the same
  //    rule the table and the blocks follow
  const before = line.slice(0, position.column - 1).trim().length > 0 ? '\n\n' : ''
  const after = line.slice(position.column - 1).trim().length > 0 ? '\n\n' : '\n'
  insertAtCursor({ content: `${before}${skeleton}${after}` })

  const firstTermLine = position.lineNumber + (before ? 2 : 0)
  editor.setSelection(new Range(firstTermLine, 1, firstTermLine, term.length + 1))
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

/**
 * Read the blocks this site has, once, before the first preview is drawn.
 *
 * Order matters more than it looks: a component only has to be fetched once to be defined for the
 * rest of the session, so a list that arrives after the first render is too late to keep a disabled
 * block from drawing. The lens over a block wants the same list a moment later, and asking twice for
 * it would be asking the same question twice.
 */
async function loadSiteBlocks() {
  try {
    siteBlocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
    disabledBlockTags.value = new Set(
      siteBlocks.filter((block) => !block.isEnabled).map((block) => `block-${block.block}`)
    )
  } catch (err) {
    /*
      Left empty, which draws everything as it did before. The preview being too generous is the
      better failure: the server strips a disabled block on save either way, so the cost is a preview
      that flatters the page, against hiding blocks the site really does have. The lens is the other
      way round — with no definitions to build a form from, it simply does not appear.
    */
    console.warn(`Could not read which blocks this site has enabled: ${err.message}`)
  }
}

/**
 * Say why a block is sitting there doing nothing.
 *
 * A disabled block is left undefined, so it draws as its own contents and otherwise says nothing —
 * which reads as a block that is broken rather than one that is switched off. The notice names the
 * reason and what saving will do about it; what the author wrote stays underneath, because that is
 * what the saved page keeps once the server has stripped the element.
 *
 * Written into the preview's DOM rather than into the render, which is deliberate: `pageStore.render`
 * is what `pageSave` sends, and a notice added to it would be a notice saved into the page. The
 * preview is rebuilt from that string on every keystroke, so this is re-applied each time and nothing
 * has to be cleaned up — the same footing `enhanceRenderedContent` works on.
 */
function markDisabledBlock(el) {
  if (el.dataset.blockDisabled !== undefined) {
    return
  }
  el.dataset.blockDisabled = ''
  const notice = document.createElement('p')
  notice.className = 'block-disabled-notice'
  notice.textContent = t('editor.blockNotEnabled')
  el.prepend(notice)
}

/**
 * Open the tabset panel the caret is in, and every panel that one sits inside.
 *
 * Which is the useful answer, and a different question from "which panel was open before": an author
 * writing inside the second panel of a tabset is telling us plainly which one they are looking at. The
 * source line is matched against the panel ranges of the same parse that built the preview -- see
 * `getTabsAtLine` -- and each panel is opened through its block's own `active` property.
 *
 * Silent about everything it does not find: a caret outside every tabset leaves them all as they were,
 * and so does a render that has not landed yet.
 *
 * @returns A promise settling once the blocks have drawn the panels. A block applies which panel is
 *          open on its own update, so a caller about to scroll to something inside one has to wait:
 *          until then the panel is still `display: none` and there is no box to scroll to.
 */
function syncPreviewTabs() {
  const container = editorPreviewContainerRef.value
  if (!container) {
    return Promise.resolve()
  }
  const tabsets = container.querySelectorAll('block-tabs')
  const drawn = []
  for (const at of md.getTabsAtLine(editor.getPosition().lineNumber)) {
    const tabset = tabsets[at.tabset]
    if (tabset) {
      tabset.active = at.tab
      // -> Absent until the component has been fetched and the element upgraded; setting `active` on
      //    one that has not been is still worth doing, and is why `processContent` asks again later
      drawn.push(tabset.updateComplete ?? Promise.resolve())
    }
  }
  return Promise.all(drawn)
}

/**
 * The element in the preview to scroll to for a source line.
 *
 * Read off the DOM rather than from a map collected during the render, because what matters is what
 * was actually drawn and where it ended up: a token can be parsed and then not rendered (a tight
 * list's paragraphs), and a footnote's definition is rendered at the foot of the page rather than on
 * the line it was written on. Lines are compared as numbers for the same reason -- the greatest line
 * at or before the caret, wherever in the page its element happens to sit.
 *
 * Two things narrow the search, and both are about tabs:
 *
 * - **Scoped to the panel the line is in**, where it is in one. Every panel of a tabset covers the
 *   same lines of the preview, and the panels that are closed hold most of the page's lines -- so a
 *   search across the whole preview would answer a line inside a panel with an element outside the
 *   tabset entirely, and scrolling there is what took the author away from what they were writing.
 * - **Only what has a box.** A closed panel's content is stamped with its lines like everything else
 *   and cannot be scrolled to; picking it would mean scrolling nowhere at all, having passed over the
 *   element that could have been reached.
 *
 * The panel itself stands in when nothing inside it carries a line -- a lone paragraph, a table, a
 * list -- which puts the top of the tabset in view, and is as close as there is to get.
 */
function previewAnchorFor(container, line) {
  // -> The last of the chain is the panel the line is written in; the ones before it are its ancestors,
  //    which `syncPreviewTabs` has already opened
  const at = md.getTabsAtLine(line).at(-1)
  const tabset = at ? container.querySelectorAll('block-tabs')[at.tabset] : null
  const panel = tabset?.querySelectorAll(':scope > block-tab')[at.tab] ?? null

  let best = null
  let bestLine = 0
  for (const el of (panel ?? container).querySelectorAll('[data-line]')) {
    const elLine = Number(el.dataset.line)
    // -> Strictly greater, so that of two elements starting on the same line -- a blockquote and the
    //    paragraph opening it -- the outer one wins, which is the one whose top is the section's top
    if (elLine <= line && elLine > bestLine && isVisible(el)) {
      best = el
      bestLine = elLine
    }
  }
  return best ?? panel
}

/**
 * Scroll the preview so that `el` sits `PREVIEW_CONTEXT_ABOVE` of the way down the pane.
 *
 * Measured through `getBoundingClientRect` rather than `offsetTop`, because what is wanted is the
 * distance to the SCROLL container and `offsetTop` answers to the nearest positioned ancestor -- which
 * inside rendered page content is whatever a block happened to put around it.
 *
 * A negative result is clamped by `scrollTo`, so an anchor near the top of the document puts the
 * document's own top in view rather than leaving a gap above it.
 */
function scrollPreviewTo(container, el) {
  const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTo({
    top: container.scrollTop + offset - container.clientHeight * PREVIEW_CONTEXT_ABOVE,
    behavior: 'smooth'
  })
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
    // -> The page's own path, because a relative image in the source is relative to the folder it
    //    sits in -- and it is being edited, so it is whatever the path field says right now
    html = md.render(newContent, { pagePath: pageStore.path })
  } catch (err) {
    console.error(err)
    notify({
      type: 'negative',
      message: t('editor.renderFailed'),
      caption: err.message
    })
    return
  }

  const container = editorPreviewContainerRef.value
  /*
    Two things about the preview have to survive the patch, because `v-html` does not patch anything --
    it throws every child away and builds them again, on every keystroke.

    Where the reader had scrolled to is the first. An emptied box has nowhere to be scrolled to, so its
    `scrollTop` is clamped to zero; the cursor handler then animated back down from the top of the
    document to the line being typed, over and over, which is what made the preview appear to fly about
    while typing in a long page.

    Which tab is open is the second. A block is a custom element with state of its own, and a rebuilt one
    starts again from its defaults -- so typing in the second panel of a tabset kept throwing the author
    back to the first. Carried across by position: the source order of the blocks is what survives an
    edit, not the elements. See `active` in `blocks/block-tabs`.
  */
  const scrollTop = container?.scrollTop ?? 0
  const openTabs = [...(container?.querySelectorAll('block-tabs') ?? [])].map(
    (el) => el.active ?? 0
  )

  pageStore.$patch({
    render: html
  })
  nextTick(async () => {
    // -> With the preview pane closed there is no DOM to attend to. The render is stored either way, so
    //    the store still holds what a save would send
    if (!container) {
      return
    }
    const tabsets = [...container.querySelectorAll('block-tabs')]
    for (const [index, el] of tabsets.entries()) {
      // -> Left alone when it is the default anyway, so nothing is set on a block that never had a state
      if (openTabs[index]) {
        el.active = openTabs[index]
      }
    }
    // -> After the carry-across, so that the tabset being written in wins over what it had open before
    syncPreviewTabs()
    /*
      The panels have to be settled BEFORE the position goes back, and that means waiting for them: a
      block applies its open panel on its own update, a microtask later.

      Restoring first is restoring against a layout that is about to change, and the change is the height
      of a whole panel. With a rebuilt tabset showing its first panel, a position inside a taller one is
      past the end of a shorter document, so the browser clamps it -- and then scroll anchoring hands back
      a different position again as the real panel opens. Measured at 800px of drift on a short-first,
      tall-second tabset, which the caret sync then animated back from on every keystroke.
    */
    await Promise.all(tabsets.map((el) => el.updateComplete ?? Promise.resolve()))
    container.scrollTop = scrollTop
    const pendingTags = new Set()
    for (const block of container.querySelectorAll(':not(:defined)')) {
      const tag = block.tagName.toLowerCase()
      // -> Left undefined on purpose, so the preview shows what saving is about to leave behind
      if (disabledBlockTags.value.has(tag)) {
        markDisabledBlock(block)
        continue
      }
      pendingTags.add(tag)
    }
    if (pendingTags.size > 0) {
      /*
        Asked again once the definitions land. A block that has not been upgraded yet is a plain unknown
        element: setting `active` on it puts a value somewhere Lit will pick up, but nothing has read the
        panels or hidden any of them, so the tab the author is in is only actually opened here -- on the
        first render of a page whose blocks are being fetched for the first time.
      */
      commonStore.loadBlocks([...pendingTags]).then(syncPreviewTabs)
    }
    // -> The render was just replaced, so the copy buttons went with it
    enhanceRenderedContent(container)
  })
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
 *
 * Except while suggesting an edit, where files are refused outright. A pending asset is uploaded when
 * the page is SAVED, and submitting a suggestion is not a save — nothing would ever send these, so the
 * markdown would keep a `blob:` URL that dies with the tab. Nor is that only plumbing: somebody
 * suggesting an edit is by definition somebody without write access to this page, and filing their
 * files into the wiki beside it is not a decision this flow gets to make. Carrying an attachment on a
 * suggestion is a feature, and until there is one, the refusal is said out loud — the paste has already
 * been taken off the browser by the time this runs, so a silent return is a paste that vanished.
 */
function insertFilesAsAssets(files) {
  if (editorStore.mode === 'suggest') {
    notify({
      type: 'warning',
      message: t('editor.pendingAssetsNotInSuggestions')
    })
    return
  }
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
 * The editor's model onto the page store: the source a save sends, and the render made from it.
 *
 * Debounced because it renders the whole document on every keystroke, and NAMED so that it can also be
 * flushed — see `reloadEditorContent`, which needs it to have happened before it returns rather than
 * half a second later.
 */
const syncContentToStore = debounce(() => {
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
    /*
      And the store follows the model NOW, rather than when the debounce would have got to it.

      This runs from `UploadPendingAssetsDialog`, immediately before the page is saved. Left to the
      timer, the sync would land after that save -- so the page would go up with a render still full of
      `blob:` URLs, and then be marked dirty half a second later by the very edit that fixed it,
      needing a second save to publish. Flushing here is what makes one save enough.
    */
    syncContentToStore.flush()
  }
}

// MOUNTED

onMounted(async () => {
  // -> Setup Editor View
  editorStore.$patch({
    hideSideNav: true
  })

  // -> Awaited here so it is settled well before the first preview render at the end of this hook
  await loadSiteBlocks()

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

  /*
    "Edit Table" over every table in the page, which opens the table editor on that table.

    A code lens rather than a context-menu action: the offer has to be visible to be found, and a table
    in markdown source is exactly the thing an author does not want to edit by hand. It appears only over
    the tables the overlay can actually hold -- `findEditableTables` says which -- because offering it
    over a table with a multi-line cell or a rowspan would be offering to flatten it.

    The command is registered on this editor rather than globally (`monaco.editor.registerCommand`),
    which is what gives `editor.addCommand` an id to hand the lens. The PROVIDER is per-language and
    process-wide, so it has to be disposed with the component or a second visit to the editor would draw
    every lens twice.
  */
  const editTableCommand = editor.addCommand(0, (_accessor, line) => editTable(line))
  tableLensProvider = monaco.languages.registerCodeLensProvider('markdown', {
    provideCodeLenses(model) {
      return {
        lenses: findEditableTables(model.getValue()).map((table) => ({
          range: new Range(table.startLine, 1, table.startLine, 1),
          command: {
            id: editTableCommand,
            title: t('editor.markup.editTable'),
            arguments: [table.startLine]
          }
        })),
        dispose() {}
      }
    }
  })

  /*
    "Edit Block Parameters" over every block in the page, for the same reason the table has one: what
    a block was given is a list of quoted attributes on one line, which is a poor thing to edit by
    hand and an easy thing to offer a form for.

    It appears only over a block this editor holds a definition for and that has something to fill in.
    A child block -- a `::block-tab` inside a tabset -- is one it never does: those are left out of
    the list the API answers with, having no switch of their own to be listed against.
  */
  const editBlockCommand = editor.addCommand(0, (_accessor, line, block) => editBlock(line, block))
  blockLensProvider = monaco.languages.registerCodeLensProvider('markdown', {
    provideCodeLenses(model) {
      return {
        lenses: findBlocks(model.getValue())
          .filter((found) => blockDefinition(found.block)?.props?.length > 0)
          .map((found) => ({
            range: new Range(found.line, 1, found.line, 1),
            command: {
              id: editBlockCommand,
              title: t('editor.markup.editBlock'),
              arguments: [found.line, found.block]
            }
          })),
        dispose() {}
      }
    }
  })

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

  /*
    Ctrl/Cmd+S, asking for the header's Save button rather than saving anything itself. What that
    button does is the header's to know -- which of the three it currently is, whether the
    reason-for-change dialog has to be answered first, and that it is disabled with nothing pending --
    so the shortcut goes through the event bus instead of reaching for `pageSave` and getting a
    different save from the one on screen.

    A Monaco action rather than a listener because that is what stops the browser offering to save the
    page as a file: Monaco takes the keystroke off the event once a keybinding resolves. It has been
    registered here, doing nothing, for exactly that reason.
  */
  editor.addAction({
    id: 'save',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    label: 'Save',
    precondition: '',
    run(ed) {
      EVENT_BUS.emit('savePage')
    }
  })

  // -> Handle content change
  editor.onDidChangeModelContent(syncContentToStore)

  // -> Handle cursor movement
  editor.onDidChangeCursorPosition(
    debounce(async (ev) => {
      if (!state.previewScrollSync || !state.previewShown) {
        return
      }
      /*
        Moving the caret into another panel opens it, the same as typing in one does -- and is AWAITED,
        because until the block has drawn it the panel is still `display: none`, and everything below
        aims at an element inside it. Scrolling to something with no box does nothing whatsoever, which
        is what made the sync appear to ignore a caret inside a tab that was not already open.
      */
      await syncPreviewTabs()
      // -> Read again rather than reused from before the await: the caret is where it is now
      const currentLine = editor.getPosition().lineNumber
      const container = editorPreviewContainerRef.value
      if (!container) {
        return
      }
      if (currentLine < 3) {
        container.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      const anchor = previewAnchorFor(container, currentLine)
      if (anchor) {
        scrollPreviewTo(container, anchor)
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
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  pasteCaptureNode?.removeEventListener('paste', onEditorPaste, true)
  monacoRef.value?.removeEventListener('dragover', onEditorDragOver)
  monacoRef.value?.removeEventListener('drop', onEditorDrop)
  // -> Registered against the markdown language, not this editor, so nothing else takes it down
  tableLensProvider?.dispose()
  blockLensProvider?.dispose()
  // -> Before the editor goes: the binding is holding the model, and leaving the room is what takes
  //    this author's avatar out of everyone else's header
  stopCollabSession()
  /*
    Anything pasted but never uploaded goes with the session that held it. This hook is where an
    editing session ends, whichever way it ended -- discarded, closed, submitted as a suggestion, or
    walked away from by following a link -- because the editor is mounted exactly while
    `editorStore.isActive` holds (see `pages/Index.vue`). A save has already emptied this by the time
    it gets here: the upload runs before the page goes up, not after.
  */
  editorStore.clearPendingAssets()
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
    /*
      Monaco writes its measured width in pixels onto its own elements, so this item's automatic
      min-width -- min-content, i.e. whatever Monaco last laid itself out at -- pins it to the full
      width it took while the preview was closed. Bringing the preview back then leaves it the few
      pixels the flex line has left over, and Monaco never re-measures because its container never
      shrinks. Zero lets the basis decide instead.
    */
    min-width: 0;
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
    /*
      `-enter-from` is the Vue 3 name; as `-enter` it matched nothing, so the pane animated shut but
      snapped open. The inner selector was stale in the same way -- the content class is
      `-preview-content` -- which left the render reflowing for the length of the transition.
    */
    &-enter-active,
    &-leave-active {
      transition: max-width 0.5s ease;
      max-width: 50vw;
      .editor-markdown-preview-content {
        width: 50vw;
        overflow: hidden;
      }
    }
    &-enter-from,
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
      /*
        A block this site has switched off, marked by `markDisabledBlock`. Editor-only styling: the
        server strips the element on save, so no reader ever meets one of these.

        Built from the admonition palette `.page-contents` already declares -- the preview pane
        carries that class, so both themes are covered by the tokens rather than by a rule here.
      */
      [data-block-disabled] {
        display: block;
        margin: 1rem 0;
        padding: 0.75rem 1rem;
        border-left: 4px solid var(--content-danger);
        border-radius: 3px;
        background-color: var(--content-danger-wash);
        color: var(--content-ink-muted);
      }
      .block-disabled-notice {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        margin: 0;
        color: var(--content-danger);
        font-size: 0.85rem;
        font-weight: 600;

        /* -> `mdi:alert`, drawn as a mask so it takes the colour above rather than one of its own */
        &::before {
          content: '';
          flex: 0 0 auto;
          width: 1.1rem;
          height: 1.1rem;
          background-color: currentColor;
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M13 14h-2V9h2m0 9h-2v-2h2M1 21h22L12 2z'/%3E%3C/svg%3E");
          mask-repeat: no-repeat;
          mask-size: contain;
        }
      }
      /* -> Whatever the author wrote inside, which is what the saved page is left holding */
      [data-block-disabled] > .block-disabled-notice + * {
        margin-top: 0.5rem;
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
    // -> Flex so the preview toggle can be pushed to the far right by `w-space`
    display: flex;
    align-items: center;
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
