<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-code.svg', left, size='md')
    span Page Source
    q-space
    transition(name='syncing')
      q-spinner-tail.q-mr-sm(
        v-show='state.loading > 0'
        color='accent'
        size='24px'
      )
    q-btn.q-mr-md(
      icon='las la-download'
      color='teal-3'
      dense
      flat
      @click='download'
      )
      q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.download`)}}
    q-btn(
      icon='las la-times'
      color='pink-2'
      dense
      flat
      @click='close'
      )
      q-tooltip(anchor='bottom middle', self='top middle') {{t(`common.actions.close`)}}

  q-page-container
    q-page.bg-dark-6.text-white.font-robotomono.pagesource
      q-scroll-area(
        :thumb-style='thumb'
        :bar-style='bar'
        :horizontal-thumb-style='{ height: `5px` }'
        style="width: 100%; height: calc(100vh - 100px);"
        )
        pre.q-px-md(v-text='state.content')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { exportFile, useQuasar } from 'quasar'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0,
  content: ''
})

const thumb = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.25
}
const bar = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.25
}

const contentTypes = {
  markdown: {
    ext: 'md',
    mime: 'text/markdown'
  },
  html: {
    ext: 'html',
    mime: 'text/html'
  }
}

// METHODS

function download () {
  const fileType = contentTypes[state.contentType] ?? { ext: 'txt', mime: 'text/plain' }
  exportFile(`page.${fileType.ext}`, state.content, { mimeType: `${fileType.mime};charset=UTF-8` })
}

function close () {
  siteStore.$patch({ overlay: '' })
}

async function load () {
  state.loading++
  $q.loading.show()
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query loadPageSource (
          $id: UUID!
          ) {
          pageById(
            id: $id
          ) {
            id
            content
            contentType
          }
        }
      `,
      variables: {
        id: pageStore.id
      },
      fetchPolicy: 'network-only'
    })
    const pageData = cloneDeep(resp?.data?.pageById ?? {})
    if (!pageData?.id) {
      throw new Error('ERR_PAGE_NOT_FOUND')
    }
    state.content = pageData.content
    state.contentType = pageData.contentType
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

onMounted(() => {
  load()
})

onBeforeUnmount(() => {
  siteStore.overlayOpts = {}
})
</script>

<style lang="scss" scoped>
.pagesource {
  > pre {
    margin: 0;
    overflow-x: auto;
  }
}
</style>
