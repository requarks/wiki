<template lang='pug'>
  .editor-code
    .editor-code-main
      .editor-code-editor
        codemirror(ref='cm', v-model='code', :options='cmOptions', @ready='onCmReady', @input='onCmInput')
</template>

<script>
import _ from 'lodash'

// ========================================
// IMPORTS
// ========================================

// Code Mirror
import CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'

// Language
import 'codemirror/mode/markdown/markdown.js'

// Addons
import 'codemirror/addon/selection/active-line.js'
import 'codemirror/addon/display/fullscreen.js'
import 'codemirror/addon/display/fullscreen.css'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/addon/scroll/annotatescrollbar.js'
import 'codemirror/addon/search/matchesonscrollbar.js'
import 'codemirror/addon/search/searchcursor.js'
import 'codemirror/addon/search/match-highlighter.js'

// ========================================
// INIT
// ========================================

// Platform detection
const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// ========================================
// Vue Component
// ========================================

export default {
  data() {
    return {
      code: '<h1>Title</h1>\n\n<p>Some text here</p>',
      cmOptions: {
        tabSize: 2,
        mode: 'text/html',
        theme: 'wikijs-dark',
        lineNumbers: true,
        lineWrapping: true,
        line: true,
        styleActiveLine: true,
        highlightSelectionMatches: {
          annotateScrollbar: true
        },
        viewportMargin: 50
      }
    }
  },
  computed: {
    cm() {
      return this.$refs.cm.codemirror
    },
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    }
  },
  methods: {
    onCmReady(cm) {
      let self = this
      const keyBindings = {
        'F11' (cm) {
          cm.setOption('fullScreen', !cm.getOption('fullScreen'))
        },
        'Esc' (cm) {
          if (cm.getOption('fullScreen')) cm.setOption('fullScreen', false)
        }
      }
      _.set(keyBindings, `${CtrlKey}-S`, cm => {
        self.$parent.save()
      })

      cm.setSize(null, 'calc(100vh - 64px)')
      cm.setOption('extraKeys', keyBindings)
      this.onCmInput(this.code)
    },
    onCmInput: _.debounce(function (newContent) {
      this.$store.set('editor/content', newContent)
    }, 500)
  }
}
</script>

<style lang='scss'>
.editor-code {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: darken(mc('grey', '900'), 4.5%);
    flex: 1 1 50%;
    display: block;
    height: calc(100vh - 96px);
    position: relative;

    &-title {
      background-color: mc('grey', '800');
      border-bottom-left-radius: 5px;
      display: inline-flex;
      height: 30px;
      justify-content: center;
      align-items: center;
      padding: 0 1rem;
      color: mc('grey', '500');
      position: absolute;
      top: 0;
      right: 0;
      z-index: 7;
      text-transform: uppercase;
      font-size: .7rem;
      cursor: pointer;

      @include until($tablet) {
        display: none;
      }
    }
  }

  // ==========================================
  // CODE MIRROR
  // ==========================================

  .CodeMirror {
    height: auto;

    .cm-header-1 {
      font-size: 1.5rem;
    }
    .cm-header-2 {
      font-size: 1.25rem;
    }
    .cm-header-3 {
      font-size: 1.15rem;
    }
    .cm-header-4 {
      font-size: 1.1rem;
    }
    .cm-header-5 {
      font-size: 1.05rem;
    }
    .cm-header-6 {
      font-size: 1.025rem;
    }
  }

  .CodeMirror-focused .cm-matchhighlight {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQI12NgYGBgkKzc8x9CMDAwAAAmhwSbidEoSQAAAABJRU5ErkJggg==);
    background-position: bottom;
    background-repeat: repeat-x;
  }
  .cm-matchhighlight {
    background-color: mc('grey', '800');
  }
  .CodeMirror-selection-highlight-scrollbar {
    background-color: mc('green', '600');
  }

  .cm-s-wikijs-dark.CodeMirror {
    background: darken(mc('grey','900'), 3%);
    color: #e0e0e0;
  }
  .cm-s-wikijs-dark div.CodeMirror-selected {
    background: mc('blue','800');
  }
  .cm-s-wikijs-dark .cm-matchhighlight {
    background: mc('blue','800');
  }
  .cm-s-wikijs-dark .CodeMirror-line::selection, .cm-s-wikijs-dark .CodeMirror-line > span::selection, .cm-s-wikijs-dark .CodeMirror-line > span > span::selection {
    background: mc('red', '500');
  }
  .cm-s-wikijs-dark .CodeMirror-line::-moz-selection, .cm-s-wikijs-dark .CodeMirror-line > span::-moz-selection, .cm-s-wikijs-dark .CodeMirror-line > span > span::-moz-selection {
    background: mc('red', '500');
  }
  .cm-s-wikijs-dark .CodeMirror-gutters {
    background: darken(mc('grey','900'), 6%);
    border-right: 1px solid mc('grey','900');
  }
  .cm-s-wikijs-dark .CodeMirror-guttermarker {
    color: #ac4142;
  }
  .cm-s-wikijs-dark .CodeMirror-guttermarker-subtle {
    color: #505050;
  }
  .cm-s-wikijs-dark .CodeMirror-linenumber {
    color: mc('grey','800');
  }
  .cm-s-wikijs-dark .CodeMirror-cursor {
    border-left: 1px solid #b0b0b0;
  }
  .cm-s-wikijs-dark span.cm-comment {
    color: mc('orange','800');
  }
  .cm-s-wikijs-dark span.cm-atom {
    color: #aa759f;
  }
  .cm-s-wikijs-dark span.cm-number {
    color: #aa759f;
  }
  .cm-s-wikijs-dark span.cm-property, .cm-s-wikijs-dark span.cm-attribute {
    color: #90a959;
  }
  .cm-s-wikijs-dark span.cm-keyword {
    color: #ac4142;
  }
  .cm-s-wikijs-dark span.cm-string {
    color: #f4bf75;
  }
  .cm-s-wikijs-dark span.cm-variable {
    color: #90a959;
  }
  .cm-s-wikijs-dark span.cm-variable-2 {
    color: #6a9fb5;
  }
  .cm-s-wikijs-dark span.cm-def {
    color: #d28445;
  }
  .cm-s-wikijs-dark span.cm-bracket {
    color: #e0e0e0;
  }
  .cm-s-wikijs-dark span.cm-tag {
    color: #ac4142;
  }
  .cm-s-wikijs-dark span.cm-link {
    color: #aa759f;
  }
  .cm-s-wikijs-dark span.cm-error {
    background: #ac4142;
    color: #b0b0b0;
  }
  .cm-s-wikijs-dark .CodeMirror-activeline-background {
    background: mc('grey','900');
  }
  .cm-s-wikijs-dark .CodeMirror-matchingbracket {
    text-decoration: underline;
    color: white !important;
  }

}
</style>
