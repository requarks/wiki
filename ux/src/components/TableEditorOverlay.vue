<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/color-data-grid.svg', left, size='md')
    span {{t(`editor.tableEditor.title`)}}
    q-space
    q-btn.q-mr-sm(
      flat
      rounded
      color='white'
      :aria-label='t(`common.actions.refresh`)'
      icon='las la-question-circle'
      :href='siteStore.docsBase + `/admin/editors/markdown`'
      target='_blank'
      type='a'
    )
    q-btn-group(push)
      q-btn(
        push
        color='white'
        text-color='grey-7'
        :label='t(`common.actions.cancel`)'
        :aria-label='t(`common.actions.cancel`)'
        icon='las la-times'
        @click='close'
      )
      q-btn(
        push
        color='positive'
        text-color='white'
        :label='t(`common.actions.save`)'
        :aria-label='t(`common.actions.save`)'
        icon='las la-check'
        :disabled='state.loading > 0'
      )
  q-page-container
    q-page.q-pa-md
      div(ref='tblRef')

      q-inner-loading(:showing='state.loading > 0')
        q-spinner(color='accent', size='lg')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { onMounted, reactive, ref } from 'vue'
import { Tabulator } from 'tabulator-tables'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

import { useSiteStore } from '@/stores/site'

import 'tabulator-tables/dist/css/tabulator.css'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0
})
const tblRef = ref(null)

// METHODS

function close () {
  siteStore.$patch({ overlay: '' })
}

onMounted(() => {
  const tbl = new Tabulator(tblRef.value, {
    clipboard: true,
    height: '100%'
  })
})
</script>
