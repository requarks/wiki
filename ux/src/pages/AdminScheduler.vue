<template lang='pug'>
q-page.admin-terminal
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-bot.svg')
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
          { label: t('admin.scheduler.scheduled'), value: 'scheduled' },
          { label: t('admin.scheduler.completed'), value: 'completed' }
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
              //- q-icon(name='las la-stopwatch', color='primary', size='sm')
          template(v-slot:body-cell-name='props')
            q-td(:props='props')
              strong {{props.value}}
          template(v-slot:body-cell-cron='props')
            q-td(:props='props')
              span {{ props.value }}
          template(v-slot:body-cell-date='props')
            q-td(:props='props')
              i18n-t.text-caption(keypath='admin.scheduler.nextExecutionIn', tag='div')
                template(#date)
                  strong {{ humanizeDate(props.value) }}
              small {{props.value}}
    template(v-else)
      q-card.rounded-borders(
        v-if='state.jobs.length < 1'
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section.text-caption {{ t('admin.scheduler.completedNone') }}
      q-card.shadow-1(v-else) ---

</template>

<script setup>
import { onMounted, reactive, watch } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import gql from 'graphql-tag'
import { DateTime } from 'luxon'

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
  displayMode: 'scheduled',
  scheduledJobs: [],
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
    label: t('common.field.name'),
    align: 'left',
    field: 'name',
    name: 'name',
    sortable: true
  },
  {
    label: t('admin.scheduler.cron'),
    align: 'left',
    field: 'cron',
    name: 'cron',
    sortable: false
  },
  {
    label: t('admin.scheduler.timezone'),
    align: 'left',
    field: 'timezone',
    name: 'timezone',
    sortable: false
  },
  {
    label: t('admin.scheduler.nextExecution'),
    align: 'left',
    field: 'nextExecution',
    name: 'date',
    sortable: false
  }
]

// WATCHERS

watch(() => state.displayMode, (newValue) => {
  load()
})

// METHODS

async function load () {
  state.loading++
  try {
    if (state.displayMode === 'scheduled') {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getSystemScheduledJobs {
            systemScheduledJobs {
              id
              name
              cron
              timezone
              nextExecution
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      state.scheduledJobs = resp?.data?.systemScheduledJobs
    } else {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getSystemJobs (
            $type: SystemJobType!
          ) {
            systemJobs (
              type: $type
              ) {
              id
              name
              priority
              state
            }
          }
        `,
        variables: {
          type: state.displayMode.toUpperCase()
        },
        fetchPolicy: 'network-only'
      })
      state.jobs = resp?.data?.systemJobs
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

function humanizeDate (val) {
  return DateTime.fromISO(val).toRelative()
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang='scss'>
.admin-terminal {
  &-term {
    width: 100%;
    background-color: #000;
    border-radius: 5px;
    overflow: hidden;
    padding: 10px;
  }
}
</style>
