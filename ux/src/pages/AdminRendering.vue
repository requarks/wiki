<template lang='pug'>
q-page.admin-mail
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-rich-text-converter.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.rendering.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.rendering.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/system/rendering`'
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
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='$t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)

  .row.q-pa-md.q-col-gutter-md
    .col-auto
      q-card.rounded-borders.bg-dark
        q-list(
          style='min-width: 300px;'
          padding
          dark
          )
          q-item(
            v-for='rdr of state.renderers'
            :key='rdr.key'
            active-class='bg-primary text-white'
            :active='state.selectedRenderer === rdr.id'
            @click='state.selectedRenderer = rdr.id'
            clickable
            )
            q-item-section(side)
              q-icon(:name='`img:` + rdr.icon')
            q-item-section
              q-item-label {{rdr.title}}
              q-item-label(caption) {{rdr.description}}
            q-item-section(side)
              status-light(:color='rdr.isEnabled ? `positive` : `negative`', :pulse='rdr.isEnabled')
    .col
      .row.q-col-gutter-md
        .col-12.col-lg

</template>

<script setup>
import { cloneDeep, concat, filter, find, findIndex, reduce, reverse, sortBy } from 'lodash-es'
import { DepGraph } from 'dependency-graph'
import gql from 'graphql-tag'

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
  title: t('admin.rendering.title')
})

// DATA

const state = reactive({
  renderers: [
    { id: '123', title: 'Core', description: 'Base HTML Transformer', isEnabled: true, icon: '/_assets/icons/ultraviolet-brick.svg' }
  ],
  selectedRenderer: '',
  loading: 0
})

// METHODS

async function load () {

}

async function save () {

}

</script>
