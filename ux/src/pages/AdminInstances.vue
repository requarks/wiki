<template lang='pug'>
q-page.admin-terminal
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-network.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.instances.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.instances.subtitle') }}
    .col-auto.flex
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/admin/instances`'
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
    q-card
      q-table(
        :rows='state.instances'
        :columns='instancesHeaders'
        row-key='name'
        flat
        hide-bottom
        :rows-per-page-options='[0]'
        :loading='state.loading > 0'
        )
        template(v-slot:body-cell-icon='props')
          q-td(:props='props')
            q-icon(name='las la-server', color='positive', size='sm')
        template(v-slot:body-cell-id='props')
          q-td(:props='props')
            strong {{props.value}}
            div: small.text-grey: strong {{props.row.ip}}
            div: small.text-grey {{props.row.dbUser}}
        template(v-slot:body-cell-cons='props')
          q-td(:props='props')
            q-chip(
              icon='las la-plug'
              square
              size='md'
              color='blue'
              text-color='white'
              )
              span.font-robotomono {{ props.value }}
        template(v-slot:body-cell-subs='props')
          q-td(:props='props')
            q-chip(
              icon='las la-broadcast-tower'
              square
              size='md'
              color='green'
              text-color='white'
              )
              small.text-uppercase {{ props.value }}
        template(v-slot:body-cell-firstseen='props')
          q-td(:props='props')
            span {{props.value}}
            div: small.text-grey {{humanizeDate(props.row.dbFirstSeen)}}
        template(v-slot:body-cell-lastseen='props')
          q-td(:props='props')
            span {{props.value}}
            div: small.text-grey {{humanizeDate(props.row.dbLastSeen)}}
</template>

<script setup>
import { onMounted, reactive } from 'vue'
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
  title: t('admin.instances.title')
})

// DATA

const state = reactive({
  instances: [],
  loading: 0
})

const instancesHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'icon',
    sortable: false,
    style: 'width: 15px; padding-right: 0;'
  },
  {
    label: t('common.field.id'),
    align: 'left',
    field: 'id',
    name: 'id',
    sortable: true
  },
  {
    label: t('admin.instances.activeConnections'),
    align: 'left',
    field: 'activeConnections',
    name: 'cons',
    sortable: true
  },
  {
    label: t('admin.instances.activeListeners'),
    align: 'left',
    field: 'activeListeners',
    name: 'subs',
    sortable: true
  },
  {
    label: t('admin.instances.firstSeen'),
    align: 'left',
    field: 'dbFirstSeen',
    name: 'firstseen',
    sortable: true,
    format: v => DateTime.fromISO(v).toRelative()
  },
  {
    label: t('admin.instances.lastSeen'),
    align: 'left',
    field: 'dbLastSeen',
    name: 'lastseen',
    sortable: true,
    format: v => DateTime.fromISO(v).toRelative()
  }
]

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
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getSystemInstances {
          systemInstances {
            id
            activeConnections
            activeListeners
            dbUser
            dbFirstSeen
            dbLastSeen
            ip
          }
        }
      `,
      fetchPolicy: 'network-only'
    })
    state.instances = resp?.data?.systemInstances
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to load list of instances.',
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
