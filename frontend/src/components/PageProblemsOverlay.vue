<template>
  <w-layout view="hHh lpR fFf" container>
    <!--
      The bar and the progress strip under it are two rows of the ONE header element, as in
      `ImportWikijs2Overlay` -- see the note there for why the strip cannot be a sibling.
    -->
    <w-header class="card-header scan-header">
      <div class="flex items-center px-4 py-2">
        <w-icon name="img:/_assets/icons/ultraviolet-rescan-document.svg" left size="md" />
        <div>
          <span>{{ t('admin.utilities.scanPageProblems') }}</span>
          <div class="text-caption">{{ t('admin.utilities.pageProblems.subtitle') }}</div>
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
        :aria-label="t('admin.utilities.pageProblems.progress')" />
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- What is checked -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-5 flex flex-col gap-4">
            <!--
              Spelt out in the slot rather than through `icon`/`label`, for the reason given on the
              import's own button: `WBtn`'s `loading` would hide the label, and the label is what
              says which of the two this button currently does.
            -->
            <w-btn
              unelevated
              size="lg"
              class="w-full"
              :color="isRunning ? 'negative' : 'positive'"
              text-color="white"
              :disabled="state.checks.length < 1"
              @click="toggleScan">
              <w-icon :name="isRunning ? 'la:stop-circle' : 'la:play-circle'" class="shrink-0" />
              <span>{{
                isRunning
                  ? t('admin.utilities.pageProblems.stop')
                  : t('admin.utilities.pageProblems.start')
              }}</span>
            </w-btn>

            <w-card class="pb-2">
              <w-card-header>{{ t('admin.utilities.pageProblems.checksTitle') }}</w-card-header>
              <!--
                A table rather than a list, because each row is read ACROSS: what is checked and
                what the scan found. One row group per heading, which is what lets
                the stripes restart under each one and gives the heading `scope="rowgroup"`.
              -->
              <table class="checks-table w-full border-collapse text-left">
                <tbody v-for="group of checkGroups" :key="group.key">
                  <tr>
                    <th scope="rowgroup" colspan="2" class="checks-table__group">
                      {{ t(`admin.utilities.pageProblems.groups.${group.key}`) }}
                    </th>
                  </tr>
                  <tr v-for="check of group.checks" :key="check.key" class="checks-table__row">
                    <td class="px-4 py-1.5 text-sm">
                      {{ t(`admin.utilities.pageProblems.checks.${check.key}`) }}
                    </td>
                    <td class="w-20 px-4 py-1.5 text-right">
                      <w-badge
                        v-if="state.counts[check.key]"
                        rounded
                        :color="check.severity === 'error' ? 'negative' : 'orange-8'"
                        :label="state.counts[check.key]" />
                      <w-icon
                        v-else-if="state.phase === 'done'"
                        name="la:check"
                        size="16px"
                        class="text-positive"
                        :aria-label="t('admin.utilities.pageProblems.noProblems')" />
                      <span v-else class="text-sm text-grey-6">{{
                        state.phase === 'idle' ? '–' : '0'
                      }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </w-card>
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.pageProblems.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <progress-log
                  :entries="state.log"
                  :empty-text="t('admin.utilities.pageProblems.progressEmpty')" />
              </div>
            </w-card>
          </div>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgressLog from '@/components/ProgressLog.vue'
import { apiErrorMessage } from '@/helpers/apiError'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

/**
 * Scan every page on every site for broken or out-of-step data, and say what was found.
 *
 * Driven from here a batch at a time, the way the 2.x import is: `GET /system/page-problems` answers
 * one batch and a cursor, and the next batch is simply the next request. So the progress bar is this
 * component's own count, and stopping is not asking again -- there is no job on the server to cancel
 * and nothing left behind by a scan abandoned halfway. The server's `models/pageProblems.ts` is where
 * the checks are, and what each one means.
 *
 * Read-only: every problem is a line in the log, linked to the page it is about.
 */

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  /** `{ key, group, severity }`, from the server, in the order it lists them. */
  checks: [],
  /** Problems found so far, per check key. */
  counts: {},
  /** `{ ts, level, message, location?, url? }` — see `ProgressLog`. */
  log: [],
  /** `idle`, `running`, then `done`, `stopped` or `failed`. */
  phase: 'idle',
  /** 0..1, rows read against the total the first batch reported. */
  progress: 0
})

/**
 * Asked for between batches. Not state: nothing draws it, and it has to be readable from inside the
 * loop the moment it is set.
 */
let stopRequested = false

// COMPUTED

const isRunning = computed(() => state.phase === 'running')

/** As for the import: the strip is for watching a run, and for how far a failed one got. */
const showProgress = computed(() => state.phase === 'running' || state.phase === 'failed')

/** The checks under their headings, in the server's order for both. */
const checkGroups = computed(() => {
  const groups = []
  for (const check of state.checks) {
    let group = groups.at(-1)
    if (group?.key !== check.group) {
      group = { key: check.group, checks: [] }
      groups.push(group)
    }
    group.checks.push(check)
  }
  return groups
})

/** Which site a problem is on is only worth saying when there is more than one to choose from. */
const siteTitles = computed(() =>
  adminStore.sites.length > 1
    ? Object.fromEntries(adminStore.sites.map((site) => [site.id, site.title]))
    : null
)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

function addLog(level, message, extra = {}) {
  state.log.push({
    ts: Temporal.Now.plainTimeISO().toString({ smallestUnit: 'second' }),
    level,
    message,
    ...extra
  })
}

async function loadChecks() {
  try {
    const resp = await API_CLIENT.get('system/page-problems/checks').json()
    state.checks = resp?.checks ?? []
  } catch (err) {
    addLog('error', apiErrorMessage(err))
  }
}

/** One problem as a line: where it is, linked when there is a page to open, then what is wrong. */
function logProblem(problem) {
  const site = siteTitles.value?.[problem.siteId]
  addLog(
    problem.severity === 'error' ? 'error' : 'warn',
    t(`admin.utilities.pageProblems.problems.${problem.check}`, problem.params ?? {}),
    {
      location: `${site ? `${site} · ` : ''}${problem.locale}/${problem.path}`,
      url: problem.url
    }
  )
}

async function startScan() {
  stopRequested = false
  state.phase = 'running'
  state.progress = 0
  state.counts = {}
  state.log = []

  let cursor = null
  let total = 0
  let scanned = 0
  let errors = 0
  let warnings = 0
  try {
    do {
      const resp = await API_CLIENT.get('system/page-problems', {
        searchParams: cursor ? { cursor } : {}
      }).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      if (!cursor) {
        total = resp.total ?? 0
        addLog('info', t('admin.utilities.pageProblems.logStarted', { pages: resp.pages ?? 0 }))
      }
      scanned += resp.scanned ?? 0
      for (const problem of resp.problems ?? []) {
        state.counts[problem.check] = (state.counts[problem.check] ?? 0) + 1
        if (problem.severity === 'error') {
          errors++
        } else {
          warnings++
        }
        logProblem(problem)
      }
      state.progress = total > 0 ? Math.min(scanned / total, 1) : 1
      cursor = resp.cursor
    } while (cursor && !stopRequested)

    if (cursor) {
      state.phase = 'stopped'
      addLog('warn', t('admin.utilities.pageProblems.logStopped', { scanned, total }))
    } else {
      state.phase = 'done'
      if (errors + warnings < 1) {
        addLog('success', t('admin.utilities.pageProblems.logClean'))
      } else {
        addLog('success', t('admin.utilities.pageProblems.logFinished', { errors, warnings }))
      }
    }
  } catch (err) {
    addLog('error', apiErrorMessage(err))
    state.phase = 'failed'
  }
}

/** Takes effect when the batch in flight comes back; nothing on the server needs telling. */
function stopScan() {
  stopRequested = true
}

function toggleScan() {
  if (isRunning.value) {
    stopScan()
  } else {
    startScan()
  }
}

// MOUNTED

onMounted(loadChecks)

// -> Closing the overlay mid-scan ends it, rather than leaving a loop requesting batches for nobody
onBeforeUnmount(stopScan)
</script>

<style scoped lang="scss">
/*
  The header's closing line, redrawn under the progress strip. The same treatment as
  `.import-header` in `ImportWikijs2Overlay`, which says why: `.card-header`'s own border and shadow
  read as one thick rule beneath a progress bar, and a 1px border lands on a fractional device row
  under display scaling.
*/
.scan-header {
  flex-direction: column;
  align-items: stretch;
  position: relative;
}

body.body--light .scan-header,
body.body--dark .scan-header {
  border-bottom: 0;
  box-shadow: none;
}

.scan-header::after {
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

body.body--dark .scan-header::after {
  background-color: #000;
}

/*
  The checks table. Its rules are hairlines drawn by a pseudo-element on each cell, scaled to one
  device pixel the way `WTable` draws its own -- a 1px border lands on a fractional device row under
  display scaling -- and the stripes restart in every row group, the heading being its first row.
*/
.checks-table {
  --checks-rule: rgb(0 0 0 / 0.12);
  --checks-group: #{$dark-1};
  --checks-stripe: rgb(0 0 0 / 0.02);
  --checks-hover: rgb(0 0 0 / 0.05);

  th,
  td {
    position: relative;
  }

  tbody tr > *::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--checks-rule);
    transform: scaleY(calc(1 / var(--w-dpr, 1)));
    transform-origin: top left;
    pointer-events: none;
  }
}

.checks-table__group {
  padding: 6px 16px;
  background-color: var(--checks-group);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #fff;
}

.checks-table__row:nth-child(odd) {
  background-color: var(--checks-stripe);
}

.checks-table__row:hover {
  background-color: var(--checks-hover);
}

body.body--dark .checks-table {
  --checks-rule: rgb(255 255 255 / 0.15);
  --checks-group: #{$dark-6};
  --checks-stripe: rgb(255 255 255 / 0.025);
  --checks-hover: rgb(255 255 255 / 0.07);
}
</style>
