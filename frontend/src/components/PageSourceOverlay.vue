<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-code.svg" left size="md" />
      <span>{{ t('pageSource.title') }}</span>
      <w-space />
      <transition name="syncing">
        <w-spinner class="mr-2" v-show="state.loading > 0" color="accent" size="24px" />
      </transition>
      <w-btn
        class="mr-4"
        icon="la:download"
        color="teal-3"
        dense
        flat
        :disable="!state.content"
        @click="download">
        <w-tooltip anchor="bottom middle" self="top middle">{{
          t(`common.actions.download`)
        }}</w-tooltip>
      </w-btn>
      <w-btn icon="la:times" color="pink-2" dense flat @click="close">
        <w-tooltip anchor="bottom middle" self="top middle">{{
          t(`common.actions.close`)
        }}</w-tooltip>
      </w-btn>
    </w-header>
    <w-page-container>
      <w-page class="bg-dark-6 text-white font-robotomono pagesource">
        <w-scroll-area
          :thumb-style="thumb"
          :bar-style="bar"
          :horizontal-thumb-style="{ height: `5px` }"
          style="width: 100%; height: calc(100vh - 100px)">
          <div class="p-4 text-grey-5" v-if="state.notice">{{ state.notice }}</div>
          <!-- -> `pt-4` so the first line clears the header rather than sitting against it -->
          <pre class="px-4 pt-4" v-else v-text="state.content"></pre>
        </w-scroll-area>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onBeforeUnmount, onMounted, reactive } from 'vue'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import { fileSave } from 'browser-fs-access'

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

function download() {
  const fileType = contentTypes[state.contentType] ?? { ext: 'txt', mime: 'text/plain' }
  // -> No `;charset=` on the type: the save picker uses it as an `accept` key and rejects a type
  //    with parameters. A Blob built from a JS string is UTF-8 regardless.
  fileSave(new Blob([state.content], { type: fileType.mime }), {
    fileName: `page.${fileType.ext}`,
    extensions: [`.${fileType.ext}`]
  })
}

function close() {
  siteStore.$patch({ overlay: '' })
}

async function load() {
  state.loading++
  loading.show()
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
    const message =
      err.response?.status === 404
        ? t('pageSource.notFound')
        : (await err.response
            ?.json()
            .then((b) => b?.message)
            .catch(() => null)) || err.message
    state.notice = message
    notify({
      type: 'negative',
      message
    })
  } finally {
    loading.hide()
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
