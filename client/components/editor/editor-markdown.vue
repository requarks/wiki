<template lang='pug'>
  .editor-markdown
    v-toolbar.editor-markdown-toolbar(
      :color='colors.surfaceDark.primaryBlueHeavy'
      style='overflow-x: hidden;'
      dense
      dark
      flat
      )
      template(v-if='isModalShown')
        v-spacer
        v-btn.animated.fadeInRight(outlined, @click='closeAllModal')
          v-icon(left) mdi-arrow-left-circle
          span {{$t('editor:backToEditor')}}
      template(v-else)
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn(icon, tile, v-on='on', @click='toggleMarkup({ start: `**` })').mx-0
              v-icon mdi-format-bold
          span {{$t('editor:markup.bold')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p1s(icon, tile, v-on='on', @click='toggleMarkup({ start: `*` })').mx-0
              v-icon mdi-format-italic
          span {{$t('editor:markup.italic')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
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
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p4s(icon, tile, v-on='on', @click='toggleMarkup({ start: `~` })').mx-0
              v-icon mdi-format-subscript
          span {{$t('editor:markup.subscript')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
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
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p7s(icon, tile, v-on='on', @click='insertBeforeEachLine({ content: `- `})').mx-0
              v-icon mdi-format-list-bulleted
          span {{$t('editor:markup.unorderedList')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p8s(icon, tile, v-on='on', @click='insertBeforeEachLine({ content: `1. `})').mx-0
              v-icon mdi-format-list-numbered
          span {{$t('editor:markup.orderedList')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p9s(icon, tile, v-on='on', @click='toggleMarkup({ start: "`" })').mx-0
              v-icon mdi-code-tags
          span {{$t('editor:markup.inlineCode')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p10s(icon, tile, v-on='on', @click='toggleMarkup({ start: `<kbd>`, end: `</kbd>` })').mx-0
              v-icon mdi-keyboard-variant
          span {{$t('editor:markup.keyboardKey')}}
        v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeIn.wait-p11s(icon, tile, v-on='on', @click='insertAfter({ content: `---`, newLine: true })').mx-0
              v-icon mdi-minus
          span {{$t('editor:markup.horizontalBar')}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy', v-if='previewShown')
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeIn.wait-p1s(icon, tile, v-on='on', @click='spellModeActive = !spellModeActive').mx-0
                v-icon(:color='spellModeActive ? `amber` : `white`') mdi-spellcheck
            span {{$t('editor:markup.toggleSpellcheck')}}
          v-tooltip(bottom, :color='colors.surfaceDark.infoHeavy')
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeIn.wait-p2s(icon, tile, v-on='on', @click='previewShown = !previewShown').mx-0
                v-icon mdi-book-open-outline
            span {{$t('editor:markup.togglePreviewPane')}}
    .editor-markdown-main
      .editor-markdown-sidebar
        v-tooltip(right, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.animated.fadeInLeft(icon, tile, v-on='on', dark, @click='insertLink').mx-0
              v-icon mdi-link-plus
          span {{$t('editor:markup.insertLink')}}
        v-tooltip(right, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p1s(icon, tile, v-on='on', dark, @click='insertExternalLink', aria-label='Insert External Link').mx-0
              v-icon mdi-open-in-new
          span Insert External Link
        v-tooltip(right, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p2s(icon, tile, v-on='on', dark, @click='toggleModal(`editorModalMedia`)').mx-0
              v-icon(:color='activeModal === `editorModalMedia` ? `teal` : ``') mdi-folder-multiple-image
          span {{$t('editor:markup.insertAssets')}}
        v-tooltip(right, :color='colors.surfaceDark.infoHeavy')
          template(v-slot:activator='{ on }')
            v-btn.mt-3.animated.fadeInLeft.wait-p3s(icon, tile, v-on='on', dark, @click='toggleModal(`editorModalDrawio`)').mx-0
              v-icon mdi-chart-multiline
          span {{$t('editor:markup.insertDiagram')}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          v-tooltip(right, :color='colors.surfaceDark.infoHeavy')
            template(v-slot:activator='{ on }')
              v-btn.mt-3.animated.fadeInLeft.wait-p4s(icon, tile, v-on='on', dark, @click='toggleFullscreen').mx-0
                v-icon mdi-arrow-expand-all
            span {{$t('editor:markup.distractionFreeMode')}}
          v-tooltip(right, :color='colors.surfaceDark.infoHeavy')
            template(v-slot:activator='{ on }')
              v-btn.mt-3.animated.fadeInLeft.wait-p4s(icon, tile, v-on='on', dark, @click='toggleHelp').mx-0
                v-icon(:color='helpShown ? `teal` : ``') mdi-help-circle
            span {{$t('editor:markup.markdownFormattingHelp')}}
      .editor-markdown-editor
        textarea(ref='cm')
      transition(name='editor-markdown-preview')
        .editor-markdown-preview(v-if='previewShown')
          .editor-markdown-preview-content.contents(ref='editorPreviewContainer')
            div(
              ref='editorPreview'
              v-html='previewHTML'
              :spellcheck='spellModeActive'
              :contenteditable='spellModeActive'
              @blur='spellModeActive = false'
              )

    v-system-bar.editor-markdown-sysbar(dark, status, :color='colors.surfaceDark.black')
      .caption.editor-markdown-sysbar-locale {{locale.toUpperCase()}}
      .caption.px-3 /{{path}}
      template(v-if='$vuetify.breakpoint.mdAndUp')
        v-spacer
        .caption Markdown
        v-spacer
        .caption Ln {{cursorPos.line + 1}}, Col {{cursorPos.ch + 1}}

    markdown-help(v-if='helpShown')
    page-selector(mode='select', v-model='insertLinkDialog', :open-handler='insertLinkHandler', :path='path', :locale='locale')
    
    v-dialog(v-model='insertExternalLinkDialog', max-width='550', persistent, overlay-color='blue-grey darken-4', overlay-opacity='.7')
      v-card
        .dialog-header.is-short(:style='`background-color: ${colors.blue[500]} !important;`')
          v-icon.mr-2(color='white') mdi-open-in-new
          span(:style='`color: ${colors.textLight.inverse};`') Insert External Link
        v-card-text.pt-5
          .d-flex.align-center
            span URL
            v-tooltip(right, color='#424242')
              template(v-slot:activator='{ on }')
                v-icon.ml-2.grey--text(small, v-on='on') mdi-information-outline
              span Enter a URL or domain. https:// is added automatically if missing.
          v-text-field(
            v-model='externalLinkUrl'
            placeholder='https://example.com'
            outlined
            dense
            autofocus
            :error='externalLinkUrlError'
            :error-messages='externalLinkUrlError ? "URL is required" : ""'
            @keyup.enter='insertExternalLinkHandler'
            class='mt-1'
          )
          v-text-field(
            v-model='externalLinkText'
            label='Link Text (optional)'
            placeholder='Enter link text or leave blank to use the URL'
            outlined
            dense
            class='mt-2'
            @keyup.enter='insertExternalLinkHandler'
          )
          v-checkbox(
            v-model='externalLinkNewTab'
            label='Open in new tab'
            class='mt-1'
          )
        v-card-chin
          v-spacer
          v-btn.btn-rounded(
            outlined
            rounded
            :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
            @click='closeExternalLinkDialog'
            ) {{$t('common:actions.cancel')}}
          v-btn.px-4.btn-rounded(
            rounded
            :dark='$vuetify.theme.dark'
            :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
            @click='insertExternalLinkHandler'
            :disabled='!externalLinkUrl'
            )
            span.text-none(:style='`color: ${colors.textLight.inverse};`') INSERT LINK
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import markdownHelp from './markdown/help.vue'
import gql from 'graphql-tag'
import DOMPurify from 'dompurify'
import colors from '@/themes/default/js/color-scheme'

/* global siteConfig, siteLangs */

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
import 'codemirror/addon/hint/show-hint.js'
import 'codemirror/addon/fold/foldcode.js'
import 'codemirror/addon/fold/foldgutter.js'
import 'codemirror/addon/fold/foldgutter.css'

// Markdown-it
import MarkdownIt from 'markdown-it'
import mdAttrs from 'markdown-it-attrs'
import mdDecorate from 'markdown-it-decorate'
import { full as mdEmoji } from 'markdown-it-emoji'
import mdTaskLists from 'markdown-it-task-lists'
import mdExpandTabs from 'markdown-it-expand-tabs'
import mdAbbr from 'markdown-it-abbr'
import mdSup from 'markdown-it-sup'
import mdSub from 'markdown-it-sub'
import mdMark from 'markdown-it-mark'
import mdMultiTable from 'markdown-it-multimd-table'
import mdFootnote from 'markdown-it-footnote'
import mdImsize from 'markdown-it-imsize'
import katex from 'katex'
import underline from '../../libs/markdown-it-underline'
import 'katex/dist/contrib/mhchem'
import twemoji from 'twemoji'
import plantuml from './markdown/plantuml'

// Prism (Syntax Highlighting)
import Prism from 'prismjs'

// Mermaid
import mermaid from 'mermaid'

// Helpers
import katexHelper from './common/katex'
import tabsetHelper from './markdown/tabset'
import cmFold from './common/cmFold'
import mentionPlugin from './markdown/mention'
import autoCompleteEmailsQuery from '../../graph/editor/users-query-auto-complete.gql'
import { v4 as uuidv4 } from 'uuid'

// ========================================
// INIT
// ========================================

// Platform detection
const CtrlKey = /Mac/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

// Prism Config
Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'
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
    if (lang === 'diagram') {
      return `<pre class="diagram">` + Buffer.from(str, 'base64').toString() + `</pre>`
    } else if (['mermaid', 'plantuml'].includes(lang)) {
      return `<pre class="codeblock-${lang}"><code>${_.escape(str)}</code></pre>`
    } else {
      return `<pre class="line-numbers"><code class="language-${lang}">${_.escape(str)}</code></pre>`
    }
  }
})
  .use(mdAttrs, {
    allowedAttributes: ['id', 'class', 'target']
  })
  .use(mdDecorate)
  .use(underline)
  .use(mdEmoji)
  .use(mdTaskLists, { label: false, labelAfter: false })
  .use(mdExpandTabs)
  .use(mdAbbr)
  .use(mdSup)
  .use(mdSub)
  .use(mdMultiTable, { multiline: true, rowspan: true, headerless: true })
  .use(mdMark)
  .use(mdFootnote)
  .use(mdImsize)
  .use(mentionPlugin)

// DOMPurify fix for draw.io
DOMPurify.addHook('uponSanitizeElement', (elm) => {
  if (elm.querySelectorAll) {
    const breaks = elm.querySelectorAll('foreignObject br, foreignObject p')
    if (breaks && breaks.length) {
      for (let i = 0; i < breaks.length; i++) {
        breaks[i].parentNode.replaceChild(
          document.createElement('div'),
          breaks[i]
        )
      }
    }
  }
})

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

cmFold.register('markdown')
// ========================================
// PLANTUML
// ========================================

// TODO: Use same options as defined in backend
plantuml.init(md, {})

// ========================================
// KATEX
// ========================================

const macros = {}
md.inline.ruler.after('escape', 'katex_inline', katexHelper.katexInline)
md.renderer.rules.katex_inline = (tokens, idx) => {
  try {
    return katex.renderToString(tokens[idx].content, {
      displayMode: false, macros
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
      displayMode: true, macros
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
    callback (icon) {
      return `/_assets/svg/twemoji/${icon}.svg`
    }
  })
}

// ========================================
// Vue Component
// ========================================

let mermaidId = 0

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
      helpShown: false,
      spellModeActive: false,
      insertLinkDialog: false,
      insertExternalLinkDialog: false,
      externalLinkUrl: '',
      externalLinkText: '',
      externalLinkNewTab: false,
      externalLinkUrlError: false,
      newMentions: new Map(),
      mentionCache: {},
      colors: colors
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
    activeModal: sync('editor/activeModal'),
    sitePath: get('page/sitePath')
  },
  watch: {
    previewShown (newValue, oldValue) {
      if (newValue && !oldValue) {
        this.$nextTick(() => {
          this.renderMermaidDiagrams()
          Prism.highlightAllUnder(this.$refs.editorPreview)
          Array.from(this.$refs.editorPreview.querySelectorAll('pre.line-numbers')).forEach(pre => pre.classList.add('prismjs'))
        })
      }
    },
    spellModeActive (newValue) {
      if (newValue) {
        this.$nextTick(() => {
          this.$refs.editorPreview.focus()
        })
      }
    },
    '$vuetify.theme.dark' () {
      // Re-render diagrams with new theme when theme changes
      this.$nextTick(() => {
        // Clear all processed mermaid diagrams and re-render
        if (this.$refs.editorPreviewContainer) {
          const mermaidDivs = this.$refs.editorPreviewContainer.querySelectorAll('.mermaid[data-processed="true"]')
          mermaidDivs.forEach(div => {
            // Save the original source code
            const source = div.getAttribute('data-mermaid-source') || div.textContent
            div.setAttribute('data-mermaid-source', source)
            div.removeAttribute('data-processed')
            div.innerHTML = source // Restore original mermaid code
            div.classList.add('mermaid')
          })
        }
        
        // Re-render with new theme
        this.renderMermaidDiagrams()
      })
    }
  },
  methods: {
    trackDeletedMentions(cm, changeObj) {
      if (changeObj.origin === '+delete' || changeObj.origin === 'cut') {
        const from = changeObj.from
        const to = changeObj.to
        for (let [uuid] of this.newMentions.entries()) {
          if (this.isMentionInRange(from, to, uuid)) {
            this.newMentions.delete(uuid)
            // Set the mentions in the Vuex store
            this.$store.set(
              'editor/mentions',
              Array.from(
                this.newMentions.values().map((mention) => {
                  return mention.mention.substring(1)
                })
              )
            )
            break
          }
        }
      }
    },
    isMentionInRange(from, to, uuid) {
      const mention = this.newMentions.get(uuid)
      if (!mention) return false
      const mentionFrom = mention.from
      const mentionTo = mention.to
      return (
        (from.line > mentionFrom.line || (from.line === mentionFrom.line && from.ch >= mentionFrom.ch)) &&
      (to.line < mentionTo.line || (to.line === mentionTo.line && to.ch <= mentionTo.ch))
      )
    },
    toggleModal(key) {
      this.activeModal = (this.activeModal === key) ? '' : key
      this.helpShown = false
    },
    closeAllModal() {
      this.activeModal = ''
      this.helpShown = false
    },
    onCmInput: _.debounce(function (newContent) {
      this.processContent(newContent)
    }, 600),
    onCmPaste () {
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
    processContent (newContent) {
      linesMap = []
      // this.$store.set('editor/content', newContent)
      this.processMarkers(this.cm.firstLine(), this.cm.lastLine())
      this.previewHTML = DOMPurify.sanitize(md.render(newContent), {
        ADD_TAGS: ['img', 'foreignObject'],
        ADD_ATTR: ['src', 'alt', 'class', 'id', 'target'],
        HTML_INTEGRATION_POINTS: { foreignobject: true }
      })
      this.$nextTick(() => {
        tabsetHelper.format()
        this.renderMermaidDiagrams()
        Prism.highlightAllUnder(this.$refs.editorPreview)
        Array.from(this.$refs.editorPreview.querySelectorAll('pre.line-numbers')).forEach(pre => pre.classList.add('prismjs'))
        this.scrollSync(this.cm)
      })
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
      lineContent = _.times(lvl, () => '#').join('') + ` ` + lineContent
      this.cm.doc.replaceRange(lineContent, { line: curLine, ch: 0 }, { line: curLine, ch: lineLength })
    },
    /**
     * Get the header lever of the current line
     */
    getHeaderLevel() {
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
      const config = {
        '- ': { pattern: /^- /, type: 'unordered' },
        '1. ': { pattern: /^\d+\. /, type: 'ordered' },
        '> ': { pattern: /^> /, type: 'blockquote' }
      }[content]

      const lines = this.cm.doc.somethingSelected() ?
        _.range(
          Math.min(this.cm.doc.listSelections()[0].from().line, this.cm.doc.listSelections()[0].to().line),
          Math.max(this.cm.doc.listSelections()[0].from().line, this.cm.doc.listSelections()[0].to().line) + 1
        ) : [this.cm.doc.getCursor('head').line]

      const getLineText = (ln) => this.cm.doc.getLine(ln)
      const hasPrefix = (text) => config.pattern.test(text)
      const isAttr = (text) => /^(> )?<!--\{\.is-.*?\}-->/.test(text)
      const buildPrefix = (text, needsAttr) => {
        if (needsAttr) return `${content}<!--${after}-->\n${content}`
        if (config.type === 'ordered') return '1. '
        return content + text
      }

      const attrLineIdx = config.type === 'blockquote' ?
        [lines[0] - 1, lines[0]].find(idx => idx >= 0 && isAttr(getLineText(idx))) ?? -1 : -1

      const contentLines = lines.filter(ln => !isAttr(getLineText(ln)))
      const nonEmptyContentLines = contentLines.filter(ln => getLineText(ln).trim())
      const allHavePrefix = nonEmptyContentLines.length > 0 && nonEmptyContentLines.every(ln => hasPrefix(getLineText(ln)))

      const state = {
        isSingleEmpty: contentLines.length === 1 && !nonEmptyContentLines.length,
        isToggleOff: allHavePrefix,
        hasAttribute: attrLineIdx >= 0,
        needsAttribute: after && config.type === 'blockquote'
      }

      const actions = {
        'singleEmpty': {
          match: () => state.isSingleEmpty && !hasPrefix(getLineText(contentLines[0])),
          execute: () => {
            const ln = contentLines[0]
            const text = getLineText(ln)
            const newText = buildPrefix(text, state.needsAttribute)
            this.cm.doc.replaceRange(newText, { line: ln, ch: 0 }, { line: ln, ch: text.length })
          }
        },
        'toggleOffWithAttr': {
          match: () => state.isToggleOff && state.hasAttribute,
          execute: () => {
            this.cm.doc.replaceRange('', { line: attrLineIdx, ch: 0 }, { line: attrLineIdx + 1, ch: 0 })
            contentLines.map(ln => ln > attrLineIdx ? ln - 1 : ln).forEach(ln => {
              const text = getLineText(ln)
              hasPrefix(text) && this.cm.doc.replaceRange(text.replace(config.pattern, ''), { line: ln, ch: 0 }, { line: ln, ch: text.length })
            })
          }
        },
        'toggleOff': {
          match: () => state.isToggleOff,
          execute: () => {
            contentLines.forEach(ln => {
              const text = getLineText(ln)
              hasPrefix(text) && this.cm.doc.replaceRange(text.replace(config.pattern, ''), { line: ln, ch: 0 }, { line: ln, ch: text.length })
            })
          }
        },
        'toggleOn': {
          match: () => true,
          execute: () => {
            state.needsAttribute && this.cm.doc.replaceRange(`${content}<!--${after}-->\n`, { line: lines[0], ch: 0 })
            const workingLines = state.needsAttribute ? contentLines.map(ln => ln + 1) : contentLines
            let counter = 1
            workingLines.forEach(ln => {
              const text = getLineText(ln)
              if (hasPrefix(text)) {
                config.type === 'ordered' && counter++
              } else {
                const prefix = config.type === 'ordered' ? `${counter++}. ` : content
                this.cm.doc.replaceRange(prefix + text, { line: ln, ch: 0 }, { line: ln, ch: text.length })
              }
            })
          }
        }
      }

      Object.values(actions).find(action => action.match() && (action.execute(), true))
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
      document.getElementsByClassName('CodeMirror-code')[0].focus()
      this.$store.commit('showNotification', {
        message: 'To exit the Distraction Free Mode, press Esc.',
        style: 'info',
        icon: 'check'
      })
    },
    refresh() {
      this.$nextTick(() => {
        this.cm.refresh()
      })
    },
    renderMermaidDiagrams () {
      // Convert codeblock-mermaid to .mermaid elements that mermaid.js can process
      if (this.$refs.editorPreviewContainer) {
        const mermaidCodeBlocks = this.$refs.editorPreviewContainer.querySelectorAll('pre.codeblock-mermaid')
        mermaidCodeBlocks.forEach(pre => {
          const code = pre.querySelector('code')
          if (code) {
            const mermaidDiv = document.createElement('div')
            mermaidDiv.className = 'mermaid'
            mermaidDiv.textContent = code.textContent
            mermaidDiv.setAttribute('data-mermaid-source', code.textContent) // Store source for re-rendering
            mermaidDiv.removeAttribute('data-processed') // Force re-render
            pre.replaceWith(mermaidDiv)
          }
        })
      }
      
      // Initialize mermaid with correct theme
      const mermaidTheme = this.$vuetify.theme.dark ? 'dark' : 'default'
      
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        securityLevel: 'loose'
      })
      
      // Run mermaid on unprocessed diagrams
      if (this.$refs.editorPreviewContainer) {
        const mermaidDivs = this.$refs.editorPreviewContainer.querySelectorAll('.mermaid:not([data-processed])')
        mermaidDivs.forEach(div => {
          mermaid.run({ nodes: [div] })
        })
      }
      
      // Apply color-scheme protection after rendering
      this.$nextTick(() => {
        this.applyMermaidColorProtection()
      })
      // Optionally, if you need to render specific diagrams manually:
      // document.querySelectorAll('.editor-markdown-preview pre.codeblock-mermaid > code').forEach(elm => {
      //   mermaidId++
      //   const mermaidDef = elm.innerText
      //   const mmElm = document.createElement('div')
      //   mmElm.innerHTML = `<div class="mermaid">${mermaidDef}</div>`
      //   elm.parentNode.replaceWith(mmElm)
      // })
    },
    applyMermaidColorProtection () {
      // Apply color-scheme protection to mermaid diagrams in editor preview
      // Use the appropriate color-scheme based on Vuetify theme, but prevent browser override
      const colorScheme = this.$vuetify.theme.dark ? 'dark' : 'light'
      
      if (this.$refs.editorPreviewContainer) {
        const mermaidContainers = this.$refs.editorPreviewContainer.querySelectorAll('.mermaid')
        mermaidContainers.forEach(container => {
          container.style.setProperty('color-scheme', colorScheme, 'important')
          container.style.setProperty('forced-color-adjust', 'none', 'important')
          container.style.setProperty('filter', 'none', 'important')
          
          // Also protect SVGs inside
          const svgs = container.querySelectorAll('svg')
          svgs.forEach(svg => {
            svg.style.setProperty('color-scheme', colorScheme, 'important')
            svg.style.setProperty('forced-color-adjust', 'none', 'important')
            svg.style.setProperty('filter', 'none', 'important')
          })
        })
        
        // Also protect draw.io diagrams (pre.diagram)
        const diagramContainers = this.$refs.editorPreviewContainer.querySelectorAll('pre.diagram')
        diagramContainers.forEach(container => {
          container.style.setProperty('color-scheme', colorScheme, 'important')
          container.style.setProperty('forced-color-adjust', 'none', 'important')
          container.style.setProperty('filter', 'none', 'important')
          
          const svgs = container.querySelectorAll('svg')
          svgs.forEach(svg => {
            svg.style.setProperty('color-scheme', colorScheme, 'important')
            svg.style.setProperty('forced-color-adjust', 'none', 'important')
            svg.style.setProperty('filter', 'none', 'important')
            
            // Remove color-scheme from inline style attribute if present
            if (svg.style.colorScheme) {
              svg.style.removeProperty('color-scheme')
              svg.style.setProperty('color-scheme', colorScheme, 'important')
            }
          })
        })
      }
    },
    autocomplete (cm, change) {
      if (cm.getModeAt(cm.getCursor()).name !== 'markdown') {
        return
      }

      // mentions
      const cursor = cm.getCursor()
      const token = cm.getTokenAt(cursor)
      const mentionPattern = /@[\w.+-]+/g
      const match = mentionPattern.exec(token.string)
      if (match) {
        const mentionIndex = token.string.indexOf(match[0])
        const charBeforeMention = token.string[mentionIndex - 1]

        // Ensure the mention is at the beginning of a word and not followed by a word character
        if ((mentionIndex === 0 || /\s/.test(charBeforeMention))) {
          const query = match.input.substring(1) // Remove the '@' from the query
          const cachedResults = Object.values(this.mentionCache)
            .flat()
            .filter((email) => email.startsWith(query))
          if (cachedResults.length > 0) {
            cm.showHint({
              hint: async (cm) => {
                const cur = cm.getCursor()
                const token = cm.getTokenAt(cur)
                return {
                  list: cachedResults.map((email) => ({
                    text: '@' + `${email}`,
                    displayText: ` ${email}`
                  })),
                  from: CodeMirror.Pos(cur.line, token.start),
                  to: CodeMirror.Pos(cur.line, token.end)
                }
              }
            })
          } else {
            cm.showHint({
              hint: async (cm) => {
                const cur = cm.getCursor()
                const token = cm.getTokenAt(cur)
                try {
                  const respRaw = await this.$apollo.query({
                    query: autoCompleteEmailsQuery,
                    variables: {
                      siteId: this.$store.get('page/siteId'),
                      query: query
                    }
                  })
                  const resp = _.get(respRaw, 'data.autoCompleteEmails', [])
                  if (resp && resp.length > 0) {
                    this.mentionCache = resp
                    return {
                      list: resp.map((email) => ({
                        text: '@' + `${email}`,
                        displayText: ` ${email}`
                      })),
                      from: CodeMirror.Pos(cur.line, token.start),
                      to: CodeMirror.Pos(cur.line, token.end)
                    }
                  }
                } catch (err) {
                  console.error(err)
                }
                return {
                  list: [],
                  from: CodeMirror.Pos(cur.line, token.start),
                  to: CodeMirror.Pos(cur.line, token.end)
                }
              }
            })
          }
        }
      }

      // Links
      if (change.text[0] === '(') {
        const curLine = cm.getLine(change.from.line).substring(0, change.from.ch)
        if (curLine[curLine.length - 1] === ']') {
          cm.showHint({
            hint: async (cm) => {
              const cur = cm.getCursor()
              const curLine = cm.getLine(cur.line).substring(0, cur.ch)
              const queryString = curLine.substring(curLine.lastIndexOf('[') + 1, curLine.length - 2)
              const token = cm.getTokenAt(cur)
              try {
                const respRaw = await this.$apollo.query({
                  query: gql`
                    query ($query: String!, $locale: String, $siteId: String!) {
                        searchPages(query:$query, locale:$locale, siteId:$siteId) {
                          results {
                            title
                            path
                            locale
                          }
                          totalHits
                        }
                    }
                  `,
                  variables: {
                    query: queryString,
                    locale: this.locale,
                    siteId: this.$store.get('page/siteId')
                  },
                  fetchPolicy: 'cache-first'
                })
                const resp = _.get(respRaw, 'data.search', {})
                if (resp && resp.totalHits > 0) {
                  return {
                    list: resp.results.map(r => ({
                      text: '(' + (siteLangs.length > 0 ? `/${r.locale}/${r.path}` : `/${r.path}`) + ')',
                      displayText: siteLangs.length > 0 ? `/${r.locale}/${r.path} - ${r.title}` : `/${r.path} - ${r.title}`
                    })),
                    from: CodeMirror.Pos(cur.line, token.start),
                    to: CodeMirror.Pos(cur.line, token.end)
                  }
                }
              } catch (err) {}
              return {
                list: [],
                from: CodeMirror.Pos(cur.line, token.start),
                to: CodeMirror.Pos(cur.line, token.end)
              }
            }
          })
        }
      }
    },
    insertLink () {
      this.insertLinkDialog = true
    },
    insertLinkHandler ({ locale, path }) {
      const lastPart = _.last(path.split('/'))
      this.insertAtCursor({
        content: siteLangs.length > 0 ? `[${lastPart}](/${this.sitePath}/${locale}/${path})` : `[${lastPart}](/${this.sitePath}/${path})`
      })
    },
    insertExternalLink () {
      this.externalLinkUrl = ''
      this.externalLinkText = ''
      this.externalLinkNewTab = false
      this.externalLinkUrlError = false
      this.insertExternalLinkDialog = true
    },
    closeExternalLinkDialog () {
      this.insertExternalLinkDialog = false
      this.externalLinkUrl = ''
      this.externalLinkText = ''
      this.externalLinkNewTab = false
      this.externalLinkUrlError = false
    },
    normalizeUrl (url) {
      if (!url) return ''
      url = url.trim()
      // If URL doesn't start with a protocol, add https://
      if (!url.match(/^[a-z][a-z0-9+.-]*:/i)) {
        url = 'https://' + url
      }
      return url
    },
    validateUrl (url) {
      if (!url?.trim()) return false
      // Basic URL validation regex
      const urlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/
      return urlRegex.test(url)
    },
    insertExternalLinkHandler () {
      const url = this.externalLinkUrl.trim()
      
      // Validate URL
      if (!url) {
        this.externalLinkUrlError = true
        return
      }
      
      // Normalize URL (add https:// if missing)
      const normalizedUrl = this.normalizeUrl(url)
      
      // Validate the normalized URL
      if (!this.validateUrl(normalizedUrl)) {
        this.$store.commit('showNotification', {
          message: 'Please enter a valid URL',
          style: 'warning',
          icon: 'warning'
        })
        return
      }
      
      const linkText = this.externalLinkText || normalizedUrl
      let content
      
      if (this.externalLinkNewTab) {
        // Use HTML for new tab links
        content = `<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`
      } else {
        // Use standard Markdown syntax
        content = `[${linkText}](${normalizedUrl})`
      }
      
      // Track analytics
      this.$store.commit('log', {
        event: 'editor.external_link.insert',
        openNewTab: this.externalLinkNewTab,
        hasDisplayText: !!this.externalLinkText
      })
      
      this.insertAtCursor({
        content: content
      })
      
      this.closeExternalLinkDialog()
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
                  return () => {
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
    setInterval(() => {
      this.mentionCache = {}
    }, 300000) // Clear cache every 5 minutes
    this.$store.set('editor/editorKey', 'markdown')

    if (this.mode === 'create' && !this.$store.get('editor/content')) {
      this.$store.set('editor/content', '# Header\nYour content here')
    }

    // Initialize Mermaid API
    mermaid.initialize({
      startOnLoad: false,
      theme: this.$vuetify.theme.dark ? `dark` : `default`
    })

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
    _.set(keyBindings, `${CtrlKey}-S`, () => {
      this.save()
      return false
    })
    _.set(keyBindings, `${CtrlKey}-B`, () => {
      this.toggleMarkup({ start: `**` })
      return false
    })
    _.set(keyBindings, `${CtrlKey}-I`, () => {
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
    // Add custom Enter key handler for blockquotes and lists
    keyBindings['Enter'] = (cm) => {
      const cursor = cm.getCursor()
      const line = cm.getLine(cursor.line)
      
      // Define patterns for different line types
      const patterns = [
        { empty: /^>\s*$/, continue: /^(>\s*)/, next: (m) => m[1] },
        { empty: /^-\s*$/, continue: /^(- )/, next: (m) => m[1] },
        { empty: /^\d+\.\s*$/, continue: /^(\d+)\. /, next: (m) => `${parseInt(m[1]) + 1}. ` }
      ]
      
      // Check if cursor is at end of line
      const atLineEnd = cursor.ch === line.length
      
      // Check each pattern
      for (const pattern of patterns) {
        // Check if it's an empty marker line (exit the block/list)
        if (pattern.empty.test(line) && atLineEnd) {
          // Remove the empty marker and add newline
          const lineStart = { line: cursor.line, ch: 0 }
          const lineEnd = { line: cursor.line, ch: line.length }
          cm.replaceRange('', lineStart, lineEnd)
          cm.replaceSelection('\n')
          return
        }
        
        // Check if line continues the pattern (only at end of line)
        if (atLineEnd) {
          const match = line.match(pattern.continue)
          if (match) {
            cm.replaceSelection('\n' + pattern.next(match))
            return
          }
        }
      }
      
      // Default behavior
      cm.execCommand('newlineAndIndent')
    }

    this.cm.setOption('extraKeys', keyBindings)

    this.cm.on('inputRead', this.autocomplete)

    // Handle cursor movement

    this.cm.on('cursorActivity', c => {
      this.positionSync(c)
      this.scrollSync(c)
    })

    // Handle special paste

    this.cm.on('paste', this.onCmPaste)

    // Add new mentions
    this.cm.on('change', (cm, changeObj) => {
      const processedMentions = new Set()

      changeObj.text.forEach((text, index) => {
        if (text.includes('@')) {
          const line = changeObj.from.line + index
          const lineText = cm.getLine(line)
          const mentionPattern = /@[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g
          const matches = lineText.match(mentionPattern)

          if (matches) {
            matches.forEach(mention => {
              const mentionIndex = lineText.indexOf(mention)
              const charBeforeMention = lineText[mentionIndex - 1]

              // Ensure the mention is at the beginning of a word
              if (mentionIndex === 0 || /\s/.test(charBeforeMention)) {
                if (!processedMentions.has(mention)) {
                  processedMentions.add(mention)
                  const from = { line, ch: mentionIndex }
                  const to = { line, ch: mentionIndex + mention.length }
                  const uuid = uuidv4()
                  this.newMentions.set(uuid, { mention, from, to })
                }
              }
            })
          }
        }
      })

      // Set the mentions in the Vuex store
      this.$store.set(
        'editor/mentions',
        Array.from(
          this.newMentions.values().map((mention) => {
            return mention.mention.substring(1)
          })
        )
      )
    })

    // remove new mentions
    this.cm.on('changes', (cm, changes) => {
      changes.forEach((change) => this.trackDeletedMentions(cm, change))
    })
    // Render initial preview

    this.processContent(this.$store.get('editor/content'))
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
        case 'DIAGRAM':
          const selStartLine = this.cm.getCursor('from').line
          const selEndLine = this.cm.getCursor('to').line + 1
          this.cm.doc.replaceSelection('```diagram\n' + opts.text + '\n```\n', 'start')
          this.processMarkers(selStartLine, selEndLine)
          break
      }
    })

    this.$root.$on('saved-page', () => {
      this.newMentions = new Map()
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

<style lang='scss' scoped>
$editor-height: calc(100vh - 112px - 24px);
$editor-height-mobile: calc(100vh - 112px - 16px);
$editor-bg: mc('surface-dark', 'page-background');

.v-btn {
  border-radius: 50px;
}

.editor-markdown-toolbar.v-toolbar.v-toolbar--dense {
  background-color: mc('surface-dark', 'primary-blue-heavy') !important;
}

.editor-markdown {
  &-main {
    display: flex;
    width: 100%;
  }

  &-editor {
    background-color: mc('surface-dark', 'page-background');
    flex: 1 1 50%;
    display: block;
    height: $editor-height;
    position: relative;
    border-right: 1px solid mc('border-dark', 'primary');

    @include until($tablet) {
      height: $editor-height-mobile;
    }
  }

  &-preview {
    flex: 1 1 50%;
    background-color: mc('surface-light', 'page-background');
    position: relative;
    height: $editor-height;
    overflow: hidden;
    padding: 1rem;

    @at-root .theme--dark & {
      background-color: mc('surface-dark', 'page-background');
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
      position: relative;
      top: -1rem;
      
      &.contents {
        padding-bottom: 1rem;
      }

      @include until($tablet) {
        height: $editor-height-mobile;
      }

      > div {
        outline: none;
      }

      p.line {
        overflow-wrap: break-word;
      }

      ::v-deep .tabset {
        background-color: mc('peacock', '700');
        color: mc('peacock', '100') !important;
        padding: 5px 12px;
        font-size: 14px;
        font-weight: 500;
        border-radius: 5px 0 0 0;

        &::after {
          display: none;
        }

        &-header {
          background-color: mc('peacock', '500');
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
          border-left: 5px solid mc('peacock', '500');
          background-color: mc('peacock', '50');
          padding: 0 15px 15px;
          overflow: hidden;

          @at-root .theme--dark & {
            background-color: rgba(mc('peacock', '500'), .1);
          }
        }
      }
    }
  }

  &-toolbar {
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
    background-color: mc('surface-dark', 'secondary-neutral-heavy');
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
      background-color: mc('surface-dark', 'primary-neutral-heavy');
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
}
</style>

// Global styles
<style lang='scss'>
$editor-bg: mc('surface-dark', 'page-background');

.editor-markdown {

  // ==========================================
  // MERMAID DIAGRAM COLOR PROTECTION
  // ==========================================
  
  .editor-markdown-preview-content {
    .mermaid, .mermaid svg {
      color-scheme: only light !important;
      forced-color-adjust: none !important;
      filter: none !important;
    }
    
    // Also protect draw.io diagrams
    pre.diagram, pre.diagram svg {
      color-scheme: only light !important;
      forced-color-adjust: none !important;
      filter: none !important;
    }

    // Remove styling from anonymized user mentions
    .mention[data-mention="AnonymousUser"] {
      background: none;
      color: inherit;
      font-weight: inherit;
      padding: 0;
      border-radius: 0;
    }
  }

  // ==========================================
  // CODE MIRROR
  // ==========================================

  .CodeMirror {
    height: auto;
    font-family: 'Ubuntu Mono', monospace;
    font-size: .9rem;
    background-color: mc('surface-dark', 'page-background');
    color: mc('text-dark', 'primary');

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
    background-color: mc('surface-dark', 'page-background');
    color: mc('text-dark', 'primary');

    ::selection {
      background-color: mc('neutral', '750');
    }
  }

  .cm-s-wikijs-dark.CodeMirror {
    &, .CodeMirror-gutters {
      background-color: $editor-bg;
    }

    .CodeMirror-linenumber.CodeMirror-gutter-elt,
    .CodeMirror-foldgutter-open.CodeMirror-guttermarker-subtle,
    .CodeMirror-foldgutter-folded.CodeMirror-guttermarker-subtle {
      color: mc('text-dark', 'tertiary');
    }
  }

  .CodeMirror-focused .cm-matchhighlight {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQI12NgYGBgkKzc8x9CMDAwAAAmhwSbidEoSQAAAABJRU5ErkJggg==);
    background-position: bottom;
    background-repeat: repeat-x;
  }
  .cm-matchhighlight {
    background-color: mc('neutral', '800');
  }
  .CodeMirror-selection-highlight-scrollbar {
    background-color: mc('green', '600');
  }
}

// HINT DROPDOWN

.CodeMirror-hints {
  position: absolute;
  z-index: 10;
  overflow: hidden;
  list-style: none;

  margin: 0;
  padding: 1px;

  box-shadow: 2px 3px 5px rgba(0,0,0,.2);
  border: 1px solid mc('neutral', '700');

  background: mc('neutral', '900');
  font-family: 'Ubuntu Mono', monospace;
  font-size: .9rem;

  max-height: 150px;
  overflow-y: auto;

  min-width: 250px;
  max-width: 80vw;
}

.CodeMirror-hint {
  margin: 0;
  padding: 0 4px;
  white-space: pre;
  color: #FFF;
  cursor: pointer;
}

li.CodeMirror-hint-active {
  background: mc('blue', '500');
  color: #FFF;
}
</style>
