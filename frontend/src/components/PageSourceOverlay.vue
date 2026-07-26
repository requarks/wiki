<template lang="pug">
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-code.svg', left, size='md')
    span {{ t('pageSource.title') }}
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
      :disable='!state.content'
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
        .q-pa-md.text-grey-5(v-if='state.notice') {{ state.notice }}
        pre.q-px-md(v-else, v-text='state.content')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { exportFile, useQuasar } from 'quasar'
import { onBeforeUnmount, onMounted, reactive } from 'vue'

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
  content: '',
  contentType: '',
  notice: ''
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
    // -> The source is not part of an ordinary page load, so it has to be asked for
    const pageData = await API_CLIENT.get(`sites/${siteStore.id}/pages/${pageStore.id}`, {
      searchParams: { withContent: true }
    }).json()
    if (!pageData?.id) {
      throw new Error(t('pageSource.notFound'))
    }
    // -> The source is withheld from a reader without a session, the field being left out entirely
    //    rather than blanked — an empty string is a page that genuinely has no content
    if (pageData.content === undefined) {
      state.notice = t('pageSource.unavailable')
      return
    }
    state.content = pageData.content
    // -> Falls back to the editor, which is what identifies the format for anything written before
    //    contentType was stored
    state.contentType = pageData.contentType || pageData.editor || ''
  } catch (err) {
    const message = err.response?.status === 404
      ? t('pageSource.notFound')
      : await err.response?.json().then(b => b?.message).catch(() => null) || err.message
    state.notice = message
    $q.notify({
      type: 'negative',
      message
    })
  } finally {
    $q.loading.hide()
    state.loading--
  }
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
