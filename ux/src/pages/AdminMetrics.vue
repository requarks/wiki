<template lang='pug'>
q-page.admin-api
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-graph.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.metrics.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.metrics.subtitle') }}
    .col
      .flex.items-center
        template(v-if='state.enabled')
          q-spinner-rings.q-mr-sm(color='green', size='md')
          .text-caption.text-green {{t('admin.metrics.enabled')}}
        template(v-else)
          q-spinner-rings.q-mr-sm(color='red', size='md')
          .text-caption.text-red {{t('admin.metrics.disabled')}}
    .col-auto
      q-btn.q-mr-sm.q-ml-md.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/metrics`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='refresh'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn.q-mr-sm(
        unelevated
        icon='las la-power-off'
        :label='!state.enabled ? t(`common.actions.activate`) : t(`common.actions.deactivate`)'
        :color='!state.enabled ? `positive` : `negative`'
        @click='globalSwitch'
        :loading='state.isToggleLoading'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.rounded-borders(
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section
            i18n-t(tag='span', keypath='admin.metrics.endpoint', scope='global')
              template(#endpoint)
                strong.font-robotomono /metrics
            .text-caption {{ t('admin.metrics.endpointWarning') }}
      q-card.rounded-borders.q-mt-md(
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-key', size='sm')
          q-card-section
            i18n-t(tag='span', keypath='admin.metrics.auth', scope='global')
              template(#headerName)
                strong.font-robotomono Authorization
              template(#tokenType)
                strong.font-robotomono Bearer
              template(#permission)
                strong.font-robotomono read:metrics
            .text-caption.font-robotomono Authorization: Bearer API-KEY-VALUE
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.metrics.title')
})

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  isToggleLoading: false
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getMetricsState {
        metricsState
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.enabled = resp?.data?.metricsState === true
  adminStore.info.isMetricsEnabled = state.enabled
  $q.loading.hide()
  state.loading--
}

async function refresh () {
  await load()
  $q.notify({
    type: 'positive',
    message: t('admin.metrics.refreshSuccess')
  })
}

async function globalSwitch () {
  state.isToggleLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation ($enabled: Boolean!) {
          setMetricsState (enabled: $enabled) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        enabled: !state.enabled
      }
    })
    if (resp?.data?.setMetricsState?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: state.enabled ? t('admin.metrics.toggleStateDisabledSuccess') : t('admin.metrics.toggleStateEnabledSuccess')
      })
      await load()
    } else {
      throw new Error(resp?.data?.setMetricsState?.operation?.message || 'An unexpected error occurred.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to switch metrics endpoint state.',
      caption: err.message
    })
  }
  state.isToggleLoading = false
}

// MOUNTED

onMounted(load)

</script>

<style lang='scss'>

</style>
