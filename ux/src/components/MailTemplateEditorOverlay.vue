<template lang='pug'>
q-layout(view='hHh lpR fFf', container)
  q-header.card-header.q-px-md.q-py-sm
    q-icon(name='img:/_assets/icons/fluent-template.svg', left, size='md')
    span {{ t(`admin.mail.templateEditor`) }}
    q-space
    q-btn.q-mr-sm(
      flat
      rounded
      color='white'
      :aria-label='t(`common.actions.viewDocs`)'
      icon='las la-question-circle'
      :href='siteStore.docsBase + `/system/mail`'
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
    q-page
      //--------------------------------------------------------
      //- MONACO EDITOR
      //--------------------------------------------------------
      .mail-template-editor
        repl(:editor='Monaco' :store='store' :show-ts-config='false' theme='dark' :auto-resize='true' :ssr='false' :show-compile-output='false')

      q-inner-loading(:showing='state.loading > 0')
        q-spinner(color='accent', size='lg')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep, debounce } from 'lodash-es'
import { Repl, ReplStore, File } from '@vue/repl'
import Monaco from '@vue/repl/monaco-editor'
import '@vue/repl/style.css'

import { useAdminStore } from 'src/stores/admin'
import { useEditorStore } from 'src/stores/editor'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  loading: 0
})
const store = new ReplStore({
  // initialize repl with previously serialized state
  serializedState: location.hash.slice(1),

  // starts on the output pane (mobile only) if the URL has a showOutput query
  showOutput: false,
  // starts on a different tab on the output pane if the URL has a outputMode query
  // and default to the "preview" tab
  outputMode: 'preview'
})

let editor
const monacoRef = ref(null)

// METHODS

function close () {
  adminStore.$patch({ overlay: '' })
}

// MOUNTED

// onMounted(async () => {
//   setTimeout(() => {
//     // -> Define Monaco Theme
//     monaco.editor.defineTheme('wikijs', {
//       base: 'vs-dark',
//       inherit: true,
//       rules: [],
//       colors: {
//         'editor.background': '#070a0d',
//         'editor.lineHighlightBackground': '#0d1117',
//         'editorLineNumber.foreground': '#546e7a',
//         'editorGutter.background': '#0d1117'
//       }
//     })

//     // -> Initialize Monaco Editor
//     editor = monaco.editor.create(monacoRef.value, {
//       automaticLayout: true,
//       cursorBlinking: 'blink',
//       // cursorSmoothCaretAnimation: true,
//       fontSize: 16,
//       formatOnType: true,
//       language: 'markdown',
//       lineNumbersMinChars: 4,
//       padding: { top: 10, bottom: 10 },
//       scrollBeyondLastLine: false,
//       tabSize: 2,
//       theme: 'wikijs',
//       value: '',
//       wordWrap: 'on'
//     })

//     // -> Handle content change
//     // editor.onDidChangeModelContent(debounce(ev => {
//     //   editor.getValue()
//     // }, 500))

//     // -> Post init
//     editor.focus()

//     console.info('BOB')
//   }, 1000)
// })

// onBeforeUnmount(() => {
//   if (editor) {
//     editor.dispose()
//   }
// })
</script>

<style lang="scss">
.mail-template-editor {
  height: calc(100vh - 101px);
  display: block;
  position: relative;

  > div {
    height: 100%;
  }
}
</style>
