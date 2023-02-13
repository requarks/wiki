<template lang="pug">
.util-code-editor
  textarea(ref='cmRef')
</template>

<script setup>
/* eslint no-unused-vars: "off" */
import { ref, shallowRef, onBeforeMount, onMounted, watch } from 'vue'

// Code Mirror
import CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'

// Language
import 'codemirror/mode/markdown/markdown.js'
import 'codemirror/mode/htmlmixed/htmlmixed.js'
import 'codemirror/mode/css/css.js'

// Addons
import 'codemirror/addon/selection/active-line.js'

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

const cm = shallowRef(null)
const cmRef = ref(null)

// WATCHERS

watch(() => props.modelValue, (newVal) => {
  // Ignore loopback changes while editing
  if (!cm.value.hasFocus()) {
    cm.value.setValue(newVal)
  }
})

// MOUNTED

onMounted(async () => {
  let langMode = null
  switch (props.language) {
    case 'css': {
      langMode = 'text/css'
      break
    }
    case 'html': {
      langMode = 'text/html'
      break
    }
    case 'javascript': {
      langMode = 'text/javascript'
      break
    }
    case 'json': {
      langMode = {
        name: 'javascript',
        json: true
      }
      break
    }
    case 'markdown': {
      langMode = 'text/markdown'
      break
    }
    default: {
      langMode = null
      break
    }
  }

  // -> Initialize CodeMirror
  cm.value = CodeMirror.fromTextArea(cmRef.value, {
    tabSize: 2,
    mode: langMode,
    theme: 'wikijs-dark',
    lineNumbers: true,
    lineWrapping: true,
    line: true,
    styleActiveLine: true,
    viewportMargin: 50,
    inputStyle: 'contenteditable',
    direction: 'ltr'
  })

  cm.value.setValue(props.modelValue)
  cm.value.on('change', c => {
    emit('update:modelValue', c.getValue())
  })

  cm.value.setSize(null, `${props.minHeight}px`)
})

onBeforeMount(() => {
  if (cm.value) {
    cm.value.destroy()
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
