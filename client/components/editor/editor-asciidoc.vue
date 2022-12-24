<template lang='pug'>
  .editor-asciidoc
    v-toolbar.editor-asciidoc-toolbar(dense, color='primary', dark, flat, style='overflow-x: hidden;')
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
            v-btn.animated.fadeIn.wait-p1s(icon, tile, v-on='on', @click='toggleMarkup({ start: `__` })').mx-0
              v-icon mdi-format-italic
          span {{$t('editor:markup.italic')}}
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
            v-list-item(@click='insertBeforeEachLine({ content: `NOTE: `})')
              v-list-item-action
                v-icon(color='blue') mdi-alpha-n-box-outline
              v-list-item-title {{'Note blockquote'}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `TIP: `})')
              v-list-item-action
                v-icon(color='success') mdi-alpha-t-box-outline
              v-list-item-title {{'Tip blockquote'}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `WARNING: `})')
              v-list-item-action
                v-icon(color='warning') mdi-alpha-w-box-outline
              v-list-item-title {{$t('editor:markup.blockquoteWarning')}}
            v-divider
            v-list-item(@click='insertBeforeEachLine({ content: `CAUTION: `})')
              v-list-item-action
                v-icon(color='purple') mdi-alpha-c-box-outline
              v-list-item-title {{'Caution blockquote'}}
            v-list-item(@click='insertBeforeEachLine({ content: `IMPORTANT: `})')
              v-list-item-action
                v-icon(color='error') mdi-alpha-i-box-outline
              v-list-item-title {{'Important blockquote'}}
            v-divider
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(bottom, color='primary')
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeIn.wait-p2s(icon, tile, v-on='on', @click='previewShown = !previewShown').mx-0
                v-icon mdi-book-open-outline
            span {{$t('editor:markup.togglePreviewPane')}}

    .editor-asciidoc-main
      .editor-asciidoc-sidebar
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeInLeft(icon, tile, v-on='on', dark, @click='insertLink').mx-0
              v-icon mdi-link-plus
          span {{$t('editor:markup.insertLink')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p1s(icon, tile, v-on='on', dark, @click='toggleModal(`editorModalMedia`)').mx-0
              v-icon(:color='activeModal === `editorModalMedia` ? `teal` : ``') mdi-folder-multiple-image
          span {{$t('editor:markup.insertAssets')}}
        v-tooltip(right, color='teal')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p5s(icon, tile, v-on='on', dark, @click='toggleModal(`editorModalDrawio`)').mx-0
              v-icon mdi-chart-multiline
          span {{$t('editor:markup.insertDiagram')}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(right, color='teal')
            template(v-slot:activator='{ on }')
              v-btn.mt-3.animated.fadeInLeft.wait-p8s(icon, tile, v-on='on', dark, @click='toggleFullscreen').mx-0
                v-icon mdi-arrow-expand-all
            span {{$t('editor:markup.distractionFreeMode')}}
      .editor-asciidoc-editor
        textarea(ref='cm')
      transition(name='editor-asciidoc-preview')
        .editor-asciidoc-preview(v-if='previewShown')
          .editor-asciidoc-preview-content.contents(ref='editorPreviewContainer')
            div(
              ref='editorPreview'
              v-html='previewHTML'
              )

    v-system-bar.editor-asciidoc-sysbar(dark, status, color='grey darken-3')
      .caption.editor-asciidoc-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption AsciiDoc
        v-spacer
        .caption Ln {{cursorPos.line + 1}}, Col {{cursorPos.ch + 1}}
    page-selector(mode='select', v-model='insertLinkDialog', :open-handler='insertLinkHandler', :path='path', :locale='locale')
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import DOMPurify from 'dompurify'

// ========================================
// IMPORTS
// ========================================

// Code Mirror
import CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'

// Language
import 'codemirror-asciidoc'

// Addons
import 'codemirror/addon/selection/active-line.js'
import 'codemirror/addon/display/fullscreen.js'
import 'codemirror/addon/display/fullscreen.css'
import 'codemirror/addon/selection/mark-selection.js'
import 'codemirror/addon/search/searchcursor.js'
import 'codemirror/addon/hint/show-hint.js'
import 'codemirror/addon/fold/foldcode.js'
import 'codemirror/addon/fold/foldgutter.js'
import 'codemirror/addon/fold/foldgutter.css'
import cmFold from './common/cmFold'

// ========================================
// INIT
// ========================================
const asciidoctor = require('asciidoctor')()
const cheerio = require('cheerio')

// Platform detection
const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// ========================================
// HELPER FUNCTIONS
// ========================================

cmFold.register('asciidoc')

// ========================================
// Vue Component
// ========================================

export default {
  data() {
    return {
      cm: null,
      cursorPos: { ch: 0, line: 1 },
      previewShown: true, // TODO
      insertLinkDialog: false,
      helpShown: false,
      previewHTML: ''
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

  methods: {
    toggleModal(key) {
      this.activeModal = (this.activeModal === key) ? '' : key
      this.helpShown = false
    },
    closeAllModal() {
      this.activeModal = ''
      this.helpShown = false
    },
    onCmInput: _.debounce(function(newContent) {
      this.processContent(newContent)
    }, 600),
    processContent(newContent) {
      this.processMarkers(this.cm.firstLine(), this.cm.lastLine())
      let html = asciidoctor.convert(newContent, {
        standalone: false,
        safe: 'safe',
        attributes: {
          showtitle: true,
          icons: 'font'
        }
      })
      const $ = cheerio.load(html, {
        decodeEntities: true
      })

      $('pre.highlight > code.language-diagram').each((i, elm) => {
        const diagramContent = Buffer.from($(elm).html(), 'base64').toString()
        $(elm).parent().replaceWith(`<pre class="diagram">${diagramContent}</div>`)
      })

      this.previewHTML = DOMPurify.sanitize($.html(), {
        ADD_TAGS: ['foreignObject']
      })
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
    setHeaderLine(lvl) {
      const curLine = this.cm.doc.getCursor('head').line
      let lineContent = this.cm.doc.getLine(curLine)
      const lineLength = lineContent.length
      if (_.startsWith(lineContent, '=')) {
        lineContent = lineContent.replace(/^(=+ )/, '')
      }
      lineContent = _.times(lvl, n => '=').join('') + ` ` + lineContent
      this.cm.doc.replaceRange(lineContent, { line: curLine, ch: 0 }, { line: curLine, ch: lineLength })
    },

    toggleFullscreen () {
      this.cm.setOption('fullScreen', true)
    },
    refresh() {
      this.$nextTick(() => {
        this.cm.refresh()
      })
    },
    insertLink () {
      this.insertLinkDialog = true
    },
    insertLinkHandler ({ locale, path }) {
      const lastPart = _.last(path.split('/'))
      this.insertAtCursor({
        content: siteLangs.length > 0 ? `link:/${locale}/${path}[${lastPart}]` : `link:/${path}[${lastPart}]`
      })
    },
    processMarkers (from, to) {
      let found = null
      let foundStart = 0
      this.cm.doc.getAllMarks().forEach(mk => {
        if (mk.__kind) {
          mk.clear()
        }
      })
      this.cm.eachLine(from, to, ln => {
        const line = ln.lineNo()
        if (ln.text.startsWith('```diagram')) {
          found = 'diagram'
          foundStart = line
        } else if (ln.text === '```' && found) {
          switch (found) {
            // ------------------------------
            // -> DIAGRAM
            // ------------------------------
            case 'diagram': {
              if (line - foundStart !== 2) {
                return
              }
              this.addMarker({
                kind: 'diagram',
                from: { line: foundStart, ch: 3 },
                to: { line: foundStart, ch: 10 },
                text: 'Edit Diagram',
                action: ((start, end) => {
                  return (ev) => {
                    this.cm.doc.setSelection({ line: start, ch: 0 }, { line: end, ch: 3 })
                    try {
                      const raw = this.cm.doc.getLine(end - 1)
                      this.$store.set('editor/activeModalData', Buffer.from(raw, 'base64').toString())
                      this.toggleModal(`editorModalDrawio`)
                    } catch (err) {
                      return this.$store.commit('showNotification', {
                        message: 'Failed to process diagram data.',
                        style: 'warning',
                        icon: 'warning'
                      })
                    }
                  }
                })(foundStart, line)
              })
              if (ln.height > 0) {
                this.cm.foldCode(foundStart)
              }
              break
            }
          }
          found = null
        }
      })
    },
    addMarker ({ kind, from, to, text, action }) {
      const markerElm = document.createElement('span')
      markerElm.appendChild(document.createTextNode(text))
      markerElm.className = 'CodeMirror-buttonmarker'
      markerElm.addEventListener('click', action)
      this.cm.markText(from, to, { replacedWith: markerElm, __kind: kind })
    }
  },
  mounted() {
    this.$store.set('editor/editorKey', 'asciidoc')

    if (this.mode === 'create') {
      this.$store.set('editor/content', '== header\n\ncontent')
    }

    // Initialize CodeMirror

    this.cm = CodeMirror.fromTextArea(this.$refs.cm, {
      tabSize: 2,
      mode: 'asciidoc',
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
      direction: siteConfig.rtl ? 'rtl' : 'ltr',
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']

    })
    this.cm.setValue(this.$store.get('editor/content'))
    this.cm.on('change', c => {
      this.$store.set('editor/content', c.getValue())
      this.onCmInput(this.$store.get('editor/content'))
    })
    if (this.$vuetify.breakpoint.mdAndUp) {
      this.cm.setSize(null, 'calc(100vh - 137px)')
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
    _.set(keyBindings, `${CtrlKey}-B`, c => {
      this.toggleMarkup({ start: `**` })
      return false
    })
    _.set(keyBindings, `${CtrlKey}-I`, c => {
      this.toggleMarkup({ start: `__` })
      return false
    })

    this.cm.setOption('extraKeys', keyBindings)

    // Handle cursor movement

    this.cm.on('cursorActivity', c => {
      this.positionSync(c)
    })

    // Render initial preview
    this.processContent(this.$store.get('editor/content'))

    this.$root.$on('editorInsert', opts => {
      switch (opts.kind) {
        case 'IMAGE':
          let img = `image::${opts.path}[${opts.text}]`
          this.insertAtCursor({
            content: img
          })
          break
        case 'BINARY':
          this.insertAtCursor({
            content: `link:${opts.path}[${opts.text}]`
          })
          break
        case 'DIAGRAM':
          const selStartLine = this.cm.getCursor('from').line
          const selEndLine = this.cm.getCursor('to').line + 1
          this.cm.doc.replaceSelection('```diagram\n' + opts.text + '\n```\n', 'start')
          this.processMarkers(selStartLine, selEndLine)
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
$editor-ascii-height: calc(100vh - 137px);
$editor-ascii-height-mobile: calc(100vh - 112px - 16px);

.editor-asciidoc {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: darken(mc('grey', '900'), 4.5%);
    flex: 1 1 50%;
    display: block;
    height: $editor-ascii-height;
    position: relative;

    @include until($tablet) {
      height: $editor-ascii-height-mobile;
    }
  }

  &-preview {
    flex: 1 1 50%;
    background-color: mc('grey', '100');
    position: relative;
    height: $editor-ascii-height;
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
      height: $editor-ascii-height;
      overflow-y: scroll;
      padding: 0;
      width: calc(100% + 17px);
      // -ms-overflow-style: none;

      // &::-webkit-scrollbar {
      //   width: 0px;
      //   background: transparent;
      // }

      @include until($tablet) {
        height: $editor-ascii-height-mobile;
      }

      > div {
        outline: none;
      }

      p.line {
        overflow-wrap: break-word;
      }

      .tabset {
        background-color: mc('teal', '700');
        color: mc('teal', '100') !important;
        padding: 5px 12px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 5px 0 0 0;
        font-style: italic;

        &::after {
          display: none;
        }

        &-header {
          background-color: mc('teal', '500');
          color: #FFF !important;
          padding: 5px 12px;
          font-size: 14px;
          font-weight: 500;
          margin-top: 0 !important;

          &::after {
            display: none;
          }
        }

        &-content {
          border-left: 5px solid mc('teal', '500');
          background-color: mc('teal', '50');
          padding: 0 15px 15px;
          overflow: hidden;

          @at-root .theme--dark & {
            background-color: rgba(mc('teal', '500'), .1);
          }
        }
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

  .CodeMirror-wrap pre.CodeMirror-line, .CodeMirror-wrap pre.CodeMirror-line-like {
    word-break: break-word;
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
}
</style>
