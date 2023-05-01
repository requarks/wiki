<template lang='pug'>
q-page.admin-utilities
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-swiss-army-knife.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.utilities.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.utilities.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/admin/utilities`'
        target='_blank'
        type='a'
        )
  q-separator(inset)
  .q-pa-md.q-gutter-md
    q-card
      q-list(separator)
        q-item
          blueprint-icon(icon='disconnected', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.disconnectWS`)}}
            q-item-label(caption) {{t(`admin.utilities.disconnectWSHint`)}}
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click='disconnectWS'
              :label='t(`common.actions.proceed`)'
            )
        q-item
          blueprint-icon(icon='database-export', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.export`)}}
            q-item-label(caption) {{t(`admin.utilities.exportHint`)}}
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click=''
              :label='t(`common.actions.proceed`)'
            )
        q-item
          blueprint-icon(icon='datalake', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.flushCache`)}}
            q-item-label(caption) {{t(`admin.utilities.flushCacheHint`)}}
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click=''
              :label='t(`common.actions.proceed`)'
            )
        q-item
          blueprint-icon(icon='database-restore', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.import`)}}
            q-item-label(caption) {{t(`admin.utilities.importHint`)}}
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click=''
              :label='t(`common.actions.proceed`)'
            )
        q-item
          blueprint-icon(icon='matches', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.invalidAuthCertificates`)}}
            q-item-label(caption) {{t(`admin.utilities.invalidAuthCertificatesHint`)}}
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click=''
              :label='t(`common.actions.proceed`)'
            )
        q-item
          blueprint-icon(icon='historical', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.purgeHistory`)}}
            q-item-label(caption) {{t(`admin.utilities.purgeHistoryHint`)}}
          q-item-section(side)
            q-select(
              outlined
              :label='t(`admin.utilities.purgeHistoryTimeframe`)'
              v-model='state.purgeHistoryTimeframe'
              style='min-width: 175px;'
              emit-value
              map-options
              dense
              :options='purgeHistoryTimeframes'
            )
          q-separator.q-ml-sm(vertical)
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click=''
              :label='t(`common.actions.proceed`)'
            )
        q-item
          blueprint-icon(icon='rescan-document', :hue-rotate='45')
          q-item-section
            q-item-label {{t(`admin.utilities.scanPageProblems`)}}
            q-item-label(caption) {{t(`admin.utilities.scanPageProblemsHint`)}}
          q-item-section(side)
            q-btn.acrylic-btn(
              flat
              icon='las la-arrow-circle-right'
              color='primary'
              @click=''
              :label='t(`common.actions.proceed`)'
            )
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import gql from 'graphql-tag'

import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.utilities.title')
})

// DATA

const state = reactive({
  purgeHistoryTimeframe: '1y'
})

// COMPUTED

const purgeHistoryTimeframes = computed(() => ([
  { value: '24h', label: t('admin.utitilies.purgeHistoryToday') },
  { value: '1m', label: t('admin.utitilies.purgeHistoryMonth', 1, { count: 1 }) },
  { value: '3m', label: t('admin.utitilies.purgeHistoryMonth', 3, { count: 3 }) },
  { value: '6m', label: t('admin.utitilies.purgeHistoryMonth', 6, { count: 6 }) },
  { value: '1y', label: t('admin.utitilies.purgeHistoryYear', 1, { count: 1 }) },
  { value: '2y', label: t('admin.utitilies.purgeHistoryYear', 2, { count: 2 }) }
]))

// METHODS

async function disconnectWS () {
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation disconnectWS {
          disconnectWS {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      fetchPolicy: 'network-only'
    })
    if (resp?.data?.disconnectWS?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.utilities.disconnectWSSuccess')
      })
    } else {
      throw new Error(resp?.data?.disconnectWS?.operation?.succeeded)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to disconnect WS connections.',
      caption: err.message
    })
  }
  $q.loading.hide()
}
</script>

<style lang='scss'>

</style>
