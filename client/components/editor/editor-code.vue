<template lang='pug'>
  .editor-code
    .editor-code-main
      .editor-code-sidebar
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeInLeft(icon, tile, v-on='on', dark, disabled).mx-0
              v-icon mdi-link-plus
          span {{$t('editor:markup.insertLink')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p1s(icon, tile, v-on='on', dark, @click='toggleModal(`editorModalMedia`)').mx-0
              v-icon(:color='activeModal === `editorModalMedia` ? `teal` : ``') mdi-folder-multiple-image
          span {{$t('editor:markup.insertAssets')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p2s(icon, tile, v-on='on', dark, @click='toggleModal(`editorModalBlocks`)', disabled).mx-0
              v-icon(:color='activeModal === `editorModalBlocks` ? `teal` : ``') mdi-view-dashboard-outline
          span {{$t('editor:markup.insertBlock')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p3s(icon, tile, v-on='on', dark, disabled).mx-0
              v-icon mdi-code-braces
          span {{$t('editor:markup.insertCodeBlock')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p4s(icon, tile, v-on='on', dark, disabled).mx-0
              v-icon mdi-library-video
          span {{$t('editor:markup.insertVideoAudio')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p5s(icon, tile, v-on='on', dark, disabled).mx-0
              v-icon mdi-chart-multiline
          span {{$t('editor:markup.insertDiagram')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p6s(icon, tile, v-on='on', dark, disabled).mx-0
              v-icon mdi-function-variant
          span {{$t('editor:markup.insertMathExpression')}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(right, color='teal')
            template(v-slot:activator='{ on }')
              v-btn.mt-3.animated.fadeInLeft.wait-p8s(icon, tile, v-on='on', dark, @click='toggleFullscreen').mx-0
                v-icon mdi-arrow-expand-all
            span {{$t('editor:markup.distractionFreeMode')}}
      .editor-code-editor
        textarea(ref='cm')
    v-system-bar.editor-code-sysbar(dark, status, color='grey darken-3')
      .caption.editor-code-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption Code
        v-spacer
        .caption Ln {{cursorPos.line + 1}}, Col {{cursorPos.ch + 1}}
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'

// ========================================
// IMPORTS
// ========================================

// Code Mirror
import CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'

// Language
import 'codemirror/mode/htmlmixed/htmlmixed.js'

// Addons
import 'codemirror/addon/selection/active-line.js'
import 'codemirror/addon/display/fullscreen.js'
import 'codemirror/addon/display/fullscreen.css'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/addon/search/searchcursor.js'

// ========================================
// INIT
// ========================================

// Platform detection
// const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// ========================================
// Vue Component
// ========================================

export default {
  data() {
    return {
      cm: null,
      cursorPos: { ch: 0, line: 1 }
    }
  },
  computed: {
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    },
    locale: get('page/locale'),
    path: get('page/path'),
    mode: get('editor/mode'),
    activeModal: sync('editor/activeModal')
  },
  methods: {
    toggleModal(key) {
      this.activeModal = (this.activeModal === key) ? '' : key
      this.helpShown = false
    },
    closeAllModal() {
      this.activeModal = ''
      this.helpShown = false
    },
    /**
     * Insert content at cursor
     */
    insertAtCursor({ content }) {
      const cursor = this.cm.doc.getCursor('head')
      this.cm.doc.replaceRange(content, cursor)
    },
    /**
     * Insert content after current line
     */
    insertAfter({ content, newLine }) {
      const curLine = this.cm.doc.getCursor('to').line
      const lineLength = this.cm.doc.getLine(curLine).length
      this.cm.doc.replaceRange(newLine ? `\n${content}\n` : content, { line: curLine, ch: lineLength + 1 })
    },
    /**
     * Insert content before current line
     */
    insertBeforeEachLine({ content, after }) {
      let lines = []
      if (!this.cm.doc.somethingSelected()) {
        lines.push(this.cm.doc.getCursor('head').line)
      } else {
        lines = _.flatten(this.cm.doc.listSelections().map(sl => {
          const range = Math.abs(sl.anchor.line - sl.head.line) + 1
          const lowestLine = (sl.anchor.line > sl.head.line) ? sl.head.line : sl.anchor.line
          return _.times(range, l => l + lowestLine)
        }))
      }
      lines.forEach(ln => {
        let lineContent = this.cm.doc.getLine(ln)
        const lineLength = lineContent.length
        if (_.startsWith(lineContent, content)) {
          lineContent = lineContent.substring(content.length)
        }

        this.cm.doc.replaceRange(content + lineContent, { line: ln, ch: 0 }, { line: ln, ch: lineLength })
      })
      if (after) {
        const lastLine = _.last(lines)
        this.cm.doc.replaceRange(`\n${after}\n`, { line: lastLine, ch: this.cm.doc.getLine(lastLine).length + 1 })
      }
    },
    /**
     * Update cursor state
     */
    positionSync(cm) {
      this.cursorPos = cm.getCursor('head')
    },
    toggleFullscreen () {
      this.cm.setOption('fullScreen', true)
    },
    refresh() {
      this.$nextTick(() => {
        this.cm.refresh()
      })
    }
  },
  mounted() {
    this.$store.set('editor/editorKey', 'code')

    if (this.mode === 'create') {
      this.$store.set('editor/content', '<h1>Title</h1>\n\n<p>Some text here</p>')
    }

    // Initialize CodeMirror

    this.cm = CodeMirror.fromTextArea(this.$refs.cm, {
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
      viewportMargin: 50,
      inputStyle: 'contenteditable',
      allowDropFileTypes: ['image/jpg', 'image/png', 'image/svg', 'image/jpeg', 'image/gif']
    })
    this.cm.setValue(this.$store.get('editor/content'))
    this.cm.on('change', c => {
      this.$store.set('editor/content', c.getValue())
    })
    if (this.$vuetify.breakpoint.mdAndUp) {
      this.cm.setSize(null, 'calc(100vh - 64px - 24px)')
    } else {
      this.cm.setSize(null, 'calc(100vh - 56px - 16px)')
    }

    // Set Keybindings

    const keyBindings = {
      'F11' (c) {
        c.setOption('fullScreen', !c.getOption('fullScreen'))
      },
      'Esc' (c) {
        if (c.getOption('fullScreen')) c.setOption('fullScreen', false)
      }
    }
    this.cm.setOption('extraKeys', keyBindings)

    // Handle cursor movement

    this.cm.on('cursorActivity', c => {
      this.positionSync(c)
    })

    // Render initial preview

    this.$root.$on('editorInsert', opts => {
      switch (opts.kind) {
        case 'IMAGE':
          let img = `<img src="${opts.path}" alt="${opts.text}"`
          if (opts.align && opts.align !== '') {
            img += ` class="align-${opts.align}"`
          }
          img += ` />`
          this.insertAtCursor({
            content: img
          })
          break
        case 'BINARY':
          this.insertAtCursor({
            content: `<a href="${opts.path}" title="${opts.text}">${opts.text}</a>`
          })
          break
      }
    })
  },
  beforeDestroy() {
    this.$root.$off('editorInsert')
  }
}
</script>

<style lang='scss'>
$editor-height: calc(100vh - 64px - 24px);
$editor-height-mobile: calc(100vh - 56px - 16px);

.editor-code {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: darken(mc('grey', '900'), 4.5%);
    flex: 1 1 50%;
    display: block;
    height: $editor-height;
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

  &-sidebar {
    background-color: mc('grey', '900');
    width: 64px;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    padding: 24px 0;

    @include until($tablet) {
      padding: 12px 0;
      width: 40px;
    }
  }

  &-sysbar {
    padding-left: 0;

    &-locale {
      background-color: rgba(255,255,255,.25);
      display:inline-flex;
      padding: 0 12px;
      height: 24px;
      width: 63px;
      justify-content: center;
      align-items: center;
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
    background: mc('amber', '500');
  }
  .cm-s-wikijs-dark .CodeMirror-line::-moz-selection, .cm-s-wikijs-dark .CodeMirror-line > span::-moz-selection, .cm-s-wikijs-dark .CodeMirror-line > span > span::-moz-selection {
    background: mc('amber', '500');
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
