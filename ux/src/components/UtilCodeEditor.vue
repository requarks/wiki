<template lang="pug">
.util-code-editor(
  ref='editorRef'
  )
</template>

<script setup>
/* eslint no-unused-vars: "off" */

import { keymap, EditorView, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { ref, shallowRef, onBeforeMount, onMounted, watch } from 'vue'

// PROPS

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    default: 'plaintext'
  },
  minHeight: {
    type: Number,
    default: 150
  }
})

// EMITS

const emit = defineEmits([
  'update:modelValue'
])

// STATE

const editor = shallowRef(null)
const editorRef = ref(null)

// WATCHERS

watch(() => props.modelValue, (newVal) => {
  // Ignore loopback changes while editing
  if (!editor.value.hasFocus) {
    editor.value.dispatch({
      changes: { from: 0, to: editor.value.state.length, insert: newVal }
    })
  }
})

// MOUNTED

onMounted(async () => {
  let langModule = null
  switch (props.language) {
    case 'css': {
      langModule = (await import('@codemirror/lang-css')).css
      break
    }
    case 'html': {
      langModule = (await import('@codemirror/lang-html')).html
      break
    }
    case 'javascript': {
      langModule = (await import('@codemirror/lang-javascript')).javascript
      break
    }
    case 'json': {
      langModule = (await import('@codemirror/lang-json')).json
      break
    }
    case 'markdown': {
      langModule = (await import('@codemirror/lang-markdown')).markdown
      break
    }
  }
  editor.value = new EditorView({
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        lineNumbers(),
        EditorView.theme({
          '.cm-content, .cm-gutter': { minHeight: `${props.minHeight}px` }
        }),
        ...langModule && [langModule()],
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.updateListener.of(v => {
          if (v.docChanged) {
            emit('update:modelValue', v.state.doc.toString())
          }
        })
      ]
    }),
    parent: editorRef.value
  })
})

onBeforeMount(() => {
  if (editor.value) {
    editor.value.destroy()
  }
})
</script>

<style lang="scss">
.util-code-editor {
  min-height: 100px;
  border: 1px solid #CCC;
  border-radius: 5px;
  overflow: hidden;

  > .CodeMirror {
    height: 150px;
  }
}
</style>
