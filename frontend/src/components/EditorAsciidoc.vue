<template>
  <div class="editor-asciidoc">
    <div class="editor-asciidoc-main">
      <div class="editor-asciidoc-sidebar">
        <!-- ------------------------------------------------------- -->
        <!-- SIDE TOOLBAR -->
        <!-- ------------------------------------------------------- -->
        <w-btn icon="mdi:link-variant-plus" padding="sm sm" flat @click="insertLink">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertLink')
          }}</w-tooltip>
        </w-btn>
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
        <!-- -> Icons only, as in the markdown editor: what goes in is an `icon:mdi:home[]` macro, and
                the picker's other tab hands back an `img:` URL, which that syntax cannot say -->
        <w-btn icon="mdi:seed-plus-outline" padding="sm sm" flat>
          <w-menu anchor="top right" self="top left" content-class="shadow-7">
            <icon-picker-dialog no-image @update:model-value="insertIcon" />
          </w-menu>
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertIcon')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:book-plus" padding="sm sm" flat @click="insertFootnote">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertFootnote')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:line-scan" padding="sm sm" flat @click="insertHorizontalBar">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertHorizontalBar')
          }}</w-tooltip>
        </w-btn>
        <w-space />
        <span class="editor-asciidoc-type">AsciiDoc</span>
      </div>
      <div class="editor-asciidoc-mid">
        <!-- ------------------------------------------------------- -->
        <!-- TOP TOOLBAR -->
        <!-- ------------------------------------------------------- -->
        <div class="editor-asciidoc-toolbar">
          <w-btn icon="mdi:format-bold" padding="xs sm" flat @click="toggleMarkup({ start: `*` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.bold')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-italic"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `_` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.italic')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-color-highlight"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `#` })">
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
                <!--
                  Levels 2 to 6, which is what a page can actually have. Level 1 is the page's own
                  title, held in a column of its own and drawn above the article — so a document title
                  written here would be swallowed by the renderer rather than shown twice. See
                  `LOCKED_ATTRIBUTES` in `renderers/asciidoc.js`.
                -->
                <w-item v-for="lvl in HEADER_LEVELS" clickable @click="setHeaderLine(lvl)">
                  <w-item-section side>
                    <w-icon :name="HEADER_ICONS[lvl - 2]" />
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
                <w-item clickable @click="insertQuote">
                  <w-item-section side><w-icon name="mdi:format-quote-close" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.blockquote') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertAdmonitionNote">
                  <w-item-section side>
                    <!-- -> The colour names here are the ones written out in full somewhere in the
                            app, so Tailwind emits them; see the same note in `EditorMarkdown.vue` -->
                    <w-icon name="mdi:information-box" color="blue" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionInfo') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertAdmonitionTip">
                  <w-item-section side>
                    <w-icon name="mdi:check-circle" color="positive" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionSuccess') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertAdmonitionImportant">
                  <w-item-section side>
                    <w-icon name="mdi:message-alert" color="purple" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionImportant') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertAdmonitionWarning">
                  <w-item-section side>
                    <w-icon name="mdi:alert-box" color="orange" />
                  </w-item-section>
                  <w-item-section>{{ t('editor.markup.admonitionWarning') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertAdmonitionCaution">
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
            @click="insertBeforeEachLine({ content: `* ` })">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.unorderedList')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            icon="mdi:format-list-numbered"
            padding="xs sm"
            flat
            @click="insertBeforeEachLine({ content: `. ` })">
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
                <w-item clickable @click="insertBeforeEachLine({ content: `* [ ] ` })">
                  <w-item-section side><w-icon name="mdi:checkbox-blank-outline" /></w-item-section>
                  <w-item-section>{{ t('editor.markup.taskListUnchecked') }}</w-item-section>
                </w-item>
                <w-item clickable @click="insertBeforeEachLine({ content: `* [x] ` })">
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
          <!-- -> A macro rather than raw HTML, which is what markdown has to reach for -->
          <w-btn
            icon="mdi:keyboard-variant"
            padding="xs sm"
            flat
            @click="toggleMarkup({ start: `kbd:[`, end: `]` })">
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
        <div class="editor-asciidoc-editor"><div ref="monacoRef" /></div>
      </div>
      <transition name="editor-asciidoc-preview">
        <div class="editor-asciidoc-preview" v-if="state.previewShown">
          <div class="editor-asciidoc-preview-toolbar">
            <strong class="editor-asciidoc-preview-label"
              ><em>{{ t('editor.renderPreview') }}</em></strong
            >
            <w-separator class="ml-4 mr-2" vertical inset dark />
            <w-btn
              icon="mdi:arrow-vertical-lock"
              padding="xs sm"
              flat
              @click="state.previewScrollSync = !state.previewScrollSync"
              :color="state.previewScrollSync ? `secondary` : null">
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
            `is-asciidoc` alongside `page-contents`, exactly as the page view sets it: the render is
            Asciidoctor's own shape, and `css/_page-contents-asciidoc.scss` is the layer that draws it.
            Both surfaces carry the pair, so the preview and the page cannot drift apart.
          -->
          <div
            class="editor-asciidoc-preview-content page-contents is-asciidoc"
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
import { blockAsciidoc } from '@/helpers/blocks'
import {
  blockOpeningLine,
  blockValues,
  findBlockContent,
  findBlocks,
  findTabsets,
  writeBlockContent
} from '@/helpers/asciidocBlocks'
import { ASCIIDOC_LANGUAGE_ID, registerAsciidocLanguage } from '@/helpers/monacoAsciidoc'

import EditorCodeBlockMenu from '@/components/EditorCodeBlockMenu.vue'
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
import { AsciidocRenderer } from '@/renderers/asciidoc'

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
 * The same three conditions the markdown editor applies, for the same reasons: a page being created
 * has no id to gather anyone around, and a suggestion is one person's private draft of a page they
 * may not write to.
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
let adoc
/** The collaboration watchers, which have to be stopped by hand — see where they are created. */
const collabWatchers = []
/** Where the paste listener ended up, so it can be taken off the same node. See the note in onMounted. */
let pasteCaptureNode = null
/** The "Edit Block Parameters" lens provider, registered against the language rather than this editor. */
let blockLensProvider = null
/** The blocks this site has, as the API describes them — their props included. */
let siteBlocks = []
/**
 * Which tabset panel each source line is in, as `findTabsets` reports it.
 *
 * Read from the SOURCE rather than produced by the render, unlike the markdown editor's `tabsMap`.
 * The AsciiDoc renderer is async, so a map built as a side effect of rendering would be a render
 * behind whenever the caret moved between one keystroke and the next — and the caret handler is
 * exactly what reads this.
 */
let tabsMap = []
const monacoRef = ref(null)
const editorPreviewContainerRef = ref(null)

/**
 * Blocks this site has switched off, as the tags they are written as.
 *
 * The preview fetches a component for every element it does not recognise, so a disabled block would
 * draw here and then disappear the moment the page was saved — the server strips one that is not
 * enabled out of the render.
 */
const disabledBlockTags = ref(new Set())

/**
 * The heading levels this editor offers, which are the ones a page can have.
 *
 * Starting at 2 because level 1 is the page's own title: it lives in a column of its own and is drawn
 * above the article, so `= Title` written in the source is swallowed by the renderer rather than
 * shown twice. `==` is therefore the first heading an author writes, exactly as `##` is the first one
 * worth writing in markdown.
 */
const HEADER_LEVELS = [2, 3, 4, 5, 6]

/*
  Listed rather than built as `mdi:format-header-${lvl}`: a concatenated icon name is invisible to the
  build-time icon scan, so it would ship as blank squares. Indexed by `level - 2`.
*/
const HEADER_ICONS = [
  'mdi:format-header-2',
  'mdi:format-header-3',
  'mdi:format-header-4',
  'mdi:format-header-5',
  'mdi:format-header-6'
]

/**
 * How the preview follows the caret: the line being edited is put a short way down the pane rather
 * than at its very top, so the lines just written stay in view. See the same constant in
 * `EditorMarkdown.vue`, which explains the alternatives and why neither works.
 */
const PREVIEW_CONTEXT_ABOVE = 0.2

/**
 * Whether the window is wide enough to open the preview beside the source. 1024 is the app's `md`
 * breakpoint (`css/tailwind.css`).
 */
const isAtLeastMd = useMinWidth(1024)

const state = reactive({
  // -> Read once, as a DEFAULT rather than a binding: past this the pane is the author's to open and
  //    close, and a bound one would slam it shut the moment a window was dragged narrower mid-edit
  previewShown: isAtLeastMd.value,
  previewScrollSync: true
})

/**
 * The render in flight, so a slow one cannot land on top of a newer one.
 *
 * The markdown pipeline is synchronous and has nothing like this to worry about; Asciidoctor's
 * `convert` is a promise, so two keystrokes in quick succession start two renders that may finish in
 * either order. Each render takes a ticket and only patches the store if it still holds the latest.
 */
let renderTicket = 0

// METHODS

function insertAssets() {
  siteStore.openFileManager({ insertMode: true })
}

/**
 * What the file manager handed back, as AsciiDoc at the cursor.
 *
 * Both kinds go in as paths from the site root: a file through `assetPath`, which is where the
 * reasoning about that form lives, and a page the way the link picker writes one.
 *
 * An image goes in as a BLOCK macro (`image::`) on a line of its own, which is what an inserted
 * picture almost always wants to be, and anything else as a link — a PDF picked from the file manager
 * is a link to a PDF, not a broken picture.
 */
function insertAssetClb(opts) {
  let content = ''
  switch (opts.type) {
    case 'asset': {
      const path = assetPath(opts.folderPath, opts.fileName)
      if (opts.mimeType?.startsWith('image/')) {
        insertOnOwnLine(`image::${path}[${escapeMacroText(opts.title)}]`)
        setTimeout(() => editor.focus(), 500)
        return
      }
      content = `link:${path}[${escapeMacroText(opts.title)}]`
      break
    }
    case 'page': {
      const pagePath = opts.folderPath ? `${opts.folderPath}/${opts.fileName}` : opts.fileName
      content = `link:/${pagePath}[${escapeMacroText(opts.title)}]`
      break
    }
  }
  insertAtCursor({ content, focus: false })
  setTimeout(() => {
    editor.focus()
  }, 500)
}

/**
 * A macro's bracketed text, with the one character that would end it early taken out.
 *
 * `]` closes a macro's attribute list, so a title carrying one would spill the rest of itself into
 * the page as prose. AsciiDoc escapes it with a backslash.
 */
function escapeMacroText(text) {
  return String(text ?? '').replaceAll(']', '\\]')
}

/**
 * A source block in the chosen language.
 *
 * Wraps the selection when there is one — marking a few lines and picking a language reads as "this
 * is code" — and otherwise opens an empty block with the caret on the line inside it.
 *
 * The attribute line has to start a line of its own, so a cursor sitting mid-sentence breaks out
 * first. The fence is four hyphens, and is lengthened past any run of hyphens the selection already
 * carries so that a body holding its own fence cannot close this one early.
 */
function insertCodeBlock(language) {
  const model = editor.getModel()
  const selection = editor.getSelection()
  const selected = model.getValueInRange(selection)
  const startLine = model.getLineContent(selection.startLineNumber)
  const endLine = model.getLineContent(selection.endLineNumber)
  const before = startLine.slice(0, selection.startColumn - 1).trim().length > 0 ? '\n\n' : ''
  const after = endLine.slice(selection.endColumn - 1).trim().length > 0 ? '\n\n' : '\n'
  const longest = Math.max(0, ...[...selected.matchAll(/-{4,}/g)].map((match) => match[0].length))
  const fence = '-'.repeat(Math.max(4, longest + 1))
  editor.executeEdits('', [
    {
      range: selection,
      text: `${before}[source,${language}]\n${fence}\n${selected}\n${fence}${after}`,
      forceMoveMarkers: true
    }
  ])
  if (!selected) {
    // -> Onto the empty line between the fences, which is the only place typing makes sense next
    const openerLine = selection.startLineNumber + (before ? 2 : 0)
    editor.setPosition({ lineNumber: openerLine + 2, column: 1 })
  }
  editor.focus()
}

/**
 * The picked icon, as the macro that draws it — `mdi:home` in, `icon:mdi:home[]` out.
 *
 * AsciiDoc's own icon macro, whose target accepts the colon inside an Iconify reference, so the name
 * goes in exactly as it was picked. See `convert_inline_image` in `renderers/asciidoc.js`.
 */
function insertIcon(reference) {
  if (reference) {
    insertAtCursor({ content: `icon:${reference}[]` })
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
 * built from the same definition rather than written out a second time here. It still asks the server
 * which blocks this site has: a shortcut to a block an administrator switched off would insert
 * something the page cannot draw.
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
    const source = blockAsciidoc(tabs)
    selectFirstTabLabel(source, insertBlockClb(source))
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
 * A block's attribute line only opens one when it starts a line and has a delimiter under it, so a
 * cursor mid-sentence breaks out first — the same rule the code block follows.
 */
function insertBlockClb(source) {
  const position = editor.getPosition()
  const line = editor.getModel().getLineContent(position.lineNumber)
  const before = line.slice(0, position.column - 1).trim().length > 0 ? '\n\n' : ''
  const after = line.slice(position.column - 1).trim().length > 0 ? '\n\n' : '\n'
  insertAtCursor({ content: `${before}${source}${after}` })
  /*
    Where the markup itself begins, for a caller that wants to put the cursor inside what it just
    inserted. Two lines below the cursor when it had to break out of a sentence first; otherwise on
    the cursor's own line, starting at the cursor's own column.
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
 * see `asciidocTemplate` in `block-tabs`), and naming them is the first thing anybody does — so the
 * first is left selected, to be typed over rather than hunted down.
 *
 * Located in the markup handed in rather than in the document, so it cannot find a tabset the page
 * already held. `d` is what makes the match report where the label VALUE sits.
 */
function selectFirstTabLabel(source, start) {
  const match = source.match(/label="([^"]*)"/d)
  if (!match) {
    return
  }
  const [from, to] = match.indices[1]
  const lines = source.slice(0, from).split('\n')
  const lineNumber = start.lineNumber + lines.length - 1
  // -> Only the first line of the insert begins at the cursor's column; every later one begins at 1
  const column = (lines.length > 1 ? 1 : start.column) + lines.at(-1).length
  editor.setSelection(new Range(lineNumber, column, lineNumber, column + (to - from)))
  editor.revealLineInCenterIfOutsideViewport(lineNumber)
}

/** The block as this site describes it, or undefined for one it does not list. */
function blockDefinition(name) {
  return siteBlocks.find((block) => block.block === name)
}

/**
 * The parameters dialog, over a block already in the page — what the lens above one opens.
 *
 * The block is looked up again here rather than taken from the lens: a lens is provided once and then
 * moves with the text, so the line it carries is from whenever the document last settled. The name it
 * was drawn for has to match too, since a block's attribute line is a single line and an edit above
 * it would otherwise put a form for one block over another.
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
      The attribute line and nothing else, so the body between the delimiters is left exactly as it
      was — which for a tabset is every tab in it. One undo takes the whole change back.
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
 * The block's BODY, in whatever editor its definition named — what the "Edit Content" lens opens.
 *
 * A block only has this one when it says so and when its body is a single source block to hand over,
 * which is what `findBlockContent` answers. Looked up again at the moment of the click, for the
 * reason `editBlock` gives.
 */
function editBlockContent(line, name) {
  const text = editor.getModel().getValue()
  const found = findBlocks(text).find((entry) => entry.line === line && entry.block === name)
  const definition = found && blockDefinition(found.block)
  const content = definition?.contentEditor ? findBlockContent(text, found) : null
  if (!content) {
    return
  }
  siteStore.$patch({
    overlay: 'BlockContentEditor',
    overlayOpts: {
      editor: definition.contentEditor,
      block: definition,
      params: blockValues(found, definition),
      source: content.source,
      lang: content.language,
      // -> Where it goes back, and in what: the editor is handed text and hands text back, and the
      //    delimiters it lives between are this side's business
      replace: content
    }
  })
}

/**
 * A block body an editor produced, back over the source block it came from.
 *
 * The attribute line and both fences are rewritten along with the text — see `writeBlockContent` — so
 * the whole thing is one edit and one undo, and the block's own attribute line is not touched.
 */
function replaceBlockContentClb({ source, replace }) {
  if (!replace) {
    return
  }
  const model = editor.getModel()
  editor.executeEdits('blockContent', [
    {
      range: new Range(
        replace.startLine,
        1,
        replace.endLine,
        model.getLineMaxColumn(replace.endLine)
      ),
      text: writeBlockContent(replace, source)
    }
  ])
  editor.setPosition(new Position(replace.startLine, 1))
  editor.focus()
}

/**
 * A footnote, at the cursor.
 *
 * One edit and no second half, unlike markdown's: AsciiDoc writes the note where it is referenced and
 * collects them at the foot of the page itself, so there is no label to allocate and no definition
 * line to keep in step. The caret lands between the brackets, which is where the note gets written.
 */
function insertFootnote() {
  insertAtCursor({ content: 'footnote:[]' })
  const position = editor.getPosition()
  editor.setPosition({ lineNumber: position.lineNumber, column: position.column - 1 })
  editor.focus()
}

/**
 * Insert a link, from the shared picker.
 *
 * Whatever is selected becomes the link's text, so marking a phrase and pressing the button reads as
 * "make this a link". With nothing selected the picker's own answer supplies it: the title of the
 * page that was chosen, or the URL itself, which is at least something to type over.
 *
 * `window=_blank` is AsciiDoc's own way of saying what markdown needs an attribute plugin for, and it
 * produces the `target` the stored render is allowed to keep — see `models/rendering.ts`.
 */
function insertLink() {
  dialog({ component: LinkPickerDialog }).onOk(({ href, openInNewTab, title }) => {
    const selection = editor.getSelection()
    const selected = editor.getModel().getValueInRange(selection)
    const label = escapeMacroText(selected || title || href)
    const attributes = openInNewTab ? `${label},window=_blank` : label
    editor.executeEdits('', [
      {
        range: selection,
        text: `link:${href}[${attributes}]`,
        forceMoveMarkers: true
      }
    ])
    editor.focus()
  })
}

/**
 * Set the current line as a heading of the given level.
 *
 * AsciiDoc counts a heading's level from the number of `=` MINUS ONE — `==` is a level-1 section and
 * comes out as `<h2>`. The menu names the level the reader sees, which is the `<h2>`, so the marker
 * is one character longer than the number on the menu item.
 */
function setHeaderLine(lvl, focus = true) {
  const curLine = editor.getPosition().lineNumber
  let lineContent = editor.getModel().getLineContent(curLine)
  const lineLength = lineContent.length
  if (lineContent.startsWith('=')) {
    lineContent = lineContent.replace(/^(=+ )/, '')
  }
  lineContent = '='.repeat(lvl) + ' ' + lineContent
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

/** The heading level of the current line, as the menu names it — so `==` answers 2. */
function getHeaderLevel() {
  const curLine = editor.getPosition().lineNumber
  const lineContent = editor.getModel().getLineContent(curLine)
  const result = lineContent.match(/^(=+) /)
  return (result?.[1] ?? '').length
}

/** Insert content at cursor */
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
 * Insert content on lines of its own, breaking out of whatever the cursor is in the middle of.
 *
 * The shape every block construct here needs — a delimited block, a block image macro, a horizontal
 * rule — since each of them is only itself when it starts a line.
 */
function insertOnOwnLine(content, { focus = true } = {}) {
  const model = editor.getModel()
  const position = editor.getPosition()
  const line = model.getLineContent(position.lineNumber)
  const before = line.slice(0, position.column - 1).trim().length > 0 ? '\n\n' : ''
  const after = line.slice(position.column - 1).trim().length > 0 ? '\n\n' : '\n'
  insertAtCursor({ content: `${before}${content}${after}`, focus })
}

/**
 * Insert content before each selected line.
 *
 * `before` is a line of its own, put above the first of them. It rides along in that line's own edit
 * rather than as an insertion of its own, so no two edits in the batch start at the same position.
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
 * Wrap the selection in a delimited block carrying `attributes`.
 *
 * What both the quote and the five admonitions are: AsciiDoc says which of them a block is on the
 * attribute line above it, so they differ by one word and share everything else. Written as a block
 * rather than as the shorter `NOTE: ` line prefix because the button acts on a SELECTION, which may
 * be several paragraphs — and a prefix only ever makes the first of them an admonition.
 *
 * The delimiter is an example block for the admonitions and a quote block for the quote, which are
 * the two AsciiDoc pairs each with its own meaning.
 */
function wrapInBlock({ attributes, delimiter }) {
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
      text: `${before}${attributes}\n${delimiter}\n${selected}\n${delimiter}${after}`,
      forceMoveMarkers: true
    }
  ])
  if (!selected) {
    // -> Onto the empty line inside the block, which is the only place typing makes sense next
    const openerLine = selection.startLineNumber + (before ? 2 : 0)
    editor.setPosition({ lineNumber: openerLine + 2, column: 1 })
  }
  editor.focus()
}

/*
  One named handler per menu item rather than an inline call with arguments. Two statements in a Vue
  template attribute is a build error the moment the file is formatted -- see the note in CLAUDE.md --
  and a single call would be fine, but these read better named than as five copies of an object
  literal in the template.
*/
function insertQuote() {
  wrapInBlock({ attributes: '[quote]', delimiter: '____' })
}
function insertAdmonitionNote() {
  wrapInBlock({ attributes: '[NOTE]', delimiter: '====' })
}
function insertAdmonitionTip() {
  wrapInBlock({ attributes: '[TIP]', delimiter: '====' })
}
function insertAdmonitionImportant() {
  wrapInBlock({ attributes: '[IMPORTANT]', delimiter: '====' })
}
function insertAdmonitionWarning() {
  wrapInBlock({ attributes: '[WARNING]', delimiter: '====' })
}
function insertAdmonitionCaution() {
  wrapInBlock({ attributes: '[CAUTION]', delimiter: '====' })
}

/** A horizontal rule, which AsciiDoc writes as three apostrophes on a line of their own. */
function insertHorizontalBar() {
  insertOnOwnLine("'''")
}

/**
 * A description list skeleton, on lines of its own.
 *
 * Two entries rather than one, because what nobody guesses is that the term and its definition are
 * joined by `::` on the SAME line — where markdown puts the definition on the next one. Placeholder
 * words rather than empty lines, since an empty term and an empty definition render as nothing at all
 * and the button would look like it had done nothing.
 */
function insertDefinitionList() {
  const term = t('editor.markup.definitionListTerm')
  const definition = t('editor.markup.definitionListDefinition')
  const skeleton = `${term}:: ${definition}\n${term}:: ${definition}`

  const position = editor.getPosition()
  const before =
    editor
      .getModel()
      .getLineContent(position.lineNumber)
      .slice(0, position.column - 1)
      .trim().length > 0
      ? '\n\n'
      : ''
  insertOnOwnLine(skeleton)

  const firstTermLine = position.lineNumber + (before ? 2 : 0)
  editor.setSelection(new Range(firstTermLine, 1, firstTermLine, term.length + 1))
}

/** Toggle markup at the selection. */
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
      if (!wordObj) {
        continue
      }
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
 * A component only has to be fetched once to be defined for the rest of the session, so a list that
 * arrives after the first render is too late to keep a disabled block from drawing.
 */
async function loadSiteBlocks() {
  try {
    siteBlocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
    disabledBlockTags.value = new Set(
      siteBlocks.filter((block) => !block.isEnabled).map((block) => `block-${block.block}`)
    )
  } catch (err) {
    // -> Left empty, which draws everything as it did before; see the same note in `EditorMarkdown.vue`
    console.warn(`Could not read which blocks this site has enabled: ${err.message}`)
  }
}

/**
 * Say why a block is sitting there doing nothing.
 *
 * Written into the preview's DOM rather than into the render, which is deliberate: `pageStore.render`
 * is what `pageSave` sends, and a notice added to it would be a notice saved into the page.
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
 * Which tabset panels a source line is inside, outermost first.
 *
 * Every panel that contains the line rather than only the innermost: a tabset nested in another is
 * drawn inside a panel, and opening the inner panel while the one holding it stays closed reveals
 * nothing. Ordered by construction, since `findTabsets` walks the source in order.
 */
function getTabsAtLine(line) {
  const found = []
  for (const [tabset, tabs] of tabsMap.entries()) {
    for (const [tab, [from, to]] of tabs.entries()) {
      if (line >= from && line <= to) {
        found.push({ tabset, tab })
      }
    }
  }
  return found
}

/**
 * Open the tabset panel the caret is in, and every panel that one sits inside.
 *
 * Which is the useful answer, and a different question from "which panel was open before": an author
 * writing inside the second panel is telling us plainly which one they are looking at.
 *
 * @returns A promise settling once the blocks have drawn the panels. A block applies which panel is
 *          open on its own update, so a caller about to scroll to something inside one has to wait.
 */
function syncPreviewTabs() {
  const container = editorPreviewContainerRef.value
  if (!container) {
    return Promise.resolve()
  }
  const tabsets = container.querySelectorAll('block-tabs')
  const drawn = []
  for (const at of getTabsAtLine(editor.getPosition().lineNumber)) {
    const tabset = tabsets[at.tabset]
    if (tabset) {
      tabset.active = at.tab
      drawn.push(tabset.updateComplete ?? Promise.resolve())
    }
  }
  return Promise.all(drawn)
}

/**
 * The element in the preview to scroll to for a source line.
 *
 * Read off the DOM rather than from a map collected during the render, because what matters is what
 * was actually drawn and where it ended up. Scoped to the panel the line is in where it is in one --
 * every panel of a tabset covers the same lines, so a search across the whole preview would answer a
 * line inside a panel with an element outside the tabset entirely -- and to what has a box, since a
 * closed panel's content cannot be scrolled to.
 */
function previewAnchorFor(container, line) {
  const at = getTabsAtLine(line).at(-1)
  const tabset = at ? container.querySelectorAll('block-tabs')[at.tabset] : null
  const panel = tabset?.querySelectorAll(':scope > block-tab')[at.tab] ?? null

  let best = null
  let bestLine = 0
  for (const el of (panel ?? container).querySelectorAll('[data-line]')) {
    const elLine = Number(el.dataset.line)
    // -> Strictly greater, so that of two elements starting on the same line the outer one wins,
    //    which is the one whose top is the section's top
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
 * distance to the SCROLL container and `offsetTop` answers to the nearest positioned ancestor.
 */
function scrollPreviewTo(container, el) {
  const offset = el.getBoundingClientRect().top - container.getBoundingClientRect().top
  container.scrollTo({
    top: container.scrollTop + offset - container.clientHeight * PREVIEW_CONTEXT_ABOVE,
    behavior: 'smooth'
  })
}

/**
 * Render the source and put the result in the store, then tidy the preview's DOM around it.
 *
 * Async, unlike its markdown counterpart, because Asciidoctor's `convert` is — see `renderTicket` for
 * what that means for two keystrokes in quick succession.
 */
async function processContent(newContent) {
  /*
    A render that throws must not become a render that is empty.

    `pageSave` sends whatever is in the store, and the server replaces the stored HTML with it -- so
    patching a failed render in blanks the published page, and patching nothing keeps the last good
    one. Loud rather than silent, because the preview is then showing something other than the source.
  */
  const ticket = ++renderTicket
  let html
  try {
    // -> The page's own path, because a relative image in the source is relative to the folder it
    //    sits in -- and it is being edited, so it is whatever the path field says right now
    html = await adoc.render(newContent, { pagePath: pageStore.path, sourcemap: true })
  } catch (err) {
    console.error(err)
    notify({
      type: 'negative',
      message: t('editor.renderFailed'),
      caption: err.message
    })
    return
  }
  // -> A newer keystroke has already started its own render; this one is stale and must not land
  if (ticket !== renderTicket) {
    return
  }

  // -> Read from the source that was just rendered, so the two describe the same document
  tabsMap = findTabsets(newContent)

  const container = editorPreviewContainerRef.value
  /*
    Two things about the preview have to survive the patch, because `v-html` does not patch anything --
    it throws every child away and builds them again, on every keystroke.

    Where the reader had scrolled to is the first: an emptied box has nowhere to be scrolled to, so its
    `scrollTop` is clamped to zero and the cursor handler then animates back down from the top on every
    keystroke. Which tab is open is the second, carried across by position -- the source order of the
    blocks is what survives an edit, not the elements.
  */
  const scrollTop = container?.scrollTop ?? 0
  const openTabs = [...(container?.querySelectorAll('block-tabs') ?? [])].map(
    (el) => el.active ?? 0
  )

  pageStore.$patch({
    render: html
  })
  await nextTick()
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
    block applies its open panel on its own update, a microtask later. Restoring first is restoring
    against a layout that is about to change by the height of a whole panel.
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
    // -> Asked again once the definitions land: until a block has been upgraded nothing has read its
    //    panels, so the tab the author is in is only actually opened here on a first render
    commonStore.loadBlocks([...pendingTags]).then(syncPreviewTabs)
  }
  // -> The render was just replaced, so the copy buttons went with it
  enhanceRenderedContent(container)
}

/**
 * Take files the author brought in — pasted or dropped — and write AsciiDoc for them at the cursor.
 *
 * Nothing is uploaded here. Each one becomes a pending asset held against a `blob:` URL that the
 * source points at, and `UploadPendingAssetsDialog` sends them on save and rewrites those URLs.
 *
 * Except while suggesting an edit, where files are refused outright: a pending asset is uploaded when
 * the page is SAVED, and submitting a suggestion is not a save. See the same guard in
 * `EditorMarkdown.vue`, which explains why it is said out loud rather than returned from silently.
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
    const name = escapeMacroText(file.name)
    return file.type.startsWith('image/')
      ? `image::${blobUrl}[${name}]`
      : `link:${blobUrl}[${name}]`
  })
  // -> One per line: two images on the same line is rarely what was meant by dropping two files, and
  //    a block image macro is only one when it has a line to itself
  insertOnOwnLine(markup.join('\n'))
}

/** Whether a paste or drop is carrying files, as opposed to text. */
function hasFiles(transfer) {
  return (transfer?.files?.length ?? 0) > 0
}

/*
  Pasting a file inserts it; pasting anything else is left alone. Text wins when both are on the
  clipboard -- copying from a spreadsheet puts a bitmap there alongside the text, and an editor that
  answered those pastes with a screenshot would be infuriating.
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
    ABOVE the editor: letting it travel on would hand the same files to Monaco's paste-as feature.
  */
  event.preventDefault()
  event.stopPropagation()
  insertFilesAsAssets([...event.clipboardData.files])
}

/*
  A drop has to be claimed twice: `dragover` is what tells the browser this is a valid target --
  without it there is no drop at all, just the browser navigating away to the file -- and `drop` is
  where it arrives.
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
 * Debounced because it renders the whole document on every keystroke, and NAMED so that it can also
 * be flushed — see `reloadEditorContent`.
 */
const syncContentToStore = debounce(() => {
  editorStore.$patch({
    lastChangeTimestamp: Temporal.Now.instant()
  })
  pageStore.$patch({
    content: editor.getValue(),
    // -> What the author has typed IS the source, whatever the load did or did not deliver
    contentLoaded: true
  })
  processContent(pageStore.content)
}, 500)

/**
 * Rewrite text that was already in the editor — the blob URLs of pending assets, once the upload has
 * given them real paths.
 *
 * Done as targeted edits rather than by putting the whole page back with `setValue`, which would read
 * as "everything was deleted and everything was typed again" and in a collaborative session would
 * land on everyone else as exactly that.
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
    // -> And the store follows the model NOW rather than when the debounce would have got to it: this
    //    runs immediately before the page is saved, and the save must not go up with blob URLs in it
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

  adoc = new AsciidocRenderer(editorStore.editors.asciidoc)

  registerAsciidocLanguage()

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

  // -> Initialize Monaco Editor
  editor = monaco.editor.create(monacoRef.value, {
    automaticLayout: true,
    cursorBlinking: 'blink',
    fontSize: 16,
    formatOnType: true,
    language: ASCIIDOC_LANGUAGE_ID,
    lineNumbersMinChars: 4,
    padding: { top: 10, bottom: 10 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    theme: 'wikijs',
    value: pageStore.content,
    wordWrap: 'on'
  })

  /*
    "Edit Block Parameters" over every block in the page, and "Edit Content" over one whose definition
    names an editor for its body. Both from one provider rather than a provider each, which is what
    fixes the order they appear in -- two providers over the same line are merged in whatever order
    the registry holds them. Content first, since it is the block itself.

    There is no "Edit Table" lens here, unlike the markdown editor: the table overlay reads and writes
    pipe syntax, and AsciiDoc tables are a different notation with a good deal more in them.

    The commands are registered on this editor, which is what gives `addCommand` an id to hand the
    lens. The PROVIDER is per-language and process-wide, so it has to be disposed with the component
    or a second visit would draw every lens twice.
  */
  const editBlockCommand = editor.addCommand(0, (_accessor, line, block) => editBlock(line, block))
  const editBlockContentCommand = editor.addCommand(0, (_accessor, line, block) =>
    editBlockContent(line, block)
  )
  blockLensProvider = monaco.languages.registerCodeLensProvider(ASCIIDOC_LANGUAGE_ID, {
    provideCodeLenses(model) {
      const text = model.getValue()
      const lenses = []
      for (const found of findBlocks(text)) {
        const definition = blockDefinition(found.block)
        if (!definition) {
          continue
        }
        const range = new Range(found.line, 1, found.line, 1)
        if (definition.contentEditor && findBlockContent(text, found)) {
          lenses.push({
            range,
            command: {
              id: editBlockContentCommand,
              title: t('editor.markup.editBlockContent'),
              arguments: [found.line, found.block]
            }
          })
        }
        if (definition.props?.length > 0) {
          lenses.push({
            range,
            command: {
              id: editBlockCommand,
              title: t('editor.markup.editBlock'),
              arguments: [found.line, found.block]
            }
          })
        }
      }
      return { lenses, dispose() {} }
    }
  })

  // -> Define Formatting Actions
  editor.addAction({
    contextMenuGroupId: 'asciidoc.editing',
    contextMenuOrder: 0,
    id: 'asciidoc.editing.toggleBold',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
    label: 'Toggle bold',
    precondition: '',
    run() {
      toggleMarkup({ start: '*' })
    }
  })

  editor.addAction({
    contextMenuGroupId: 'asciidoc.editing',
    contextMenuOrder: 0,
    id: 'asciidoc.editing.toggleItalic',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
    label: 'Toggle italic',
    precondition: '',
    run() {
      toggleMarkup({ start: '_' })
    }
  })

  /*
    Heading level, clamped to what a page can have: 2 is the first heading under the page's own title
    and 6 is the deepest AsciiDoc has. A line that is not a heading answers 0, so increasing from
    there opens at 2.
  */
  editor.addAction({
    id: 'asciidoc.editing.increaseHeaderLevel',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.RightArrow],
    label: 'Increase Header Level',
    precondition: '',
    run() {
      setHeaderLine(Math.min(6, Math.max(2, getHeaderLevel() + 1)))
    }
  })
  editor.addAction({
    id: 'asciidoc.editing.decreaseHeaderLevel',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow],
    label: 'Decrease Header Level',
    precondition: '',
    run() {
      setHeaderLine(Math.max(2, getHeaderLevel() - 1))
    }
  })

  /*
    Ctrl/Cmd+S, asking for the header's Save button rather than saving anything itself -- what that
    button does is the header's to know. A Monaco action rather than a listener because that is what
    stops the browser offering to save the page as a file.
  */
  editor.addAction({
    id: 'save',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
    label: 'Save',
    precondition: '',
    run() {
      EVENT_BUS.emit('savePage')
    }
  })

  // -> Handle content change
  editor.onDidChangeModelContent(syncContentToStore)

  // -> Handle cursor movement
  editor.onDidChangeCursorPosition(
    debounce(async () => {
      if (!state.previewScrollSync || !state.previewShown) {
        return
      }
      /*
        Moving the caret into another panel opens it, the same as typing in one does -- and is AWAITED,
        because until the block has drawn it the panel is still `display: none` and everything below
        aims at an element inside it.
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

    Paste is CAPTURED on the element above the editor, and that is the whole trick: Monaco's own
    paste-as feature listens in the capture phase on the editor's container and calls
    `stopImmediatePropagation()` for every paste it claims, files included. Capture runs outside-in,
    so one level up goes first.
  */
  pasteCaptureNode = monacoRef.value.parentElement ?? monacoRef.value
  pasteCaptureNode.addEventListener('paste', onEditorPaste, true)
  monacoRef.value.addEventListener('dragover', onEditorDragOver)
  monacoRef.value.addEventListener('drop', onEditorDrop)

  // -> Live collaboration

  if (collabEnabled.value) {
    /*
      Read-only until the shared document has arrived, and only that first time: the binding below
      starts by making the editor say what the document says, so anything typed before it exists is
      about to be overwritten. The session gives up after a few seconds and releases the editor, so
      this cannot strand an author in a page they are unable to type in.
    */
    editor.updateOptions({ readOnly: true })
    startCollabSession({ siteId: siteStore.id, pageId: pageStore.id })

    /*
      Both handles are kept, and both are stopped by hand on the way out. A watcher created during
      `setup` belongs to the component and stops with it; these do not, because this hook is `async`
      and everything after its first `await` runs with no component instance current.
    */
    collabWatchers.push(
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
      ),
      /*
        Somebody else saved the page. The editor state has already been put back to "nothing pending"
        by the session -- this is only so that the author is told why their Save button went quiet.
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
    )
  }

  // -> Post init

  editor.focus()

  nextTick(() => {
    processContent(pageStore.content)
  })

  EVENT_BUS.on('insertAsset', insertAssetClb)
  EVENT_BUS.on('insertBlock', insertBlockClb)
  EVENT_BUS.on('replaceBlockContent', replaceBlockContentClb)
  EVENT_BUS.on('reloadEditorContent', reloadEditorContent)
})

onBeforeUnmount(() => {
  // -> First, because everything below is what they reach for: these are not stopped by the component
  //    going away, and one that fires afterwards finds a disposed editor
  for (const stop of collabWatchers.splice(0)) {
    stop()
  }
  EVENT_BUS.off('insertAsset', insertAssetClb)
  EVENT_BUS.off('insertBlock', insertBlockClb)
  EVENT_BUS.off('replaceBlockContent', replaceBlockContentClb)
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  pasteCaptureNode?.removeEventListener('paste', onEditorPaste, true)
  monacoRef.value?.removeEventListener('dragover', onEditorDragOver)
  monacoRef.value?.removeEventListener('drop', onEditorDrop)
  // -> Registered against the language, not this editor, so nothing else takes it down
  blockLensProvider?.dispose()
  // -> Before the editor goes: the binding is holding the model, and leaving the room is what takes
  //    this author's avatar out of everyone else's header
  stopCollabSession()
  /*
    Anything pasted but never uploaded goes with the session that held it. This hook is where an
    editing session ends, whichever way it ended, because the editor is mounted exactly while
    `editorStore.isActive` holds (see `pages/Index.vue`).
  */
  editorStore.clearPendingAssets()
  if (editor) {
    editor.dispose()
  }
})
</script>

<style lang="scss">
@use 'sass:color';
@use '@/css/_bricks.scss' as *;

$editor-height: calc(100vh - 64px - 96px);
$editor-preview-height: calc(100vh - 64px - 96px - 32px);

.editor-asciidoc {
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
      min-width -- whatever Monaco last laid itself out at -- would pin it to the full width it took
      while the preview was closed. Zero lets the basis decide instead.
    */
    min-width: 0;
  }
  &-editor {
    display: block;
    height: calc(100% - 32px);
    position: relative;

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
    &-enter-active,
    &-leave-active {
      transition: max-width 0.5s ease;
      max-width: 50vw;
      .editor-asciidoc-preview-content {
        width: 50vw;
        overflow: hidden;
      }
    }
    &-enter-from,
    &-leave-to {
      max-width: 0;
    }
    /*
      Dark in either appearance: the bar labels the render rather than being part of it, and the
      brickwork at its right end needs a colour with room above it. Same reasoning as the markdown
      editor's, which `css/_bricks.scss` sets out in full.
    */
    &-toolbar {
      height: 32px;
      display: flex;
      align-items: center;
      padding: 0 1rem;
      background-color: $dark-2;
      color: $grey-6;

      @include brick-transition($dark-2);
    }

    &-label {
      color: $grey-5;
    }
    &-content {
      height: $editor-preview-height;
      overflow-y: scroll;
      padding: 1rem;
      max-width: calc(50vw - 57px);

      > div {
        outline: none;
      }
      /*
        A block this site has switched off, marked by `markDisabledBlock`. Editor-only styling: the
        server strips the element on save, so no reader ever meets one of these. Built from the
        admonition palette `.page-contents` already declares.
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
