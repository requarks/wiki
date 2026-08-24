<template>
  <w-layout class="page-history" view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="la:history" left size="md" />
      <span>{{ t('history.title') }}</span>
      <!--
        Centred on the header itself rather than on the space left between the two groups of
        controls, which are nowhere near the same width — hence absolute rather than a pair of
        spacers. Ignores the pointer so it can overlap nothing it would block.
      -->
      <span class="page-history-page">{{ pageStore.title }}</span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-4" v-show="state.loading > 0" color="accent" size="20px" />
      </transition>
      <!--
        How the two versions are laid against each other. Up here rather than over the diff, so the
        compare bar below can stay exactly two halves lining up with the editor's own two panes.
      -->
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
    <w-drawer class="page-history-sidebar" :model-value="true" :width="380">
      <w-scroll-area :thumb-style="thumb" :bar-style="bar" style="height: 100%">
        <div class="page-history-timeline" v-if="state.versions.length > 0">
          <div
            class="page-history-item"
            v-for="(version, idx) of state.versions"
            :key="version.id"
            :class="{ 'is-picked': version.id === state.aId || version.id === state.bId }"
            role="button"
            tabindex="0"
            @click="selectVersion(idx)"
            @keydown.enter="selectVersion(idx)">
            <!-- The subway stop: the line itself is drawn by the item, this is the dot on it. -->
            <div class="page-history-dot" :class="actionStyle(version.action).dot">
              <w-icon :name="actionStyle(version.action).icon" size="15px" />
            </div>
            <div class="page-history-body">
              <div class="flex items-center gap-2">
                <strong>{{ actionLabel(version.action) }}</strong>
                <w-badge v-if="idx === 0" color="primary" rounded>
                  {{ t('history.current') }}
                </w-badge>
              </div>
              <div class="page-history-meta">{{ humanizeDate(version.versionDate) }}</div>
              <div class="page-history-meta">
                {{ version.author.name || t('history.unknownAuthor') }}
              </div>
              <!-- Where it went, which is the whole point of telling a move apart from an edit. -->
              <div class="page-history-meta" v-if="version.action === `moved`">
                /{{ version.path }}
              </div>
            </div>
            <!--
              Stops the click from also reaching the item, which would move both letters at once.
            -->
            <div class="page-history-pick" @click.stop>
              <w-btn
                flat
                dense
                round
                icon="la:ellipsis-h"
                color="grey-5"
                :aria-label="t(`history.versionActions`)">
                <w-menu class="translucent-menu" auto-close anchor="bottom left" self="top left">
                  <!--
                    `!min-w-0 !pr-2` on each icon section, and literal colour classes rather than
                    WIcon's `color` prop — both for the same reasons as the profile menu this copies.
                  -->
                  <w-list dense padding style="min-width: 260px">
                    <w-item clickable @click="pick(`a`, version.id)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="mdi:letter-a-box" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('history.setAsSource') }}</w-item-section>
                    </w-item>
                    <w-item clickable @click="pick(`b`, version.id)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="mdi:letter-b-box" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('history.setAsTarget') }}</w-item-section>
                    </w-item>
                    <w-separator class="my-1" />
                    <w-item clickable @click="viewSource(version)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:code" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('history.viewSource') }}</w-item-section>
                    </w-item>
                    <w-item clickable @click="downloadVersion(version)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:download" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('history.downloadVersion') }}</w-item-section>
                    </w-item>
                    <template v-if="userStore.can(`write:pages`)">
                      <w-separator class="my-1" />
                      <!--
                        Writes over the page, so it reads as the one destructive thing in here — the
                        same red the profile menu gives its one irreversible entry.
                      -->
                      <w-item clickable @click="restoreVersion(version)">
                        <w-item-section avatar class="!min-w-0 !pr-2">
                          <w-icon name="la:undo" class="text-negative" />
                        </w-item-section>
                        <w-item-section>{{ t('history.restore') }}</w-item-section>
                      </w-item>
                      <w-item clickable @click="branchFrom(version)">
                        <w-item-section avatar class="!min-w-0 !pr-2">
                          <w-icon name="la:code-branch" class="text-blue-7" />
                        </w-item-section>
                        <w-item-section>{{ t('history.branchOff') }}</w-item-section>
                      </w-item>
                    </template>
                  </w-list>
                </w-menu>
              </w-btn>
              <!-- Not `unelevated`: the push ledge is the point, and that prop would flatten it. -->
              <w-btn-group>
                <w-btn
                  push
                  glossy
                  dense
                  no-caps
                  label="A"
                  padding="0.285em sm"
                  :color="version.id === state.aId ? `pink-6` : `dark-3`"
                  :aria-label="t(`history.pickA`)"
                  @click="pick(`a`, version.id)" />
                <w-btn
                  push
                  glossy
                  dense
                  no-caps
                  label="B"
                  padding="0.285em sm"
                  :color="version.id === state.bId ? `pink-6` : `dark-3`"
                  :aria-label="t(`history.pickB`)"
                  @click="pick(`b`, version.id)" />
              </w-btn-group>
            </div>
            <!--
              A row of their own, under the buttons rather than beside them: both are prose that runs
              on, and the column left over next to the A/B group is too narrow to read either in.
            -->
            <div
              class="page-history-notes"
              v-if="version.reason || version.changedFields.length > 0">
              <!-- Why, in the author's own words, when the site asks for a reason on save. -->
              <div class="page-history-reason" v-if="version.reason">{{ version.reason }}</div>
              <div class="page-history-fields" v-if="version.changedFields.length > 0">
                {{ t('history.changedFields', { fields: version.changedFields.join(', ') }) }}
              </div>
            </div>
          </div>
        </div>
        <div class="p-4 text-grey-5" v-else-if="state.loading < 1">{{ t('history.none') }}</div>
      </w-scroll-area>
    </w-drawer>

    <!-- ----------------------------------------------------- -->
    <!-- DIFF -->
    <!-- ----------------------------------------------------- -->
    <w-page-container>
      <w-page class="page-history-main">
        <div class="p-4 text-grey-5" v-if="state.notice">{{ state.notice }}</div>
        <template v-else-if="state.versions.length > 0">
          <div class="page-history-compare">
            <div class="page-history-side">
              <span class="page-history-letter">A</span>
              <div class="min-w-0">
                <div class="truncate">{{ sideLabel(sideA) }}</div>
                <div class="page-history-meta truncate">{{ sideCaption(sideA) }}</div>
              </div>
              <!-- A literal class, not `color`: that prop builds one at runtime, which Tailwind
                   never emits. `ml-auto` puts it on the seam between the two panes. -->
              <w-icon class="text-grey-6 ml-auto" name="la:arrow-right" />
            </div>
            <div class="page-history-side">
              <span class="page-history-letter">B</span>
              <div class="min-w-0">
                <div class="truncate">{{ sideLabel(sideB) }}</div>
                <div class="page-history-meta truncate">{{ sideCaption(sideB) }}</div>
              </div>
            </div>
          </div>
          <!--
            An identical diff looks like a failure otherwise: a metadata-only edit leaves the source
            untouched, and the timeline entry is where what actually changed is listed.
          -->
          <div class="page-history-same" v-if="state.sameContent">
            {{ t('history.sameContent') }}
          </div>
          <div ref="diffEl" class="page-history-diff" />
        </template>
      </w-page>
    </w-page-container>
  </w-layout>
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
import { useRouter } from 'vue-router'

import * as monaco from 'monaco-editor'
import { fileSave } from 'browser-fs-access'

import { MarkdownRenderer } from '@/renderers/markdown'

import { confirm, dialog } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'
import { apiErrorMessage } from '@/helpers/apiError'

/**
 * Everything that ever happened to a page, and the difference between any two moments of it.
 *
 * The timeline is the record; A and B are a pair of cursors over it. They are deliberately not "the
 * selected item" — comparing a version against the one immediately before it is only the most common
 * question, not the only one, so clicking an entry sets that up and the two letters then move
 * independently. What the right-hand side shows is always A on the left and B on the right, whichever
 * way round in time they happen to be.
 */

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  /** Newest first, as the API returns them: the first entry is the page as it stands. */
  versions: [],
  /** The left-hand side. Null against the very first version, where there is nothing to compare to. */
  aId: null,
  /** The right-hand side. Never null once there is any history at all. */
  bId: null,
  /** Shown in place of the diff when there is nothing to show one of. */
  notice: '',
  /** Set alongside the models rather than computed: the fetched sources are held outside `state`. */
  sameContent: false,
  /** One column with the changes marked in place, rather than the two-column default. */
  inline: false
})

const thumb = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.25
}
const bar = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.25
}

/**
 * How each kind of change reads on the line. Both halves are literals on purpose: an icon name built
 * at runtime is not inlined by the icon generator, and a class built at runtime is not emitted by
 * Tailwind.
 */
const ACTION_STYLES = {
  created: { icon: 'la:plus', dot: 'bg-positive' },
  updated: { icon: 'la:pen', dot: 'bg-blue-7' },
  moved: { icon: 'la:share', dot: 'bg-warning' },
  deleted: { icon: 'la:trash', dot: 'bg-negative' }
}
const ACTION_FALLBACK = { icon: 'la:circle', dot: 'bg-grey-7' }

// REFS

const diffEl = ref(null)

/*
  The Monaco instances, deliberately outside `state`: they are large objects with their own internals,
  and making them reactive buys nothing and costs a lot.
*/
let diffEditor = null
let originalModel = null
let modifiedModel = null

/** The versions whose source has been fetched, keyed by id. Kept out of `state` for the same reason. */
const contents = new Map()

/** Guards against an out-of-order fetch: only the newest comparison may touch the editor. */
let applyToken = 0

// COMPUTED

const sideA = computed(() => state.versions.find((v) => v.id === state.aId) ?? null)
const sideB = computed(() => state.versions.find((v) => v.id === state.bId) ?? null)

// WATCHERS

watch(() => [state.aId, state.bId], applyDiff)

// -> A live option, so switching keeps the scroll position and the models rather than rebuilding
watch(
  () => state.inline,
  (inline) => diffEditor?.updateOptions({ renderSideBySide: !inline })
)

// METHODS

function close() {
  siteStore.$patch({ overlay: '' })
}

function humanizeDate(val) {
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function actionStyle(action) {
  return ACTION_STYLES[action] ?? ACTION_FALLBACK
}

function actionLabel(action) {
  return ACTION_STYLES[action] ? t(`history.action.${action}`) : action
}

function sideLabel(version) {
  return version ? humanizeDate(version.versionDate) : t('history.emptyPage')
}

/** Who, and why if they said — the same line the timeline entry carries, on one row. */
function sideCaption(version) {
  if (!version) {
    return ''
  }
  const author = version.author.name || t('history.unknownAuthor')
  return version.reason ? `${author} — ${version.reason}` : author
}

/**
 * What one entry changed: itself as B, and whatever came before it as A.
 *
 * The oldest entry has nothing before it, so A goes empty and the diff shows the page arriving.
 */
function selectVersion(idx) {
  state.bId = state.versions[idx]?.id ?? null
  state.aId = state.versions[idx + 1]?.id ?? null
}

/**
 * Move one of the two letters onto a version.
 *
 * The pair can never land on the same entry, so a letter arriving where the other one sits displaces
 * it: normally to the position being vacated, which is a straight swap. The one case that cannot swap
 * is A landing on B while A is nowhere — comparing against the empty page — and there B steps to the
 * next newer entry instead, or the click does nothing if there is no such entry.
 */
function pick(slot, id) {
  const idx = state.versions.findIndex((v) => v.id === id)
  if (slot === 'a') {
    if (state.bId === id) {
      const displaced = state.aId ?? state.versions[idx - 1]?.id
      if (!displaced) {
        return
      }
      state.bId = displaced
    }
    state.aId = id
  } else {
    if (state.aId === id) {
      state.aId = state.bId
    }
    state.bId = id
  }
}

/**
 * A version's source, fetched once.
 *
 * Cached because the two letters walk back and forth over the same handful of entries, and because a
 * version is immutable — there is no state in which a second fetch would answer differently.
 */
async function loadVersion(id) {
  if (!id) {
    return null
  }
  if (contents.has(id)) {
    return contents.get(id)
  }
  const version = await API_CLIENT.get(
    `sites/${siteStore.id}/pages/${pageStore.id}/history/${id}`
  ).json()
  contents.set(id, version)
  return version
}

/** What a version's source is saved as, by the format it was written in. */
const FILE_TYPES = {
  markdown: { ext: 'md', mime: 'text/markdown' },
  html: { ext: 'html', mime: 'text/html' }
}

/**
 * The format a version was written in — which decides how it colours, how it renders and what it
 * downloads as. Taken from the version rather than from the page, since the page may have been
 * converted since.
 */
function contentTypeOf(version) {
  return version?.meta?.contentType || version?.meta?.editor || pageStore.editor || 'markdown'
}

/** A version with its source, with the spinner and the error report the menu actions all want. */
async function withVersion(version) {
  state.loading++
  try {
    return await loadVersion(version.id)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('history.loadFailed'),
      caption: apiErrorMessage(err)
    })
    return null
  } finally {
    state.loading--
  }
}

/**
 * The HTML for a version's source, produced here for the same reason every save produces it here:
 * the markdown pipeline is a frontend one, and the server would otherwise have to drive a headless
 * browser — an extension most instances do not install.
 */
async function renderOf(version, content) {
  if (contentTypeOf(version) !== 'markdown') {
    return content
  }
  // -> The renderer is configured per site (line breaks, typographer, …), and that configuration
  //    arrives with the editor configs rather than on its own
  if (!editorStore.configIsLoaded) {
    await editorStore.fetchConfigs()
  }
  // -> Rendered as the page it is a version of, so a relative image in it resolves the way it does
  //    in the page view rather than against the site root
  return new MarkdownRenderer(editorStore.editors.markdown ?? {}).render(content, {
    pagePath: pageStore.path
  })
}

async function viewSource(version) {
  const full = await withVersion(version)
  if (!full) {
    return
  }
  dialog({
    component: defineAsyncComponent(() => import('./PageVersionSourceDialog.vue')),
    componentProps: {
      content: full.content ?? '',
      date: humanizeDate(full.versionDate)
    }
  })
}

async function downloadVersion(version) {
  const full = await withVersion(version)
  if (!full) {
    return
  }
  const type = FILE_TYPES[contentTypeOf(full)] ?? { ext: 'txt', mime: 'text/plain' }
  // -> Named for the page and the moment, since a folder of `page.md` files says nothing
  const name = full.path.split('/').at(-1) || 'page'
  const stamp = full.versionDate.slice(0, 19).replace(/[:T]/g, '-')
  try {
    /*
      A bare MIME type, with no `;charset=` on it: the save picker uses this as an `accept` key and
      rejects a type carrying parameters outright. Nothing is lost by dropping it — a Blob built from
      a JS string is UTF-8 already.
    */
    await fileSave(new Blob([full.content ?? ''], { type: type.mime }), {
      fileName: `${name}-${stamp}.${type.ext}`,
      extensions: [`.${type.ext}`]
    })
  } catch (err) {
    // -> Dismissing the file picker is not a failure
    if (err.name !== 'AbortError') {
      notify({ type: 'negative', message: t('history.downloadFailed'), caption: err.message })
    }
  }
}

/**
 * Put this version's source back on the page.
 *
 * The source only: the page keeps the title, tags and settings it has now. Restoring those too would
 * quietly undo everything done since, and a reader asking for an old version back is asking for the
 * text. Nothing is lost either way — this is an ordinary edit, so it becomes a version of its own
 * with the current state recorded in it.
 */
function restoreVersion(version) {
  confirm({
    title: t('history.restore'),
    message: [
      t('history.restoreConfirm', { date: humanizeDate(version.versionDate) }),
      t('history.restoreConfirmHint')
    ],
    caption: t('history.versionId', { id: version.id }),
    cancel: true,
    color: 'negative',
    okLabel: t('history.restore')
  }).onOk(async () => {
    const full = await withVersion(version)
    if (!full) {
      return
    }
    state.loading++
    try {
      const content = full.content ?? ''
      const resp = await API_CLIENT.patch(`sites/${siteStore.id}/pages/${pageStore.id}`, {
        json: {
          content,
          render: await renderOf(full, content),
          reasonForChange: t('history.restoreReason', { date: humanizeDate(full.versionDate) })
        }
      }).json()
      if (!resp?.page?.id) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({ type: 'positive', message: t('history.restoreSuccess') })
      // -> The page behind this overlay is now out of date, and so is the timeline: the restore is
      //    itself a version, and it is the one worth landing on
      await pageStore.pageLoad({ id: pageStore.id })
      await load()
    } catch (err) {
      notify({
        type: 'negative',
        message: t('history.restoreFailed'),
        caption: apiErrorMessage(err)
      })
    } finally {
      state.loading--
    }
  })
}

/**
 * Start a new page from this version, leaving this one alone.
 *
 * What to do with an old version that is worth keeping but not worth reverting to. The same path
 * picker as duplicating a page, because that is what this is — a duplicate of a page as it was.
 */
function branchFrom(version) {
  dialog({
    component: defineAsyncComponent(() => import('./TreeBrowserDialog.vue')),
    componentProps: {
      mode: 'duplicatePage',
      folderPath: '',
      itemId: pageStore.id,
      itemTitle: version.title,
      itemFileName: pageStore.path,
      locale: pageStore.locale
    }
  }).onOk(async (target) => {
    const full = await withVersion(version)
    if (!full) {
      return
    }
    state.loading++
    try {
      const content = full.content ?? ''
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/pages`, {
        json: {
          path: target.path,
          title: target.title,
          locale: pageStore.locale,
          editor: full.meta?.editor || pageStore.editor,
          content,
          render: await renderOf(full, content),
          description: full.meta?.description ?? '',
          icon: full.meta?.icon ?? '',
          tags: full.meta?.tags ?? [],
          // -> A version that was scheduled carries dates this new page has not got, and the API
          //    rightly refuses that combination
          publishState: full.meta?.publishState === 'published' ? 'published' : 'draft',
          reasonForChange: t('history.branchReason', { date: humanizeDate(full.versionDate) })
        }
      }).json()
      const page = resp?.page
      if (!page?.id) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({ type: 'positive', message: t('history.branchSuccess') })
      close()
      router.push(`/${page.path}`)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('history.branchFailed'),
        caption: apiErrorMessage(err)
      })
    } finally {
      state.loading--
    }
  })
}

/** The editor is built on first use, since the container only exists once there is history to show. */
async function mountEditor() {
  await nextTick()
  if (diffEditor || !diffEl.value) {
    return
  }

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

  diffEditor = monaco.editor.createDiffEditor(diffEl.value, {
    automaticLayout: true,
    fontSize: 14,
    // -> Side by side by default: this exists to compare the two, and an inline diff of prose reads
    //    as a jumble of half-lines. The header offers the other way for anyone who prefers it.
    renderSideBySide: !state.inline,
    originalEditable: false,
    // -> A reader, not an editor. Restoring a version is its own action, and is not implemented yet.
    readOnly: true,
    scrollBeyondLastLine: false,
    theme: 'wikijs',
    wordWrap: 'on'
  })
}

/** The format the page was written in at the time, which is what colours the two sides. */
function languageOf(version) {
  return contentTypeOf(version) === 'html' ? 'html' : 'markdown'
}

async function applyDiff() {
  const token = ++applyToken
  state.loading++
  try {
    const [a, b] = await Promise.all([loadVersion(state.aId), loadVersion(state.bId)])
    await mountEditor()
    // -> A newer comparison started while this one was in flight, and owns the editor now
    if (token !== applyToken || !diffEditor) {
      return
    }

    state.sameContent = Boolean(a && b && a.content === b.content)

    const previous = [originalModel, modifiedModel]
    originalModel = monaco.editor.createModel(a?.content ?? '', languageOf(a ?? b))
    modifiedModel = monaco.editor.createModel(b?.content ?? '', languageOf(b))
    diffEditor.setModel({ original: originalModel, modified: modifiedModel })
    // -> After the swap, not before: disposing a model the editor still holds blanks the pane
    for (const model of previous) {
      model?.dispose()
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('history.loadFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.loading--
  }
}

function disposeEditor() {
  diffEditor?.dispose()
  originalModel?.dispose()
  modifiedModel?.dispose()
  diffEditor = null
  originalModel = null
  modifiedModel = null
}

async function load() {
  state.loading++
  state.notice = ''
  try {
    state.versions =
      (await API_CLIENT.get(`sites/${siteStore.id}/pages/${pageStore.id}/history`).json()) ?? []
    // -> The timeline says so itself; repeating it in the diff pane would say it twice
    if (state.versions.length < 1) {
      return
    }
    // -> The live version against the one before it: the change the page is carrying right now
    state.bId = state.versions[0].id
    state.aId = state.versions[1]?.id ?? null
  } catch (err) {
    const caption = apiErrorMessage(err)
    state.notice = caption
    notify({
      type: 'negative',
      message: t('history.loadFailed'),
      caption
    })
  } finally {
    state.loading--
  }
}

// MOUNTED

onMounted(load)

onBeforeUnmount(disposeEditor)
</script>

<style lang="scss">
/** The subway line: its colour, and the radius of the turn it makes at the end. */
$timeline-line: rgba(#fff, 0.12);
$timeline-turn: 16px;

.page-history {
  /* -> The header is the positioning context for the page title below */
  .card-header {
    position: relative;
  }

  &-page {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    /* -> Never wide enough to reach either group of controls; a long title is cut instead */
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
    /* -> The grid cell already has a height; this claims it so the diff can fill what is left */
    height: 100%;
    min-height: 0;
  }

  /* The subway line: one continuous rule behind the dots, drawn by the list rather than the items. */
  &-timeline {
    position: relative;
    padding: 1rem 0;

    /*
      The line: down behind the dots, then a quarter turn out to the left edge rather than stopping
      in mid-air.

      Both halves are ONE border of ONE box -- the right and bottom edges of an invisible rectangle,
      joined by a corner radius -- rather than a straight element meeting a curved one. Two elements
      cannot be made to match under fractional display scaling: each snaps to the device pixel grid
      from its own layout box, so at 125% or 150% one lands on a whole device pixel and the other
      straddles two, and the seam shows as a change of thickness. As a single border there is nothing
      to line up: the browser rasterises the straight stretch and the curve as one path.

      The box's right edge sits under the middle of the dots: 1rem of padding, half of the 28px dot,
      half of the 2px line.
    */
    &::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: calc(1rem + 14px + 1px);
      border-right: 2px solid $timeline-line;
      border-bottom: 2px solid $timeline-line;
      border-bottom-right-radius: $timeline-turn;
    }
  }

  &-item {
    position: relative;
    display: flex;
    /* -> Wraps so the notes below can claim a row of their own; no row gap, since they bring their
          own margin */
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 0 0.75rem;
    padding: 0.75rem 1rem;
    cursor: pointer;

    &:hover {
      background-color: rgba(#fff, 0.04);
    }

    /*
      An inset shadow rather than a `border-left`, which is what this was: a border is part of the
      box, so it pushed the row's contents 3px across and took the dot of every picked entry off the
      line while the unpicked ones stayed on it.
    */
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
    /* -> A ring in the sidebar's own colour, so the line appears to pass behind the dot */
    box-shadow: 0 0 0 3px $dark-5;
  }

  &-body {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.85rem;
    line-height: 1.35;
  }

  &-meta {
    font-size: 0.75rem;
    color: rgba(#fff, 0.6);
  }

  /* -> Full width, indented to sit under the entry's text rather than under its dot */
  &-notes {
    flex: 0 0 100%;
    min-width: 0;
    padding-left: calc(28px + 0.75rem);
  }

  &-reason {
    margin-top: 0.25rem;
    font-size: 0.78rem;
    font-style: italic;
    color: rgba(#fff, 0.8);
    word-break: break-word;
  }

  &-fields {
    margin-top: 0.25rem;
    font-size: 0.7rem;
    color: rgba(#fff, 0.45);
    word-break: break-word;
  }

  &-pick {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  &-compare {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    /* -> No gap: each side owns exactly half the width, and its own padding keeps the two apart */
    padding: 0.75rem 0;
    border-bottom: 1px solid rgba(#fff, 0.1);
    font-size: 0.85rem;
  }

  /* -> Half each, so B starts on the divider between the editor's two panes rather than wherever
        the row's other contents happen to leave it */
  &-side {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 0 0 50%;
    min-width: 0;
    padding: 0 1rem;
  }

  &-letter {
    flex: 0 0 24px;
    height: 24px;
    border-radius: 4px;
    background-color: $primary;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.75rem;
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
