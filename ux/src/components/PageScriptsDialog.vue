<template lang="pug">
q-card.page-scripts-dialog(style='width: 860px; max-width: 90vw;')
  q-toolbar.bg-primary.text-white
    .text-subtitle2 {{t('editor.pageScripts.title')}} - {{t('editor.props.' + props.mode)}}
    q-space
    q-chip(
      square
      style='background-color: rgba(0,0,0,.1)'
      text-color='white'
      )
      .text-caption {{languageLabel}}
  div(style='min-height: 450px;')
    q-no-ssr(:placeholder='t(`common.loading`)')
      util-code-editor(
        v-if='state.showEditor'
        ref='editor'
        v-model='state.content'
        :language='language'
        :min-height='450'
      )
  q-card-actions.card-actions
    q-space
    q-btn.acrylic-btn(
      icon='las la-times'
      :label='t(`common.actions.discard`)'
      color='grey-7'
      padding='xs md'
      v-close-popup
      flat
    )
    q-btn(
      icon='las la-check'
      :label='t(`common.actions.save`)'
      unelevated
      color='primary'
      padding='xs md'
      @click='persist'
      v-close-popup
    )
</template>

<script setup>
import { computed, nextTick, onMounted, reactive } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

import UtilCodeEditor from './UtilCodeEditor.vue'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

// PROPS

const props = defineProps({
  mode: {
    type: String,
    default: 'css'
  }
})

// QUASAR

const $q = useQuasar()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  content: '',
  showEditor: false
})

// COMPUTED

const language = computed(() => {
  switch (props.mode) {
    case 'jsLoad':
    case 'jsUnload':
      return 'javascript'
    case 'styles':
      return 'css'
    default:
      return 'plaintext'
  }
})

const languageLabel = computed(() => {
  switch (language.value) {
    case 'javascript':
      return 'Javascript'
    case 'css':
      return 'CSS'
    default:
      return 'Plain Text'
  }
})

const contentStoreKey = computed(() => {
  return 'script' + props.mode.charAt(0).toUpperCase() + props.mode.slice(1)
})

// METHODS

function persist () {
  pageStore.$patch({
    [contentStoreKey]: state.content
  })
}

// MOUNTED

onMounted(() => {
  state.content = pageStore[contentStoreKey.value]
  nextTick(() => {
    setTimeout(() => {
      state.showEditor = true
    }, 250)
  })
})
</script>

<style lang="scss">

</style>
