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
      <!--
        -> Square: this one spans the dialog edge to edge, so a radius would cut across its corners.
        -> Dark in either appearance: what is typed here is the page's own code rather than a wiki
           setting, and a dark field is both what an author reads code in and what tells their code
           apart from the dialog around it.
      -->
      <util-code-editor
        ref="editor"
        v-model="state.content"
        :language="language"
        :min-height="450"
        :aria-label="languageLabel"
        square
        dark />
    </div>
    <!--
      Its own class rather than the shared `card-actions`: that one follows the app theme, and the
      editor above is dark whichever theme is on -- a light bar under a dark pane reads as a different
      component bolted to the bottom. Same treatment, and the same reasoning, as
      `PageVersionSourceDialog`.
    -->
    <w-card-actions class="page-scripts-dialog-actions">
      <w-space />
      <!-- -> `grey-5`, not the `grey-7` a light bar takes: #757575 on this bar is barely there -->
      <w-btn
        class="acrylic-btn"
        icon="la:times"
        :label="t(`common.actions.discard`)"
        color="grey-5"
        padding="xs md"
        flat
        @click="$emit('close')" />
      <!--
        -> Apply, not Save: this writes the content into the page store and closes. Nothing reaches
           the server until the page itself is saved, and a button saying otherwise invites an author
           to close the editor believing their script is stored.
      -->
      <w-btn
        icon="la:check"
        :label="t(`common.actions.apply`)"
        unelevated
        color="primary"
        padding="xs md"
        @click="applyAndClose" />
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
  /** Which of the three the dialog is editing: `jsLoad`, `jsUnload` or `styles`. */
  mode: {
    type: String,
    default: 'styles'
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

/*
  Which store field this dialog is editing. A table rather than a name built from `mode`, because the
  two do not line up: the CSS mode is called `styles` -- it is the button in the properties panel and
  the translation key of its label -- while the field it writes is `scriptCss`. Assembled, it spelled
  `scriptStyles`, a field the store does not have, so the CSS editor opened empty on a page that had
  CSS and saved into nothing.
*/
const STORE_KEYS = {
  jsLoad: 'scriptJsLoad',
  jsUnload: 'scriptJsUnload',
  styles: 'scriptCss'
}

const contentStoreKey = computed(() => STORE_KEYS[props.mode])

// METHODS

function persist() {
  // -> `.value`: the computed itself as a key stringifies to `[object Object]`, which is where every
  //    edit made in this dialog used to go
  pageStore.$patch({
    [contentStoreKey.value]: state.content
  })
}

/*
  A named handler rather than `persist(); $emit('close')` inline: Vue parses an inline handler as an
  EXPRESSION, and oxfmt reformats a semicolon-separated pair onto separate lines without the
  semicolon, which stops being one. It broke the build twice while this file was being edited.
*/
function applyAndClose() {
  persist()
  emit('close')
}

// MOUNTED

// -> No deferred mount: the quarter-second wait was there to give the old editor a laid-out container
//    to measure itself against, and a textarea needs no such thing
onMounted(() => {
  state.content = pageStore[contentStoreKey.value] ?? ''
  // -> The editor is what this dialog is for, so the caret starts there. After the tick that renders
  //    the content above, so focus lands on a field that is already populated.
  nextTick(() => {
    editor.value?.focus()
  })
})
</script>

<style lang="scss">
/* -> Colour only: WCardActions already lays the bar out */
.page-scripts-dialog-actions {
  background-color: $dark-3;
  background-image: radial-gradient(at top left, $dark-3, $dark-5);
  border-top: 1px solid #000;
  box-shadow: 0 -1px 0 0 rgba(#fff, 0.06);
  color: #fff;
}
</style>
