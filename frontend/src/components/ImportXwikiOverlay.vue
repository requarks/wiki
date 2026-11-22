<template>
  <w-layout view="hHh lpR fFf" container>
    <!-- -> The bar and its progress strip are one header, as in `ImportWikijs2Overlay`, which says why -->
    <w-header class="card-header import-header">
      <div class="flex items-center px-4 py-2">
        <w-icon name="img:/_assets/icons/ultraviolet-database-restore.svg" left size="md" />
        <div>
          <span>{{ t('admin.utilities.importXwiki') }}</span>
          <div class="text-caption">{{ t('admin.utilities.xwikiImport.subtitle') }}</div>
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
        :aria-label="t('admin.utilities.xwikiImport.progress')" />
    </w-header>
    <w-page-container ref="pageContainer">
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- What to import -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.xwikiImport.source') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="website" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.xwikiImport.targetSite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.xwikiImport.targetSiteHint')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section side>
                  <w-select
                    dense
                    emit-value
                    map-options
                    style="min-width: 200px"
                    v-model="state.siteId"
                    :options="siteOptions"
                    :disabled="isBusy"
                    :aria-label="t('admin.utilities.xwikiImport.targetSite')" />
                </w-item-section>
              </w-item>
              <w-item>
                <blueprint-icon icon="archive-folder" />
                <w-item-section>
                  <w-item-label>{{
                    state.sourceName || t('admin.utilities.xwikiImport.noSource')
                  }}</w-item-label>
                  <w-item-label caption>{{ sourceCaption }}</w-item-label>
                </w-item-section>
              </w-item>
              <div class="flex flex-wrap justify-end gap-2 px-4 pb-2">
                <w-btn
                  class="acrylic-btn"
                  flat
                  color="primary"
                  icon="la:file-archive"
                  :label="t('admin.utilities.xwikiImport.selectFile')"
                  :disabled="isBusy"
                  @click="pickFile" />
              </div>
            </w-card>

            <!-- -> Everything below is about a XAR, so it waits for one to be read -->
            <template v-if="state.index">
              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.xwikiImport.spaces') }}</w-card-header>
                <div class="px-4 pb-2 text-caption text-grey-7 dark:text-grey-5">
                  {{ t('admin.utilities.xwikiImport.spacesHint') }}
                </div>
                <div
                  v-for="space of state.spaces"
                  :key="space.id"
                  class="flex items-start gap-x-3 px-4 py-1">
                  <w-checkbox
                    v-model="space.include"
                    color="primary"
                    class="mt-1"
                    :disabled="isBusy"
                    :aria-label="space.id" />
                  <div class="min-w-0 flex-1">
                    <div class="truncate font-mono">{{ space.id }}</div>
                    <div class="text-caption text-grey-7 dark:text-grey-5">
                      {{ describeSpace(space) }}
                    </div>
                  </div>
                </div>
                <w-separator class="my-2" />
                <w-item tag="label">
                  <blueprint-icon icon="private" />
                  <w-item-section>
                    <w-item-label>{{ t('admin.utilities.xwikiImport.hidden') }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.utilities.xwikiImport.hiddenHint')
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      :model-value="state.includeHidden"
                      color="primary"
                      :disabled="isBusy"
                      checked-icon="la:check"
                      unchecked-icon="la:times"
                      :aria-label="t('admin.utilities.xwikiImport.hidden')"
                      @update:model-value="setIncludeHidden" />
                  </w-item-section>
                </w-item>
                <w-item>
                  <blueprint-icon icon="tree-structure" />
                  <w-item-section>
                    <w-item-label>{{ t('admin.utilities.xwikiImport.prefix') }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.utilities.xwikiImport.prefixHint')
                    }}</w-item-label>
                    <w-item-label v-if="prefixProblem" caption class="text-negative">{{
                      prefixProblem
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-input
                      v-model="state.prefix"
                      dense
                      style="width: 180px"
                      spellcheck="false"
                      autocomplete="off"
                      :placeholder="t('admin.utilities.xwikiImport.siteRoot')"
                      :disabled="isBusy"
                      :aria-label="t('admin.utilities.xwikiImport.prefix')">
                      <template #prepend>
                        <span class="text-grey-6">/</span>
                      </template>
                    </w-input>
                  </w-item-section>
                </w-item>
              </w-card>

              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.xwikiImport.whatToImport') }}</w-card-header>
                <!-- -> Pages are the root of the elbow rather than a choice, as in the other imports -->
                <div class="flex flex-col gap-4 px-4 pt-1 pb-3 sm:flex-row sm:items-start">
                  <div class="flex flex-col gap-3 sm:shrink-0">
                    <w-checkbox
                      :model-value="true"
                      color="primary"
                      disabled
                      :label="t('admin.utilities.xwikiImport.pages')" />
                    <div
                      v-for="(entry, idx) of contentEntries"
                      :key="entry.key"
                      :class="[
                        'content-child',
                        idx === contentEntries.length - 1 ? 'content-child--last' : ''
                      ]">
                      <w-checkbox
                        v-model="state.content[entry.key]"
                        color="primary"
                        :label="entry.label"
                        :disabled="isBusy" />
                    </div>
                  </div>
                  <w-banner
                    dense
                    class="bg-blue-1 text-blue-9 sm:ml-auto sm:max-w-[50%] sm:flex-1 dark:bg-blue-9/30 dark:text-blue-2">
                    <template #avatar>
                      <w-icon name="la:info-circle" size="20px" />
                    </template>
                    {{ t('admin.utilities.xwikiImport.differencesNote') }}
                  </w-banner>
                </div>
              </w-card>

              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.xwikiImport.authors') }}</w-card-header>
                <div class="px-4 pb-2 text-caption text-grey-7 dark:text-grey-5">
                  {{
                    state.index.hasUsers
                      ? t('admin.utilities.xwikiImport.authorsHintUsers')
                      : t('admin.utilities.xwikiImport.authorsHintNoUsers')
                  }}
                </div>
                <div
                  v-if="authors.length < 1"
                  class="px-4 py-2 text-caption text-grey-7 dark:text-grey-5">
                  {{ t('admin.utilities.xwikiImport.authorsEmpty') }}
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
                          <span class="min-w-0 truncate">{{ author.name || author.id }}</span>
                          <template v-if="author.name || author.email">
                            <span
                              class="text-caption text-grey-7 dark:text-grey-5"
                              aria-hidden="true"
                              >·</span
                            >
                            <span
                              class="text-caption text-grey-7 dark:text-grey-5 min-w-0 shrink-[4] truncate"
                              >{{ author.email || author.id }}</span
                            >
                          </template>
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
                          t('admin.utilities.xwikiImport.authorUnmapped')
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
                          :aria-label="t('admin.utilities.xwikiImport.authorClear')"
                          @click="clearAuthor(author)">
                          <w-tooltip>{{ t('admin.utilities.xwikiImport.authorClear') }}</w-tooltip>
                        </w-btn>
                      </div>
                    </div>
                  </w-list>
                  <w-separator />
                </template>
              </w-card>

              <w-card class="pb-2">
                <w-card-header>{{ t('admin.utilities.xwikiImport.options') }}</w-card-header>
                <w-item tag="label">
                  <blueprint-icon icon="duplicate" />
                  <w-item-section>
                    <w-item-label>{{ t('admin.utilities.xwikiImport.overwrite') }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.utilities.xwikiImport.overwriteHint')
                    }}</w-item-label>
                    <w-item-label caption class="text-deep-orange-9 dark:text-deep-orange-4">{{
                      t('admin.utilities.xwikiImport.overwriteWarning')
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="state.overwrite"
                      color="negative"
                      :disabled="isBusy"
                      checked-icon="la:check"
                      unchecked-icon="la:times"
                      :aria-label="t('admin.utilities.xwikiImport.overwrite')" />
                  </w-item-section>
                </w-item>
                <w-item>
                  <blueprint-icon icon="markdown" />
                  <w-item-section>
                    <w-item-label>{{ t('admin.utilities.xwikiImport.conversion') }}</w-item-label>
                    <w-item-label caption>{{
                      t('admin.utilities.xwikiImport.conversionHint')
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-select
                      dense
                      emit-value
                      map-options
                      style="min-width: 220px"
                      v-model="state.htmlConversion"
                      :options="conversionOptions"
                      :disabled="isBusy"
                      :aria-label="t('admin.utilities.xwikiImport.conversion')" />
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
                  ? t('admin.utilities.xwikiImport.inProgress')
                  : t('admin.utilities.xwikiImport.start')
              }}</span>
            </w-btn>
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.xwikiImport.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <progress-log
                  :entries="state.log"
                  :empty-text="t('admin.utilities.xwikiImport.progressEmpty')" />
              </div>
            </w-card>
          </div>
        </div>
      </w-page>
    </w-page-container>

    <input
      type="file"
      ref="fileIpt"
      accept=".xar,.zip,application/zip"
      style="display: none"
      @change="onFilePicked" />
  </w-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgressLog from '@/components/ProgressLog.vue'
import UserSearchDialog from '@/components/UserSearchDialog.vue'
import { dialog } from '@/composables/dialog'
import { scrollBehavior } from '@/helpers/motion'
import { prefixError } from '@/helpers/pagePaths'

import { useAdminStore } from '@/stores/admin'

/**
 * Import an XWiki XAR export into a site on this instance.
 *
 * The operator hands over the XAR, and it is read straight away (`helpers/xwikiSource.js`), because
 * everything else on this screen is about what is IN it: which spaces there are, where the wiki goes,
 * and who wrote what — XWiki's accounts do not come over, so each user is pointed at an account here
 * or left to whoever runs the import. Then Start posts it through the import session routes
 * (`helpers/xwikiImport.js`). Both helpers are lazily imported, as the other imports' are.
 *
 * The layout is the DokuWiki import's, `ImportDokuwikiOverlay`.
 */

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const fileIpt = ref(null)

/** The open XAR. Not reactive: it holds a handle on every entry in the archive. */
let source = null

/** What was read from it, kept out of `state` so Vue does not make a proxy of every document in it. */
let index = null

const state = reactive({
  siteId: adminStore.currentSiteId,
  sourceName: '',
  /** Set once the source has been read: `{ hasUsers, pages, files }`, shallow on purpose. */
  index: null,
  /** `describeSpaces`, each with `include`. */
  spaces: [],
  includeHidden: false,
  prefix: '',
  /** XWiki user (`XWiki.jdoe`) → `{ id, name }` of the account here it is mapped onto. */
  authorMap: {},
  content: {
    history: true,
    assets: true,
    comments: true
  },
  overwrite: false,
  htmlConversion: 'markdown',
  log: [],
  /** `idle`, `reading` (the source), `running` (the import), `done` or `failed`. */
  phase: 'idle',
  progress: 0
})

/** `helpers/xwikiImport.js`, once the lazy chunk has arrived with the source read. */
const helpers = shallowRef(null)

// COMPUTED

const isRunning = computed(() => state.phase === 'running')
const isBusy = computed(() => state.phase === 'running' || state.phase === 'reading')
const showProgress = computed(
  () => state.phase === 'running' || state.phase === 'failed' || state.phase === 'reading'
)

const siteOptions = computed(() =>
  adminStore.sites.map((site) => ({ value: site.id, label: site.title }))
)

const conversionOptions = computed(() => [
  { value: 'markdown', label: t('admin.utilities.xwikiImport.conversionMarkdown') },
  { value: 'html', label: t('admin.utilities.xwikiImport.conversionHtml') }
])

const contentEntries = computed(() => [
  { key: 'history', label: t('admin.utilities.xwikiImport.history') },
  { key: 'assets', label: t('admin.utilities.xwikiImport.attachments') },
  { key: 'comments', label: t('admin.utilities.xwikiImport.comments') }
])

const sourceCaption = computed(() => {
  if (state.phase === 'reading') {
    return t('admin.utilities.xwikiImport.reading')
  }
  if (!state.index) {
    return t('admin.utilities.xwikiImport.sourceHint')
  }
  return t('admin.utilities.xwikiImport.sourceSummary', {
    pages: state.index.pages,
    files: state.index.files
  })
})

const includedSpaces = computed(() => state.spaces.filter((space) => space.include))

const prefixProblem = computed(() => {
  const problem = prefixError(state.prefix)
  return problem ? t(`admin.utilities.xwikiImport.prefix_${problem}`) : ''
})

/** Who wrote what in the spaces ticked, recomputed as they are ticked and unticked. */
const authors = computed(() => {
  if (!state.index || !helpers.value) {
    return []
  }
  return helpers.value.describeAuthors(index, {
    spaces: includedSpaces.value.map((space) => space.id),
    includeHidden: state.includeHidden
  })
})

const canStart = computed(
  () =>
    Boolean(state.index && state.siteId) && includedSpaces.value.length > 0 && !prefixProblem.value
)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

function pickFile() {
  fileIpt.value?.click()
}

async function onFilePicked() {
  const file = fileIpt.value?.files?.[0] ?? null
  if (fileIpt.value) {
    fileIpt.value.value = null
  }
  if (file) {
    await readSource(file)
  }
}

async function readSource(file) {
  await closeSource()
  state.sourceName = file.name
  state.index = null
  state.spaces = []
  state.authorMap = {}
  state.log = []
  state.progress = 0
  state.phase = 'reading'
  addLog('info', t('admin.utilities.xwikiImport.logReading', { name: file.name }))

  try {
    const [{ openSource, readIndex }, planner] = await Promise.all([
      import('@/helpers/xwikiSource'),
      import('@/helpers/xwikiImport')
    ])
    helpers.value = planner
    source = await openSource(file)
    index = await readIndex(source, {
      onProgress: (value) => {
        state.progress = value
      }
    })
    state.spaces = planner.describeSpaces(index, { includeHidden: state.includeHidden })
    const files = [...index.documents.values()].reduce(
      (sum, document) => sum + document.attachments.length,
      0
    )
    state.index = {
      hasUsers: index.users.size > 0,
      pages: index.documents.size,
      files
    }
    addLog(
      'info',
      t('admin.utilities.xwikiImport.logRead', {
        pages: index.documents.size,
        files,
        spaces: state.spaces.length
      })
    )
    if (index.users.size < 1) {
      addLog('warn', t('admin.utilities.xwikiImport.logNoUsers'))
    }
    await matchAuthorsByEmail()
    state.phase = 'idle'
  } catch (err) {
    addLog('error', err.message)
    await closeSource()
    state.phase = 'failed'
  }
}

/**
 * Count the spaces again with hidden pages in or out, keeping what the operator ticked: whether a
 * space is wanted does not change because its hidden pages now count.
 */
function setIncludeHidden(value) {
  state.includeHidden = value
  const ticked = new Map(state.spaces.map((space) => [space.id, space.include]))
  state.spaces = helpers.value.describeSpaces(index, { includeHidden: value }).map((space) => ({
    ...space,
    include: ticked.get(space.id) ?? space.include
  }))
}

/**
 * Point every user whose profile gives an address at the account here with the same one. Only a
 * suggestion: the operator can change or clear each of them before starting.
 */
async function matchAuthorsByEmail() {
  const emails = [...index.users.values()].map((user) => user.email).filter(Boolean)
  if (emails.length < 1) {
    return
  }
  const matches = await API_CLIENT.post('import/match-users', { json: { emails } }).json()
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
    addLog('info', t('admin.utilities.xwikiImport.logMatched', { count: matched }))
  }
}

function describeSpace(space) {
  return [
    t('admin.utilities.xwikiImport.countPages', { count: space.pages }),
    space.files > 0 && t('admin.utilities.xwikiImport.countFiles', { count: space.files }),
    space.hidden > 0 && t('admin.utilities.xwikiImport.countHidden', { count: space.hidden })
  ]
    .filter(Boolean)
    .join(' · ')
}

/** The pencil's words: choosing an account, or changing the one already chosen. */
function pickLabel(author) {
  return state.authorMap[author.id]
    ? t('admin.utilities.xwikiImport.authorChange')
    : t('admin.utilities.xwikiImport.authorChoose')
}

function pickAuthor(author) {
  dialog({
    component: UserSearchDialog,
    componentProps: {
      title: t('admin.utilities.xwikiImport.pickAuthorTitle', {
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
    author.pages && t('admin.utilities.xwikiImport.countPages', { count: author.pages }),
    author.versions && t('admin.utilities.xwikiImport.countVersions', { count: author.versions }),
    author.files && t('admin.utilities.xwikiImport.countFiles', { count: author.files }),
    author.comments && t('admin.utilities.xwikiImport.countComments', { count: author.comments })
  ]
    .filter(Boolean)
    .join(' · ')
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
 * Run the import. A failure unlocks the form: pages are matched by path, and versions and comments
 * keyed by a derived id, so starting again after fixing what went wrong carries on rather than
 * duplicating.
 */
async function startImport() {
  state.phase = 'running'
  scrollToTop()
  state.progress = 0
  addLog('info', t('admin.utilities.xwikiImport.logStarted'))
  try {
    await helpers.value.runXwikiImport({
      source,
      index,
      spaces: includedSpaces.value.map((space) => space.id),
      prefix: state.prefix,
      includeHidden: state.includeHidden,
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

async function closeSource() {
  if (source) {
    await source.close()
    source = null
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
  closeSource()
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
