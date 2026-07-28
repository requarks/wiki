<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-template.svg" left size="md" />
      <span>{{ t(`admin.mail.templateEditor`) }}</span>
      <w-space />
      <w-btn
        class="mr-2"
        flat
        rounded
        color="white"
        :aria-label="t(`common.actions.viewDocs`)"
        icon="la:question-circle"
        :href="siteStore.docsBase + `/system/mail`"
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
      <w-page>
        <!-- ------------------------------------------------------- -->
        <!-- MONACO EDITOR -->
        <!-- ------------------------------------------------------- -->
        <div class="mail-template-editor">
          <repl
            :editor="Monaco"
            :store="store"
            :show-ts-config="false"
            theme="dark"
            :auto-resize="true"
            :ssr="false"
            :show-compile-output="false" />
        </div>
        <w-inner-loading :showing="state.loading > 0">
          <w-spinner color="accent" size="lg" />
        </w-inner-loading>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { useAdminStore } from '@/stores/admin'
import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'

import { cloneDeep } from 'es-toolkit/object'
import { debounce } from 'es-toolkit/function'
import { Repl, ReplStore, File } from '@vue/repl'
import Monaco from '@vue/repl/monaco-editor'
import '@vue/repl/style.css'

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

function close() {
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
