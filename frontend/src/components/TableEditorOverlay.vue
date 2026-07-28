<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/color-data-grid.svg" left size="md" />
      <span>{{t(`editor.tableEditor.title`)}}</span>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.refresh`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/admin/editors/markdown`"
        target="_blank"
        type="a" />
      <w-btn-group push>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.cancel`)"
          :aria-label="t(`common.actions.cancel`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.save`)"
          :aria-label="t(`common.actions.save`)"
          icon="la:check"
          :disabled="state.loading > 0" />
      </w-btn-group>
    </w-header>
    <w-page-container>
      <w-page class="p-4">
        <div ref="tblRef" />
        <w-inner-loading :showing="state.loading > 0">
          <w-spinner color="accent" size="lg" />
        </w-inner-loading>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, ref } from 'vue'

import { useSiteStore } from '@/stores/site'

import { Tabulator } from 'tabulator-tables'
import { cloneDeep } from 'es-toolkit/object'
import 'tabulator-tables/dist/css/tabulator.css'


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
