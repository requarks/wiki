<template>
  <div class="editor-markdown" :class="{ 'has-contents': contentsLaidOut }">
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
              now has no caller. In a live note, whose images are not filed in the File Manager,
              straight to the browser's file picker instead — see `uploadNoteImages`. -->
        <w-btn
          v-if="props.noteKey"
          icon="mdi:image-plus-outline"
          padding="sm sm"
          flat
          @click="pickNoteImages">
          <w-tooltip anchor="center right" self="center left">{{
            t('liveNote.insertImage')
          }}</w-tooltip>
        </w-btn>
        <w-btn v-else icon="mdi:image-plus-outline" padding="sm sm" flat @click="insertAssets">
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
        <w-btn icon="mdi:book-plus" padding="sm sm" flat @click="insertFootnote">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertFootnote')
          }}</w-tooltip>
        </w-btn>
        <w-btn icon="mdi:tooltip-plus-outline" padding="sm sm" flat @click="insertAbbreviation">
          <w-tooltip anchor="center right" self="center left">{{
            t('editor.markup.insertAbbreviation')
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
          <!-- -> The only way back once a pane is closed: its own toggle goes with it. One spacer
                  for both, so that with both closed they sit together at the right end -->
          <template v-if="!panes.previewShown || contentsClosed">
            <w-space />
            <w-btn
              v-if="!panes.previewShown"
              icon="mdi:view-split-vertical"
              padding="xs sm"
              flat
              @click="panes.previewShown = true">
              <w-tooltip anchor="top middle" self="bottom middle">{{
                t('editor.togglePreviewPane')
              }}</w-tooltip>
            </w-btn>
            <w-btn
              v-if="contentsClosed"
              icon="mdi:table-of-contents"
              padding="xs sm"
              flat
              @click="panes.contentsOpen = true">
              <w-tooltip anchor="top middle" self="bottom middle">{{
                t('editor.contents.toggle')
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
        <div class="editor-markdown-preview" v-if="panes.previewShown">
          <!--
            -> No brickwork into the actions rail unless the rail is what this bar runs up to: a note
               has none, and the contents column takes its place beside the preview; see the stylesheet
          -->
          <div
            class="editor-markdown-preview-toolbar"
            :class="{ 'is-railless': props.noteKey || contentsLaidOut }">
            <strong class="editor-markdown-preview-label"
              ><em>{{ t('editor.renderPreview') }}</em></strong
            >
            <w-space />
            <w-btn
              icon="mdi:dots-horizontal"
              padding="xs sm"
              flat
              :aria-label="t(`editor.previewMenu`)"
              @click="state.previewMenuShown = !state.previewMenuShown">
              <!--
                -> Held open rather than `auto-close`, so flipping Scroll Sync leaves the menu up to
                   show it took. Hiding the pane closes it by hand: the button stays mounted for the
                   length of the pane's slide out, and the menu with it
              -->
              <w-menu v-model="state.previewMenuShown" anchor="bottom right" self="top right">
                <w-list dense padding>
                  <w-item tag="label">
                    <w-item-section side><w-icon name="mdi:arrow-vertical-lock" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('editor.previewScrollSync') }}</w-item-label>
                    </w-item-section>
                    <w-item-section side>
                      <w-toggle v-model="panes.previewScrollSync" dense />
                    </w-item-section>
                  </w-item>
                  <w-item clickable @click="hidePreview">
                    <w-item-section side><w-icon name="mdi:eye-off-outline" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t('editor.hidePreviewPane') }}</w-item-label>
                    </w-item-section>
                  </w-item>
                </w-list>
              </w-menu>
              <w-tooltip anchor="top middle" self="bottom middle">{{
                t('editor.previewMenu')
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
            :class="{ 'is-centered': previewCentered }"
            :lang="docLocale"
            :dir="siteStore.localeDir(docLocale)"
            ref="editorPreviewContainerRef"
            v-html="docStore.render" />
        </div>
      </transition>
      <!-- ------------------------------------------------------- -->
      <!-- CONTENTS -->
      <!-- ------------------------------------------------------- -->
      <!-- -> Slides out to the right and back as the preview does; see `contentsLaidOut` for the rest -->
      <transition name="editor-contents" @after-leave="contentsLeft">
        <editor-contents-pane
          v-if="contentsShown"
          :headings="headings"
          :cursor-line="cursorLine"
          :railless="Boolean(props.noteKey)"
          @go-to-line="goToLine"
          @go-to-end="goToEnd"
          @hide="panes.contentsOpen = false" />
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

import { useBlockCompletions } from '@/composables/blockCompletions'
import {
  bindCollabEditor,
  isCollabActive,
  unbindCollabEditor,
  startCollabSession,
  stopCollabSession
} from '@/composables/collab'
import { dialog } from '@/composables/dialog'
import { useEditorPanes } from '@/composables/editorPanes'
import { usePreviewScrollSync } from '@/composables/previewScrollSync'
import { useFenceCompletions } from '@/composables/fenceCompletions'
import { useLinkCompletions } from '@/composables/linkCompletions'
import { useImagePropertiesLens } from '@/composables/imagePropertiesLens'
import { notify } from '@/composables/notify'
import { useTableCellNavigation } from '@/composables/tableCellNavigation'
import { useTagCompletions } from '@/composables/tagCompletions'
import { apiErrorMessage } from '@/helpers/apiError'
import { assetPath } from '@/helpers/assets'
import { blockMarkdown } from '@/helpers/blocks'
import {
  blockAttributeContext,
  blockNameContext,
  blockOpeningLine,
  blockSnippet,
  blockValues,
  findBlockContent,
  findBlocks,
  writeBlockContent
} from '@/helpers/markdownBlocks'
import { findImages, imageValues, writeImage } from '@/helpers/markdownImages'
import { findEditableTables, tableRowToAdd, tableWithColumnAdded } from '@/helpers/markdownTable'

import EditorCodeBlockMenu from '@/components/EditorCodeBlockMenu.vue'
import EditorContentsPane from '@/components/EditorContentsPane.vue'
import EditorEmojiMenu from '@/components/EditorEmojiMenu.vue'
import IconPickerDialog from '@/components/IconPickerDialog.vue'
import LinkPickerDialog from '@/components/LinkPickerDialog.vue'

import { useCollabStore } from '@/stores/collab'
import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useLiveNoteStore } from '@/stores/liveNote'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { enhanceRenderedContent } from '@/helpers/renderedContent'

import { fileOpen } from 'browser-fs-access'
import { debounce } from 'es-toolkit/function'
import * as monaco from 'monaco-editor'
import { Position, Range } from 'monaco-editor'
import { language as markdownLanguage } from 'monaco-editor/languages/definitions/markdown/markdown.js'
import { MarkdownRenderer } from '@/renderers/markdown'

// PROPS

const props = defineProps({
  /**
   * The live note being edited, by its key, rather than the page in the page store.
   *
   * The same editor with less around it: the source and its render go to the live note store instead,
   * and everything a page has that a note does not is left out — there is no save, so no pending
   * changes and no Ctrl+S, and no File Manager, since a note's images are not filed there. The
   * collaboration room is the note's own, and is what stores it. See `pages/LiveNote.vue`, which also
   * holds the room open: this editor binds to it, and leaves it open behind it for the Reader view.
   *
   * Only ever mounted for somebody who may write in the note -- a reader of a locked note gets the
   * Reader view and nothing else (`LiveNoteReader.vue`).
   *
   * Fixed for the life of the component: a different note is a different mount.
   */
  noteKey: {
    type: String,
    default: ''
  }
})

// STORES

const collabStore = useCollabStore()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const liveNoteStore = useLiveNoteStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

/**
 * Where the source being edited and its render are kept: the page store, or the live note's.
 * Both have `content`, `render` and `setRender`, which is all the editor asks of either.
 */
const docStore = props.noteKey ? liveNoteStore : pageStore

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
const collabEnabled = computed(() =>
  props.noteKey
    ? siteStore.features.collaborativeEditing &&
      siteStore.features.liveNotes &&
      userStore.authenticated
    : siteStore.features.collaborativeEditing &&
      userStore.authenticated &&
      editorStore.mode === 'edit' &&
      Boolean(pageStore.id)
)

/**
 * The language the preview is drawn in: the page's, or for a note — which has no locale — the
 * interface's, which is the language the person writing it is reading the wiki in.
 */
const docLocale = computed(() => (props.noteKey ? commonStore.locale : pageStore.locale))

/**
 * Whether the preview is held to the centered measure. A page's follows the site theme, since it
 * previews how the page will be drawn; a note is never drawn anywhere but here, and reads best centered.
 */
const previewCentered = computed(
  () => Boolean(props.noteKey) || siteStore.theme.contentWidth === 'centered'
)

// STATE

let editor
let md
/**
 * The collaboration watchers, which have to be stopped by hand — see where they are created.
 *
 * @type {Array<() => void>}
 */
const collabWatchers = []
/**
 * Set as the editor goes, for the collaboration watcher to see after an `await`: stopping a watcher
 * does not stop a run of it already in flight, and in a note the session outlives the editor (it is
 * `pages/LiveNote.vue`'s), so `isCollabActive()` alone no longer says the editor is still here.
 */
let unmounted = false
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

/** The "Image Properties" lens, over every image in the source. See `useImagePropertiesLens`. */
const imageLens = useImagePropertiesLens({
  getEditor: () => editor,
  languageId: 'markdown',
  findImages,
  imageValues,
  writeImage
})

/*
  A block's name after `::block-`, and its parameters inside its braces. The hyphen is what ends
  `::block-`; a space begins the next attribute, a brace the first, and a quote a value.
*/
const blockCompletions = useBlockCompletions({
  getEditor: () => editor,
  getBlocks: () => siteBlocks,
  languageId: 'markdown',
  triggerCharacters: ['-', ' ', '{', '"'],
  nameContext: blockNameContext,
  attributeContext: blockAttributeContext,
  blockSnippet
})

// -> A code fence's `title`, `linesStart` and `linesHighlight`, after its language
const fenceCompletions = useFenceCompletions({ getEditor: () => editor })

// -> HTML tags such as `<kbd>` after a `<`, written with their closing tag
const tagCompletions = useTagCompletions({ getEditor: () => editor })

// -> Pages of this wiki after `](/`, by the start of their path
const linkCompletions = useLinkCompletions({
  getEditor: () => editor,
  getLocale: () => docLocale.value
})

// -> Tab and Shift+Tab between a table's cells, and Tab past the last one adds a row
const tableCellNavigation = useTableCellNavigation({
  getEditor: () => editor,
  addRow: (line) => addTableRow(line)
})

/** The preview and the Contents pane, remembered per browser. See `useEditorPanes`. */
const { panes, contentsShown, contentsLaidOut, contentsLeft, contentsClosed } = useEditorPanes()

/** The preview following the source as either is scrolled. See `usePreviewScrollSync`. */
const previewScrollSync = usePreviewScrollSync({
  getEditor: () => editor,
  previewRef: editorPreviewContainerRef,
  isEnabled: () => panes.previewScrollSync && panes.previewShown,
  // -> The panel the caret is written in has to be open before there is anything of it to show
  beforeReveal: () => syncPreviewTabs()
})

const state = reactive({
  previewMenuShown: false
})

/**
 * The document's headings, as the last render found them -- see `collect_headings` in
 * `renderers/markdown.js`. Replaced wholesale on each render rather than mutated.
 */
const headings = shallowRef([])

/** The line the caret is on, for marking which section of the Contents pane is being written in. */
const cursorLine = ref(1)

// METHODS

/**
 * Monaco's own markdown tokenizer, with headings and link text given tokens of their own for the
 * `wikijs` theme to colour, the way HedgeDoc's editor does.
 *
 * - An ATX heading (`# Title`) is `keyword` stock -- the same token as a list bullet, a setext
 *   underline and a table separator -- so a theme rule cannot touch headings without every `-`
 *   changing with them. It becomes `keyword.heading`.
 * - An inline link's `[text]` has no token at all stock: its brackets are `string.link` along with
 *   the `(url)`, and the text between them is plain. The bracketed half becomes `link.text`, which
 *   needs the one regex split in four rather than three, so that `]` goes with the text and `(` with
 *   the URL. A bare `[text]` (a reference, a task list box) is left alone.
 *
 * Rules are found by the tokens they emit, so a Monaco upgrade that reshapes either one leaves it
 * stock rather than breaking anything.
 */
function markdownLanguageForTheme() {
  const tokensOf = (rule) => (Array.isArray(rule[1]) ? rule[1].join() : null)
  const root = markdownLanguage.tokenizer.root.map((rule) =>
    tokensOf(rule) === 'white,keyword,keyword,keyword'
      ? [rule[0], ['white', 'keyword.heading', 'keyword.heading', 'keyword.heading']]
      : rule
  )
  const linecontent = markdownLanguage.tokenizer.linecontent.map((rule) =>
    tokensOf(rule) === 'string.link,,string.link'
      ? [
          /(!?\[)((?:[^\]\\]|@escapes)*)(\])(\([^)]+\))/,
          ['link.text', 'link.text', 'link.text', 'string.link']
        ]
      : rule
  )
  return {
    ...markdownLanguage,
    tokenizer: { ...markdownLanguage.tokenizer, root, linecontent }
  }
}

/** The preview menu's Hide item -- closing the menu first, which would otherwise ride the pane out. */
function hidePreview() {
  state.previewMenuShown = false
  panes.previewShown = false
}

/**
 * Take the editor to a line: scrolled to near the top, with the caret at its start. The scroll is
 * what brings the preview along, when it is following the source -- see `usePreviewScrollSync`.
 */
function goToLine(line) {
  // -> Focus first: focusing reveals the caret at once, which cancels a smooth scroll already under way
  editor.focus()
  editor.setPosition({ lineNumber: line, column: 1 })
  editor.revealLineNearTop(line, monaco.editor.ScrollType.Smooth)
}

/** The end of the document, with the caret after its last character, ready to carry on writing. */
function goToEnd() {
  const model = editor.getModel()
  const lineNumber = model.getLineCount()
  editor.focus()
  editor.setPosition({ lineNumber, column: model.getLineMaxColumn(lineNumber) })
  editor.revealLine(lineNumber, monaco.editor.ScrollType.Smooth)
}

function insertAssets() {
  siteStore.openFileManager({ insertMode: true })
}

/**
 * The image formats a live note takes, as the browser's file picker is to offer them. The server
 * decides by the bytes, not by this list; it is only what the picker filters on.
 */
const NOTE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

/** Insert Image, in a live note: the browser's own file picker, and the picks uploaded at once. */
async function pickNoteImages() {
  let files
  try {
    files = await fileOpen({ mimeTypes: NOTE_IMAGE_TYPES, multiple: true })
  } catch (err) {
    // -> Closing the picker without choosing is not a failure
    if (err.name !== 'AbortError') {
      notify({ type: 'negative', message: err.message })
    }
    return
  }
  uploadNoteImages(files)
}

/**
 * Upload images into the live note being edited, and write markdown for them where the cursor was.
 *
 * Unlike a page, a note has no save to upload them on, so each is sent the moment it arrives — into a
 * folder of its own on the server that no listing shows (`liveNotes.addImage`) — and goes into the text
 * only once it has a URL: a placeholder would be text every other participant sees, and is left behind
 * in the note for good if this tab goes away mid-upload.
 *
 * Where it goes in is where the cursor was when it arrived, tracked through whatever is typed while the
 * upload runs, here or by anybody else in the room: a decoration, which Monaco moves with every edit to
 * the model the room applies.
 *
 * Anything that is not an image is refused before anything is sent. An image in a format the server
 * does not take (BMP, say) is refused by the server, with its own message.
 */
async function uploadNoteImages(files) {
  const images = files.filter((file) => file.type.startsWith('image/'))
  if (images.length < files.length) {
    notify({ type: 'warning', message: t('liveNote.imagesOnly') })
  }
  if (images.length < 1) {
    return
  }

  const cursor = editor.getPosition()
  const marker = editor.createDecorationsCollection([
    {
      range: new Range(cursor.lineNumber, cursor.column, cursor.lineNumber, cursor.column),
      options: { stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges }
    }
  ])

  const markup = []
  for (const file of images) {
    try {
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/notes/${props.noteKey}/images`, {
        headers: { 'content-type': file.type },
        body: file
      }).json()
      markup.push(`![${file.name}](${resp.url})`)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('liveNote.imageUploadFailed', { name: file.name }),
        caption: apiErrorMessage(err)
      })
    }
  }

  // -> The editor is gone if the note was closed meanwhile; the images are the note's either way
  if (!editor?.getModel()) {
    return
  }
  const range = marker.getRange(0)
  marker.clear()
  if (!range || markup.length < 1) {
    return
  }
  // -> One per line, as files dropped onto a page are
  editor.executeEdits('', [{ range, text: markup.join('\n'), forceMoveMarkers: true }])
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
  // -> A pick the Image Properties dialog asked for is the dialog's, not the cursor's
  if (imageLens.takePick(opts)) {
    return
  }
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
  const table = tableAt(line)
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

/**
 * The table under a lens, found again at the moment of the click -- see `editTable` for why.
 */
function tableAt(line) {
  return findEditableTables(editor.getModel().getValue()).find(
    (entry) => entry.startLine <= line && line <= entry.endLine
  )
}

/**
 * An empty row, from the "Add Row" lens: under the row the caret is in, or at the end of the table when
 * the caret is anywhere else -- in the header, or not in the table at all. Clicking a lens does not move
 * the caret, so where it is is where the author was writing. It lands in the new row's first cell.
 */
function addTableRow(line) {
  const table = tableAt(line)
  if (!table) {
    return
  }
  const row = tableRowToAdd(table, editor.getPosition()?.lineNumber ?? null)
  const model = editor.getModel()
  const end = model.getLineMaxColumn(row.afterLine)
  editor.executeEdits('table', [
    { range: new Range(row.afterLine, end, row.afterLine, end), text: `\n${row.text}` }
  ])
  editor.setPosition(new Position(row.afterLine + 1, row.column))
  editor.focus()
}

/** An empty column at the end of the table, from the "Add Column" lens, with the caret in its header. */
function addTableColumn(line) {
  const table = tableAt(line)
  if (!table) {
    return
  }
  const result = tableWithColumnAdded(table)
  const model = editor.getModel()
  editor.executeEdits('table', [
    {
      range: new Range(result.startLine, 1, result.endLine, model.getLineMaxColumn(result.endLine)),
      text: result.text
    }
  ])
  editor.setPosition(new Position(result.caret.line, result.caret.column))
  editor.focus()
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
 * The block's BODY, in whatever editor its definition named — what the "Edit Content" lens opens.
 *
 * A second lens rather than a second tab of the parameters dialog, because the two are different
 * shapes of thing: the parameters are a short form over one line, and a body is a whole screen of
 * drawing or source. A block only has this one when it says so and when its body is a single fenced
 * source to hand over, which is what `findBlockContent` answers.
 *
 * Looked up again at the moment of the click, for the reason `editTable` gives: a lens carries a line
 * number from whenever the document last settled.
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
      /*
        What the block declared, which is the key the overlay resolves to an editor component. The
        block's own parameters go with it, since an editor may be configured by them -- where the
        drawing is edited, say -- and only the editor knows which of them it cares about.
      */
      editor: definition.contentEditor,
      block: definition,
      params: blockValues(found, definition),
      source: content.source,
      lang: content.language,
      // -> Where it goes back, and in what: the editor is handed text and hands text back, and the
      //    fence it lives in is this side's business
      replace: content
    }
  })
}

/**
 * A block body an editor produced, back over the fence it came from.
 *
 * The fences are rewritten along with the text -- see `writeBlockContent` -- so the whole thing is one
 * edit and one undo, and the opening line of the block is not touched at all.
 */
function replaceBlockContentClb({ source, replace }) {
  // -> The Visual editor's own answer carries no range; only one editor is ever mounted, so this is
  //    belt and braces rather than a case that happens
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
 * An abbreviation definition, on a line of its own.
 *
 * `*[TERM]: definition` is a block rule, so it can follow a paragraph line directly but cannot sit
 * inside one — the same reason the definition list breaks out of a line the cursor is mid-way
 * through.
 *
 * Inserted as a Monaco snippet rather than as plain text, so the two placeholders are tab stops: the
 * term starts selected and Tab moves to the definition. Both are typed over, never cleaned up.
 */
function insertAbbreviation() {
  const model = editor.getModel()
  const position = editor.getPosition()
  const line = model.getLineContent(position.lineNumber)
  const before = line.slice(0, position.column - 1).trim().length > 0 ? '\n' : ''
  const after = line.slice(position.column - 1).trim().length > 0 ? '\n' : ''
  const term = snippetEscape(t('editor.markup.abbreviationTerm'))
  const definition = snippetEscape(t('editor.markup.abbreviationDefinition'))

  editor
    .getContribution('snippetController2')
    .insert(`${before}*[\${1:${term}}]: \${2:${definition}}${after}`)
  editor.focus()
}

/**
 * Escape the characters Monaco's snippet parser reads as syntax, so a translated placeholder is
 * inserted as the words it is
 */
function snippetEscape(text) {
  return text.replace(/[\\$}]/g, '\\$&')
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
  // -> A formula in a line of text keeps to the line: the notice is its tooltip, not a paragraph
  if (el.hasAttribute('inline')) {
    el.title = t('editor.blockNotEnabled')
    return
  }
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
    //    sits in -- and it is being edited, so it is whatever the path field says right now. A note
    //    sits in no folder, so its relative links are relative to the root
    html = md.render(newContent, { pagePath: props.noteKey ? '' : pageStore.path })
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
    `scrollTop` is clamped to zero, which threw the preview back to the top of the document on every
    keystroke -- and the scroll sync, whatever its rules, would then have to bring it back from there.

    Which tab is open is the second. A block is a custom element with state of its own, and a rebuilt one
    starts again from its defaults -- so typing in the second panel of a tabset kept throwing the author
    back to the first. Carried across by position: the source order of the blocks is what survives an
    edit, not the elements. See `active` in `blocks/block-tabs`.
  */
  const scrollTop = container?.scrollTop ?? 0
  const openTabs = [...(container?.querySelectorAll('block-tabs') ?? [])].map(
    (el) => el.active ?? 0
  )

  docStore.setRender(html)
  headings.value = md.headings
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
      tall-second tabset, which the scroll sync then had to make up on every keystroke.
    */
    await Promise.all(tabsets.map((el) => el.updateComplete ?? Promise.resolve()))
    container.scrollTop = scrollTop
    previewScrollSync.rendered()
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
  // -> A live note has no save to upload them on, so they go up now and nowhere near the File Manager
  if (props.noteKey) {
    uploadNoteImages(files)
    return
  }
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
  if (props.noteKey) {
    // -> Nothing is ever pending in a note -- its room stores it -- so the change timestamp the
    //    unsaved-changes guard reads is left alone
    liveNoteStore.content = editor.getValue()
  } else {
    editorStore.$patch({
      lastChangeTimestamp: Temporal.Now.instant()
    })
    pageStore.$patch({
      content: editor.getValue(),
      // -> What the author has typed IS the source, whatever the load did or did not deliver; see
      //    the guard in `pageSave`
      contentLoaded: true
    })
  }
  processContent(docStore.content)
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

/**
 * Put back a whole source the author wrote and never saved — see `composables/editorBuffer.js`.
 *
 * The one case where replacing everything IS the edit, so it is done as one: a single edit over the
 * full range rather than `setValue`, which keeps it undoable and, in a collaborative session, carries
 * it into the room through the binding as this author's change. Only asked for once `isReady` says
 * the binding is in place, since a source put in before it would be overwritten by the room's.
 */
/**
 * A level-one heading line, split into what introduces it and its text. An empty one -- `#` alone,
 * which markdown reads as a heading with no text -- matches too, since that is what a title cleared
 * mid-edit leaves behind.
 */
const H1_LINE = /^( {0,3}#)(?:[ \t]+(.*?))?[ \t]*$/

/**
 * A live note's title, typed into the bar above the editor, written into the note itself: the H1 that
 * opens it, or a new one inserted at the top when it does not open with one. Only ever a note's, since
 * a page has a title field of its own.
 *
 * "Opens it" is the first line that is not blank. The title the bar SHOWS is the note's first heading
 * of any level (`noteTitleOf`), so a note that starts with an H2 gains an H1 above it the first time
 * its title is typed -- after which the two are the same line.
 *
 * An edit like any other, through the binding and into the room, and only of the characters that
 * changed: replacing the whole line on every keystroke would land on anybody else typing in it as
 * their own text being deleted.
 *
 * @param {object} payload
 * @param {string} payload.title What the bar holds.
 * @param {boolean} [payload.final] The bar has lost focus. An empty title then takes its heading away
 *   rather than leaving a `#` with nothing after it; while typing, an empty one is somebody about to
 *   write a new title, and keeps its line.
 */
function setNoteTitle({ title, final = false }) {
  const model = editor.getModel()
  const text = title.replace(/[\r\n]+/g, ' ')
  const lineCount = model.getLineCount()
  let line = 1
  while (line <= lineCount && model.getLineContent(line).trim() === '') {
    line++
  }
  const current = line <= lineCount ? model.getLineContent(line) : ''
  const heading = line <= lineCount ? H1_LINE.exec(current) : null

  if (!heading) {
    if (text.trim()) {
      editor.executeEdits('title', [{ range: new Range(1, 1, 1, 1), text: `# ${text}\n\n` }])
    }
    return
  }

  if (final && !text.trim()) {
    // -> The heading line, and the blank line under it that inserting one adds
    const end =
      line < lineCount && model.getLineContent(line + 1).trim() === '' ? line + 2 : line + 1
    const range =
      end <= lineCount
        ? new Range(line, 1, end, 1)
        : new Range(line, 1, lineCount, model.getLineMaxColumn(lineCount))
    editor.executeEdits('title', [{ range, text: '' }])
    return
  }

  const next = `${heading[1]} ${text}`
  if (next === current) {
    return
  }
  let start = 0
  while (start < current.length && start < next.length && current[start] === next[start]) {
    start++
  }
  let end = 0
  while (
    end < current.length - start &&
    end < next.length - start &&
    current[current.length - 1 - end] === next[next.length - 1 - end]
  ) {
    end++
  }
  editor.executeEdits('title', [
    {
      range: new Range(line, start + 1, line, current.length - end + 1),
      text: next.slice(start, next.length - end)
    }
  ])
}

function restoreEditorContent({ content }) {
  const model = editor.getModel()
  editor.pushUndoStop()
  editor.executeEdits('restore', [{ range: model.getFullModelRange(), text: content ?? '' }])
  editor.pushUndoStop()
  syncContentToStore.flush()
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
    // -> Both taken from HedgeDoc's editor. The app's own `--color-amber` reads as yellow against a
    //    background this dark
    rules: [
      { token: 'keyword.heading', foreground: 'eda15e', fontStyle: 'bold' },
      { token: 'link.text', foreground: '8bc577' }
    ],
    colors: {
      'editor.background': '#070a0d',
      'editor.lineHighlightBackground': '#0d1117',
      'editorLineNumber.foreground': '#546e7a',
      'editorGutter.background': '#0d1117'
    }
  })

  // -> Set rather than left to Monaco's lazy loader, which would register the stock tokenizer: a
  //    provider set directly is used in place of the loader's factory, and replaces one it already made
  monaco.languages.setMonarchTokensProvider('markdown', markdownLanguageForTheme())

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
    // -> The site's choice, under Admin -> Editors -> Markdown. Off unless it says otherwise, which is
    //    also what a site that has never saved the option gets
    minimap: { enabled: editorStore.editors.markdown?.minimap === true },
    padding: { top: 10, bottom: 10 },
    scrollBeyondLastLine: false,
    tabSize: 2,
    theme: 'wikijs',
    value: docStore.content,
    wordWrap: 'on'
  })

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
  const addTableRowCommand = editor.addCommand(0, (_accessor, line) => addTableRow(line))
  const addTableColumnCommand = editor.addCommand(0, (_accessor, line) => addTableColumn(line))
  tableLensProvider = monaco.languages.registerCodeLensProvider('markdown', {
    provideCodeLenses(model) {
      /*
        "Add Row" and "Add Column" beside it, from the same provider so the three always come in the
        same order. They edit the source in place rather than through the overlay -- see
        `tableRowToAdd` -- and are offered over the same tables, since a table the overlay cannot hold
        is one these could not be trusted to read either.
      */
      const lenses = []
      for (const table of findEditableTables(model.getValue())) {
        const range = new Range(table.startLine, 1, table.startLine, 1)
        const lens = (id, title) => ({
          range,
          command: { id, title, arguments: [table.startLine] }
        })
        lenses.push(
          lens(editTableCommand, t('editor.markup.editTable')),
          lens(addTableRowCommand, t('editor.markup.addTableRow')),
          lens(addTableColumnCommand, t('editor.markup.addTableColumn'))
        )
      }
      return { lenses, dispose() {} }
    }
  })

  /*
    "Edit Block Parameters" over every block in the page, for the same reason the table has one: what
    a block was given is a list of quoted attributes on one line, which is a poor thing to edit by
    hand and an easy thing to offer a form for.

    It appears only over a block this editor holds a definition for and that has something to fill in.
    A child block -- a `::block-tab` inside a tabset -- is one it never does: those are left out of
    the list the API answers with, having no switch of their own to be listed against.

    "Edit Content" joins it over a block whose definition NAMES an editor for its body and whose body
    is a single fenced source to hand that editor. Both lenses come from this one provider rather than
    a provider each, which is what fixes the order they appear in: two providers over the same line are
    merged in whatever order the registry holds them, and a block would get its two links either way
    round. Content first, since it is the block itself -- its parameters are how it is drawn.
  */
  const editBlockCommand = editor.addCommand(0, (_accessor, line, block) => editBlock(line, block))
  const editBlockContentCommand = editor.addCommand(0, (_accessor, line, block) =>
    editBlockContent(line, block)
  )
  blockLensProvider = monaco.languages.registerCodeLensProvider('markdown', {
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

  // -> Block names and parameters, code fence attributes and HTML tags, as they are typed
  blockCompletions.register()
  fenceCompletions.register()
  tagCompletions.register()
  linkCompletions.register()
  tableCellNavigation.register()

  // -> "Image Properties" over every image in the page -- see `useImagePropertiesLens`
  imageLens.register()

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
      // -> Still claimed in a note, where there is nothing to save: the browser's own Save Page As
      //    is not what anybody pressing it in an editor wants either
      if (!props.noteKey) {
        EVENT_BUS.emit('savePage')
      }
    }
  })

  // -> Handle content change
  editor.onDidChangeModelContent(syncContentToStore)

  // -> Which section of the Contents pane the caret is in. Not debounced: it is one number
  editor.onDidChangeCursorPosition((ev) => {
    cursorLine.value = ev.position.lineNumber
  })

  // -> Preview scroll sync
  previewScrollSync.register()

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
    /*
      A page's session is this editor's own. A note's is already open: the note's view holds it for as
      long as the note is on screen, so that switching to the Reader view and back is not a reconnect
      -- which is also why the watcher below runs at once, the room having perhaps answered already.
    */
    if (!props.noteKey) {
      startCollabSession({ siteId: siteStore.id, pageId: pageStore.id })
    }

    /*
      Both handles are kept, and both are stopped by hand on the way out.

      A watcher created during `setup` belongs to the component and stops with it. These do not: this
      hook is `async`, and everything after its first `await` runs with no component instance current
      — so Vue has nothing to attach them to and they outlive the editor they were written for. Left
      running they fire on the NEXT session's connection and reach for a Monaco editor that has been
      disposed, and one more pair is added every time an editor is opened.
    */
    collabWatchers.push(
      watch(
        () => collabStore.status,
        async (status) => {
          /*
            Not for a note, whose page asks for the note again on a refusal and says what it finds --
            deleted, switched off, signed out -- in place of the editor. See `pages/LiveNote.vue`.
          */
          if (status === 'denied' && !props.noteKey) {
            notify({
              type: 'warning',
              message: t('editor.collab.notAllowed')
            })
          }
          if (status === 'connecting') {
            return
          }
          /*
            A note stays read-only until its room has answered once. The room IS the note: an editor
            released without it holds an empty document that nothing would ever store, and whatever
            was typed into it would be replaced by the note the moment the room did answer. After
            that first sync a dropped connection is harmless, as it is for a page -- the edits are
            held in the shared document and merged when the socket comes back.
          */
          if (props.noteKey && !collabStore.hasSynced) {
            return
          }
          editor.updateOptions({ readOnly: false })
          /*
            A note binds whatever the socket is doing, once the room has answered: the document is
            already here, and what is typed into it while the socket is down is merged when it comes
            back. An editor mounted onto a session that had dropped, and bound only on reconnecting,
            would have whatever was typed in between replaced by the document.
          */
          if (status === 'connected' || props.noteKey) {
            await bindCollabEditor(editor)
            // -> The editor was closed while the binding loaded, and is not ready for anything
            if (unmounted || !isCollabActive()) {
              return
            }
          }
          /*
            Holding the room's document now, or carrying on as a plain editor without one -- and the
            store says so before anything asks: what the room holds may be somebody's unsaved edit,
            and the debounce would leave the store on the loaded page for another half second.
          */
          syncContentToStore.flush()
          editorStore.isReady = true
        },
        { immediate: true }
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
    processContent(docStore.content)
  })

  EVENT_BUS.on('insertAsset', insertAssetClb)
  EVENT_BUS.on('insertTable', insertTableClb)
  EVENT_BUS.on('insertBlock', insertBlockClb)
  EVENT_BUS.on('replaceBlockContent', replaceBlockContentClb)
  EVENT_BUS.on('reloadEditorContent', reloadEditorContent)
  EVENT_BUS.on('restoreEditorContent', restoreEditorContent)
  if (props.noteKey) {
    EVENT_BUS.on('setNoteTitle', setNoteTitle)
  }

  // -> Ready now, unless a room is still to answer -- the status watcher above says when that is.
  //    Not if the editor was closed while this hook was still awaiting.
  if (!collabEnabled.value && editorStore.isActive) {
    editorStore.isReady = true
  }
})

onBeforeUnmount(() => {
  unmounted = true
  // -> A sync still waiting would read the editor after it is disposed below, which reads as empty
  syncContentToStore.cancel()
  // -> First, because everything below is what they reach for: these are not stopped by the component
  //    going away, and one that fires afterwards finds a disposed editor
  for (const stop of collabWatchers.splice(0)) {
    stop()
  }
  EVENT_BUS.off('insertAsset', insertAssetClb)
  EVENT_BUS.off('insertTable', insertTableClb)
  EVENT_BUS.off('insertBlock', insertBlockClb)
  EVENT_BUS.off('replaceBlockContent', replaceBlockContentClb)
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  EVENT_BUS.off('restoreEditorContent', restoreEditorContent)
  EVENT_BUS.off('setNoteTitle', setNoteTitle)
  pasteCaptureNode?.removeEventListener('paste', onEditorPaste, true)
  monacoRef.value?.removeEventListener('dragover', onEditorDragOver)
  monacoRef.value?.removeEventListener('drop', onEditorDrop)
  // -> Registered against the markdown language, not this editor, so nothing else takes it down
  tableLensProvider?.dispose()
  blockLensProvider?.dispose()
  blockCompletions.dispose()
  fenceCompletions.dispose()
  tagCompletions.dispose()
  linkCompletions.dispose()
  tableCellNavigation.dispose()
  imageLens.dispose()
  // -> Before the editor goes: the binding is holding the model, and leaving the room is what takes
  //    this author's avatar out of everyone else's header. A note's room is left open behind it, for
  //    the view that holds it to close -- see `pages/LiveNote.vue`
  if (props.noteKey) {
    unbindCollabEditor()
  } else {
    stopCollabSession()
  }
  /*
    Anything pasted but never uploaded goes with the session that held it. This hook is where an
    editing session ends, whichever way it ended -- discarded, closed, submitted as a suggestion, or
    walked away from by following a link -- because the editor is mounted exactly while
    `editorStore.isActive` holds (see `pages/Index.vue`). A save has already emptied this by the time
    it gets here: the upload runs before the page goes up, not after.
  */
  editorStore.clearPendingAssets()
  previewScrollSync.dispose()
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
@use '@/css/_bricks.scss' as *;

$editor-height: calc(100vh - 64px - 96px);
$editor-preview-height: calc(100vh - 64px - 96px - 32px);
$editor-height-mobile: calc(100vh - 112px - 16px);

.editor-markdown {
  /*
    The Contents pane's width (`-size`, which `EditorContentsPane.vue` reads), and what of it the
    preview's own width has to allow for (`-width`): its measure is worked out from the window (`50vw`
    below) rather than from the pane, and a third column takes half of itself out of each of the other
    two. The second is 0 while there is no pane -- and still the full size while one is sliding away;
    see `contentsLaidOut` in `useEditorPanes`.
  */
  --editor-contents-size: 200px;
  &.has-contents {
    --editor-contents-width: var(--editor-contents-size);
  }
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

    // -> The page's own background in each theme: this is the render, and a tint here is a tint the article does not have
    @at-root .body--light & {
      background-color: #fff;
    }
    @at-root .body--dark & {
      background-color: $dark;
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
    /*
      Dark in either appearance, where this used to follow the theme. Two reasons, and the second is
      the one that settled it: the bar labels the render rather than being part of it, so a dark strip
      reads as a caption on the pane instead of as more page; and the brickwork at its right end needs
      a colour with room above it -- `$grey-3` is 93% lightness, so a seam brick a shade lighter than
      it is white, which is a hole rather than a highlight.
    */
    &-toolbar {
      height: 32px;
      display: flex;
      align-items: center;
      padding: 0 1rem;
      background-color: $dark-2;
      color: $grey-6;

      /*
        -> The right end steps out of the bar's grey into the editor orange, as brickwork -- the same
           treatment the Visual editor's toolbar gets, and for the same reason: the actions rail is
           orange while an editor is open, and this bar runs up to it. `css/_bricks.scss` has the
           whole of how and why.
      */
      @include brick-transition($dark-2);

      // -> The menu at the right end kept clear of the brickwork, which is six bricks wide at its
      //    bottom course (the staircase and the seam beside it)
      padding-right: calc(var(--brick) * 6 + 0.5rem);

      /*
        -> Nothing orange beside the bar to step into: a live note has no actions rail
           (`pages/LiveNote.vue`), and with the contents column open it is that column's bar that
           meets the rail. The bricks are its background, and nothing else is -- so with them gone,
           nothing needs keeping clear either.
      */
      &.is-railless {
        background-image: none;
        padding-right: 1rem;
      }
    }

    /*
      -> A shade lighter than the bar's own text colour, which the two icon buttons beside it still
         take: this is the one piece of writing on the strip and what names the pane, so it carries
         slightly more of the reader's attention than the controls do.
    */
    &-label {
      color: $grey-5;
    }
    &-content {
      height: $editor-preview-height;
      overflow-y: scroll;
      padding: 1rem;
      // -> Half the window, less half of each rail -- which, the two being the same width, is one of them
      max-width: calc(50vw - #{$rail-width} - 1px - var(--editor-contents-width, 0px) / 2);

      /*
        The site theme's Centered content width, so the preview wraps where the page will. The pane is
        the scrolling box and the render goes straight into it (see the template), so the measure is
        made out of padding rather than a box inside: whatever the element is wider than the measure
        by goes either side. `min()` is the element's own width -- the pane, up to the cap above --
        since a percentage here is the pane's. Only a wide window gets past the cap to make any
        difference. The title's rule stops at the text, as it does on the page.
      */
      &.is-centered {
        --content-bleed: 0px;
        padding-inline: max(
          1rem,
          calc(
            (
                min(100%, 50vw - #{$rail-width} - 1px - var(--editor-contents-width, 0px) / 2) -
                  $content-centered-max-width
              ) /
              2
          )
        );
      }
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
      /* -> An inline formula, left as its TeX source in the sentence, underlined rather than boxed */
      [data-block-disabled][inline] {
        display: inline;
        margin: 0;
        padding: 0;
        border-left: 0;
        border-radius: 0;
        border-bottom: 2px solid var(--content-danger);
        font-family: monospace;
        cursor: help;
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
    /*
      The actions rail's width (`$rail-width`), and held to it: as a flex item this could otherwise
      shrink, and did -- the source and the preview take half the row each, so with the Contents pane
      beside them the row overflows and every item gave up its share, this one included.
    */
    flex: 0 0 $rail-width;
    width: $rail-width;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: 12px 0;
  }
}
</style>
