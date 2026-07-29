<template>
  <w-card class="page-scripts-dialog" style="width: 860px; max-width: 90vw">
    <w-toolbar class="bg-primary text-white">
      <div class="text-subtitle2">
        {{ t('editor.pageScripts.title') }} - {{ t('editor.props.' + props.mode) }}
      </div>
      <w-space />
      <w-chip square style="background-color: rgba(0, 0, 0, 0.1)" text-color="white">
        <div class="text-caption">{{ languageLabel }}</div>
      </w-chip>
    </w-toolbar>
    <div style="min-height: 450px">
      <!-- -> Square: this one spans the dialog edge to edge, so a radius would cut across its corners -->
      <util-code-editor
        ref="editor"
        v-model="state.content"
        :language="language"
        :min-height="450"
        :aria-label="languageLabel"
        square />
    </div>
    <w-card-actions class="card-actions">
      <w-space />
      <w-btn
        class="acrylic-btn"
        icon="la:times"
        :label="t(`common.actions.discard`)"
        color="grey-7"
        padding="xs md"
        flat
        @click="$emit('close')" />
      <w-btn
        icon="la:check"
        :label="t(`common.actions.save`)"
        unelevated
        color="primary"
        padding="xs md"
        @click="saveAndClose" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import UtilCodeEditor from './UtilCodeEditor.vue'

// PROPS

const props = defineProps({
  mode: {
    type: String,
    default: 'css'
  }
})

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const emit = defineEmits(['close'])

const { t } = useI18n()

// DATA

const editor = ref(null)

const state = reactive({
  content: ''
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

function persist() {
  pageStore.$patch({
    [contentStoreKey]: state.content
  })
}

/*
  A named handler rather than `persist(); $emit('close')` inline: Vue parses an inline handler as an
  EXPRESSION, and oxfmt reformats a semicolon-separated pair onto separate lines without the
  semicolon, which stops being one. It broke the build twice while this file was being edited.
*/
function saveAndClose() {
  persist()
  emit('close')
}

// MOUNTED

// -> No deferred mount: the quarter-second wait was there to give the old editor a laid-out container
//    to measure itself against, and a textarea needs no such thing
onMounted(() => {
  state.content = pageStore[contentStoreKey.value]
  // -> The editor is what this dialog is for, so the caret starts there. After the tick that renders
  //    the content above, so focus lands on a field that is already populated.
  nextTick(() => {
    editor.value?.focus()
  })
})
</script>

<style lang="scss"></style>
