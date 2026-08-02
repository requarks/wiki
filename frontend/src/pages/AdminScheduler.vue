<template>
  <w-page class="admin-terminal">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-bot-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.scheduler.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.scheduler.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn-toggle
          class="mr-4"
          v-model="state.displayMode"
          push
          no-caps
          :disable="state.loading > 0"
          :toggle-color="dark.isActive ? `white` : `black`"
          :toggle-text-color="dark.isActive ? `black` : `white`"
          :text-color="dark.isActive ? `white` : `black`"
          :color="dark.isActive ? `dark-1` : `white`"
          :options="[
            { label: t('admin.scheduler.schedule'), value: 'scheduled' },
            { label: t('admin.scheduler.upcoming'), value: 'upcoming' },
            { label: t('admin.scheduler.active'), value: 'active' },
            { label: t('admin.scheduler.completed'), value: 'completed' },
            { label: t('admin.scheduler.failed'), value: 'failed' }
          ]" />
        <w-separator class="mr-4" vertical />
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/scheduler`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <div class="p-4 gap-4">
      <template v-if="state.displayMode === `scheduled`">
        <w-card
          class="rounded"
          v-if="state.scheduledJobs.length < 1"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section class="text-caption">{{
              t('admin.scheduler.scheduledNone')
            }}</w-card-section>
          </w-card-section>
        </w-card>
        <w-card v-else>
          <w-table
            :rows="state.scheduledJobs"
            :columns="scheduledJobsHeaders"
            row-key="id"
            flat
            :loading="state.loading > 0">
            <template v-slot:body-cell-id="props">
              <w-td :props="props">
                <!--
                  -> A calendar, not the plain `clock` the Upcoming tab uses: these rows are recurring
                     cron entries rather than single runs waiting on a time, and the two tabs should
                     not be telling them apart by nothing.

                     From `la` rather than `mdi` for weight: every other icon on this page is Line
                     Awesome, which is an outline set, and MDI's solid glyph sat noticeably heavier
                     beside them.
                -->
                <w-icon class="mr-2" name="la:calendar" color="indigo" size="sm" />
              </w-td>
            </template>
            <template v-slot:body-cell-task="props">
              <w-td :props="props">
                <strong>{{ props.value }}</strong>
                <div>
                  <small class="text-grey">{{ props.row.id }}</small>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-cron="props">
              <w-td :props="props">
                <w-chip square size="md" color="blue" text-color="white">
                  <span class="font-robotomono">{{ props.value }}</span>
                </w-chip>
              </w-td>
            </template>
            <template v-slot:body-cell-type="props">
              <w-td :props="props">
                <w-chip square size="md" dense color="deep-orange" text-color="white">
                  <small class="uppercase">{{ props.value }}</small>
                </w-chip>
              </w-td>
            </template>
            <template v-slot:body-cell-created="props">
              <w-td :props="props">
                <span>{{ props.value }}</span>
                <div>
                  <small class="text-grey">{{ humanizeDate(props.row.createdAt) }}</small>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-updated="props">
              <w-td :props="props">
                <span>{{ props.value }}</span>
                <div>
                  <small class="text-grey">{{ humanizeDate(props.row.updatedAt) }}</small>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-run="props">
              <w-td :props="props">
                <w-btn
                  class="acrylic-btn px-2"
                  flat
                  icon="la:play"
                  color="positive"
                  :aria-label="t(`admin.scheduler.runNow`)"
                  @click="runNow(props.row)">
                  <w-tooltip anchor="center left" self="center right">{{
                    t('admin.scheduler.runNow')
                  }}</w-tooltip>
                </w-btn>
              </w-td>
            </template>
          </w-table>
        </w-card>
      </template>
      <template v-else-if="state.displayMode === `upcoming`">
        <w-card
          class="rounded"
          v-if="state.upcomingJobs.length < 1"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section class="text-caption">{{
              t('admin.scheduler.upcomingNone')
            }}</w-card-section>
          </w-card-section>
        </w-card>
        <w-card v-else>
          <w-table
            :rows="state.upcomingJobs"
            :columns="upcomingJobsHeaders"
            row-key="id"
            flat
            :loading="state.loading > 0">
            <template v-slot:body-cell-id="props">
              <w-td :props="props"><w-icon name="la:clock" color="primary" size="sm" /></w-td>
            </template>
            <template v-slot:body-cell-task="props">
              <w-td :props="props">
                <strong>{{ props.value }}</strong>
                <div>
                  <small class="text-grey">{{ props.row.id }}</small>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-waituntil="props">
              <w-td :props="props">
                <span>{{ props.value }}</span>
                <div>
                  <small class="text-grey">{{ humanizeDate(props.row.waitUntil) }}</small>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-retries="props">
              <w-td :props="props">
                <span
                  ><strong>{{ props.value + 1 }}</strong>
                  <span class="text-grey">/ {{ props.row.maxRetries + 1 }}</span></span
                >
              </w-td>
            </template>
            <template v-slot:body-cell-useworker="props">
              <w-td :props="props">
                <template v-if="props.value">
                  <w-icon name="la:microchip" color="brown" size="sm" />
                  <small class="ml-1 text-brown">Worker</small>
                </template>
                <template v-else>
                  <w-icon name="la:leaf" color="teal" size="sm" />
                  <small class="ml-1 text-teal">In-Process</small>
                </template>
              </w-td>
            </template>
            <template v-slot:body-cell-date="props">
              <w-td :props="props">
                <span>{{ props.value }}</span>
                <div>
                  <i18n-t class="text-grey" keypath="admin.scheduler.createdBy" tag="small">
                    <template #instance
                      ><strong>{{ props.row.createdBy }}</strong></template
                    >
                  </i18n-t>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-cancel="props">
              <w-td :props="props">
                <w-btn
                  class="acrylic-btn px-2"
                  flat
                  icon="la:window-close"
                  color="negative"
                  @click="cancelJob(props.row.id)">
                  <w-tooltip anchor="center left" self="center right">{{
                    t('admin.scheduler.cancelJob')
                  }}</w-tooltip>
                </w-btn>
              </w-td>
            </template>
          </w-table>
        </w-card>
      </template>
      <template v-else>
        <w-card
          class="rounded"
          v-if="state.jobs.length < 1"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section class="text-caption">{{
              t('admin.scheduler.' + state.displayMode + 'None')
            }}</w-card-section>
          </w-card-section>
        </w-card>
        <w-card v-else>
          <w-table
            :rows="state.jobs"
            :columns="jobsHeaders"
            row-key="id"
            flat
            :loading="state.loading > 0">
            <template v-slot:body-cell-id="props">
              <w-td :props="props">
                <w-avatar
                  v-if="props.row.state === `completed`"
                  icon="la:check"
                  color="positive"
                  text-color="white"
                  size="sm"
                  rounded />
                <w-avatar
                  v-else-if="props.row.state === `failed`"
                  icon="la:times"
                  color="negative"
                  text-color="white"
                  size="sm"
                  rounded />
                <w-avatar
                  v-else-if="props.row.state === `interrupted`"
                  icon="la:square-full"
                  color="orange"
                  text-color="white"
                  size="sm"
                  rounded />
                <w-circular-progress
                  v-else-if="props.row.state === `active`"
                  indeterminate
                  size="sm"
                  :thickness="0.4"
                  color="blue"
                  track-color="blue-1"
                  center-color="blue-2" />
              </w-td>
            </template>
            <template v-slot:body-cell-task="props">
              <w-td :props="props">
                <strong>{{ props.value }}</strong>
                <div>
                  <small class="text-grey">{{ props.row.id }}</small>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-state="props">
              <w-td :props="props">
                <template v-if="props.value === `completed`">
                  <i18n-t keypath="admin.scheduler.completedIn" tag="span">
                    <template #duration>
                      <strong>{{
                        humanizeDuration(props.row.startedAt, props.row.completedAt)
                      }}</strong>
                    </template>
                  </i18n-t>
                  <div>
                    <small class="text-grey">{{ humanizeDate(props.row.completedAt) }}</small>
                  </div>
                </template>
                <template v-else-if="props.value === `active`">
                  <em class="text-grey">{{ t('admin.scheduler.pending') }}</em>
                </template>
                <template v-else>
                  <strong class="text-negative">{{
                    props.value === 'failed'
                      ? t('admin.scheduler.error')
                      : t('admin.scheduler.interrupted')
                  }}</strong>
                  <div>
                    <small>{{ props.row.lastErrorMessage }}</small>
                  </div>
                </template>
              </w-td>
            </template>
            <template v-slot:body-cell-attempt="props">
              <w-td :props="props">
                <span
                  ><strong>{{ props.value }}</strong>
                  <span class="text-grey">/ {{ props.row.maxRetries + 1 }}</span></span
                >
              </w-td>
            </template>
            <template v-slot:body-cell-useworker="props">
              <w-td :props="props">
                <template v-if="props.value">
                  <w-icon name="la:microchip" color="brown" size="sm" />
                  <small class="ml-1 text-brown">Worker</small>
                </template>
                <template v-else>
                  <w-icon name="la:leaf" color="teal" size="sm" />
                  <small class="ml-1 text-teal">In-Process</small>
                </template>
              </w-td>
            </template>
            <template v-slot:body-cell-date="props">
              <w-td :props="props">
                <span>{{ props.value }}</span>
                <div>
                  <small class="text-grey">{{ humanizeDate(props.row.startedAt) }}</small>
                </div>
                <div>
                  <i18n-t class="text-grey" keypath="admin.scheduler.createdBy" tag="small">
                    <template #instance
                      ><strong>{{ props.row.executedBy }}</strong></template
                    >
                  </i18n-t>
                </div>
              </w-td>
            </template>
            <template v-slot:body-cell-actions="props">
              <w-td :props="props">
                <!-- Only withheld while the scheduler still owes the job an automatic attempt -->
                <!-- (`attempt` counts from 1, `maxRetries` is how many *extra* attempts it gets) -->
                <w-btn
                  class="acrylic-btn px-2"
                  v-if="props.row.state !== `active`"
                  flat
                  icon="la:undo-alt"
                  color="orange"
                  :aria-label="t(`admin.scheduler.retryJob`)"
                  @click="retryJob(props.row.id)"
                  :disable="
                    props.row.state === `failed` && props.row.attempt <= props.row.maxRetries
                  ">
                  <w-tooltip anchor="center left" self="center right">{{
                    t('admin.scheduler.retryJob')
                  }}</w-tooltip>
                </w-btn>
              </w-td>
            </template>
          </w-table>
        </w-card>
        <div class="text-caption text-grey" v-if="state.jobsTotal > state.jobs.length">
          {{
            t('admin.scheduler.historyCapped', { shown: state.jobs.length, total: state.jobsTotal })
          }}
        </div>
      </template>
    </div>
  </w-page>
</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { humanizeDuration, relativeDate } from '@/helpers/datetime'

import { useSiteStore } from '@/stores/site'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.scheduler.title')
})

// DATA

const state = reactive({
  displayMode: 'upcoming',
  scheduledJobs: [],
  upcomingJobs: [],
  jobs: [],
  jobsTotal: 0,
  loading: 0
})

/** How many history entries a tab shows. The API caps this at 500. */
const HISTORY_LIMIT = 100

/** The history states behind each display mode. */
const MODE_STATES = {
  active: ['active'],
  completed: ['completed'],
  // -> An interrupted job never reported a result of its own, so it belongs with the failures
  failed: ['failed', 'interrupted']
}

const scheduledJobsHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'id',
    sortable: false,
    style: 'width: 15px; padding-right: 0;'
  },
  {
    label: t('common.field.task'),
    align: 'left',
    field: 'task',
    name: 'task',
    sortable: true
  },
  {
    label: t('admin.scheduler.cron'),
    align: 'left',
    field: 'cron',
    name: 'cron',
    sortable: true
  },
  {
    label: t('admin.scheduler.type'),
    align: 'left',
    field: 'type',
    name: 'type',
    sortable: true
  },
  {
    label: t('admin.scheduler.createdAt'),
    align: 'left',
    field: 'createdAt',
    name: 'created',
    sortable: true,
    format: relativeDate
  },
  {
    label: t('admin.scheduler.updatedAt'),
    align: 'left',
    field: 'updatedAt',
    name: 'updated',
    sortable: true,
    format: relativeDate
  },
  {
    align: 'center',
    field: 'id',
    name: 'run',
    sortable: false,
    style: 'width: 15px;'
  }
]

const upcomingJobsHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'id',
    sortable: false,
    style: 'width: 15px; padding-right: 0;'
  },
  {
    label: t('common.field.task'),
    align: 'left',
    field: 'task',
    name: 'task',
    sortable: true
  },
  {
    label: t('admin.scheduler.waitUntil'),
    align: 'left',
    field: 'waitUntil',
    name: 'waituntil',
    sortable: true,
    format: relativeDate
  },
  {
    label: t('admin.scheduler.attempt'),
    align: 'left',
    field: 'retries',
    name: 'retries',
    sortable: true
  },
  {
    label: t('admin.scheduler.useWorker'),
    align: 'left',
    field: 'useWorker',
    name: 'useworker',
    sortable: true
  },
  {
    label: t('admin.scheduler.scheduled'),
    align: 'left',
    field: 'createdAt',
    name: 'date',
    sortable: true,
    format: relativeDate
  },
  {
    align: 'center',
    field: 'id',
    name: 'cancel',
    sortable: false,
    style: 'width: 15px;'
  }
]

const jobsHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'id',
    sortable: false,
    style: 'width: 15px; padding-right: 0;'
  },
  {
    label: t('common.field.task'),
    align: 'left',
    field: 'task',
    name: 'task',
    sortable: true
  },
  {
    label: t('admin.scheduler.result'),
    align: 'left',
    field: 'state',
    name: 'state',
    sortable: true
  },
  {
    label: t('admin.scheduler.attempt'),
    align: 'left',
    field: 'attempt',
    name: 'attempt',
    sortable: true
  },
  {
    label: t('admin.scheduler.useWorker'),
    align: 'left',
    field: 'useWorker',
    name: 'useworker',
    sortable: true
  },
  {
    label: t('admin.scheduler.startedAt'),
    align: 'left',
    field: 'startedAt',
    name: 'date',
    sortable: true,
    format: relativeDate
  },
  {
    align: 'center',
    field: 'id',
    name: 'actions',
    sortable: false,
    style: 'width: 15px;'
  }
]

// WATCHERS

watch(
  () => state.displayMode,
  () => {
    load()
  }
)

// METHODS

/** Absolute, and with seconds: for a job, the timing IS the thing being read. */
function humanizeDate(val) {
  if (!val) {
    return '---'
  }
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  })
}

async function load() {
  state.loading++
  try {
    if (state.displayMode === 'scheduled') {
      state.scheduledJobs = (await API_CLIENT.get('scheduler/schedule').json()) ?? []
    } else if (state.displayMode === 'upcoming') {
      state.upcomingJobs = (await API_CLIENT.get('scheduler/upcoming').json()) ?? []
    } else {
      // -> Repeated `states` params rather than a comma-joined value: that is what the route's
      //    array schema validates against
      const searchParams = new URLSearchParams(
        MODE_STATES[state.displayMode].map((s) => ['states', s])
      )
      searchParams.set('limit', HISTORY_LIMIT)
      const resp = await API_CLIENT.get('scheduler/jobs', { searchParams }).json()
      state.jobs = resp?.jobs ?? []
      state.jobsTotal = resp?.total ?? 0
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.scheduler.loadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function runNow(entry) {
  state.loading++
  try {
    const resp = await API_CLIENT.post(`scheduler/schedule/${entry.id}/run`).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    // -> Nothing on this tab changes: the job it queued shows up under upcoming, then in the history
    notify({
      type: 'positive',
      message: t('admin.scheduler.runNowSuccess', { task: entry.task })
    })
  } catch (err) {
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.scheduler.runNowFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

async function cancelJob(jobId) {
  state.loading++
  try {
    const resp = await API_CLIENT.delete(`scheduler/upcoming/${jobId}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.scheduler.cancelJobSuccess')
    })
    await load()
  } catch (err) {
    // -> ky throws above 400 — a job picked up between the render and the click answers 404
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.scheduler.cancelJobFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

async function retryJob(jobId) {
  state.loading++
  try {
    const resp = await API_CLIENT.post(`scheduler/jobs/${jobId}/retry`).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.scheduler.retryJobSuccess')
    })
    await load()
  } catch (err) {
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.scheduler.retryJobFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  load()
})
</script>
