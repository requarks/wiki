<template>
  <w-layout view="hHh lpR fFf" container>
    <!--
      The bar and the progress strip under it are two rows of the ONE header element, rather than the
      strip being a sibling below it: `WLayout` is a grid of named areas and an unassigned child
      would be auto-placed into the empty left drawer cell, a column wide. Stacking them here is also
      what makes the strip flush -- it spans the header's own width, inside its border.
    -->
    <w-header class="card-header import-header">
      <div class="flex items-center px-4 py-2">
        <w-icon name="img:/_assets/icons/ultraviolet-database-restore.svg" left size="md" />
        <div>
          <span>{{ t('admin.utilities.importWikijs2') }}</span>
          <div class="text-caption">{{ t('admin.utilities.wikijs2Import.subtitle') }}</div>
        </div>
        <w-space />
        <w-btn
          class="mr-2"
          flat
          rounded
          color="white"
          :aria-label="t(`common.actions.viewDocs`)"
          icon="la:question-circle"
          :href="siteStore.docsBase + `/admin/utilities`"
          target="_blank"
          type="a" />
        <w-btn-group push>
          <w-btn
            push
            color="white"
            text-color="grey-7"
            :label="t(`common.actions.close`)"
            :aria-label="t(`common.actions.close`)"
            icon="la:times"
            @click="close" />
        </w-btn-group>
      </div>
      <w-linear-progress
        v-if="showProgress"
        size="10px"
        :striped="isRunning"
        :color="state.phase === 'failed' ? 'negative' : 'positive'"
        :value="state.progress"
        :aria-label="t('admin.utilities.wikijs2Import.progress')" />
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- What to import -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.wikijs2Import.source') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="website" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.wikijs2Import.targetSite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.wikijs2Import.targetSiteHint')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-select
                    outlined
                    dense
                    emit-value
                    map-options
                    style="min-width: 200px"
                    v-model="state.siteId"
                    :options="siteOptions"
                    :disabled="isRunning"
                    :aria-label="t('admin.utilities.wikijs2Import.targetSite')" />
                </w-item-section>
              </w-item>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>
                {{ t('admin.utilities.wikijs2Import.whatToImport') }}
                <template #hint>{{ t('admin.utilities.wikijs2Import.whatToImportHint') }}</template>
              </w-card-header>
              <!--
                A compact checklist rather than `w-item` rows: eight of those stand 450px tall and
                push the Start Import button below the fold, which is the one control on this panel
                that has to be in front of the reader. Flat rather than a real tree, too -- only
                `pages` has children, so the indent on the two that depend on it says what a tree
                widget would.
              -->
              <div class="grid grid-cols-2 gap-x-4 px-4 pt-1 pb-3">
                <div
                  v-for="(column, idx) of contentColumns"
                  :key="`content-col-` + idx"
                  class="flex flex-col gap-3">
                  <div
                    v-for="entry of column"
                    :key="entry.key"
                    :class="[
                      entry.parent ? 'content-child' : '',
                      entry.isLastChild ? 'content-child--last' : ''
                    ]">
                    <w-checkbox
                      v-model="state.content[entry.key]"
                      color="primary"
                      :label="entry.label"
                      :disabled="
                        isRunning || (entry.parent ? !state.content[entry.parent] : false)
                      " />
                  </div>
                </div>
              </div>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.wikijs2Import.options') }}</w-card-header>
              <w-item tag="label">
                <blueprint-icon icon="duplicate" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.wikijs2Import.overwrite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.wikijs2Import.overwriteHint')
                  }}</w-item-label>
                  <!--
                    Permanent, and stated whichever way the switch is set: what it warns about is
                    what turning it on would do, so it has to be readable before that happens.
                  -->
                  <w-item-label caption class="text-deep-orange-9 dark:text-deep-orange-4">{{
                    t('admin.utilities.wikijs2Import.overwriteWarning')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.overwrite"
                    color="negative"
                    :disabled="isRunning"
                    checked-icon="la:check"
                    unchecked-icon="la:times"
                    :aria-label="t('admin.utilities.wikijs2Import.overwrite')" />
                </w-item-section>
              </w-item>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.wikijs2Import.archive') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="archive-folder" />
                <w-item-section>
                  <w-item-label>{{
                    state.archive
                      ? state.archive.name
                      : t('admin.utilities.wikijs2Import.noArchive')
                  }}</w-item-label>
                  <w-item-label caption>{{
                    state.archive
                      ? formatBytes(state.archive.size)
                      : t('admin.utilities.wikijs2Import.archiveHint')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-btn
                    class="acrylic-btn"
                    flat
                    color="primary"
                    icon="la:file-upload"
                    :label="t('admin.utilities.wikijs2Import.selectArchive')"
                    :disabled="isRunning"
                    @click="pickArchive" />
                </w-item-section>
              </w-item>
            </w-card>

            <!-- -> Below the cards rather than inside the last one: it acts on all four -->
            <!--
              Spelt out in the slot rather than through `icon`/`label`, because `WBtn`'s own
              `loading` prop hides the content behind a centred spinner -- which is the right
              treatment for a button whose label would be a lie mid-request, and the wrong one here:
              the label is what says what is happening.
            -->
            <w-btn
              unelevated
              size="lg"
              class="w-full"
              color="positive"
              text-color="white"
              :disabled="!canStart || isRunning"
              @click="startImport">
              <w-spinner v-if="isRunning" size="1.2em" />
              <w-icon v-else name="la:play-circle" class="shrink-0" />
              <span>{{
                isRunning
                  ? t('admin.utilities.wikijs2Import.inProgress')
                  : t('admin.utilities.wikijs2Import.start')
              }}</span>
            </w-btn>
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.wikijs2Import.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <div ref="logPanel" class="import-log">
                  <div v-if="state.log.length < 1" class="import-log__empty">
                    {{ t('admin.utilities.wikijs2Import.progressEmpty') }}
                  </div>
                  <div
                    v-for="(entry, idx) of state.log"
                    :key="`log-` + idx"
                    class="import-log__line"
                    :class="`import-log__line--` + entry.level">
                    <span class="import-log__ts">{{ entry.ts }}</span>
                    <span class="import-log__msg">{{ entry.message }}</span>
                  </div>
                </div>
              </div>
            </w-card>
          </div>
        </div>
      </w-page>
    </w-page-container>

    <!-- -> Hidden native input, as the block package upload in `AdminBlocks` uses -->
    <input
      type="file"
      ref="archiveIpt"
      accept=".wkbackup"
      style="display: none"
      @change="onArchivePicked" />
  </w-layout>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

/**
 * Import a 2.x backup into a site on this instance.
 *
 * The package is never uploaded as a file: this component opens it, walks it, and drives the import
 * API a batch at a time. `helpers/wkbackup.js` is the reader and `helpers/wkbackupImport.js` is what
 * knows which stream goes where; both are lazily imported, so an instance that never opens this
 * screen never fetches the ZIP library. `dev/specs/wkbackup.md` is the format and the design.
 *
 * Two columns, because there are two things to watch: what is being brought in, on the left, and what
 * happened to it, on the right. The left half locks for the length of the run -- those four cards
 * describe the import that is already going, so a control that still moved would be lying.
 */

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const archiveIpt = ref(null)
const logPanel = ref(null)

const state = reactive({
  /** Defaults to whichever site the admin area is already pointed at. */
  siteId: adminStore.currentSiteId,
  /**
   * Everything on, because a backup is normally restored whole; the checkboxes are for the case
   * where it is not. `comments` and `history` hang off `pages` -- there is nothing to attach either
   * one to without the pages themselves.
   */
  content: {
    assets: true,
    pages: true,
    comments: true,
    history: true,
    groups: true,
    users: true,
    navigation: true
  },
  overwrite: false,
  /** The `File` the picker handed back, kept whole so its name and size can be shown. */
  archive: null,
  /** `{ ts, level, message }`, appended as the import reports its progress. */
  log: [],
  /**
   * `idle` before the first run, then `running`, then `done` or `failed`.
   *
   * One value rather than a pair of booleans, because the three things that read it want different
   * cuts of it: the form locks on `running` alone, the progress bar is drawn for anything but `idle`
   * -- a finished import should still show what it reached -- and its colour is the difference
   * between `done` and `failed`.
   */
  phase: 'idle',
  /** 0..1, as the importer reports it against the record counts in the package manifest. */
  progress: 0
})

// COMPUTED

const isRunning = computed(() => state.phase === 'running')

/**
 * The strip under the header, while there is something to watch.
 *
 * Gone once the import finishes: a full bar says nothing the log's closing line does not, and leaving
 * it up reads as though something were still happening. A FAILED import keeps it, because there the
 * bar carries the one thing the log cannot say at a glance — how far it got before it stopped.
 */
const showProgress = computed(() => state.phase === 'running' || state.phase === 'failed')

const siteOptions = computed(() =>
  adminStore.sites.map((site) => ({ value: site.id, label: site.title }))
)

/**
 * The rows under *What to import*, with the two that depend on `pages` marked as such. Built here
 * rather than written out in the template so that the indent, the disabled state and the cascade
 * below all read from one list.
 */
const contentEntries = computed(() => [
  { key: 'assets', col: 1, label: t('admin.utilities.wikijs2Import.assets') },
  { key: 'pages', col: 1, label: t('admin.utilities.wikijs2Import.pages') },
  { key: 'comments', col: 1, parent: 'pages', label: t('admin.utilities.wikijs2Import.comments') },
  { key: 'history', col: 1, parent: 'pages', label: t('admin.utilities.wikijs2Import.history') },
  { key: 'groups', col: 2, label: t('admin.utilities.wikijs2Import.groups') },
  { key: 'users', col: 2, label: t('admin.utilities.wikijs2Import.users') },
  { key: 'navigation', col: 2, label: t('admin.utilities.wikijs2Import.navigation') }
])

/**
 * What is actually going to be imported: what is ticked, minus anything whose parent is not.
 *
 * The same reading `canStart` makes, and what the session is opened with -- a child of an unticked
 * `pages` is not imported, so sending it would have the server reading a stream nobody asked for.
 */
const selectedContent = computed(() =>
  contentEntries.value
    .filter((entry) => state.content[entry.key] && (!entry.parent || state.content[entry.parent]))
    .map((entry) => entry.key)
)

/**
 * The same rows dealt into the two columns they are drawn in. Which column an entry belongs to is a
 * field on the entry rather than a slice of the list, so that a row added later lands where it is
 * put instead of wherever the halfway point moved to -- and `canStart` keeps reading the flat list,
 * since where a checkbox is drawn has nothing to do with what it means.
 */
const contentColumns = computed(() => {
  const entries = contentEntries.value
  const decorated = entries.map((entry, idx) => ({
    ...entry,
    // -> Where the elbow's trunk stops. Read off the flat list rather than hardcoded, so the day
    //    `pages` gains a third child the line runs down to it instead of stopping at `history`
    isLastChild: Boolean(entry.parent) && entries[idx + 1]?.parent !== entry.parent
  }))
  return [
    decorated.filter((entry) => entry.col === 1),
    decorated.filter((entry) => entry.col === 2)
  ]
})

/**
 * An import needs an archive, a site to put it in, and at least one thing to bring over. A child of
 * an unticked `pages` does not count, since it is not imported either.
 */
const canStart = computed(() => {
  if (!state.archive || !state.siteId) {
    return false
  }
  return selectedContent.value.length > 0
})

// WATCHERS

// -> Turning `pages` back on restores its children rather than leaving them silently off: the two
//    were ticked when it was unticked, and that is the state being returned to
watch(
  () => state.content.pages,
  (isOn) => {
    state.content.comments = isOn
    state.content.history = isOn
  }
)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

function pickArchive() {
  archiveIpt.value?.click()
}

function onArchivePicked() {
  state.archive = archiveIpt.value?.files?.[0] ?? null
  // -> So that picking the same file twice in a row still fires `change`
  if (archiveIpt.value) {
    archiveIpt.value.value = null
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

/**
 * Run the import.
 *
 * Everything heavy is behind the dynamic import: the ZIP reader and the stream logic are a lazy chunk
 * that an instance which never migrates from 2.x never fetches.
 *
 * A failure unlocks the form rather than leaving the screen dead. Every record is keyed so that
 * writing it twice is an upsert, so running it again after fixing whatever went wrong carries on
 * instead of duplicating what already landed.
 */
async function startImport() {
  state.phase = 'running'
  state.progress = 0
  state.log = []
  addLog('info', t('admin.utilities.wikijs2Import.logStarted', { file: state.archive.name }))

  try {
    const { runImport } = await import('@/helpers/wkbackupImport')
    await runImport({
      file: state.archive,
      siteId: state.siteId,
      includes: selectedContent.value,
      overwrite: state.overwrite,
      log: addLog,
      onProgress: (value) => {
        state.progress = value
      }
    })
    state.phase = 'done'
  } catch (err) {
    addLog('error', err.message)
    state.phase = 'failed'
  }
}

/**
 * Add a line to the log, and keep the panel at the bottom.
 *
 * Pinned only when the reader is already there, so that scrolling back to read a warning is not
 * undone by the next of the several thousand lines a large import writes.
 */
function addLog(level, message) {
  const panel = logPanel.value
  const wasAtBottom = panel ? panel.scrollHeight - panel.scrollTop - panel.clientHeight < 40 : true
  state.log.push({
    ts: Temporal.Now.plainTimeISO().toString({ smallestUnit: 'second' }),
    level,
    message
  })
  if (wasAtBottom) {
    nextTick(() => {
      if (logPanel.value) {
        logPanel.value.scrollTop = logPanel.value.scrollHeight
      }
    })
  }
}
</script>

<style scoped lang="scss">
/*
  `.card-header` is a centred flex ROW, which is what the bar itself wants; the strip beneath it
  belongs to the header too, so the element becomes a column of the two. Scoped styles carry an
  attribute selector, so this outweighs `.card-header` regardless of stylesheet order.
*/
.import-header {
  flex-direction: column;
  align-items: stretch;
  position: relative;
}

/*
  The line that closes the header, under the progress strip.

  `.card-header` draws TWO of them -- a 1px border plus a 1px `box-shadow` sitting under it -- which
  is the bevel every dialog header in the app wears, and under a progress bar reads as one thick
  rule. On top of that a 1px CSS border lands on a fractional device row under display scaling and
  paints 1.5 device pixels at 150%, so it looks heavier still.

  So: neither, and one line drawn by a pseudo-element scaled to `1 / dpr` instead -- the same
  technique as the `.w-hairline` utility in `css/tailwind.css`, with `--w-dpr` published by
  `helpers/hairline.js` and a fallback of 1 for an unscaled display.

  Selectors are written from `body` because `.card-header`'s own rules are, and a scoped style is
  not guaranteed to be injected after the global stylesheet -- matching their specificity would
  leave which one wins up to Vite's ordering.
*/
body.body--light .import-header,
body.body--dark .import-header {
  border-bottom: 0;
  box-shadow: none;
}

.import-header::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background-color: $dark-6;
  transform: scaleY(calc(1 / var(--w-dpr, 1)));
  transform-origin: bottom;
}

body.body--dark .import-header::after {
  background-color: #000;
}

/*
  The elbow that ties Comments and History to the Pages checkbox above them.

  The trunk sits on the centre of the PARENT's box -- 9px in, the box being 20px wide -- and the row
  is indented far enough for the branch to cross to it. Everything vertical is a percentage rather
  than a pixel count: the row is as tall as the label's line box, not as tall as the 20px box in it,
  so a figure measured once would drift the moment the caption's line height changed.

  The trunk starts 12px above the row -- the `gap-3` between them -- so each child's segment meets
  the one above it and the line reads as continuous down the group. The last child's stops halfway,
  at its own branch, rather than running on into the rows below.
*/
.content-child {
  --tree-line: rgb(0 0 0 / 0.16);

  position: relative;
  padding-left: 28px;

  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 9px;
    background-color: var(--tree-line);
  }

  &::before {
    top: -12px;
    width: 1px;
    height: calc(100% + 12px);
  }

  &::after {
    top: 50%;
    width: 13px;
    height: 1px;
  }
}

.content-child--last::before {
  height: calc(50% + 12px);
}

body.body--dark .content-child {
  --tree-line: rgb(255 255 255 / 0.2);
}

/*
  The log is a terminal, so it looks like one: monospaced, dark, scrolling on its own and keeping a
  fixed height whether it holds two lines or two hundred -- a panel that grew with the import would
  move the form beside it on every message. `--font-mono` is the app's own, as `UtilCodeEditor` uses.

  Dark in both themes, rather than following the app. This is machine output scrolling past, and every
  other place anybody reads that -- a terminal, a CI log, the browser console -- is dark; a light one
  reads as a document. It also keeps the colours below meaning one thing: a warning and an error have
  to be legible against exactly one background instead of two, which is why they can be the brighter
  end of the ramp and stay readable.

  The palette is the app's own dark surfaces (`_theme.scss`), so the panel sits in an admin overlay
  rather than looking like a component from somewhere else.
*/
.import-log {
  height: calc(100vh - 260px);
  min-height: 300px;
  overflow-y: auto;
  border-radius: 4px;
  padding: 12px;
  background-color: $dark-6;
  border: 1px solid $dark-3;
  color: $grey-4;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;

  /*
    A step lighter than the timestamps, because it is not secondary the way they are: it is the only
    thing on the panel before an import starts, so it has to read as an instruction rather than as
    something greyed out. `$grey-7` was 4.3:1 against this background and `$grey-6` is 7.4:1, while
    still sitting a step below the message colour so it does not pass for output.
  */
  &__empty {
    color: $grey-6;
    font-style: italic;
  }

  &__line {
    display: flex;
    gap: 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__ts {
    flex: none;
    color: $grey-7;
  }

  /*
    The full Material ramp is in `tailwind.css` as custom properties; `_palette.scss` carries only the
    steps its own stylesheets happened to need, and the mid tones a log wants are not among them.
    These are the light end of each hue, which is what stays legible on the dark panel above.
  */
  &__line--success .import-log__msg {
    color: var(--color-green-4);
    font-weight: 600;
  }

  &__line--warn .import-log__msg {
    color: var(--color-orange-4);
  }

  &__line--error .import-log__msg {
    color: var(--color-red-4);
  }
}
</style>
