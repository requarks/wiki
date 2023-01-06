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
        :href='siteStore.docsBase + `/admin/scheduler`'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
      )
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
      q-card.shadow-1(v-else)
        q-table(
          :rows='state.scheduledJobs'
          :columns='scheduledJobsHeaders'
          row-key='name'
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
      q-card.shadow-1(v-else)
        q-table(
          :rows='state.upcomingJobs'
          :columns='upcomingJobsHeaders'
          row-key='name'
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
      q-card.shadow-1(v-else)
        q-table(
          :rows='state.jobs'
          :columns='jobsHeaders'
          row-key='name'
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
              q-btn.acrylic-btn.q-px-sm(
                v-if='props.row.state !== `active`'
                flat
                icon='las la-undo-alt'
                color='orange'
                @click='retryJob(props.row.id)'
                :disable='props.row.state === `interrupted` || props.row.state === `failed` && props.row.attempt < props.row.maxRetries'
                )
                q-tooltip(anchor='center left', self='center right') {{ t('admin.scheduler.retryJob') }}

</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import gql from 'graphql-tag'
import { DateTime, Duration, Interval } from 'luxon'

import { useSiteStore } from 'src/stores/site'

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
  loading: 0
})

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
    format: v => DateTime.fromISO(v).toRelative()
  },
  {
    label: t('admin.scheduler.updatedAt'),
    align: 'left',
    field: 'updatedAt',
    name: 'updated',
    sortable: true,
    format: v => DateTime.fromISO(v).toRelative()
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
    format: v => DateTime.fromISO(v).toRelative()
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
    format: v => DateTime.fromISO(v).toRelative()
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
    format: v => DateTime.fromISO(v).toRelative()
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

watch(() => state.displayMode, (newValue) => {
  load()
})

// METHODS

function humanizeDate (val) {
  return DateTime.fromISO(val).toFormat('fff')
}

function humanizeDuration (start, end) {
  const dur = Interval.fromDateTimes(DateTime.fromISO(start), DateTime.fromISO(end))
    .toDuration(['hours', 'minutes', 'seconds', 'milliseconds'])
  return Duration.fromObject({
    ...dur.hours > 0 && { hours: dur.hours },
    ...dur.minutes > 0 && { minutes: dur.minutes },
    ...dur.seconds > 0 && { seconds: dur.seconds },
    ...dur.milliseconds > 0 && { milliseconds: dur.milliseconds }
  }).toHuman({ unitDisplay: 'narrow', listStyle: 'short' })
}

async function load () {
  state.loading++
  try {
    if (state.displayMode === 'scheduled') {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getSystemJobsScheduled {
            systemJobsScheduled {
              id
              task
              cron
              type
              createdAt
              updatedAt
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      state.scheduledJobs = resp?.data?.systemJobsScheduled
    } else if (state.displayMode === 'upcoming') {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getSystemJobsUpcoming {
            systemJobsUpcoming {
              id
              task
              useWorker
              retries
              maxRetries
              waitUntil
              isScheduled
              createdBy
              createdAt
              updatedAt
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      state.upcomingJobs = resp?.data?.systemJobsUpcoming
    } else {
      const states = state.displayMode === 'failed' ? ['FAILED', 'INTERRUPTED'] : [state.displayMode.toUpperCase()]
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getSystemJobs (
            $states: [SystemJobState]
          ) {
            systemJobs (
              states: $states
              ) {
                id
                task
                state
                useWorker
                wasScheduled
                attempt
                maxRetries
                lastErrorMessage
                executedBy
                createdAt
                startedAt
                completedAt
            }
          }
        `,
        variables: {
          states
        },
        fetchPolicy: 'network-only'
      })
      state.jobs = resp?.data?.systemJobs?.map(j => ({ ...j, state: j.state.toLowerCase() }))
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load scheduled jobs.',
      caption: err.message
    })
  }
  state.loading--
}

async function cancelJob (jobId) {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation cancelJob ($id: UUID!) {
          cancelJob(id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: jobId
      }
    })
    if (resp?.data?.cancelJob?.operation?.succeeded) {
      load()
      $q.notify({
        type: 'positive',
        message: t('admin.scheduler.cancelJobSuccess')
      })
    } else {
      throw new Error(resp?.data?.cancelJob?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to cancel job.',
      caption: err.message
    })
  }
  state.loading--
}

async function retryJob (jobId) {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation retryJob ($id: UUID!) {
          retryJob(id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: jobId
      }
    })
    if (resp?.data?.retryJob?.operation?.succeeded) {
      this.load()
      $q.notify({
        type: 'positive',
        message: t('admin.scheduler.retryJobSuccess')
      })
    } else {
      throw new Error(resp?.data?.retryJob?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to retry the job.',
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  load()
})
</script>
