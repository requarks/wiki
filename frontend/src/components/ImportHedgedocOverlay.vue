<template>
  <w-layout view="hHh lpR fFf" container>
    <!-- -> The bar and the progress strip as two rows of one header, as `ImportWikijs2Overlay` says why -->
    <w-header class="card-header import-header">
      <div class="flex items-center px-4 py-2">
        <w-icon name="img:/_assets/icons/ultraviolet-database-restore.svg" left size="md" />
        <div>
          <span>{{ t('admin.utilities.importHedgedoc') }}</span>
          <div class="text-caption">{{ t('admin.utilities.hedgedocImport.subtitle') }}</div>
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
        :aria-label="t('admin.utilities.hedgedocImport.progress')" />
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- What to import -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.hedgedocImport.source') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="database" top />
                <w-item-section>
                  <w-item-label>{{
                    t('admin.utilities.hedgedocImport.connectionString')
                  }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.hedgedocImport.connectionStringHint')
                  }}</w-item-label>
                  <w-input
                    class="mt-2"
                    outlined
                    dense
                    autocomplete="off"
                    spellcheck="false"
                    v-model="state.connectionString"
                    placeholder="postgresql://user:password@host:5432/hedgedoc"
                    :disabled="isRunning"
                    :aria-label="t('admin.utilities.hedgedocImport.connectionString')" />
                </w-item-section>
              </w-item>
              <w-separator class="my-2" inset />
              <w-item>
                <blueprint-icon icon="image" top />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.hedgedocImport.uploadUrls') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.hedgedocImport.uploadUrlsHint')
                  }}</w-item-label>
                  <w-input
                    class="mt-2"
                    outlined
                    dense
                    type="textarea"
                    :rows="2"
                    spellcheck="false"
                    v-model="state.uploadUrlsText"
                    placeholder="https://notes.example.org/uploads/"
                    :disabled="isRunning"
                    :aria-label="t('admin.utilities.hedgedocImport.uploadUrls')" />
                </w-item-section>
              </w-item>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.hedgedocImport.destination') }}</w-card-header>
              <w-item>
                <blueprint-icon icon="website" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.hedgedocImport.targetSite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.hedgedocImport.targetSiteHint')
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
                    :aria-label="t('admin.utilities.hedgedocImport.targetSite')" />
                </w-item-section>
              </w-item>
            </w-card>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.hedgedocImport.options') }}</w-card-header>
              <w-item tag="label">
                <blueprint-icon icon="duplicate" />
                <w-item-section>
                  <w-item-label>{{ t('admin.utilities.hedgedocImport.overwrite') }}</w-item-label>
                  <w-item-label caption>{{
                    t('admin.utilities.hedgedocImport.overwriteHint')
                  }}</w-item-label>
                  <w-item-label caption class="text-deep-orange-9 dark:text-deep-orange-4">{{
                    t('admin.utilities.hedgedocImport.overwriteWarning')
                  }}</w-item-label>
                </w-item-section>
                <w-item-section avatar>
                  <w-toggle
                    v-model="state.overwrite"
                    color="negative"
                    :disabled="isRunning"
                    checked-icon="la:check"
                    unchecked-icon="la:times"
                    :aria-label="t('admin.utilities.hedgedocImport.overwrite')" />
                </w-item-section>
              </w-item>
            </w-card>

            <!-- -> The label is spelt out rather than `loading`, as `ImportWikijs2Overlay` says why -->
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
                  ? t('admin.utilities.hedgedocImport.inProgress')
                  : t('admin.utilities.hedgedocImport.start')
              }}</span>
            </w-btn>
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.hedgedocImport.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <progress-log
                  :entries="state.log"
                  :empty-text="t('admin.utilities.hedgedocImport.progressEmpty')" />
              </div>
            </w-card>
          </div>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgressLog from '@/components/ProgressLog.vue'
import { apiErrorMessage } from '@/helpers/apiError'

import { useAdminStore } from '@/stores/admin'

/**
 * Import a HedgeDoc instance into a site as live notes.
 *
 * Unlike the 2.x import, the work is the server's: it connects to HedgeDoc's database itself, and this
 * screen only says where, and shows what `POST /import/hedgedoc` streams back while it runs -- log
 * lines keyed under `admin.utilities.hedgedocImport.log`, and how far it has got.
 *
 * Closing the screen ends the request, and the server stops after the note it is writing. Running the
 * import again carries on: it recognises the notes it already brought in.
 */

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /** Never kept anywhere but here: it carries the database password. */
  connectionString: '',
  /** HedgeDoc's upload URLs, one per line -- only images under one of them are copied. */
  uploadUrlsText: '',
  /** Defaults to whichever site the admin area is already pointed at. */
  siteId: adminStore.currentSiteId,
  overwrite: false,
  /** `{ ts, level, message }`, appended as the server reports. */
  log: [],
  /** `idle`, `running`, then `done` or `failed` -- see `ImportWikijs2Overlay` for why one value. */
  phase: 'idle',
  /** 0..1, as the server reports it. */
  progress: 0
})

/** The run in flight, so that closing the screen can end it. */
let controller = null

// COMPUTED

const isRunning = computed(() => state.phase === 'running')

/** The strip under the header while there is something to watch, and after a failure. */
const showProgress = computed(() => state.phase === 'running' || state.phase === 'failed')

const siteOptions = computed(() =>
  adminStore.sites.map((site) => ({ value: site.id, label: site.title }))
)

/** The textarea as the API wants it: trimmed, blanks dropped, one entry per line or comma. */
const uploadPrefixes = computed(() =>
  state.uploadUrlsText
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean)
)

const canStart = computed(() => Boolean(state.connectionString.trim() && state.siteId))

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

onBeforeUnmount(() => {
  controller?.abort()
})

/**
 * Run the import and follow it.
 *
 * The answer is newline-delimited JSON for as long as the import runs, read as it arrives. No timeout:
 * ky's default would cut a run of several minutes off at ten seconds. A refusal before it starts --
 * the body failing validation, no such site -- is an ordinary error answer instead.
 */
async function startImport() {
  state.phase = 'running'
  state.progress = 0
  state.log = []
  addLog('info', t('admin.utilities.hedgedocImport.logStarted'))

  controller = new AbortController()
  let failed = false
  try {
    const resp = await API_CLIENT.post('import/hedgedoc', {
      json: {
        connectionString: state.connectionString.trim(),
        siteId: state.siteId,
        overwrite: state.overwrite,
        uploadPrefixes: uploadPrefixes.value
      },
      timeout: false,
      signal: controller.signal
    })
    // -> A 400 is not thrown (`boot/api.js`), so it is read here
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      throw new Error(body?.message || resp.statusText)
    }

    const reader = resp.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) {
        break
      }
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop()
      for (const line of lines) {
        if (line.trim()) {
          failed = onEvent(JSON.parse(line)) || failed
        }
      }
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      addLog('error', apiErrorMessage(err))
    }
    failed = true
  }
  controller = null
  state.phase = failed ? 'failed' : 'done'
}

/**
 * Take one event from the server.
 *
 * @returns Whether it reports a failure
 */
function onEvent(event) {
  switch (event.type) {
    case 'progress':
      state.progress = event.value
      return false
    case 'log': {
      const params = { ...event.params }
      // -> A note is named by its title in the log, never its key: the key is its credential
      if ('title' in params && !params.title) {
        params.title = t('admin.utilities.hedgedocImport.untitled')
      }
      addLog(event.level, t(`admin.utilities.hedgedocImport.log.${event.key}`, params))
      return event.level === 'error' && event.key !== 'noteFailed'
    }
    default:
      return false
  }
}

/** Add a line to the log. `ProgressLog` keeps the panel at the bottom as it grows. */
function addLog(level, message) {
  state.log.push({
    ts: Temporal.Now.plainTimeISO().toString({ smallestUnit: 'second' }),
    level,
    message
  })
}
</script>

<style scoped lang="scss">
/* The header as a column of the bar and the strip, with one hairline under both -- the same rules as
   `ImportWikijs2Overlay`, which explains each. */
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
</style>
