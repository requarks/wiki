<template>
  <w-layout class="note-revisions" view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-history.svg" left size="md" />
      <span>{{ t('liveNote.revisions') }}</span>
      <span class="note-revisions-title">{{ liveNoteStore.title || t('liveNote.untitled') }}</span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-4" v-show="state.loading > 0" color="accent" size="20px" />
      </transition>
      <w-btn-group class="mr-6">
        <w-btn
          push
          dense
          no-caps
          :label="t(`history.sideBySide`)"
          padding="0.285em sm"
          :color="state.inline ? `white` : `secondary`"
          :text-color="state.inline ? `black` : `white`"
          @click="state.inline = false" />
        <w-btn
          push
          dense
          no-caps
          :label="t(`history.inline`)"
          padding="0.285em sm"
          :color="state.inline ? `secondary` : `white`"
          :text-color="state.inline ? `white` : `black`"
          @click="state.inline = true" />
      </w-btn-group>
      <w-btn
        icon="la:times"
        color="pink-2"
        dense
        flat
        :aria-label="t(`common.actions.close`)"
        @click="close">
        <w-tooltip anchor="bottom middle" self="top middle">{{
          t(`common.actions.close`)
        }}</w-tooltip>
      </w-btn>
    </w-header>

    <!-- ----------------------------------------------------- -->
    <!-- TIMELINE -->
    <!-- ----------------------------------------------------- -->
    <w-drawer class="note-revisions-sidebar" :model-value="true" :width="320">
      <w-scroll-area style="height: 100%">
        <div v-if="state.revisions.length > 0" class="py-2">
          <div
            v-for="revision of state.revisions"
            :key="revision.id"
            class="note-revisions-item"
            :class="{ 'is-picked': revision.id === state.selectedId }"
            role="button"
            tabindex="0"
            @click="state.selectedId = revision.id"
            @keydown.enter="state.selectedId = revision.id">
            <div class="note-revisions-dot">
              <w-icon name="la:pen" size="15px" />
            </div>
            <div class="min-w-0 flex-1">
              <strong>{{ humanizeDate(revision.createdAt) }}</strong>
              <div class="note-revisions-meta truncate">
                {{ authorsOf(revision) }}
              </div>
              <div class="note-revisions-meta">
                {{ t('liveNote.revisionLength', { count: revision.length }) }}
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 text-grey-5 text-sm" v-else-if="state.loading < 1">
          {{ t('liveNote.noRevisions') }}
        </div>
      </w-scroll-area>
    </w-drawer>

    <!-- ----------------------------------------------------- -->
    <!-- DIFF -->
    <!-- ----------------------------------------------------- -->
    <w-page-container>
      <w-page class="note-revisions-main">
        <template v-if="selected">
          <!--
            The revision on the left and the note as it stands on the right, which is the question a
            history of a note being written answers: what has happened to it since then. The right side
            follows the note while this is open, so a change somebody makes meanwhile shows up here.
          -->
          <div class="note-revisions-compare">
            <div class="note-revisions-side">
              <div class="min-w-0">
                <div class="truncate">{{ humanizeDate(selected.createdAt) }}</div>
                <div class="note-revisions-meta truncate">{{ authorsOf(selected) }}</div>
              </div>
              <w-icon class="text-grey-6 ml-auto" name="la:arrow-right" />
            </div>
            <div class="note-revisions-side">
              <div class="min-w-0 flex-1">
                <div class="truncate">{{ t('history.current') }}</div>
                <div class="note-revisions-meta truncate">{{ t('liveNote.currentHint') }}</div>
              </div>
              <!-- -> Not for a reader of a locked note: the history is theirs to read, not to put back -->
              <w-btn
                v-if="liveNoteStore.canWrite"
                unelevated
                dense
                no-caps
                icon="la:undo"
                color="negative"
                padding="xs md"
                :label="t(`liveNote.restore`)"
                :disabled="state.sameContent"
                @click="restore" />
            </div>
          </div>
          <div class="note-revisions-same" v-if="state.sameContent">
            {{ t('liveNote.sameContent') }}
          </div>
        </template>
        <div ref="diffEl" class="note-revisions-diff" />
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import * as monaco from 'monaco-editor'

import { confirm } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

import { useLiveNoteStore } from '@/stores/liveNote'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/**
 * A live note's history: the revisions its room took as it was written (`models/liveNotes.ts`), each
 * set against the note as it stands, and any of them put back.
 *
 * Putting one back is an ordinary edit, made through the editor that is open behind this — the whole
 * text replaced in one undoable step, which the room carries to everyone else and stores like any
 * other change. Nothing is lost by it: the note as it was before is the next revision.
 */

// STORES

const liveNoteStore = useLiveNoteStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  /** Newest first, as the API returns them. */
  revisions: [],
  selectedId: null,
  sameContent: false,
  inline: false
})

const diffEl = ref(null)

/* -> Outside `state`, as in `PageHistoryOverlay`: Monaco objects gain nothing from being reactive */
let diffEditor = null
let originalModel = null
let modifiedModel = null

/** Fetched revision sources, by id. */
const contents = new Map()

/** Only the newest selection may touch the editor. */
let applyToken = 0

// COMPUTED

const selected = computed(() => state.revisions.find((r) => r.id === state.selectedId) ?? null)

// WATCHERS

watch(() => state.selectedId, applyDiff)

watch(
  () => state.inline,
  (inline) => diffEditor?.updateOptions({ renderSideBySide: !inline })
)

// -> The right-hand side is the note as it stands, and it keeps standing somewhere new while this is open
watch(
  () => liveNoteStore.content,
  (content) => {
    if (modifiedModel && modifiedModel.getValue() !== content) {
      modifiedModel.setValue(content)
    }
    refreshSameContent()
  }
)

// METHODS

function close() {
  siteStore.$patch({ overlay: '' })
}

function humanizeDate(val) {
  return userStore.formatDateTime(t, val)
}

function authorsOf(revision) {
  return revision.authors.length > 0
    ? revision.authors.map((author) => author.name).join(', ')
    : t('liveNote.unknownAuthors')
}

function refreshSameContent() {
  const content = contents.get(state.selectedId)
  state.sameContent = content !== undefined && content === liveNoteStore.content
}

async function loadRevision(id) {
  if (!contents.has(id)) {
    const revision = await API_CLIENT.get(
      `sites/${siteStore.id}/notes/${liveNoteStore.key}/revisions/${id}`
    ).json()
    contents.set(id, revision.content ?? '')
  }
  return contents.get(id)
}

async function mountEditor() {
  await nextTick()
  if (diffEditor || !diffEl.value) {
    return
  }
  // -> The markdown editor's theme, which is defined by that component and may be defined again here
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
  diffEditor = monaco.editor.createDiffEditor(diffEl.value, {
    automaticLayout: true,
    fontSize: 14,
    renderSideBySide: !state.inline,
    originalEditable: false,
    readOnly: true,
    scrollBeyondLastLine: false,
    theme: 'wikijs',
    wordWrap: 'on'
  })
}

async function applyDiff() {
  if (!state.selectedId) {
    return
  }
  const token = ++applyToken
  state.loading++
  try {
    const content = await loadRevision(state.selectedId)
    await mountEditor()
    if (token !== applyToken || !diffEditor) {
      return
    }
    const previous = [originalModel, modifiedModel]
    originalModel = monaco.editor.createModel(content, 'markdown')
    modifiedModel = monaco.editor.createModel(liveNoteStore.content, 'markdown')
    diffEditor.setModel({ original: originalModel, modified: modifiedModel })
    // -> After the swap: disposing a model the editor still holds blanks the pane
    for (const model of previous) {
      model?.dispose()
    }
    refreshSameContent()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('liveNote.revisionLoadFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.loading--
  }
}

function restore() {
  const revision = selected.value
  if (!revision) {
    return
  }
  confirm({
    title: t('liveNote.restore'),
    message: [
      t('liveNote.restoreConfirm', { date: humanizeDate(revision.createdAt) }),
      t('liveNote.restoreConfirmHint')
    ],
    cancel: true,
    color: 'negative',
    okLabel: t('liveNote.restore')
  }).onOk(async () => {
    try {
      const content = await loadRevision(revision.id)
      // -> The open editor makes the edit, which is what carries it into the room -- see
      //    `restoreEditorContent` in `EditorMarkdown.vue`
      EVENT_BUS.emit('restoreEditorContent', { content })
      notify({ type: 'positive', message: t('liveNote.restoreSuccess') })
      close()
    } catch (err) {
      notify({
        type: 'negative',
        message: t('liveNote.revisionLoadFailed'),
        caption: apiErrorMessage(err)
      })
    }
  })
}

async function load() {
  state.loading++
  try {
    state.revisions =
      (await API_CLIENT.get(`sites/${siteStore.id}/notes/${liveNoteStore.key}/revisions`).json()) ??
      []
    state.selectedId = state.revisions[0]?.id ?? null
  } catch (err) {
    notify({
      type: 'negative',
      message: t('liveNote.revisionsLoadFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.loading--
  }
}

onMounted(load)

onBeforeUnmount(() => {
  applyToken++
  diffEditor?.dispose()
  originalModel?.dispose()
  modifiedModel?.dispose()
  diffEditor = null
  originalModel = null
  modifiedModel = null
})
</script>

<style lang="scss">
.note-revisions {
  .card-header {
    position: relative;
  }

  /* -> Centred on the header itself, as the page history's title is */
  &-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
    font-size: 0.8rem;
    opacity: 0.6;
  }

  &-sidebar {
    background-color: $dark-5;
    color: #fff;
    border-right: 1px solid rgba(#fff, 0.08);
  }

  &-main {
    display: flex;
    flex-direction: column;
    background-color: $dark-6;
    color: #fff;
    height: 100%;
    min-height: 0;
  }

  &-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    cursor: pointer;
    font-size: 0.85rem;
    line-height: 1.35;

    &:hover {
      background-color: rgba(#fff, 0.04);
    }

    /* -> An inset shadow rather than a border, so a picked entry's dot stays where the others' are */
    &.is-picked {
      background-color: rgba($primary, 0.16);
      box-shadow: inset 3px 0 0 $primary;
    }
  }

  &-dot {
    flex: 0 0 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background-color: $primary;
  }

  &-meta {
    font-size: 0.75rem;
    color: rgba(#fff, 0.6);
  }

  &-compare {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(#fff, 0.1);
    font-size: 0.85rem;
  }

  /* -> Half each, so the right side starts on the seam between the diff's two panes */
  &-side {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 0 0 50%;
    min-width: 0;
    padding: 0 1rem;
  }

  &-same {
    flex: 0 0 auto;
    padding: 0.5rem 1rem;
    font-size: 0.8rem;
    color: rgba(#fff, 0.6);
    background-color: rgba(#fff, 0.04);
  }

  &-diff {
    flex: 1 1 auto;
    min-height: 0;
  }
}
</style>
