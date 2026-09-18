<template>
  <div class="editor-visual">
    <div class="editor-visual-main">
      <!-- ------------------------------------------------------- -->
      <!-- SIDE TOOLBAR -->
      <!-- ------------------------------------------------------- -->
      <div class="editor-visual-sidebar">
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
        <span class="editor-visual-type">{{ t('editor.visual.name') }}</span>
      </div>

      <div class="editor-visual-mid">
        <!-- ------------------------------------------------------- -->
        <!-- TOP TOOLBAR -->
        <!-- ------------------------------------------------------- -->
        <div class="editor-visual-toolbar">
          <w-btn
            dense
            icon="mdi:format-bold"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.strong }"
            @click="runToggleStrong">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.bold')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-italic"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.em }"
            @click="runToggleEm">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.italic')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            v-if="underlineEnabled"
            dense
            icon="mdi:format-underline"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.underline }"
            @click="runToggleUnderline">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.underline')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-strikethrough"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.strike }"
            @click="runToggleStrike">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.strikethrough')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-color-highlight"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.mark }"
            @click="runToggleMark">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.highlight')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:code-tags"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.code }"
            @click="runToggleCode">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.inlineCode')
            }}</w-tooltip>
          </w-btn>

          <w-separator class="mx-1" vertical inset dark />

          <w-btn dense icon="mdi:format-header-pound" padding="xs sm" flat>
            <w-menu anchor="bottom left" self="top left">
              <w-list dense padding>
                <w-item clickable @click="setParagraph">
                  <w-item-section side><w-icon name="mdi:format-paragraph" /></w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t('editor.markup.paragraph') }}</w-item-label>
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" />
                <w-item
                  v-for="level of [1, 2, 3, 4, 5, 6]"
                  :key="`h${level}`"
                  clickable
                  :active="active.heading === level"
                  active-class="text-primary"
                  @click="setHeading(level)">
                  <w-item-section side>
                    <w-icon :name="headingIcons[level - 1]" />
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t('editor.markup.headerLevel', { level }) }}</w-item-label>
                  </w-item-section>
                </w-item>
              </w-list>
            </w-menu>
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.header')
            }}</w-tooltip>
          </w-btn>

          <w-btn
            dense
            icon="mdi:format-subscript"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.sub }"
            @click="runToggleSub">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.subscript')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-superscript"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.sup }"
            @click="runToggleSup">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.superscript')
            }}</w-tooltip>
          </w-btn>

          <w-separator class="mx-1" vertical inset dark />

          <w-btn
            dense
            icon="mdi:format-quote-close"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.blockquote }"
            @click="runWrapBlockquote">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.blockquote')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:alert-box-outline"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.alert }">
            <!--
              Each kind under the icon and in the colour its admonition is drawn with, so picking one
              from this list is picking the thing that will appear on the page.
            -->
            <w-menu anchor="bottom left" self="top left">
              <w-list dense padding>
                <w-item
                  v-for="kind of alertKinds"
                  :key="kind"
                  clickable
                  :active="active.alert === kind"
                  active-class="text-primary"
                  @click="setAlert(kind)">
                  <w-item-section side>
                    <w-icon :name="ALERT_ICONS[kind]" :class="`visual-alert-choice--${kind}`" />
                  </w-item-section>
                  <w-item-section>
                    <w-item-label>{{ t(`editor.visual.alert.${kind}`) }}</w-item-label>
                  </w-item-section>
                </w-item>
              </w-list>
            </w-menu>
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.visual.alert.title')
            }}</w-tooltip>
          </w-btn>

          <w-separator class="mx-1" vertical inset dark />

          <w-btn
            dense
            icon="mdi:format-list-bulleted"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.bulletList }"
            @click="runBulletList">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.unorderedList')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-list-numbered"
            padding="xs sm"
            flat
            :class="{ 'is-active': active.orderedList }"
            @click="runOrderedList">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.orderedList')
            }}</w-tooltip>
          </w-btn>
          <w-btn dense icon="mdi:format-list-checks" padding="xs sm" flat @click="runTaskList">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.markup.taskList')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-indent-increase"
            padding="xs sm"
            flat
            @click="runSinkListItem">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.visual.indent')
            }}</w-tooltip>
          </w-btn>
          <w-btn
            dense
            icon="mdi:format-indent-decrease"
            padding="xs sm"
            flat
            @click="runLiftListItem">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.visual.outdent')
            }}</w-tooltip>
          </w-btn>

          <w-separator class="mx-1" vertical inset dark />

          <w-btn dense icon="mdi:table-cog" padding="xs sm" flat :disabled="!active.table">
            <w-menu anchor="bottom left" self="top left">
              <w-list dense padding>
                <template v-for="item of tableActions" :key="item.key">
                  <w-separator v-if="item.divider" class="my-2" />
                  <w-item v-else clickable @click="item.run">
                    <w-item-section side><w-icon :name="item.icon" /></w-item-section>
                    <w-item-section>
                      <w-item-label>{{ t(item.label) }}</w-item-label>
                    </w-item-section>
                  </w-item>
                </template>
              </w-list>
            </w-menu>
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.visual.tableActions')
            }}</w-tooltip>
          </w-btn>

          <w-separator class="mx-1" vertical inset dark />

          <w-btn dense icon="mdi:undo-variant" padding="xs sm" flat @click="runUndo">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.visual.undo')
            }}</w-tooltip>
          </w-btn>
          <w-btn dense icon="mdi:redo-variant" padding="xs sm" flat @click="runRedo">
            <w-tooltip anchor="top middle" self="bottom middle">{{
              t('editor.visual.redo')
            }}</w-tooltip>
          </w-btn>
        </div>

        <!-- ------------------------------------------------------- -->
        <!-- PROSEMIRROR EDITOR -->
        <!-- ------------------------------------------------------- -->
        <div
          class="editor-visual-editor"
          @paste="onEditorPaste"
          @dragover="onEditorDragOver"
          @drop="onEditorDrop">
          <div ref="mountRef" class="editor-visual-surface" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { debounce } from 'es-toolkit/function'

import { collabHandles, startCollabSession, stopCollabSession } from '@/composables/collab'
import { dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { assetPath } from '@/helpers/assets'
import { blockMarkdown } from '@/helpers/blocks'

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

/*
  ProseMirror's own base styles, which are behaviour rather than decoration — the editing surface's
  whitespace handling, the table wrapper's overflow, the resize cursor. Imported here rather than in
  the stylesheet so that they travel with this lazily-loaded component instead of with the app.
*/
import 'prosemirror-view/style/prosemirror.css'
import 'prosemirror-tables/style/tables.css'
import 'prosemirror-gapcursor/style/gapcursor.css'

import { createVisualEditor } from '@/editor/visual'
import { readFencedBody, writeFencedBody } from '@/editor/visual/blockBody'
import {
  insertDefinitionList as insertDefinitionListCommand,
  insertNode,
  insertTable as insertTableCommand,
  markActive,
  nodeActive,
  toggleAlert,
  toggleHeading,
  toggleTaskList
} from '@/editor/visual/commands'
import { applyImageEdit, applyImageSrc, findImage } from '@/editor/visual/images'
import { applyLink, removeLink } from '@/editor/visual/links'
import { ALERT_KINDS, schema } from '@/editor/visual/schema'

import { lift, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands'
import { liftListItem, sinkListItem, wrapInList } from 'prosemirror-schema-list'
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
  toggleHeaderColumn,
  toggleHeaderRow
} from 'prosemirror-tables'

// STORES

const collabStore = useCollabStore()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const mountRef = ref(null)

/**
 * Whether this edit is shared with whoever else has the page open.
 *
 * Deliberately narrow, and the same reading the Markdown editor takes: a page being created has no id
 * to gather anyone around yet, and a suggestion is one person's private draft of a page they may not
 * write to — the server refuses a room for it, and asking for one anyway would only produce a rejected
 * socket on every keystroke.
 */
const collabEnabled = computed(
  () =>
    siteStore.features.collaborativeEditing &&
    userStore.authenticated &&
    editorStore.mode === 'edit' &&
    Boolean(pageStore.id)
)

/**
 * What the toolbar lights up.
 *
 * Recomputed from the selection rather than tracked as the author types, because a mark is on or off
 * depending on where the caret IS — moving it changes every one of these without a single edit.
 */
const active = reactive({
  strong: false,
  em: false,
  underline: false,
  strike: false,
  mark: false,
  code: false,
  sub: false,
  sup: false,
  heading: 0,
  blockquote: false,
  alert: '',
  bulletList: false,
  orderedList: false,
  table: false
})

const headingIcons = [
  'mdi:format-header-1',
  'mdi:format-header-2',
  'mdi:format-header-3',
  'mdi:format-header-4',
  'mdi:format-header-5',
  'mdi:format-header-6'
]
const alertKinds = ['note', 'tip', 'important', 'warning', 'caution']

/**
 * The icon each alert kind is drawn with, matching what the content stylesheet masks into the
 * admonition itself -- see the `is-info` family in `_page-contents.scss`, which is where these came
 * from and what they have to keep agreeing with.
 *
 * Written as literals so `scripts/generate-icons.mjs` can see them: an icon named by a string built at
 * runtime is invisible to that scan and falls through to resolving against `/_icons`.
 */
const ALERT_ICONS = {
  note: 'mdi:information',
  tip: 'mdi:check-circle',
  important: 'mdi:message-alert',
  warning: 'mdi:alert',
  caution: 'mdi:close-box'
}

/** The editor itself, held outside Vue's reactivity — a ProseMirror view is not a plain object. */
let editor = null
/** What the site says about blocks, for the parameters form and for what is switched off. */
let siteBlocks = []
const disabledBlockTags = new Set()
/** Which block the content editor overlay was opened over, so its answer knows where to go back. */
let editingBlockPos = null

const underlineEnabled = ref(false)

// METHODS

/** Run a ProseMirror command against the live view, and keep the focus in the document. */
function run(command) {
  if (!editor) {
    return
  }
  command(editor.view.state, editor.view.dispatch, editor.view)
  editor.view.focus()
}

const runToggleStrong = () => run(toggleMark(schema.marks.strong))
const runToggleEm = () => run(toggleMark(schema.marks.em))
const runToggleUnderline = () => run(toggleMark(schema.marks.underline))
const runToggleStrike = () => run(toggleMark(schema.marks.strike))
const runToggleMark = () => run(toggleMark(schema.marks.mark))
const runToggleCode = () => run(toggleMark(schema.marks.code))
const runToggleSub = () => run(toggleMark(schema.marks.sub))
const runToggleSup = () => run(toggleMark(schema.marks.sup))
const runBulletList = () => run(wrapInList(schema.nodes.bullet_list))
const runOrderedList = () => run(wrapInList(schema.nodes.ordered_list))
const runTaskList = () => run(toggleTaskList)
const runSinkListItem = () => run(sinkListItem(schema.nodes.list_item))
const runLiftListItem = () => run(liftListItem(schema.nodes.list_item))
const runUndo = () => editor?.undo()
const runRedo = () => editor?.redo()
const setHeading = (level) => run(toggleHeading(level))
const setParagraph = () => run(setBlockType(schema.nodes.paragraph))
const setAlert = (kind) => run(toggleAlert(kind))

function runWrapBlockquote() {
  run(active.blockquote ? lift : wrapIn(schema.nodes.blockquote))
}

const tableActions = [
  {
    key: 'colBefore',
    icon: 'mdi:table-column-plus-before',
    label: 'editor.visual.table.addColumnBefore',
    run: () => run(addColumnBefore)
  },
  {
    key: 'colAfter',
    icon: 'mdi:table-column-plus-after',
    label: 'editor.visual.table.addColumnAfter',
    run: () => run(addColumnAfter)
  },
  {
    key: 'colDelete',
    icon: 'mdi:table-column-remove',
    label: 'editor.visual.table.deleteColumn',
    run: () => run(deleteColumn)
  },
  { key: 'd1', divider: true },
  {
    key: 'rowBefore',
    icon: 'mdi:table-row-plus-before',
    label: 'editor.visual.table.addRowBefore',
    run: () => run(addRowBefore)
  },
  {
    key: 'rowAfter',
    icon: 'mdi:table-row-plus-after',
    label: 'editor.visual.table.addRowAfter',
    run: () => run(addRowAfter)
  },
  {
    key: 'rowDelete',
    icon: 'mdi:table-row-remove',
    label: 'editor.visual.table.deleteRow',
    run: () => run(deleteRow)
  },
  { key: 'd2', divider: true },
  {
    key: 'merge',
    icon: 'mdi:table-merge-cells',
    label: 'editor.visual.table.mergeCells',
    run: () => run(mergeCells)
  },
  {
    key: 'split',
    icon: 'mdi:table-split-cell',
    label: 'editor.visual.table.splitCell',
    run: () => run(splitCell)
  },
  { key: 'd3', divider: true },
  {
    key: 'headerRow',
    icon: 'mdi:table-row',
    label: 'editor.visual.table.toggleHeaderRow',
    run: () => run(toggleHeaderRow)
  },
  {
    key: 'headerCol',
    icon: 'mdi:table-column',
    label: 'editor.visual.table.toggleHeaderColumn',
    run: () => run(toggleHeaderColumn)
  },
  { key: 'd4', divider: true },
  {
    key: 'delete',
    icon: 'mdi:table-large-remove',
    label: 'editor.visual.table.deleteTable',
    run: () => run(deleteTable)
  }
]

/** Read the toolbar's state off the selection. */
function refreshActive() {
  if (!editor) {
    return
  }
  const state = editor.view.state
  active.strong = markActive(state, schema.marks.strong)
  active.em = markActive(state, schema.marks.em)
  active.underline = markActive(state, schema.marks.underline)
  active.strike = markActive(state, schema.marks.strike)
  active.mark = markActive(state, schema.marks.mark)
  active.code = markActive(state, schema.marks.code)
  active.sub = markActive(state, schema.marks.sub)
  active.sup = markActive(state, schema.marks.sup)
  active.blockquote = nodeActive(state, schema.nodes.blockquote)
  active.bulletList = nodeActive(state, schema.nodes.bullet_list)
  active.orderedList = nodeActive(state, schema.nodes.ordered_list)
  active.table = nodeActive(state, schema.nodes.table)

  const { $from } = state.selection
  active.heading = $from.parent.type === schema.nodes.heading ? $from.parent.attrs.level : 0
  active.alert = ''
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === schema.nodes.alert) {
      active.alert = $from.node(depth).attrs.kind
      break
    }
  }
}

/**
 * Markdown inserted at the caret, as the nodes it parses to.
 *
 * Every overlay in the app hands back markdown — the block picker, the table editor, the file
 * manager — and this is what lets the Visual editor reuse all of them unchanged instead of growing a
 * second set of insert paths that would have to be kept in step with the first.
 */
function insertMarkdown(markdown, { block = false } = {}) {
  if (!editor) {
    return
  }
  const fragment = editor.parseFragment(markdown)
  if (fragment.size === 0) {
    return
  }
  const view = editor.view
  const { $from, from, to } = view.state.selection
  const tr = view.state.tr

  /*
    A block construct replaces the textblock it was invoked in when that block is empty, rather than
    being dropped inside it — inserting a table into the empty paragraph at the end of a page should
    not leave that paragraph stranded above it.
  */
  if (block && $from.parent.isTextblock && $from.parent.content.size === 0) {
    tr.replaceWith($from.before(), $from.after(), fragment)
  } else if (block) {
    // -> After the block the caret is in, since a block construct cannot sit inside a paragraph
    tr.insert($from.after(), fragment)
  } else {
    /*
      Inline: what was parsed is a paragraph holding the inline content, and it is that content that
      goes in — inserting the paragraph itself would break the sentence being written in two.
    */
    const inline = fragment.childCount === 1 && fragment.firstChild.isTextblock
    tr.replaceWith(from, to, inline ? fragment.firstChild.content : fragment)
  }
  view.dispatch(tr.scrollIntoView())
  view.focus()
}

function insertAssets() {
  siteStore.openFileManager({ insertMode: true })
}

/**
 * Whether the file manager was opened to replace the selected image rather than to insert something.
 *
 * A flag and not the image's position: the editor keeps its selection while the overlay is up, so the
 * image is found again from the state when the pick comes back — which is what keeps this right in a
 * session where somebody else's edit has moved everything along in the meantime.
 */
let replacingImage = false

/** Pick a different file for the selected image — see the bar in `images.js`. */
function replaceImage() {
  replacingImage = true
  siteStore.openFileManager({ insertMode: true })
}

/*
  A file manager closed without a pick. Cleared here rather than left standing, since the next thing
  the author inserts would otherwise land on the image instead of at the caret.
*/
watch(
  () => siteStore.overlay,
  (overlay) => {
    if (!overlay) {
      replacingImage = false
    }
  }
)

/** What the file manager handed back, written the way the Markdown editor writes it. */
function insertAssetClb(opts) {
  const replacing = replacingImage && findImage(editor.view.state)
  replacingImage = false
  if (replacing) {
    /*
      Anything that is not a picture would leave a broken image behind — the node stays an image
      whatever its `src` points at — so the pick is refused rather than applied.
    */
    if (opts.type !== 'asset' || !opts.mimeType?.startsWith('image/')) {
      notify({ type: 'warning', message: t('editor.visual.image.replaceNotImage') })
      return
    }
    applyImageSrc(editor.view, replacing.pos, {
      src: assetPath(opts.folderPath, opts.fileName),
      // -> Only where there is nothing to lose: an alt text the author wrote is theirs, not the
      //    file's title
      alt: replacing.node.attrs.alt ? null : opts.title
    })
    return
  }

  let markdown = ''
  switch (opts.type) {
    case 'asset': {
      const isImage = opts.mimeType?.startsWith('image/')
      markdown = `${isImage ? '!' : ''}[${opts.title}](${assetPath(opts.folderPath, opts.fileName)})`
      break
    }
    case 'page': {
      const path = opts.folderPath ? `${opts.folderPath}/${opts.fileName}` : opts.fileName
      markdown = `[${opts.title}](/${path})`
      break
    }
  }
  if (markdown) {
    insertMarkdown(markdown)
  }
}

/**
 * Edit the link the caret is in — its words, its address and its tooltip.
 *
 * The range comes from the bar that offered the action rather than being found again here: it was
 * worked out from the selection at the moment the bar was drawn, and the selection has not moved,
 * since clicking the bar deliberately does not take the focus out of the document.
 */
function editLink(range) {
  dialog({
    component: defineAsyncComponent(() => import('./LinkEditDialog.vue')),
    componentProps: {
      text: range.text,
      href: range.href,
      linkTitle: range.title,
      newTab: range.mdAttrs?.target === '_blank'
    }
  }).onOk(({ text, href, linkTitle, newTab }) => {
    applyLink(editor.view, range, { text, href, title: linkTitle, newTab })
  })
}

function unlink(range) {
  removeLink(editor.view, range)
}

/**
 * The selected image's alt text and how big it is drawn — the latter stored as
 * `markdown-it-imsize`'s `=WxH`.
 *
 * The picture's own size comes off the element that is drawing it rather than out of the document,
 * since nothing in the source says what it is — it is offered as a hint, so that "half of it" is a
 * sum an author can do.
 */
function editImage(target) {
  const el = editor.view.nodeDOM(target.pos)
  dialog({
    component: defineAsyncComponent(() => import('./ImageEditDialog.vue')),
    componentProps: {
      alt: target.node.attrs.alt ?? '',
      width: target.node.attrs.width ?? '',
      height: target.node.attrs.height ?? '',
      naturalWidth: el?.naturalWidth ?? 0,
      naturalHeight: el?.naturalHeight ?? 0
    }
  }).onOk(({ alt, width, height }) => {
    applyImageEdit(editor.view, target.pos, { alt, width, height })
  })
}

/**
 * A new link, from the page-or-URL picker.
 *
 * `href` is what the picker answers with, for both of its tabs. `path` -- which this read at first --
 * is the wiki path of a chosen PAGE and is deliberately empty on the URL tab, so picking a URL
 * produced an empty href and the insert gave up without a word.
 *
 * A selection becomes the link's text; without one the href stands in, or the title of the page that
 * was picked.
 */
function insertLink() {
  dialog({ component: LinkPickerDialog }).onOk(({ href, title, openInNewTab }) => {
    if (!href) {
      return
    }
    const view = editor.view
    const { from, to, empty } = view.state.selection
    // -> How both editors write "open in a new tab": an attribute the renderer reads off the link
    const mdAttrs = openInNewTab ? { target: '_blank' } : null

    if (empty) {
      insertMarkdown(`[${title || href}](${href})${openInNewTab ? '{target="_blank"}' : ''}`)
      return
    }
    view.dispatch(
      view.state.tr.addMark(from, to, schema.marks.link.create({ href, title: null, mdAttrs }))
    )
    view.focus()
  })
}

function insertCodeBlock(language) {
  const view = editor.view
  const { empty } = view.state.selection
  /*
    Marking a few lines and picking a language reads as "this is code", so a selection becomes the
    body of the block rather than being replaced by an empty one.
  */
  const text = empty
    ? ''
    : view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, '\n')
  run(
    insertNode(
      schema.nodes.code_block,
      { params: language ?? '', indented: false },
      text ? schema.text(text) : null
    )
  )
}

function insertTable() {
  run(insertTableCommand(3, 3))
}

function insertHorizontalBar() {
  run(insertNode(schema.nodes.horizontal_rule, { markup: '---' }))
}

/*
  Both of these go in as the markdown they are and are parsed, rather than being built as nodes here.
  It costs nothing and it means the shortcode is resolved by the very rule that will resolve it when
  the page is rendered — an emoji node needs the character as well as the name, and this is where that
  mapping lives.
*/
function insertEmoji(shortcode) {
  insertMarkdown(`:${shortcode}:`)
}

function insertIcon(reference) {
  insertMarkdown(`:${reference}:`)
}

/**
 * A definition list with one empty pair, ready to be typed into.
 *
 * The same shape the Markdown editor's own button produces, which is a term and a definition rather
 * than a bare `dl` — an empty list is not something markdown can even express. Where it goes and
 * where the caret lands afterwards are the command's business; see it for why that matters.
 */
function insertDefinitionList() {
  run(insertDefinitionListCommand())
}

/** The next free footnote label, counting the ones the document already carries. */
function nextFootnoteLabel() {
  const used = new Set()
  editor.view.state.doc.descendants((node) => {
    if (node.type === schema.nodes.footnote_definition) {
      used.add(node.attrs.label)
    }
  })
  let index = 1
  while (used.has(String(index))) {
    index++
  }
  return String(index)
}

/**
 * A footnote: a reference where the caret is, and its body at the end of the document.
 *
 * The end, because that is where markdown-it reports every definition whatever the source says and
 * therefore where a round trip would put it anyway.
 */
function insertFootnote() {
  const label = nextFootnoteLabel()
  const view = editor.view
  const definition = schema.nodes.footnote_definition.createAndFill({ label })
  const tr = view.state.tr.replaceSelectionWith(schema.nodes.footnote_ref.create({ label }), false)
  tr.insert(tr.doc.content.size, definition)
  view.dispatch(tr.scrollIntoView())
  view.focus()
}

/**
 * An abbreviation definition, at the end of the document with the other declarations.
 *
 * The end because that is where it belongs rather than where it happens to be typed: a definition
 * applies to the whole page wherever it sits, and it is also where the parser reports every one it
 * finds. Filled in from its own node view, which is two fields — there is no dialog because there is
 * nothing to decide, only two words to type.
 */
function insertAbbreviation() {
  const view = editor.view
  const node = schema.nodes.abbreviation.create({
    label: t('editor.markup.abbreviationTerm'),
    title: t('editor.markup.abbreviationDefinition')
  })
  view.dispatch(view.state.tr.insert(view.state.doc.content.size, node).scrollIntoView())
  view.focus()
}

function insertBlock() {
  siteStore.$patch({ overlay: 'BlockPicker' })
}

/** The tabset, built from the block's own definition rather than written out a second time here. */
async function insertTabset() {
  try {
    const blocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
    const tabs = blocks.find((block) => block.block === 'tabs' && block.isEnabled)
    if (!tabs) {
      notify({ type: 'warning', message: t('editor.blockPicker.blockUnavailable') })
      return
    }
    insertMarkdown(blockMarkdown(tabs), { block: true })
  } catch (err) {
    notify({ type: 'negative', message: t('editor.blockPicker.loadFailed'), caption: err.message })
  }
}

/** What the block picker built, as the nodes it parses to. */
function insertBlockClb(markdown) {
  insertMarkdown(markdown, { block: true })
}

/** The block as this site describes it, or undefined for one it does not list. */
function blockDefinition(name) {
  return siteBlocks.find((block) => block.block === name)
}

/**
 * The parameters dialog over a block already in the page.
 *
 * The position is read at the moment of the click rather than captured when the block was drawn, for
 * the same reason the Markdown editor looks its blocks up again: the document moves underneath.
 */
function editBlockParams(node, pos) {
  const definition = blockDefinition(node.attrs.name)
  if (!definition) {
    return
  }
  /*
    Seeded from the block's own props rather than from the attributes alone, so a prop the page never
    wrote still opens on the value the block declares. Without it a `select` whose attribute is absent
    opens on nothing at all -- a tab that is not a heading showed an empty Header Level rather than
    "Normal".
  */
  const values = Object.fromEntries(
    (definition.props ?? []).map((prop) => [
      prop.name,
      node.attrs.blockAttrs?.[prop.name] ?? prop.default ?? ''
    ])
  )
  dialog({
    component: defineAsyncComponent(() => import('./BlockParamsDialog.vue')),
    componentProps: { definition, values }
  }).onOk((values) => {
    const view = editor.view
    const current = view.state.doc.nodeAt(pos)
    if (!current || current.type !== node.type) {
      return
    }
    const blockAttrs = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== '' && value != null)
    )
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, blockAttrs }))
    view.focus()
  })
}

/** Whether this block declares an editor for what it holds — the "Content" action. */
function hasContentEditor(name) {
  return Boolean(blockDefinition(name)?.contentEditor)
}

/**
 * Whether this block has any parameters to fill in.
 *
 * What decides whether a block is offered a "Parameters" action at all. `block-tabs` declares none —
 * a tabset is its panels and nothing else — so the button opened a form with no fields in it.
 */
function hasProps(name) {
  return (blockDefinition(name)?.props ?? []).length > 0
}

/** The block's BODY, in whatever editor its definition named. */
function editBlockContent(node, pos) {
  const definition = blockDefinition(node.attrs.name)
  const body = readFencedBody(node.attrs.body)
  if (!definition?.contentEditor || !body) {
    return
  }
  editingBlockPos = pos
  siteStore.$patch({
    overlay: 'BlockContentEditor',
    overlayOpts: {
      editor: definition.contentEditor,
      block: definition,
      params: { ...node.attrs.blockAttrs },
      source: body.source,
      lang: body.lang,
      // -> The Markdown editor puts a line range here; nothing on this side needs one, since the
      //    block is a node and `editingBlockPos` is where it is
      replace: null
    }
  })
}

/**
 * A block body an editor produced, back onto the node it came from.
 *
 * The position is taken into a local BEFORE the field is cleared, and the field is cleared whichever
 * way this returns: writing it back through `editingBlockPos` wrote it back through `null`, which is
 * position -1 to ProseMirror and an exception rather than an edit.
 */
function replaceBlockContentClb({ source }) {
  const pos = editingBlockPos
  editingBlockPos = null
  if (pos === null || !editor) {
    return
  }
  const view = editor.view
  const node = view.state.doc.nodeAt(pos)
  if (!node || node.type !== schema.nodes.block_component) {
    return
  }
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      body: writeFencedBody(node.attrs.body, source)
    })
  )
}

/** What the table editor overlay produced, which is a markdown table. */
function insertTableClb({ markdown }) {
  insertMarkdown(markdown, { block: true })
}

/** Take a node out of the document, for the Remove action on a block. */
function removeNode(pos) {
  const view = editor.view
  const node = view.state.doc.nodeAt(pos)
  if (!node) {
    return
  }
  view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
  view.focus()
}

/** Unwrap a container block, keeping what it held. */
function liftNode(pos) {
  const view = editor.view
  const node = view.state.doc.nodeAt(pos)
  if (!node) {
    return
  }
  view.dispatch(view.state.tr.replaceWith(pos, pos + node.nodeSize, node.content))
  view.focus()
}

/** Fetch a block's code so its custom element upgrades and draws itself. */
function ensureBlockLoaded(tag) {
  if (!customElements.get(tag)) {
    commonStore.loadBlocks([tag])
  }
}

/**
 * Files the author brought in — pasted or dropped — as markdown at the caret.
 *
 * Nothing is uploaded here: each becomes a pending asset behind a `blob:` URL, and
 * `UploadPendingAssetsDialog` sends them on save and rewrites those URLs. The same rule as the
 * Markdown editor, including the refusal while suggesting an edit — nothing would ever send them.
 */
function insertFilesAsAssets(files) {
  if (editorStore.mode === 'suggest') {
    notify({ type: 'warning', message: t('editor.pendingAssetsNotInSuggestions') })
    return
  }
  const markup = files.map((file) => {
    const blobUrl = editorStore.addPendingAsset(file)
    const name = file.name ?? ''
    return file.type?.startsWith('image/') ? `![${name}](${blobUrl})` : `[${name}](${blobUrl})`
  })
  insertMarkdown(markup.join('\n\n'), { block: true })
}

function filesOf(transfer) {
  return [...(transfer?.items ?? [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter(Boolean)
}

function onEditorPaste(event) {
  const files = filesOf(event.clipboardData)
  if (files.length === 0) {
    return
  }
  event.preventDefault()
  insertFilesAsAssets(files)
}

function onEditorDragOver(event) {
  if (filesOf(event.dataTransfer).length > 0) {
    event.preventDefault()
  }
}

function onEditorDrop(event) {
  const files = filesOf(event.dataTransfer)
  if (files.length === 0) {
    return
  }
  event.preventDefault()
  insertFilesAsAssets(files)
}

/**
 * The editor's document onto the page store: the source a save sends, and the render made from it.
 *
 * Debounced because serialising the document and rendering the result is the whole page's worth of
 * work, and the alternative is doing it on every keystroke. NAMED so that it can also be flushed —
 * see `reloadEditorContent`, which needs it to have happened before it returns rather than half a
 * second later. The same shape, and the same reasons, as `syncContentToStore` in `EditorMarkdown`.
 */
/**
 * The collaboration watchers, which have to be stopped by hand — see where they are created.
 *
 * @type {Array<() => void>}
 */
const collabWatchers = []

const syncContentToStore = debounce(() => {
  if (!editor) {
    return
  }
  const markdown = editor.getMarkdown()
  editorStore.$patch({ lastChangeTimestamp: Temporal.Now.instant() })
  pageStore.$patch({
    content: markdown,
    // -> What the author has written IS the source, whatever the load did or did not deliver; see
    //    the guard in `pageSave`
    contentLoaded: true
  })
  pageStore.setRender(editor.getRender())
}, 500)

/**
 * The whole document again, with some strings swapped.
 *
 * Runs from `UploadPendingAssetsDialog` immediately before a save, to turn each pending asset's
 * `blob:` URL into wherever the file actually landed. Applied to the source and reparsed, which is
 * the one place the Visual editor goes through text — a `blob:` URL is in an image's `src` and in a
 * link's `href`, and a search-and-replace over the source catches both without this having to know
 * which nodes can hold one.
 */
function reloadEditorContent({ replacements = [] } = {}) {
  if (!editor || replacements.length === 0) {
    return
  }
  let markdown = editor.getMarkdown()
  for (const { from, to } of replacements) {
    markdown = markdown.split(from).join(to)
  }
  editor.setMarkdown(markdown)
  /*
    And the store follows NOW rather than when the debounce would have got to it.

    This runs immediately before a save. Left to the timer, the sync would land after that save -- so
    the page would go up with a render still full of `blob:` URLs, and then be marked dirty half a
    second later by the very edit that fixed it, needing a second save to publish.
  */
  syncContentToStore.flush()
}

/** Which blocks this site has, for the parameters form and for saying what is switched off. */
async function loadSiteBlocks() {
  try {
    siteBlocks = (await API_CLIENT.get(`sites/${siteStore.id}/blocks`).json()) ?? []
    for (const block of siteBlocks) {
      if (!block.isEnabled) {
        disabledBlockTags.add(`block-${block.block}`)
      }
    }
  } catch (err) {
    // -> Everything draws as it did before; the server strips a disabled block on save either way
    console.warn(`Could not read which blocks this site has enabled: ${err.message}`)
  }
}

// MOUNTED

onMounted(async () => {
  /*
    The sidebar stays, which is what separates this editor from the other two.

    They put a preview beside the source, so the half being typed into is already narrower than the
    page — this one IS the page, drawn with the article's own stylesheet, and given the whole window it
    is drawn wider than the reader will ever see it. Keeping the navigation column takes that column
    back off the width, so a line of text breaks roughly where it is going to break once saved.

    Set explicitly rather than left alone: the flag is one piece of state shared by every editor, so a
    visit to the Markdown editor first would otherwise carry its `true` in here.
  */
  editorStore.$patch({ hideSideNav: false })

  if (!editorStore.configIsLoaded) {
    await editorStore.fetchConfigs()
  }
  /*
    The MARKDOWN editor's configuration, deliberately. The Visual editor writes markdown and previews
    it through the same pipeline, so a config of its own would only be a way for the two to disagree
    about what a page means.
  */
  const config = editorStore.editors.markdown ?? {}
  underlineEnabled.value = Boolean(config.underline)

  await loadSiteBlocks()

  editor = createVisualEditor({
    mount: mountRef.value,
    content: pageStore.content,
    config,
    context: {
      pagePath: () => pageStore.path,
      isDisabled: (tag) => disabledBlockTags.has(tag),
      ensureBlockLoaded,
      hasContentEditor,
      hasProps,
      editBlockParams,
      editBlockContent,
      removeNode,
      liftNode,
      editLink,
      removeLink: unlink,
      editImage,
      replaceImage,
      alertClass: (kind) => ALERT_KINDS[kind] ?? '',
      alertLabel: (kind) => t(`editor.visual.alert.${kind}`),
      t
    },
    onChange: syncContentToStore,
    onSelectionChange: refreshActive
  })

  EVENT_BUS.on('insertAsset', insertAssetClb)
  EVENT_BUS.on('insertBlock', insertBlockClb)
  EVENT_BUS.on('insertTable', insertTableClb)
  EVENT_BUS.on('replaceBlockContent', replaceBlockContentClb)
  EVENT_BUS.on('reloadEditorContent', reloadEditorContent)

  /*
    Live collaboration.

    The editor opens read-only and is released once the room has answered. The binding REPLACES this
    editor's document with the room's, so anything typed before that is about to be overwritten -- by
    an empty document, if the sync has not landed yet. The session gives up after a few seconds (a
    proxy that does not forward websocket upgrades is the usual reason) and the editor is released as
    an ordinary one, so this cannot strand an author in a page they are unable to type in.
  */
  if (collabEnabled.value) {
    editor.view.setProps({ editable: () => false })
    startCollabSession({ siteId: siteStore.id, pageId: pageStore.id })

    /*
      Both handles are kept, and both are stopped by hand on the way out.

      A watcher created during `setup` belongs to the component and stops with it. These do not: this
      hook is `async`, and everything after its first `await` runs with no component instance current
      — so Vue has nothing to attach them to and they outlive the editor they were written for. Left
      running they fire on the NEXT session's connection, reaching for an `editor` that is null, and
      one more pair is added every time an editor is opened.
    */
    collabWatchers.push(
      watch(
        () => collabStore.status,
        (status) => {
          if (status === 'connected') {
            const handles = collabHandles()
            if (handles) {
              editor.enableCollab(handles)
            }
          }
          if (status !== 'connecting') {
            editor.view.setProps({ editable: () => true })
          }
          if (status === 'denied') {
            notify({ type: 'warning', message: t('editor.collab.notAllowed') })
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

  /*
    The store gets the render immediately, before anything is typed. A page opened and saved without
    an edit must not be saved with the render of whatever was in the store before — and a page being
    created has no render at all until this runs.
  */
  nextTick(() => {
    pageStore.setRender(editor.getRender())
    refreshActive()
    editor.view.focus()
  })
})

onBeforeUnmount(() => {
  // -> Anything the debounce was still holding is dropped: the editor is going, and the store must
  //    not be written to after the page has moved on
  syncContentToStore.cancel()
  // -> First, because everything below is what they reach for: these are not stopped by the component
  //    going away, and one that fires afterwards finds a destroyed editor
  for (const stop of collabWatchers.splice(0)) {
    stop()
  }
  // -> Before the editor goes: the binding is holding the document, and leaving the room is what takes
  //    this author's cursor off everyone else's screen
  stopCollabSession()
  EVENT_BUS.off('insertAsset', insertAssetClb)
  EVENT_BUS.off('insertBlock', insertBlockClb)
  EVENT_BUS.off('insertTable', insertTableClb)
  EVENT_BUS.off('replaceBlockContent', replaceBlockContentClb)
  EVENT_BUS.off('reloadEditorContent', reloadEditorContent)
  editor?.destroy()
  editor = null
})
</script>

<style lang="scss">
@use '@/css/_visual-editor.scss';
</style>
