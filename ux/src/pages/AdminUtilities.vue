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
        href='https://docs.js.wiki/admin/utilities'
        target='_blank'
        type='a'
        )
  q-separator(inset)
  .q-pa-md.q-gutter-md
    q-card.shadow-1
      q-list(separator)
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

</template>

<script setup>
import { computed, reactive } from 'vue'
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

// QUASAR

const $q = useQuasar()

// STORES / ROUTERS / i18n

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
</script>

<style lang='scss'>

</style>
