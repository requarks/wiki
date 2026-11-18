<template>
  <w-layout view="hHh lpR fFf" container>
    <!-- -> The bar and its progress strip are one header, as in `ImportWikijs2Overlay`, which says why -->
    <w-header class="card-header import-header">
      <div class="flex items-center px-4 py-2">
        <w-icon name="img:/_assets/icons/ultraviolet-database-restore.svg" left size="md" />
        <div>
          <span>{{ t('admin.utilities.importConfluence') }}</span>
          <div class="text-caption">{{ t('admin.utilities.confluenceImport.subtitle') }}</div>
        </div>
        <w-space />
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
        :aria-label="t('admin.utilities.confluenceImport.progress')" />
    </w-header>
    <w-page-container ref="pageContainer">
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- What to import -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.confluenceImport.source') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="website" />
                <w-item-section>
                  <w-item-label>{{
                    t('admin.utilities.confluenceImport.targetSite')
                  }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.confluenceImport.targetSiteHint')
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
                    :disabled="isBusy"
                    :aria-label="t('admin.utilities.confluenceImport.targetSite')" />
                </w-item-section>
              </w-item>
              <w-item>
                <blueprint-icon icon="archive-folder" />
                <w-item-section>
                  <w-item-label>{{
                    state.file ? state.file.name : t('admin.utilities.confluenceImport.noBackup')
                  }}</w-item-label>
                  <w-item-label caption>{{ backupCaption }}</w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-btn
                    class="acrylic-btn"
                    flat
                    color="primary"
                    icon="la:file-upload"
                    :label="t('admin.utilities.confluenceImport.selectBackup')"
                    :disabled="isBusy"
                    @click="pickBackup" />
                </w-item-section>
              </w-item>
            </w-card>

            <!-- -> Everything below is about a backup, so it waits for one to be read -->
            <template v-if="state.index">
              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.confluenceImport.spaces') }}</w-card-header>
                <div class="px-4 pb-2 text-caption text-grey-7 dark:text-grey-5">
                  {{ t('admin.utilities.confluenceImport.spacesHint') }}
                </div>
                <div
                  v-for="space of state.spaces"
                  :key="space.id"
                  class="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2">
                  <w-checkbox
                    v-model="space.include"
                    color="primary"
                    class="mt-1"
                    :disabled="isBusy"
                    :aria-label="space.name" />
                  <div class="min-w-0 flex-1">
                    <div class="truncate">{{ space.name }}</div>
                    <div class="text-caption text-grey-7 dark:text-grey-5">
                      {{
                        space.type === 'personal'
                          ? t('admin.utilities.confluenceImport.personalSpace')
                          : space.key
                      }}
                      ·
                      {{ t('admin.utilities.confluenceImport.spacePages', { count: space.pages }) }}
                    </div>
                  </div>
                  <w-input
                    v-model="space.prefix"
                    outlined
                    dense
                    style="width: 180px"
                    spellcheck="false"
                    autocomplete="off"
                    :placeholder="t('admin.utilities.confluenceImport.siteRoot')"
                    :disabled="isBusy || !space.include"
                    :aria-label="
                      t('admin.utilities.confluenceImport.spacePrefix', { space: space.name })
                    ">
                    <template #prepend>
                      <span class="text-grey-6">/</span>
                    </template>
                  </w-input>
                  <!--
                    Under the row rather than through the input's own `rules`: a path taken twice is
                    an error caused by the OTHER space's field as often as by this one, and a rule only
                    runs when its own input changes.
                  -->
                  <div
                    v-if="space.include && prefixErrors[space.id]"
                    class="w-full pl-8 text-caption text-negative">
                    {{ prefixErrors[space.id] }}
                  </div>
                </div>
              </w-card>

              <w-card class="pb-2">
                <w-card-header>{{
                  t('admin.utilities.confluenceImport.whatToImport')
                }}</w-card-header>
                <!--
                  Pages are not optional: everything else on the list hangs off them, so they are the
                  root of the elbow rather than a choice, as `pages` is in the 2.x import.
                -->
                <div class="flex flex-col gap-4 px-4 pt-1 pb-3 sm:flex-row sm:items-start">
                  <div class="flex flex-col gap-3 sm:shrink-0">
                    <w-checkbox
                      :model-value="true"
                      color="primary"
                      disabled
                      :label="t('admin.utilities.confluenceImport.pages')" />
                    <div
                      v-for="(entry, idx) of contentEntries"
                      :key="entry.key"
                      :class="[
                        'content-child',
                        idx === contentEntries.length - 1 ? 'content-child--last' : ''
                      ]">
                      <div class="flex items-center gap-1">
                        <w-checkbox
                          v-model="state.content[entry.key]"
                          color="primary"
                          :label="entry.label"
                          :disabled="isBusy" />
                        <span
                          v-if="entry.hint"
                          data-tooltip-anchor
                          tabindex="0"
                          class="inline-flex cursor-help text-grey-6 outline-offset-2"
                          :aria-label="entry.hint">
                          <w-icon name="mdi:information-outline" size="16px" />
                          <w-tooltip>{{ entry.hint }}</w-tooltip>
                        </span>
                      </div>
                    </div>
                  </div>
                  <w-banner
                    dense
                    class="bg-blue-1 text-blue-9 sm:ml-auto sm:max-w-[50%] sm:flex-1 dark:bg-blue-9/30 dark:text-blue-2">
                    <template #avatar>
                      <w-icon name="la:info-circle" size="20px" />
                    </template>
                    {{ t('admin.utilities.confluenceImport.differencesNote') }}
                  </w-banner>
                </div>
              </w-card>

              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.confluenceImport.authors') }}</w-card-header>
                <div class="px-4 pb-2 text-caption text-grey-7 dark:text-grey-5">
                  {{
                    state.index.format === 'csv'
                      ? t('admin.utilities.confluenceImport.authorsHintCsv')
                      : t('admin.utilities.confluenceImport.authorsHintXml')
                  }}
                </div>
                <div
                  v-if="authors.length < 1"
                  class="px-4 py-2 text-caption text-grey-7 dark:text-grey-5">
                  {{ t('admin.utilities.confluenceImport.authorsEmpty') }}
                </div>
                <template v-else>
                  <w-separator />
                  <w-list separator class="authors-list">
                    <div
                      v-for="author of authors"
                      :key="author.id"
                      class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                      <div class="min-w-0 flex-1">
                        <div class="flex min-w-0 items-baseline gap-1.5">
                          <span class="min-w-0 truncate">{{
                            author.name || t('admin.utilities.confluenceImport.authorUnknown')
                          }}</span>
                          <span class="text-caption text-grey-7 dark:text-grey-5" aria-hidden="true"
                            >·</span
                          >
                          <span
                            class="text-caption text-grey-7 dark:text-grey-5 min-w-0 shrink-[4] truncate"
                            >{{ author.email || author.id }}</span
                          >
                        </div>
                        <div class="text-caption text-grey-7 dark:text-grey-5">
                          {{ describeCounts(author) }}
                        </div>
                      </div>
                      <!-- -> Who the author becomes here; on a phone the row wraps and it would point at nothing -->
                      <span
                        class="hidden text-grey-5 opacity-60 sm:inline-flex dark:text-grey-6"
                        aria-hidden="true">
                        <w-icon name="la:angle-right" size="20px" />
                      </span>
                      <div class="flex flex-wrap items-center justify-end gap-2">
                        <span
                          v-if="state.authorMap[author.id]"
                          class="inline-flex items-center gap-1 text-body2 font-medium text-primary dark:text-blue-4">
                          <w-icon name="la:user-check" size="18px" />{{
                            state.authorMap[author.id].name
                          }}
                        </span>
                        <span v-else class="text-caption text-grey-7 dark:text-grey-5">{{
                          t('admin.utilities.confluenceImport.authorUnmapped')
                        }}</span>
                        <w-btn
                          class="acrylic-btn"
                          flat
                          dense
                          color="primary"
                          icon="la:pen"
                          :disabled="isBusy"
                          :aria-label="pickLabel(author)"
                          @click="pickAuthor(author)">
                          <w-tooltip>{{ pickLabel(author) }}</w-tooltip>
                        </w-btn>
                        <w-btn
                          v-if="state.authorMap[author.id]"
                          class="acrylic-btn"
                          flat
                          dense
                          color="grey"
                          icon="la:times"
                          :disabled="isBusy"
                          :aria-label="t('admin.utilities.confluenceImport.authorClear')"
                          @click="clearAuthor(author)">
                          <w-tooltip>{{
                            t('admin.utilities.confluenceImport.authorClear')
                          }}</w-tooltip>
                        </w-btn>
                      </div>
                    </div>
                  </w-list>
                  <w-separator />
                </template>
              </w-card>

              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.confluenceImport.options') }}</w-card-header>
                <w-item tag="label">
                  <blueprint-icon icon="duplicate" />
                  <w-item-section>
                    <w-item-label>{{
                      t('admin.utilities.confluenceImport.overwrite')
                    }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.utilities.confluenceImport.overwriteHint')
                    }}</w-item-label>
                    <w-item-label caption class="text-deep-orange-9 dark:text-deep-orange-4">{{
                      t('admin.utilities.confluenceImport.overwriteWarning')
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="state.overwrite"
                      color="negative"
                      :disabled="isBusy"
                      checked-icon="la:check"
                      unchecked-icon="la:times"
                      :aria-label="t('admin.utilities.confluenceImport.overwrite')" />
                  </w-item-section>
                </w-item>
                <w-item>
                  <blueprint-icon icon="markdown" />
                  <w-item-section>
                    <w-item-label>{{
                      t('admin.utilities.confluenceImport.conversion')
                    }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.utilities.confluenceImport.conversionHint')
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-select
                      outlined
                      dense
                      emit-value
                      map-options
                      style="min-width: 220px"
                      v-model="state.htmlConversion"
                      :options="conversionOptions"
                      :disabled="isBusy"
                      :aria-label="t('admin.utilities.confluenceImport.conversion')" />
                  </w-item-section>
                </w-item>
              </w-card>
            </template>

            <!-- -> Spelt out in the slot, as in the 2.x import: the label is what says what is happening -->
            <w-btn
              unelevated
              size="lg"
              class="w-full"
              color="positive"
              text-color="white"
              :disabled="!canStart || isBusy"
              @click="startImport">
              <w-spinner v-if="isRunning" size="1.2em" />
              <w-icon v-else name="la:play-circle" class="shrink-0" />
              <span>{{
                isRunning
                  ? t('admin.utilities.confluenceImport.inProgress')
                  : t('admin.utilities.confluenceImport.start')
              }}</span>
            </w-btn>
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.confluenceImport.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <progress-log
                  :entries="state.log"
                  :empty-text="t('admin.utilities.confluenceImport.progressEmpty')" />
              </div>
            </w-card>
          </div>
        </div>
      </w-page>
    </w-page-container>

    <input
      type="file"
      ref="backupIpt"
      accept=".zip,application/zip"
      style="display: none"
      @change="onBackupPicked" />
  </w-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgressLog from '@/components/ProgressLog.vue'
import UserSearchDialog from '@/components/UserSearchDialog.vue'
import { dialog } from '@/composables/dialog'
import { scrollBehavior } from '@/helpers/motion'
import { normalizeNewPagePath } from '@/helpers/pagePaths'

import { useAdminStore } from '@/stores/admin'

/**
 * Import a Confluence backup into a site on this instance.
 *
 * Picking the file reads it straight away (`helpers/confluenceBackup.js`), because everything else on
 * this screen is about what is IN it: which spaces there are and where each one goes, and who wrote
 * what — a Confluence backup brings no accounts, so each author is pointed at an account here or left
 * to whoever runs the import. Then Start posts it through the import session routes
 * (`helpers/confluenceImport.js`). Both helpers are lazily imported, as the `.wkbackup` ones are.
 *
 * The layout is the 2.x import's, `ImportWikijs2Overlay`: what is being brought in on the left, what
 * happened to it on the right, and the left half locked while a run is going.
 */

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const backupIpt = ref(null)

/** The open backup and what was read from it. Not reactive: the index can be very large. */
let backup = null

const state = reactive({
  siteId: adminStore.currentSiteId,
  file: null,
  /** Set once the backup has been read: `{ format, sourceId, … }`, shallow on purpose. */
  index: null,
  /** `describeSpaces`, each with `include` and an editable `prefix`. */
  spaces: [],
  /** Confluence user id → `{ id, name }` of the account here it is mapped onto. */
  authorMap: {},
  content: {
    history: true,
    comments: true,
    assets: true
  },
  overwrite: false,
  htmlConversion: 'markdown',
  log: [],
  /** `idle`, `reading` (the backup), `running` (the import), `done` or `failed`. */
  phase: 'idle',
  progress: 0
})

/** The index itself, kept out of `state` so Vue does not make a proxy of every content in it. */
let index = null

/**
 * `helpers/confluenceImport.js`, once the lazy chunk has arrived — which it has by the time a backup
 * has been read, the only time the computed properties below ask it anything.
 */
const helpers = shallowRef(null)

// COMPUTED

const isRunning = computed(() => state.phase === 'running')
const isBusy = computed(() => state.phase === 'running' || state.phase === 'reading')
const showProgress = computed(() => state.phase === 'running' || state.phase === 'failed')

const siteOptions = computed(() =>
  adminStore.sites.map((site) => ({ value: site.id, label: site.title }))
)

const conversionOptions = computed(() => [
  { value: 'markdown', label: t('admin.utilities.confluenceImport.conversionMarkdown') },
  { value: 'html', label: t('admin.utilities.confluenceImport.conversionHtml') }
])

const contentEntries = computed(() => [
  { key: 'history', label: t('admin.utilities.confluenceImport.history') },
  {
    key: 'comments',
    label: t('admin.utilities.confluenceImport.comments'),
    hint: t('admin.utilities.confluenceImport.commentsHint')
  },
  { key: 'assets', label: t('admin.utilities.confluenceImport.attachments') }
])

const backupCaption = computed(() => {
  if (state.phase === 'reading') {
    return t('admin.utilities.confluenceImport.reading')
  }
  if (!state.index) {
    return t('admin.utilities.confluenceImport.backupHint')
  }
  const format =
    state.index.format === 'csv'
      ? t('admin.utilities.confluenceImport.formatCsv')
      : t('admin.utilities.confluenceImport.formatXml')
  return `${format} · ${formatBytes(state.file.size)}`
})

const includedSpaces = computed(() => state.spaces.filter((space) => space.include))

/**
 * What is wrong with each included space's prefix, by space id. Two spaces under one path would put
 * two home pages at it, so a prefix taken twice is an error on both — the site root included.
 */
const prefixErrors = computed(() => {
  const errors = {}
  const seen = new Map()
  for (const space of includedSpaces.value) {
    const normalized = normalizeNewPagePath(space.prefix)
    seen.set(normalized, [...(seen.get(normalized) ?? []), space.id])
  }
  for (const space of includedSpaces.value) {
    const problem = helpers.value?.prefixError(space.prefix)
    if (problem) {
      errors[space.id] = t(`admin.utilities.confluenceImport.prefix_${problem}`)
    } else if (seen.get(normalizeNewPagePath(space.prefix)).length > 1) {
      errors[space.id] = t('admin.utilities.confluenceImport.prefix_duplicate')
    }
  }
  return errors
})

/** Who wrote what in the spaces ticked, recomputed as they are ticked and unticked. */
const authors = computed(() => {
  if (!state.index || !helpers.value) {
    return []
  }
  return helpers.value.describeAuthors(
    index,
    includedSpaces.value.map((space) => space.id)
  )
})

const canStart = computed(
  () =>
    Boolean(state.index && state.siteId) &&
    includedSpaces.value.length > 0 &&
    Object.keys(prefixErrors.value).length < 1
)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

function pickBackup() {
  backupIpt.value?.click()
}

async function onBackupPicked() {
  const file = backupIpt.value?.files?.[0] ?? null
  if (backupIpt.value) {
    backupIpt.value.value = null
  }
  if (!file) {
    return
  }
  await closeBackup()
  state.file = file
  state.index = null
  state.spaces = []
  state.authorMap = {}
  state.log = []
  state.phase = 'reading'
  addLog('info', t('admin.utilities.confluenceImport.logReading', { file: file.name }))

  try {
    const [{ openBackup, readIndex }, planner] = await Promise.all([
      import('@/helpers/confluenceBackup'),
      import('@/helpers/confluenceImport')
    ])
    helpers.value = planner
    backup = await openBackup(file)
    index = await readIndex(backup)
    state.spaces = planner.describeSpaces(index).map((space) => ({ ...space, include: true }))
    state.index = { format: index.format, sourceId: index.sourceId }
    addLog(
      'info',
      t('admin.utilities.confluenceImport.logRead', {
        spaces: state.spaces.length,
        pages: state.spaces.reduce((sum, space) => sum + space.pages, 0)
      })
    )
    await matchAuthorsByEmail()
    state.phase = 'idle'
  } catch (err) {
    addLog('error', err.message)
    await closeBackup()
    state.phase = 'failed'
  }
}

/**
 * Point every author an XML backup gives an address for at the account here with the same one. Only
 * a suggestion: the operator can change or clear each of them before starting.
 */
async function matchAuthorsByEmail() {
  const emails = [...index.users.values()].map((user) => user.email).filter(Boolean)
  if (emails.length < 1) {
    return
  }
  const matches = await API_CLIENT.post('import/match-users', {
    json: { emails }
  }).json()
  const byEmail = new Map(matches.map((match) => [match.email, match]))
  let matched = 0
  for (const user of index.users.values()) {
    const match = byEmail.get(user.email.toLowerCase())
    if (match) {
      state.authorMap[user.id] = { id: match.id, name: match.name }
      matched++
    }
  }
  if (matched > 0) {
    addLog('info', t('admin.utilities.confluenceImport.logMatched', { count: matched }))
  }
}

/** The pencil's words: choosing an account, or changing the one already chosen. */
function pickLabel(author) {
  return state.authorMap[author.id]
    ? t('admin.utilities.confluenceImport.authorChange')
    : t('admin.utilities.confluenceImport.authorChoose')
}

function pickAuthor(author) {
  dialog({
    component: UserSearchDialog,
    componentProps: {
      title: t('admin.utilities.confluenceImport.pickAuthorTitle', {
        name: author.name || author.id
      }),
      single: true,
      excludeSystem: true
    }
  }).onOk((users) => {
    const user = users?.[0]
    if (user) {
      state.authorMap[author.id] = { id: user.id, name: user.name }
    }
  })
}

function clearAuthor(author) {
  delete state.authorMap[author.id]
}

function describeCounts(author) {
  return [
    author.pages && t('admin.utilities.confluenceImport.countPages', { count: author.pages }),
    author.versions &&
      t('admin.utilities.confluenceImport.countVersions', { count: author.versions }),
    author.comments &&
      t('admin.utilities.confluenceImport.countComments', { count: author.comments }),
    author.files && t('admin.utilities.confluenceImport.countFiles', { count: author.files })
  ]
    .filter(Boolean)
    .join(' · ')
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

/** The overlay's scrolling box -- `WPageContainer`, not the page inside it. */
const pageContainer = ref(null)

/**
 * Back to the top of the overlay, where the progress bar and the start of the log are: the button
 * that starts an import is at the bottom of the form, and a long form leaves both out of view, so
 * the import would start without anything visibly happening.
 */
function scrollToTop() {
  pageContainer.value?.$el?.scrollTo({ top: 0, behavior: scrollBehavior() })
}

/**
 * Run the import. A failure unlocks the form: every record is keyed so that writing it twice
 * replaces it, so starting again after fixing what went wrong carries on rather than duplicating.
 */
async function startImport() {
  state.phase = 'running'
  scrollToTop()
  state.progress = 0
  addLog('info', t('admin.utilities.confluenceImport.logStarted'))
  try {
    await helpers.value.runConfluenceImport({
      backup,
      index,
      spaces: includedSpaces.value.map((space) => ({ id: space.id, prefix: space.prefix })),
      siteId: state.siteId,
      includes: [
        'pages',
        ...contentEntries.value.map((entry) => entry.key).filter((key) => state.content[key])
      ],
      overwrite: state.overwrite,
      htmlConversion: state.htmlConversion,
      users: Object.entries(state.authorMap).map(([sourceId, user]) => ({
        sourceId,
        userId: user.id
      })),
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

async function closeBackup() {
  if (backup) {
    await backup.close()
    backup = null
  }
  index = null
}

/** Add a line to the log. `ProgressLog` keeps the panel at the bottom as it grows. */
function addLog(level, message) {
  state.log.push({
    ts: Temporal.Now.plainTimeISO().toString({ smallestUnit: 'second' }),
    level,
    message
  })
}

onBeforeUnmount(() => {
  closeBackup()
})
</script>

<style scoped lang="scss">
/* The header and the elbow are `ImportWikijs2Overlay`'s, whose comments say why each line is there */
.import-header {
  flex-direction: column;
  align-items: stretch;
  position: relative;
}

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

/* -> A large wiki has hundreds of authors; the list scrolls rather than pushing Start off the page */
.authors-list {
  max-height: 360px;
  overflow-y: auto;
}
</style>
