<template lang="pug">
.util-code-editor(
  ref='editor'
  )
</template>

<script>
/* eslint no-unused-vars: "off" */

// import { keymap, EditorView } from '@codemirror/view'
// import { EditorState } from '@codemirror/state'
// import { history, historyKeymap } from '@codemirror/history'
// import { defaultKeymap, indentWithTab } from '@codemirror/commands'
// import { lineNumbers } from '@codemirror/gutter'
// import { defaultHighlightStyle } from '@codemirror/highlight'

export default {
  props: {
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
  },
  emits: ['update:modelValue'],
  data () {
    return {
      editor: null
    }
  },
  watch: {
    modelValue (newVal) {
      // Ignore loopback changes while editing
      if (!this.editor.hasFocus) {
        this.editor.dispatch({
          changes: { from: 0, to: this.editor.state.length, insert: newVal }
        })
      }
    }
  },
  async mounted () {
    let langModule = null
    switch (this.language) {
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
    // this.editor = new EditorView({
    //   state: EditorState.create({
    //     doc: this.modelValue,
    //     extensions: [
    //       // history()
    //       // keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab])
    //       lineNumbers()
    //       // EditorView.theme({
    //       //   '.cm-content, .cm-gutter': { minHeight: `${this.minHeight}px` }
    //       // }),
    //       // ...langModule && [langModule()],
    //       // defaultHighlightStyle,
    //       // EditorView.updateListener.of(v => {
    //       //   if (v.docChanged) {
    //       //     this.$emit('update:modelValue', v.state.doc.toString())
    //       //   }
    //       // })
    //     ]
    //   }),
    //   parent: this.$refs.editor
    // })
  },
  beforeUnmount () {
    if (this.editor) {
      this.editor.destroy()
    }
  }
}
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
