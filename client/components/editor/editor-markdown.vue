<template lang='pug'>
  .editor-markdown
    v-toolbar.editor-markdown-toolbar(dense, color='primary', dark)
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon format_bold
        span Bold
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon format_italic
        span Italic
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon format_strikethrough
        span Strikethrough
      v-menu(offset-y, open-on-hover)
        v-btn(icon, slot='activator').mx-0
          v-icon font_download
        v-list
          v-list-tile(v-for='(n, idx) in 6', @click='', :key='idx')
            v-list-tile-action
              v-icon font_download
            v-list-tile-title Heading {{n}}
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon format_quote
        span Blockquote
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon format_list_bulleted
        span Unordered List
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon format_list_numbered
        span Ordered List
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon insert_link
        span Link
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon space_bar
        span Inline Code
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon code
        span Code Block
      v-tooltip(top)
        v-btn(icon, slot='activator').mx-0
          v-icon remove
        span Horizontal Bar

    .editor-markdown-main
      .editor-markdown-editor
        .editor-markdown-editor-title(v-if='previewShown', @click='previewShown = false') Editor
        .editor-markdown-editor-title(v-else='previewShown', @click='previewShown = true'): v-icon(dark) drag_indicator
        codemirror(ref='cm', v-model='code', :options='cmOptions', @ready='onCmReady', @input='onCmInput')
      transition(name='editor-markdown-preview')
        .editor-markdown-preview(v-if='previewShown')
          .editor-markdown-preview-title(@click='previewShown = false') Preview
          .editor-markdown-preview-content.contents(ref='editorPreview', v-html='previewHTML')

      //- v-speed-dial.editor-markdown-insert(v-model='fabInsertMenu', :open-on-hover='true', direction='top', transition='slide-y-reverse-transition', fixed, bottom, :right='!previewShown || $vuetify.breakpoint.smAndDown')
      //-   v-btn(color='blue', fab, dark, v-model='fabInsertMenu', slot='activator')
      //-     v-icon add_circle
      //-     v-icon close
      //-   v-btn(color='teal', fab, dark): v-icon image
      //-   v-btn(color='pink', fab, dark): v-icon insert_drive_file
      //-   v-btn(color='red', fab, dark): v-icon play_circle_outline
      //-   v-btn(color='purple', fab, dark): v-icon multiline_chart
      //-   v-btn(color='indigo', fab, dark): v-icon functions
</template>

<script>
import _ from 'lodash'

// ========================================
// IMPORTS
// ========================================

// Code Mirror
import { codemirror } from 'vue-codemirror'
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

// Markdown-it
import MarkdownIt from 'markdown-it'
import mdAttrs from 'markdown-it-attrs'
import mdEmoji from 'markdown-it-emoji'
import mdTaskLists from 'markdown-it-task-lists'
import mdExpandTabs from 'markdown-it-expand-tabs'
import mdAbbr from 'markdown-it-abbr'
import mdSup from 'markdown-it-sup'
import mdSub from 'markdown-it-sub'
import mdMark from 'markdown-it-mark'
import mdImsize from 'markdown-it-imsize'

// Prism (Syntax Highlighting)
import Prism from '@/libs/prism/prism.js'

// ========================================
// INIT
// ========================================

// Platform detection
const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// Markdown Instance
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typography: true,
  highlight(str, lang) {
    return `<pre class="line-numbers"><code class="language-${lang}">${str}</code></pre>`
  }
})
  .use(mdAttrs)
  .use(mdEmoji)
  .use(mdTaskLists, {label: true, labelAfter: true})
  .use(mdExpandTabs)
  .use(mdAbbr)
  .use(mdSup)
  .use(mdSub)
  .use(mdMark)
  .use(mdImsize)

// ========================================
// HELPER FUNCTIONS
// ========================================

// Inject line numbers for preview scroll sync
let linesMap = []
function injectLineNumbers (tokens, idx, options, env, slf) {
  let line
  if (tokens[idx].map && tokens[idx].level === 0) {
    line = tokens[idx].map[0]
    tokens[idx].attrJoin('class', 'line')
    tokens[idx].attrSet('data-line', String(line))
    linesMap.push(line)
  }
  return slf.renderToken(tokens, idx, options, env, slf)
}
md.renderer.rules.paragraph_open = injectLineNumbers
md.renderer.rules.heading_open = injectLineNumbers

// ========================================
// Vue Component
// ========================================

export default {
  components: {
    codemirror
  },
  data() {
    return {
      fabInsertMenu: false,
      code: this.$store.get('editor/content'),
      cmOptions: {
        tabSize: 2,
        mode: 'text/markdown',
        theme: 'wikijs-dark',
        lineNumbers: true,
        lineWrapping: true,
        line: true,
        styleActiveLine: true,
        highlightSelectionMatches: {
          annotateScrollbar: true
        },
        viewportMargin: 50
      },
      previewShown: true,
      previewHTML: ''
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

      cm.setSize(null, 'calc(100vh - 112px)')
      cm.setOption('extraKeys', keyBindings)
      cm.on('cursorActivity', cm => {
        this.toolbarSync(cm)
        this.scrollSync(cm)
      })
      this.onCmInput(this.code)
    },
    onCmInput: _.debounce(function (newContent) {
      linesMap = []
      this.$store.set('editor/content', newContent)
      this.previewHTML = md.render(newContent)
      this.$nextTick(() => {
        Prism.highlightAllUnder(this.$refs.editorPreview)
        this.scrollSync(this.cm)
      })
    }, 500),
    /**
     * Update toolbar state
     */
    toolbarSync(cm) {
      // const pos = cm.getCursor('start')
      // const token = cm.getTokenAt(pos)

      // if (!token.type) { return }

      // console.info(token)
    },
    /**
     * Update scroll sync
     */
    scrollSync: _.debounce(function (cm) {
      if (!this.previewShown || cm.somethingSelected()) { return }
      let currentLine = cm.getCursor().line
      if (currentLine < 3) {
        this.Velocity(this.$refs.editorPreview, 'stop', true)
        this.Velocity(this.$refs.editorPreview.firstChild, 'scroll', { offset: '-50', duration: 1000, container: this.$refs.editorPreview })
      } else {
        let closestLine = _.findLast(linesMap, n => n <= currentLine)
        let destElm = this.$refs.editorPreview.querySelector(`[data-line='${closestLine}']`)
        if (destElm) {
          this.Velocity(this.$refs.editorPreview, 'stop', true)
          this.Velocity(destElm, 'scroll', { offset: '-100', duration: 1000, container: this.$refs.editorPreview })
        }
      }
    }, 500),
    toggleAround (before, after) {

    }
  }
}
</script>

<style lang='scss'>
.editor-markdown {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: darken(mc('grey', '900'), 4.5%);
    flex: 1 1 50%;
    display: block;
    height: calc(100vh - 112px);
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

  &-preview {
    flex: 1 1 50%;
    background-color: mc('grey', '100');
    position: relative;
    height: calc(100vh - 112px);
    overflow: hidden;

    @at-root .theme--dark & {
      background-color: mc('grey', '900');
    }

    @include until($tablet) {
      display: none;
    }

    &-enter-active, &-leave-active {
      transition: max-width .5s ease;
      max-width: 50vw;

      .editor-code-preview-content {
        width: 50vw;
        overflow:hidden;
      }
    }
    &-enter, &-leave-to {
      max-width: 0;
    }

    &-content {
      height: calc(100vh - 112px);
      overflow-y: scroll;
      padding: 1rem 1rem 1rem 0;
      width: calc(100% + 1rem + 17px)
      // -ms-overflow-style: none;

      // &::-webkit-scrollbar {
      //   width: 0px;
      //   background: transparent;
      // }
    }

    &-title {
      background-color: rgba(mc('blue', '100'), .75);
      border-bottom-right-radius: 5px;
      display: inline-flex;
      height: 30px;
      justify-content: center;
      align-items: center;
      padding: 0 1rem;
      color: mc('blue', '800');
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      text-transform: uppercase;
      font-size: .7rem;
      cursor: pointer;
    }
  }

  &-toolbar {
    background-color: mc('blue', '700');
    background-image: linear-gradient(to bottom, mc('blue', '700') 0%, mc('blue','800') 100%);
    color: #FFF;

    .v-toolbar__content {
      padding-left: 16px;

      @include until($tablet) {
        padding-left: 8px;
      }
    }
  }

  &-insert:not(.v-speed-dial--right) {
    @include from($tablet) {
      left: 50%;
      margin-left: -28px;
    }
  }

  // ==========================================
  // Fix FAB revealing under codemirror
  // ==========================================

  .speed-dial--fixed {
    z-index: 8;
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
