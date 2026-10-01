<template>
  <w-layout view="hHh lpR fFf" container>
    <!--
      The bar and the progress strip under it are two rows of the ONE header element, as in
      `ImportWikijs2Overlay` -- see the note there for why the strip cannot be a sibling.
    -->
    <w-header class="card-header render-header">
      <div class="flex items-center px-4 py-2">
        <w-icon name="img:/_assets/icons/ultraviolet-html.svg" left size="md" />
        <div>
          <span>{{ t('admin.utilities.rerenderPages') }}</span>
          <div class="text-caption">{{ t('admin.utilities.pageRenders.subtitle') }}</div>
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
        :aria-label="t('admin.utilities.pageRenders.progress')" />
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div class="grid grid-cols-12 gap-4 items-start">
          <!-- ----------------------- -->
          <!-- Pages -->
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
              :disabled="state.phase === 'starting'"
              @click="toggleRun">
              <w-icon :name="isRunning ? 'la:stop-circle' : 'la:play-circle'" class="shrink-0" />
              <span>{{
                isRunning
                  ? t('admin.utilities.pageRenders.stop')
                  : t('admin.utilities.pageRenders.start')
              }}</span>
            </w-btn>

            <w-card class="pb-2">
              <w-card-header>
                {{ t('admin.utilities.pageRenders.pagesTitle') }}
                <template v-if="state.pages.length > 0" #action>
                  <span class="text-sm font-normal text-grey-6">{{
                    t('admin.utilities.pageRenders.count', {
                      processed: state.processed,
                      total: state.pages.length
                    })
                  }}</span>
                </template>
              </w-card-header>
              <div v-if="state.pages.length < 1" class="px-4 py-2 text-sm text-grey-6">
                {{ t('admin.utilities.pageRenders.pagesEmpty') }}
              </div>
              <!--
                A table rather than a list, because each row is read ACROSS: how its render went,
                then which page it is. Scrolls on its own so that the button above stays in reach on
                a wiki of thousands of pages.
              -->
              <div v-else class="pages-scroll">
                <table class="pages-table w-full border-collapse text-left">
                  <tbody>
                    <tr v-for="page of state.pages" :key="page.id" class="pages-table__row">
                      <td class="w-16 pl-4 pr-0 py-1.5 align-middle">
                        <w-badge color="grey-7" class="max-w-full truncate" :label="page.locale" />
                      </td>
                      <td class="px-2 py-1.5 min-w-0">
                        <div class="text-sm truncate">{{ page.title }}</div>
                        <div class="text-xs text-grey-6 truncate">{{ pageSubtitle(page) }}</div>
                      </td>
                      <td class="w-10 pl-1 pr-4 py-1.5 align-middle text-right">
                        <w-spinner v-if="page.status === 'running'" size="16px" color="primary" />
                        <w-icon
                          v-else
                          :name="statusIcons[page.status].icon"
                          size="16px"
                          :class="statusIcons[page.status].class"
                          :aria-label="t(`admin.utilities.pageRenders.status.${page.status}`)" />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </w-card>
          </div>

          <!-- ----------------------- -->
          <!-- Progress log -->
          <!-- ----------------------- -->
          <div class="col-span-12 lg:col-span-7">
            <w-card>
              <w-card-header>{{ t('admin.utilities.pageRenders.progress') }}</w-card-header>
              <div class="p-4 pt-0">
                <progress-log
                  :entries="state.log"
                  :empty-text="t('admin.utilities.pageRenders.progressEmpty')" />
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
import { renderSource } from '@/renderers/source'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

/**
 * Render every page on every site again from its source, in this browser.
 *
 * The other way to re-render is the server's queue, which drives the same pipeline in a headless
 * browser and so needs the Puppeteer extension. This needs nothing: `renderSource` is that same
 * pipeline, and the admin's browser is a browser. So it is the way to put right renders that went
 * blank or stale on an instance with no extension, and to bring every page up to date after the
 * markdown settings change.
 *
 * Driven from here a batch at a time, the way the page problem scan is: `POST /system/page-renders`
 * lists the pages, `sources` hands out a batch of their content, and each render goes back on its own
 * `PUT`. Stopping is not asking again -- there is no job on the server to cancel, and a page is either
 * stored or left exactly as it was. What a render may carry (scripts, styles) is the server's to
 * decide, from the page's current render, and nothing sent from here can widen it.
 */

/** Sources fetched per request. Small enough to keep a request quick, large enough to matter. */
const BATCH_SIZE = 20

/** Lines the log keeps before it starts dropping the oldest routine ones -- see `trimLog`. */
const MAX_LOG_LINES = 5000

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t, locale } = useI18n()

// DATA

const state = reactive({
  /**
   * `{ id, siteId, locale, path, title, editor, status }`, in the server's order. `status` is
   * `pending`, `running`, `done`, `error` or `skipped` -- the last for a page that was deleted or
   * changed while the run reached it, which keeps whatever render that change gave it.
   */
  pages: [],
  /** Pages finished one way or another, which is what the count and the strip measure. */
  processed: 0,
  /** `{ ts, level, message, location?, url? }` — see `ProgressLog`. */
  log: [],
  /** `idle`, `starting`, `running`, then `done`, `stopped` or `failed`. */
  phase: 'idle',
  /** 0..1 */
  progress: 0
})

/**
 * Asked between pages. Not state: nothing draws it, and it has to be readable from inside the loop
 * the moment it is set.
 */
let stopRequested = false

/** Literal names, so that the icon bundle picks them up -- see `scripts/generate-icons.mjs`. */
const statusIcons = {
  pending: { icon: 'la:clock', class: 'text-grey-5' },
  done: { icon: 'la:check-circle', class: 'text-positive' },
  error: { icon: 'la:times-circle', class: 'text-negative' },
  skipped: { icon: 'la:exclamation-triangle', class: 'text-orange-8' }
}

// COMPUTED

const isRunning = computed(() => state.phase === 'running')

/** As for the page problem scan: the strip is for watching a run, and for how far a failed one got. */
const showProgress = computed(() => state.phase === 'running' || state.phase === 'failed')

/** Which site a page is on is only worth saying when there is more than one to choose from. */
const siteTitles = computed(() =>
  adminStore.sites.length > 1
    ? Object.fromEntries(adminStore.sites.map((site) => [site.id, site.title]))
    : null
)

/** Sizes in the log, in the reader's own number format. */
const sizeFormat = computed(
  () =>
    new Intl.NumberFormat(locale.value, {
      style: 'unit',
      unit: 'kilobyte',
      maximumFractionDigits: 1
    })
)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

/**
 * Push a line, and hand back the reactive copy of it so that a step can finish its own line in place
 * rather than writing a second one.
 */
function addLog(level, message, extra = {}) {
  state.log.push({
    ts: Temporal.Now.plainTimeISO().toString({ smallestUnit: 'second' }),
    level,
    message,
    ...extra
  })
  trimLog()
  return state.log.at(-1)
}

/**
 * Keep the log to a size the panel can draw. A run writes three lines a page, so a large wiki would
 * otherwise put tens of thousands of rows in the DOM. What goes is the oldest routine output; the
 * warnings and errors, which are what anybody scrolls back for, are kept however many there are.
 */
function trimLog() {
  while (state.log.length > MAX_LOG_LINES) {
    const idx = state.log.findIndex((entry) => entry.level === 'info' || entry.level === 'success')
    if (idx < 0) {
      return
    }
    state.log.splice(idx, 1)
  }
}

/**
 * One sub-task of the run, as a line that says what is being done and is then finished in place with
 * how it went: `↳ Rendering (markdown)… done in 12 ms, 4.1 kB`.
 */
function startStep(message) {
  const label = `  ↳ ${message}…`
  const entry = addLog('info', label)
  const started = performance.now()
  return {
    elapsed: () => Math.round(performance.now() - started),
    finish(detail, level = 'info') {
      entry.level = level
      entry.message = `${label} ${detail}`
    }
  }
}

/** The line a page's log starts with: where it is, then what it is called. */
function pageLocation(page) {
  const site = siteTitles.value?.[page.siteId]
  return `${site ? `${site} · ` : ''}${page.locale}/${page.path}`
}

/** The second line of a row in the table, whose locale is already in the badge beside it. */
function pageSubtitle(page) {
  const site = siteTitles.value?.[page.siteId]
  return `${site ? `${site} · ` : ''}/${page.path}`
}

function formatSize(text) {
  return sizeFormat.value.format(new Blob([text]).size / 1000)
}

function finishPage(page, status) {
  page.status = status
  state.processed++
  state.progress = state.pages.length > 0 ? state.processed / state.pages.length : 1
}

/** Render one page here and store it there. Never throws: a page that fails is the page's problem. */
async function renderPage(page, source) {
  addLog('info', page.title, { location: pageLocation(page) })
  if (!source) {
    addLog('warn', `  ↳ ${t('admin.utilities.pageRenders.logGone')}`)
    finishPage(page, 'skipped')
    return
  }
  page.status = 'running'

  const rendering = startStep(
    t('admin.utilities.pageRenders.logRendering', { editor: source.editor })
  )
  let html
  try {
    html = await renderSource(source.content, source.config, {
      pagePath: source.path,
      editor: source.editor
    })
    rendering.finish(
      t('admin.utilities.pageRenders.logRendered', {
        ms: rendering.elapsed(),
        size: formatSize(html)
      })
    )
  } catch (err) {
    rendering.finish(t('admin.utilities.pageRenders.logFailed', { message: err.message }), 'error')
    finishPage(page, 'error')
    return
  }

  const saving = startStep(t('admin.utilities.pageRenders.logSaving'))
  try {
    await API_CLIENT.put(`system/page-renders/${page.id}`, {
      json: { render: html, contentHash: source.contentHash }
    })
    saving.finish(t('admin.utilities.pageRenders.logSaved', { ms: saving.elapsed() }))
    finishPage(page, 'done')
  } catch (err) {
    const status = err.response?.status
    if (status === 404) {
      saving.finish(t('admin.utilities.pageRenders.logSkippedGone'), 'warn')
      finishPage(page, 'skipped')
    } else if (status === 409) {
      saving.finish(t('admin.utilities.pageRenders.logSkippedChanged'), 'warn')
      finishPage(page, 'skipped')
    } else {
      saving.finish(
        t('admin.utilities.pageRenders.logFailed', { message: apiErrorMessage(err) }),
        'error'
      )
      finishPage(page, 'error')
    }
  }
}

async function startRun() {
  stopRequested = false
  state.phase = 'starting'
  state.pages = []
  state.processed = 0
  state.progress = 0
  state.log = []
  const runStarted = performance.now()

  try {
    addLog('info', t('admin.utilities.pageRenders.logStarted'))
    const listing = startStep(t('admin.utilities.pageRenders.logListing'))
    const resp = await API_CLIENT.post('system/page-renders').json()
    state.pages = (resp?.pages ?? []).map((page) => ({ ...page, status: 'pending' }))
    listing.finish(
      t('admin.utilities.pageRenders.logListed', {
        pages: state.pages.length,
        ms: listing.elapsed()
      })
    )
    if (resp?.skipped > 0) {
      addLog('info', t('admin.utilities.pageRenders.logSkippedEditors', { count: resp.skipped }))
    }
    state.phase = 'running'

    for (let idx = 0; idx < state.pages.length && !stopRequested; idx += BATCH_SIZE) {
      const batch = state.pages.slice(idx, idx + BATCH_SIZE)
      addLog(
        'info',
        t('admin.utilities.pageRenders.logBatch', {
          from: idx + 1,
          to: idx + batch.length,
          total: state.pages.length
        })
      )
      const fetching = startStep(t('admin.utilities.pageRenders.logFetching'))
      let sources
      try {
        sources = await API_CLIENT.post('system/page-renders/sources', {
          json: { ids: batch.map((page) => page.id) }
        }).json()
      } catch (err) {
        fetching.finish(
          t('admin.utilities.pageRenders.logFailed', { message: apiErrorMessage(err) }),
          'error'
        )
        throw err
      }
      const byId = new Map((sources?.pages ?? []).map((source) => [source.id, source]))
      fetching.finish(
        t('admin.utilities.pageRenders.logFetched', {
          count: byId.size,
          ms: fetching.elapsed(),
          size: formatSize(JSON.stringify(sources?.pages ?? []))
        })
      )
      for (const page of batch) {
        if (stopRequested) {
          break
        }
        await renderPage(page, byId.get(page.id))
      }
    }

    const counts = { done: 0, error: 0, skipped: 0 }
    for (const page of state.pages) {
      if (page.status in counts) {
        counts[page.status]++
      }
    }
    const seconds = Math.round((performance.now() - runStarted) / 100) / 10
    if (state.processed < state.pages.length) {
      state.phase = 'stopped'
      addLog(
        'warn',
        t('admin.utilities.pageRenders.logStopped', {
          processed: state.processed,
          total: state.pages.length,
          seconds
        })
      )
    } else {
      state.phase = 'done'
      addLog(
        counts.error > 0 ? 'warn' : 'success',
        t('admin.utilities.pageRenders.logFinished', {
          rendered: counts.done,
          failed: counts.error,
          skipped: counts.skipped,
          seconds
        })
      )
    }
  } catch (err) {
    // -> Only the list and the batches get here: a page of its own never throws out of `renderPage`
    addLog('error', apiErrorMessage(err))
    state.phase = 'failed'
  }
}

/** Takes effect once the page in hand is finished; nothing on the server needs telling. */
function stopRun() {
  stopRequested = true
}

function toggleRun() {
  if (isRunning.value) {
    stopRun()
  } else {
    startRun()
  }
}

// -> Closing the overlay mid-run ends it, rather than leaving a loop rendering for nobody
onBeforeUnmount(stopRun)
</script>

<style scoped lang="scss">
/*
  The header's closing line, redrawn under the progress strip. The same treatment as
  `.import-header` in `ImportWikijs2Overlay`, which says why: `.card-header`'s own border and shadow
  read as one thick rule beneath a progress bar, and a 1px border lands on a fractional device row
  under display scaling.
*/
.render-header {
  flex-direction: column;
  align-items: stretch;
  position: relative;
}

body.body--light .render-header,
body.body--dark .render-header {
  border-bottom: 0;
  box-shadow: none;
}

.render-header::after {
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

body.body--dark .render-header::after {
  background-color: #000;
}

/* -> Tall enough to be worth scrolling, short enough that the card never runs off the overlay */
.pages-scroll {
  max-height: calc(100vh - 290px);
  overflow-y: auto;
}

/*
  The pages table, ruled and striped as the page problem scan's checklist is: hairlines drawn by a
  pseudo-element on each cell, scaled to one device pixel the way `WTable` draws its own. `fixed`
  layout, so that a long path truncates instead of widening the column.
*/
.pages-table {
  --pages-rule: rgb(0 0 0 / 0.12);
  --pages-stripe: rgb(0 0 0 / 0.02);
  --pages-hover: rgb(0 0 0 / 0.05);

  table-layout: fixed;

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
    background-color: var(--pages-rule);
    transform: scaleY(calc(1 / var(--w-dpr, 1)));
    transform-origin: top left;
    pointer-events: none;
  }
}

.pages-table__row:nth-child(odd) {
  background-color: var(--pages-stripe);
}

.pages-table__row:hover {
  background-color: var(--pages-hover);
}

body.body--dark .pages-table {
  --pages-rule: rgb(255 255 255 / 0.15);
  --pages-stripe: rgb(255 255 255 / 0.025);
  --pages-hover: rgb(255 255 255 / 0.07);
}
</style>
