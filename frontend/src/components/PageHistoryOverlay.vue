<template>
  <w-layout class="page-history" view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="la:history" left size="md" />
      <span>{{ t('history.title') }}</span>
      <span class="page-history-page ml-3">{{ pageStore.title }}</span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-2" v-show="state.loading > 0" color="accent" size="24px" />
      </transition>
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
              <!-- Why, in the author's own words, when the site asks for a reason on save. -->
              <div class="page-history-reason" v-if="version.reason">{{ version.reason }}</div>
              <div class="page-history-fields" v-if="version.changedFields.length > 0">
                {{ t('history.changedFields', { fields: version.changedFields.join(', ') }) }}
              </div>
            </div>
            <!--
              Stops the click from also reaching the item, which would move both letters at once.
            -->
            <div class="page-history-pick" @click.stop>
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
            </div>
            <!-- A literal class, not `color`: that prop builds one at runtime, which Tailwind never emits. -->
            <w-icon class="text-grey-6" name="la:arrow-right" />
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
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import * as monaco from 'monaco-editor'

import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

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

const pageStore = usePageStore()
const siteStore = useSiteStore()

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
  sameContent: false
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

// METHODS

function close() {
  siteStore.$patch({ overlay: '' })
}

/** The reason the API gave, out of a response ky threw on, or the error's own message. */
async function apiMessage(err) {
  return (
    (await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)) ?? err.message
  )
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
    // -> Side by side: this exists to compare the two, and an inline diff of prose reads as a jumble
    //    of half-lines
    renderSideBySide: true,
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
  const kind = version?.meta?.contentType || version?.meta?.editor
  return kind === 'html' ? 'html' : 'markdown'
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
      caption: await apiMessage(err)
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
    const caption = await apiMessage(err)
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
  &-page {
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
    align-items: flex-start;
    gap: 0.75rem;
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
  }

  &-compare {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(#fff, 0.1);
    font-size: 0.85rem;
  }

  &-side {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex: 1 1 0;
    min-width: 0;
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
