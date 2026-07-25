<template lang='pug'>
q-page.admin-terminal
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-bot-animated.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.scheduler.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.scheduler.subtitle') }}
    .col-auto.flex
      q-btn-toggle.q-mr-md(
        v-model='state.displayMode'
        push
        no-caps
        :disable='state.loading > 0'
        :toggle-color='$q.dark.isActive ? `white` : `black`'
        :toggle-text-color='$q.dark.isActive ? `black` : `white`'
        :text-color='$q.dark.isActive ? `white` : `black`'
        :color='$q.dark.isActive ? `dark-1` : `white`'
        :options=`[
          { label: t('admin.scheduler.schedule'), value: 'scheduled' },
          { label: t('admin.scheduler.upcoming'), value: 'upcoming' },
          { label: t('admin.scheduler.active'), value: 'active' },
          { label: t('admin.scheduler.completed'), value: 'completed' },
          { label: t('admin.scheduler.failed'), value: 'failed' },
        ]`
      )
      q-separator.q-mr-md(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/scheduler`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
  q-separator(inset)
  .q-pa-md.q-gutter-md
    template(v-if='state.displayMode === `scheduled`')
      q-card.rounded-borders(
        v-if='state.scheduledJobs.length < 1'
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section.text-caption {{ t('admin.scheduler.scheduledNone') }}
      q-card(v-else)
        q-table(
          :rows='state.scheduledJobs'
          :columns='scheduledJobsHeaders'
          row-key='id'
          flat
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='state.loading > 0'
          )
          template(v-slot:body-cell-id='props')
            q-td(:props='props')
              q-spinner-clock.q-mr-sm(
                color='indigo'
                size='xs'
              )
          template(v-slot:body-cell-task='props')
            q-td(:props='props')
              strong {{props.value}}
              div: small.text-grey {{props.row.id}}
          template(v-slot:body-cell-cron='props')
            q-td(:props='props')
              q-chip(
                square
                size='md'
                color='blue'
                text-color='white'
                )
                span.font-robotomono {{ props.value }}
          template(v-slot:body-cell-type='props')
            q-td(:props='props')
              q-chip(
                square
                size='md'
                dense
                color='deep-orange'
                text-color='white'
                )
                small.text-uppercase {{ props.value }}
          template(v-slot:body-cell-created='props')
            q-td(:props='props')
              span {{props.value}}
              div: small.text-grey {{humanizeDate(props.row.createdAt)}}
          template(v-slot:body-cell-updated='props')
            q-td(:props='props')
              span {{props.value}}
              div: small.text-grey {{humanizeDate(props.row.updatedAt)}}
          template(v-slot:body-cell-run='props')
            q-td(:props='props')
              q-btn.acrylic-btn.q-px-sm(
                flat
                icon='las la-play'
                color='positive'
                :aria-label='t(`admin.scheduler.runNow`)'
                @click='runNow(props.row)'
                )
                q-tooltip(anchor='center left', self='center right') {{ t('admin.scheduler.runNow') }}
    template(v-else-if='state.displayMode === `upcoming`')
      q-card.rounded-borders(
        v-if='state.upcomingJobs.length < 1'
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section.text-caption {{ t('admin.scheduler.upcomingNone') }}
      q-card(v-else)
        q-table(
          :rows='state.upcomingJobs'
          :columns='upcomingJobsHeaders'
          row-key='id'
          flat
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='state.loading > 0'
          )
          template(v-slot:body-cell-id='props')
            q-td(:props='props')
              q-icon(name='las la-clock', color='primary', size='sm')
          template(v-slot:body-cell-task='props')
            q-td(:props='props')
              strong {{props.value}}
              div: small.text-grey {{props.row.id}}
          template(v-slot:body-cell-waituntil='props')
            q-td(:props='props')
              span {{ props.value }}
              div: small.text-grey {{humanizeDate(props.row.waitUntil)}}
          template(v-slot:body-cell-retries='props')
            q-td(:props='props')
              span #[strong {{props.value + 1}}] #[span.text-grey / {{props.row.maxRetries + 1}}]
          template(v-slot:body-cell-useworker='props')
            q-td(:props='props')
              template(v-if='props.value')
                q-icon(name='las la-microchip', color='brown', size='sm')
                small.q-ml-xs.text-brown Worker
              template(v-else)
                q-icon(name='las la-leaf', color='teal', size='sm')
                small.q-ml-xs.text-teal In-Process
          template(v-slot:body-cell-date='props')
            q-td(:props='props')
              span {{props.value}}
              div
                i18n-t.text-grey(keypath='admin.scheduler.createdBy', tag='small')
                  template(#instance)
                    strong {{props.row.createdBy}}
          template(v-slot:body-cell-cancel='props')
            q-td(:props='props')
              q-btn.acrylic-btn.q-px-sm(
                flat
                icon='las la-window-close'
                color='negative'
                @click='cancelJob(props.row.id)'
                )
                q-tooltip(anchor='center left', self='center right') {{ t('admin.scheduler.cancelJob') }}
    template(v-else)
      q-card.rounded-borders(
        v-if='state.jobs.length < 1'
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section.text-caption {{ t('admin.scheduler.' + state.displayMode + 'None') }}
      q-card(v-else)
        q-table(
          :rows='state.jobs'
          :columns='jobsHeaders'
          row-key='id'
          flat
          hide-bottom
          :rows-per-page-options='[0]'
          :loading='state.loading > 0'
          )
          template(v-slot:body-cell-id='props')
            q-td(:props='props')
              q-avatar(
                v-if='props.row.state === `completed`'
                icon='las la-check'
                color='positive'
                text-color='white'
                size='sm'
                rounded
                )
              q-avatar(
                v-else-if='props.row.state === `failed`'
                icon='las la-times'
                color='negative'
                text-color='white'
                size='sm'
                rounded
                )
              q-avatar(
                v-else-if='props.row.state === `interrupted`'
                icon='las la-square-full'
                color='orange'
                text-color='white'
                size='sm'
                rounded
                )
              q-circular-progress(
                v-else-if='props.row.state === `active`'
                indeterminate
                size='sm'
                :thickness='0.4'
                color='blue'
                track-color='blue-1'
                center-color='blue-2'
                )
          template(v-slot:body-cell-task='props')
            q-td(:props='props')
              strong {{props.value}}
              div: small.text-grey {{props.row.id}}
          template(v-slot:body-cell-state='props')
            q-td(:props='props')
              template(v-if='props.value === `completed`')
                i18n-t(keypath='admin.scheduler.completedIn', tag='span')
                  template(#duration)
                    strong {{humanizeDuration(props.row.startedAt, props.row.completedAt)}}
                div: small.text-grey {{ humanizeDate(props.row.completedAt) }}
              template(v-else-if='props.value === `active`')
                em.text-grey {{ t('admin.scheduler.pending') }}
              template(v-else)
                strong.text-negative {{ props.value === 'failed' ? t('admin.scheduler.error') : t('admin.scheduler.interrupted') }}
                div: small {{ props.row.lastErrorMessage }}
          template(v-slot:body-cell-attempt='props')
            q-td(:props='props')
              span #[strong {{props.value}}] #[span.text-grey / {{props.row.maxRetries + 1}}]
          template(v-slot:body-cell-useworker='props')
            q-td(:props='props')
              template(v-if='props.value')
                q-icon(name='las la-microchip', color='brown', size='sm')
                small.q-ml-xs.text-brown Worker
              template(v-else)
                q-icon(name='las la-leaf', color='teal', size='sm')
                small.q-ml-xs.text-teal In-Process
          template(v-slot:body-cell-date='props')
            q-td(:props='props')
              span {{props.value}}
              div: small.text-grey {{humanizeDate(props.row.startedAt)}}
              div
                i18n-t.text-grey(keypath='admin.scheduler.createdBy', tag='small')
                  template(#instance)
                    strong {{props.row.executedBy}}
          template(v-slot:body-cell-actions='props')
            q-td(:props='props')
              //- Only withheld while the scheduler still owes the job an automatic attempt
              //- (`attempt` counts from 1, `maxRetries` is how many *extra* attempts it gets)
              q-btn.acrylic-btn.q-px-sm(
                v-if='props.row.state !== `active`'
                flat
                icon='las la-undo-alt'
                color='orange'
                :aria-label='t(`admin.scheduler.retryJob`)'
                @click='retryJob(props.row.id)'
                :disable='props.row.state === `failed` && props.row.attempt <= props.row.maxRetries'
                )
                q-tooltip(anchor='center left', self='center right') {{ t('admin.scheduler.retryJob') }}
      .text-caption.text-grey(v-if='state.jobsTotal > state.jobs.length')
        | {{ t('admin.scheduler.historyCapped', { shown: state.jobs.length, total: state.jobsTotal }) }}

</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

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

watch(() => state.displayMode, () => {
  load()
})

// METHODS

/** Largest-first. `week` is deliberately absent, so output reads e.g. "21 days ago". */
const RELATIVE_UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1]
]
const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** Reads both ways: past for history, future for a job still waiting its turn. */
function relativeDate (val) {
  if (!val) { return '---' }
  const seconds = Temporal.Instant.from(val).until(Temporal.Now.instant()).total('seconds')
  for (const [unit, secondsPerUnit] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= secondsPerUnit || unit === 'second') {
      return relativeTimeFormat.format(-Math.round(seconds / secondsPerUnit), unit)
    }
  }
}

function humanizeDate (val) {
  if (!val) { return '---' }
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

/** Narrow, largest-first and skipping empty units — "1h 4m 32s", or "820ms" for a quick job. */
const DURATION_UNITS = ['hour', 'minute', 'second', 'millisecond']
const durationListFormat = new Intl.ListFormat(undefined, { style: 'narrow', type: 'unit' })

function humanizeDuration (start, end) {
  if (!start || !end) { return '---' }
  const dur = Temporal.Instant.from(start).until(Temporal.Instant.from(end)).round({
    largestUnit: 'hour',
    smallestUnit: 'millisecond'
  })
  const parts = DURATION_UNITS
    .filter(unit => dur[`${unit}s`] > 0)
    .map(unit => new Intl.NumberFormat(undefined, {
      style: 'unit',
      unit,
      unitDisplay: 'narrow'
    }).format(dur[`${unit}s`]))
  // -> A job that took under a millisecond still has to render as something
  return parts.length > 0 ? durationListFormat.format(parts) : '0ms'
}

async function load () {
  state.loading++
  try {
    if (state.displayMode === 'scheduled') {
      state.scheduledJobs = await API_CLIENT.get('scheduler/schedule').json() ?? []
    } else if (state.displayMode === 'upcoming') {
      state.upcomingJobs = await API_CLIENT.get('scheduler/upcoming').json() ?? []
    } else {
      // -> Repeated `states` params rather than a comma-joined value: that is what the route's
      //    array schema validates against
      const searchParams = new URLSearchParams(
        MODE_STATES[state.displayMode].map(s => ['states', s])
      )
      searchParams.set('limit', HISTORY_LIMIT)
      const resp = await API_CLIENT.get('scheduler/jobs', { searchParams }).json()
      state.jobs = resp?.jobs ?? []
      state.jobsTotal = resp?.total ?? 0
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.scheduler.loadFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function runNow (entry) {
  state.loading++
  try {
    const resp = await API_CLIENT.post(`scheduler/schedule/${entry.id}/run`).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    // -> Nothing on this tab changes: the job it queued shows up under upcoming, then in the history
    $q.notify({
      type: 'positive',
      message: t('admin.scheduler.runNowSuccess', { task: entry.task })
    })
  } catch (err) {
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: t('admin.scheduler.runNowFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

async function cancelJob (jobId) {
  state.loading++
  try {
    const resp = await API_CLIENT.delete(`scheduler/upcoming/${jobId}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('admin.scheduler.cancelJobSuccess')
    })
    await load()
  } catch (err) {
    // -> ky throws above 400 — a job picked up between the render and the click answers 404
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: t('admin.scheduler.cancelJobFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

async function retryJob (jobId) {
  state.loading++
  try {
    const resp = await API_CLIENT.post(`scheduler/jobs/${jobId}/retry`).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('admin.scheduler.retryJobSuccess')
    })
    await load()
  } catch (err) {
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
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
