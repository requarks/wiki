<template lang='pug'>
  .editor-code
    v-toolbar(color='blue', flat, dense, dark)
      v-icon(color='blue lighten-5') edit
      v-toolbar-title.white--text Sample Page
    .editor-code-toolbar
      .editor-code-toolbar-group
        .editor-code-toolbar-item(@click='toggleAround("**", "**")')
          svg.icons.is-18(role='img')
            title Bold
            use(xlink:href='#fa-bold')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Italic
            use(xlink:href='#fa-italic')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Strikethrough
            use(xlink:href='#fa-strikethrough')
      .editor-code-toolbar-group
        v-menu(offset-y, open-on-hover)
          .editor-code-toolbar-item.is-dropdown(slot='activator')
            svg.icons.is-18(role='img')
              title Heading
              use(xlink:href='#fa-heading')
          v-list
            v-list-tile(v-for='(n, idx) in 6', @click='', :key='idx')
              v-list-tile-action: v-icon format_size
              v-list-tile-title Heading {{n}}
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Blockquote
            use(xlink:href='#fa-quote-left')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Unordered List
            use(xlink:href='#fa-list-ul')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Ordered List
            use(xlink:href='#fa-list-ol')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Link
            use(xlink:href='#fa-link')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Inline Code
            use(xlink:href='#fa-terminal')
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Code Block
            use(xlink:href='#fa-code')
      .editor-code-toolbar-group
        .editor-code-toolbar-item
          svg.icons.is-18(role='img')
            title Horizontal Bar
            use(xlink:href='#fa-minus')

    .editor-code-main
      .editor-code-editor
        .editor-code-editor-title(v-if='previewShown', @click='previewShown = false') Editor
        .editor-code-editor-title(v-else='previewShown', @click='previewShown = true'): v-icon(dark) search
        codemirror(ref='cm', v-model='code', :options='cmOptions', @ready='onCmReady', @input='onCmInput')
      transition(name='editor-code-preview')
        .editor-code-preview(v-if='previewShown')
          .editor-code-preview-title(@click='previewShown = false') Preview
          .editor-code-preview-content.markdown-content(ref='editorPreview', v-html='previewHTML')

      v-speed-dial(v-model='fabInsertMenu', :open-on-hover='true', direction='top', transition='slide-y-reverse-transition', :fixed='true', :right='!isMobile', :left='isMobile', :bottom='true')
        v-btn(color='blue', fab, dark, v-model='fabInsertMenu', slot='activator')
          v-icon add_circle
          v-icon close
        v-btn(color='teal', fab, dark): v-icon image
        v-btn(color='pink', fab, dark): v-icon insert_drive_file
        v-btn(color='red', fab, dark): v-icon play_circle_outline
        v-btn(color='purple', fab, dark): v-icon multiline_chart
        v-btn(color='indigo', fab, dark): v-icon functions
      v-speed-dial(v-model='fabMainMenu', :open-on-hover='true', :direction='saveMenuDirection', transition='slide-x-reverse-transition', :fixed='true', :right='true', :top='!isMobile', :bottom='isMobile')
        v-btn(color='white', fab, light, v-model='fabMainMenu' slot='activator')
          v-icon(color='blue darken-2') blur_on
          v-icon(color='blue darken-2') close
        v-btn(color='blue-grey', fab, dark, @click.native.stop='$parent.openModal(`properties`)'): v-icon sort_by_alpha
        v-btn(color='green', fab, dark, @click.native.stop='$parent.save()'): v-icon save
        v-btn(color='red', fab, dark, small): v-icon not_interested
        v-btn(color='orange', fab, dark, small, @click.native.stop='$parent.openModal(`access`)'): v-icon vpn_lock
        v-btn(color='indigo', fab, dark, small): v-icon restore
        v-btn(color='brown', fab, dark, small): v-icon archive
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
import mdEmoji from 'markdown-it-emoji'
import mdTaskLists from 'markdown-it-task-lists'
import mdExpandTabs from 'markdown-it-expand-tabs'
import mdAbbr from 'markdown-it-abbr'
import mdSup from 'markdown-it-sup'
import mdSub from 'markdown-it-sub'
import mdMark from 'markdown-it-mark'
import mdImsize from 'markdown-it-imsize'

// Prism (Syntax Highlighting)
import Prism from '../libs/prism/prism.js'

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
  .use(mdEmoji)
  .use(mdTaskLists)
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
      fabMainMenu: false,
      fabInsertMenu: false,
      code: '# Header 1\n\nSample **Text**\nhttp://wiki.js.org\n:rocket: :) :( :| :P\n\n## Header 2\nSample Text\n\n```javascript\nvar test = require("test");\n\n// some comment\nconst foo = bar(\'param\') + 1.234;\n```\n\n### Header 3\nLorem *ipsum* ~~text~~',
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
    },
    saveMenuDirection() {
      return this.isMobile ? 'top' : 'bottom'
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

      cm.setSize(null, 'calc(100vh - 100px)')
      cm.setOption('extraKeys', keyBindings)
      cm.on('cursorActivity', cm => {
        this.toolbarSync(cm)
        this.scrollSync(cm)
      })
      this.onCmInput(this.code)
    },
    onCmInput: _.debounce(function (newContent) {
      linesMap = []
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
      const pos = cm.getCursor('start')
      const token = cm.getTokenAt(pos)

      if (!token.type) { return }

      console.info(token)
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
.editor-code {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: darken(mc('grey', '900'), 4.5%);
    flex: 1 1 50%;
    display: block;
    height: calc(100vh - 100px);
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
    height: calc(100vh - 100px);
    overflow: hidden;

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
      height: calc(100vh - 100px);
      overflow-y: scroll;
      padding: 30px 1rem 1rem 1rem;
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
    height: 50px;
    color: #FFF;
    display: flex;

    @include until($tablet) {
      justify-content: center;
    }

    &-group {
      display: flex;

      + .editor-code-toolbar-group {
        border-left: 1px solid rgba(mc('blue', '600'), .5);
      }
    }

    &-item {
      width: 40px;
      height: 50px;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: all .4s ease;
      cursor: pointer;

      &:first-child {
        padding-left: .5rem;
      }

      &:last-child {
        padding-right: .5rem;
      }

      &:hover {
        background-color: mc('blue', '600');
      }

      @include until($tablet) {
        width: 35px;
      }
    }

    svg {
      use {
        color: #FFF;
      }
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
