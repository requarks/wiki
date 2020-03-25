<template lang='pug'>
  .editor-markdown
    v-toolbar.editor-markdown-toolbar(dense, color='primary', dark, flat, style='overflow-x: hidden;')
      template(v-if='isModalShown')
        v-spacer
        v-btn.animated.fadeInRight(text, @click='closeAllModal')
          v-icon(left) mdi-arrow-left-circle
          span {{$t('editor:backToEditor')}}
      template(v-else)
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn(icon, tile, v-on='on', @click='toggleMarkup({ start: `**` })').mx-0
              v-icon mdi-format-bold
          span {{$t('editor:markup.bold')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p1s(icon, tile, v-on='on', @click='toggleMarkup({ start: `*` })').mx-0
              v-icon mdi-format-italic
          span {{$t('editor:markup.italic')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p2s(icon, tile, v-on='on', @click='toggleMarkup({ start: `~~` })').mx-0
              v-icon mdi-format-strikethrough
          span {{$t('editor:markup.strikethrough')}}
        v-menu(offset-y, open-on-hover)
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p3s(icon, tile, v-on='on').mx-0
              v-icon mdi-format-header-pound
          v-list.py-0
            template(v-for='(n, idx) in 6')
              v-list-item(@click='setHeaderLine(n)', :key='idx')
                v-list-item-action
                  v-icon(:size='24 - (idx - 1) * 2') mdi-format-header-{{n}}
                v-list-item-title {{$t('editor:markup.heading', { level: n })}}
              v-divider(v-if='idx < 5')
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p4s(icon, tile, v-on='on', @click='toggleMarkup({ start: `~` })').mx-0
              v-icon mdi-format-subscript
          span {{$t('editor:markup.subscript')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p5s(icon, tile, v-on='on', @click='toggleMarkup({ start: `^` })').mx-0
              v-icon mdi-format-superscript
          span {{$t('editor:markup.superscript')}}
        v-menu(offset-y, open-on-hover)
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p6s(icon, tile, v-on='on').mx-0
              v-icon mdi-alpha-t-box-outline
          v-list.py-0
            v-list-item(@click='insertBeforeEachLine({ content: `> `})')
              v-list-item-action
                v-icon mdi-alpha-t-box-outline
              v-list-item-title {{$t('editor:markup.blockquote')}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `> `, after: `{.is-info}`})')
              v-list-item-action
                v-icon(color='blue') mdi-alpha-i-box-outline
              v-list-item-title {{$t('editor:markup.blockquoteInfo')}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `> `, after: `{.is-success}`})')
              v-list-item-action
                v-icon(color='success') mdi-alpha-s-box-outline
              v-list-item-title {{$t('editor:markup.blockquoteSuccess')}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `> `, after: `{.is-warning}`})')
              v-list-item-action
                v-icon(color='warning') mdi-alpha-w-box-outline
              v-list-item-title {{$t('editor:markup.blockquoteWarning')}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `> `, after: `{.is-danger}`})')
              v-list-item-action
                v-icon(color='error') mdi-alpha-e-box-outline
              v-list-item-title {{$t('editor:markup.blockquoteError')}}
            v-divider
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p7s(icon, tile, v-on='on', @click='insertBeforeEachLine({ content: `- `})').mx-0
              v-icon mdi-format-list-bulleted
          span {{$t('editor:markup.unorderedList')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p8s(icon, tile, v-on='on', @click='insertBeforeEachLine({ content: `1. `})').mx-0
              v-icon mdi-format-list-numbered
          span {{$t('editor:markup.orderedList')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p9s(icon, tile, v-on='on', @click='toggleMarkup({ start: "`" })').mx-0
              v-icon mdi-code-tags
          span {{$t('editor:markup.inlineCode')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p10s(icon, tile, v-on='on', @click='toggleMarkup({ start: `<kbd>`, end: `</kbd>` })').mx-0
              v-icon mdi-keyboard-variant
          span {{$t('editor:markup.keyboardKey')}}
        v-tooltip(bottom, color='primary')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p11s(icon, tile, v-on='on', @click='insertAfter({ content: `---`, newLine: true })').mx-0
              v-icon mdi-minus
          span {{$t('editor:markup.horizontalBar')}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(bottom, color='primary')
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeIn.wait-p11s(icon, tile, v-on='on', @click='previewShown = !previewShown').mx-0
                v-icon mdi-book-open-outline
            span {{$t('editor:markup.togglePreviewPane')}}
    .editor-markdown-main
      .editor-markdown-sidebar
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
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p7s(icon, tile, v-on='on', dark, disabled).mx-0
              v-icon mdi-table-plus
          span {{$t('editor:markup.tableHelper')}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(right, color='teal')
            template(v-slot:activator='{ on }')
              v-btn.mt-3.animated.fadeInLeft.wait-p8s(icon, tile, v-on='on', dark, @click='toggleFullscreen').mx-0
                v-icon mdi-arrow-expand-all
            span {{$t('editor:markup.distractionFreeMode')}}
          v-tooltip(right, color='teal')
            template(v-slot:activator='{ on }')
              v-btn.mt-3.animated.fadeInLeft.wait-p9s(icon, tile, v-on='on', dark, @click='toggleHelp').mx-0
                v-icon(:color='helpShown ? `teal` : ``') mdi-help-circle
            span {{$t('editor:markup.markdownFormattingHelp')}}
      .editor-markdown-editor
        textarea(ref='cm')
      transition(name='editor-markdown-preview')
        .editor-markdown-preview(v-if='previewShown')
          .editor-markdown-preview-content.contents(ref='editorPreviewContainer')
            div(ref='editorPreview', v-html='previewHTML')

    v-system-bar.editor-markdown-sysbar(dark, status, color='grey darken-3')
      .caption.editor-markdown-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption Markdown
        v-spacer
        .caption Ln {{cursorPos.line + 1}}, Col {{cursorPos.ch + 1}}

    markdown-help(v-if='helpShown')
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import markdownHelp from './markdown/help.vue'

/* global siteConfig */

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
import 'codemirror/addon/search/searchcursor.js'

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
import katex from 'katex'
import twemoji from 'twemoji'

// Prism (Syntax Highlighting)
import Prism from 'prismjs'

// Helpers
import katexHelper from './common/katex'

// ========================================
// INIT
// ========================================

// Platform detection
const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// Prism Config
Prism.plugins.autoloader.languages_path = '/js/prism/'
Prism.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true,
  'remove-initial-line-feed': true,
  'tabs-to-spaces': 2
})

// Markdown Instance
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typography: true,
  highlight(str, lang) {
    return `<pre class="line-numbers"><code class="language-${lang}">${_.escape(str)}</code></pre>`
  }
})
  .use(mdAttrs, {
    allowedAttributes: ['id', 'class', 'target']
  })
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
md.renderer.rules.blockquote_open = injectLineNumbers

// ========================================
// KATEX
// ========================================

md.inline.ruler.after('escape', 'katex_inline', katexHelper.katexInline)
md.renderer.rules.katex_inline = (tokens, idx) => {
  try {
    return katex.renderToString(tokens[idx].content, {
      displayMode: false
    })
  } catch (err) {
    console.warn(err)
    return tokens[idx].content
  }
}
md.block.ruler.after('blockquote', 'katex_block', katexHelper.katexBlock, {
  alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
})
md.renderer.rules.katex_block = (tokens, idx) => {
  try {
    return `<p>` + katex.renderToString(tokens[idx].content, {
      displayMode: true
    }) + `</p>`
  } catch (err) {
    console.warn(err)
    return tokens[idx].content
  }
}

// ========================================
// TWEMOJI
// ========================================

md.renderer.rules.emoji = (token, idx) => {
  return twemoji.parse(token[idx].content, {
    callback (icon, opts) {
      return `/svg/twemoji/${icon}.svg`
    }
  })
}

// ========================================
// Vue Component
// ========================================

export default {
  components: {
    markdownHelp
  },
  props: {
    save: {
      type: Function,
      default: () => {}
    }
  },
  data() {
    return {
      fabInsertMenu: false,
      cm: null,
      cursorPos: { ch: 0, line: 1 },
      previewShown: true,
      previewHTML: '',
      helpShown: false
    }
  },
  computed: {
    isMobile() {
      return this.$vuetify.breakpoint.smAndDown
    },
    isModalShown() {
      return this.helpShown || this.activeModal !== ''
    },
    locale: get('page/locale'),
    path: get('page/path'),
    mode: get('editor/mode'),
    activeModal: sync('editor/activeModal')
  },
  watch: {
    previewShown (newValue, oldValue) {
      if (newValue && !oldValue) {
        this.$nextTick(() => {
          Prism.highlightAllUnder(this.$refs.editorPreview)
          Array.from(this.$refs.editorPreview.querySelectorAll('pre.line-numbers')).forEach(pre => pre.classList.add('prismjs'))
        })
      }
    }
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
    onCmInput: _.debounce(function (newContent) {
      linesMap = []
      this.$store.set('editor/content', newContent)
      this.previewHTML = md.render(newContent)
      this.$nextTick(() => {
        Prism.highlightAllUnder(this.$refs.editorPreview)
        Array.from(this.$refs.editorPreview.querySelectorAll('pre.line-numbers')).forEach(pre => pre.classList.add('prismjs'))
        this.scrollSync(this.cm)
      })
    }, 500),
    onCmPaste (cm, ev) {
      // const clipItems = (ev.clipboardData || ev.originalEvent.clipboardData).items
      // for (let clipItem of clipItems) {
      //   if (_.startsWith(clipItem.type, 'image/')) {
      //     const file = clipItem.getAsFile()
      //     const reader = new FileReader()
      //     reader.onload = evt => {
      //       this.$store.commit(`loadingStart`, 'editor-paste-image')
      //       this.insertAfter({
      //         content: `![${file.name}](${evt.target.result})`,
      //         newLine: true
      //       })
      //     }
      //     reader.readAsDataURL(file)
      //   }
      // }
    },
    /**
     * Update cursor state
     */
    positionSync(cm) {
      this.cursorPos = cm.getCursor('head')
    },
    /**
     * Wrap selection with start / end tags
     */
    toggleMarkup({ start, end }) {
      if (!end) { end = start }
      if (!this.cm.doc.somethingSelected()) {
        return this.$store.commit('showNotification', {
          message: this.$t('editor:markup.noSelectionError'),
          style: 'warning',
          icon: 'warning'
        })
      }
      this.cm.doc.replaceSelections(this.cm.doc.getSelections().map(s => start + s + end))
    },
    /**
     * Set current line as header
     */
    setHeaderLine(lvl) {
      const curLine = this.cm.doc.getCursor('head').line
      let lineContent = this.cm.doc.getLine(curLine)
      const lineLength = lineContent.length
      if (_.startsWith(lineContent, '#')) {
        lineContent = lineContent.replace(/^(#+ )/, '')
      }
      lineContent = _.times(lvl, n => '#').join('') + ` ` + lineContent
      this.cm.doc.replaceRange(lineContent, { line: curLine, ch: 0 }, { line: curLine, ch: lineLength })
    },
    /**
     * Get the header lever of the current line
     */
    getHeaderLevel(cm) {
      const curLine = this.cm.doc.getCursor('head').line
      let lineContent = this.cm.doc.getLine(curLine)
      let lvl = 0

      const result = lineContent.match(/^(#+) /)
      if (result) {
        lvl = _.get(result, '[1]', '').length
      }
      return lvl
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
     * Update scroll sync
     */
    scrollSync: _.debounce(function (cm) {
      if (!this.previewShown || cm.somethingSelected()) { return }
      let currentLine = cm.getCursor().line
      if (currentLine < 3) {
        this.Velocity(this.$refs.editorPreview, 'stop', true)
        this.Velocity(this.$refs.editorPreview.firstChild, 'scroll', { offset: '-50', duration: 1000, container: this.$refs.editorPreviewContainer })
      } else {
        let closestLine = _.findLast(linesMap, n => n <= currentLine)
        let destElm = this.$refs.editorPreview.querySelector(`[data-line='${closestLine}']`)
        if (destElm) {
          this.Velocity(this.$refs.editorPreview, 'stop', true)
          this.Velocity(destElm, 'scroll', { offset: '-100', duration: 1000, container: this.$refs.editorPreviewContainer })
        }
      }
    }, 500),
    toggleHelp () {
      this.helpShown = !this.helpShown
      this.activeModal = ''
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
    this.$store.set('editor/editorKey', 'markdown')

    if (this.mode === 'create' && !this.$store.get('editor/content')) {
      this.$store.set('editor/content', '# Header\nYour content here')
    }

    // Initialize CodeMirror

    this.cm = CodeMirror.fromTextArea(this.$refs.cm, {
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
      viewportMargin: 50,
      inputStyle: 'contenteditable',
      allowDropFileTypes: ['image/jpg', 'image/png', 'image/svg', 'image/jpeg', 'image/gif'],
      direction: siteConfig.rtl ? 'rtl' : 'ltr'
    })
    this.cm.setValue(this.$store.get('editor/content'))
    this.cm.on('change', c => {
      this.$store.set('editor/content', c.getValue())
      this.onCmInput(this.$store.get('editor/content'))
    })
    if (this.$vuetify.breakpoint.mdAndUp) {
      this.cm.setSize(null, 'calc(100vh - 112px - 24px)')
    } else {
      this.cm.setSize(null, 'calc(100vh - 112px - 16px)')
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
    _.set(keyBindings, `${CtrlKey}-S`, c => {
      this.save()
      return false
    })
    _.set(keyBindings, `${CtrlKey}-B`, c => {
      this.toggleMarkup({ start: `**` })
      return false
    })
    _.set(keyBindings, `${CtrlKey}-I`, c => {
      this.toggleMarkup({ start: `*` })
      return false
    })
    _.set(keyBindings, `${CtrlKey}-Alt-Right`, c => {
      let lvl = this.getHeaderLevel(c)
      if (lvl >= 6) { lvl = 5 }
      this.setHeaderLine(lvl + 1)
      return false
    })
    _.set(keyBindings, `${CtrlKey}-Alt-Left`, c => {
      let lvl = this.getHeaderLevel(c)
      if (lvl <= 1) { lvl = 2 }
      this.setHeaderLine(lvl - 1)
      return false
    })
    this.cm.setOption('extraKeys', keyBindings)

    // Handle cursor movement

    this.cm.on('cursorActivity', c => {
      this.positionSync(c)
      this.scrollSync(c)
    })

    // Handle special paste

    this.cm.on('paste', this.onCmPaste)

    // Render initial preview

    this.onCmInput(this.$store.get('editor/content'))
    this.refresh()

    this.$root.$on('editorInsert', opts => {
      switch (opts.kind) {
        case 'IMAGE':
          let img = `![${opts.text}](${opts.path})`
          if (opts.align && opts.align !== '') {
            img += `{.align-${opts.align}}`
          }
          this.insertAtCursor({
            content: img
          })
          break
        case 'BINARY':
          this.insertAtCursor({
            content: `[${opts.text}](${opts.path})`
          })
          break
      }
    })

    // Handle save conflict
    this.$root.$on('saveConflict', () => {
      this.toggleModal(`editorModalConflict`)
    })
    this.$root.$on('overwriteEditorContent', () => {
      this.cm.setValue(this.$store.get('editor/content'))
    })
  },
  beforeDestroy() {
    this.$root.$off('editorInsert')
  }
}
</script>

<style lang='scss'>

$editor-height: calc(100vh - 112px - 24px);
$editor-height-mobile: calc(100vh - 112px - 16px);

.editor-markdown {
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

    @include until($tablet) {
      height: $editor-height-mobile;
    }
  }

  &-preview {
    flex: 1 1 50%;
    background-color: mc('grey', '100');
    position: relative;
    height: $editor-height;
    overflow: hidden;
    padding: 1rem;

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
      height: $editor-height;
      overflow-y: scroll;
      padding: 0;
      width: calc(100% + 17px);
      // -ms-overflow-style: none;

      // &::-webkit-scrollbar {
      //   width: 0px;
      //   background: transparent;
      // }

      @include until($tablet) {
        height: $editor-height-mobile;
      }
    }
  }

  &-toolbar {
    background-color: mc('blue', '700');
    background-image: linear-gradient(to bottom, mc('blue', '700') 0%, mc('blue','800') 100%);
    color: #FFF;

    .v-toolbar__content {
      padding-left: 64px;

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
    font-family: 'Roboto Mono', monospace;
    font-size: .9rem;

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
