<template lang='pug'>
  v-card.editor-modal-conflict.animated.fadeIn(flat, tile)
    .pa-4
      v-toolbar.radius-7(flat, :color='$vuetify.theme.dark ? colors.surfaceDark.secondaryNeutralLite : colors.surfaceDark.secondaryNeutralLite', style='border-bottom-left-radius: 0; border-bottom-right-radius: 0;', dark)
        v-icon.mr-3 mdi-merge
        .subtitle-1 {{$t('editor:conflict.title')}}
        v-spacer
        v-btn.rounded-button.hover-btn.text-primary.text-none(
          :color='colors.actionLight.highlightOnLite'
          rounded
          @click='useLocal'
          :title='$t(`editor:conflict.useLocalHint`)'
          )
          v-icon(left, :color='$vuetify.theme.dark ? "black" : colors.textLight.primary') mdi-alpha-l-box
          span.text-none {{$t('editor:conflict.useLocal')}}
        v-dialog(
          v-model='isRemoteConfirmDiagShown'
          width='500'
          )
          template(v-slot:activator='{ on }')
            v-btn.ml-3.rounded-button.hover-btn.text-primary.text-none(
              :color='colors.actionLight.highlightOnLite'
              rounded
              v-on='on'
              :title='$t(`editor:conflict.useRemoteHint`)'
              )
              v-icon(left, :color='$vuetify.theme.dark ? "black" : colors.textLight.primary') mdi-alpha-r-box
              span.text-none {{$t('editor:conflict.useRemote')}}
          v-card
            .dialog-header.is-short.is-indigo
              v-icon.mr-3(color='white') mdi-alpha-r-box
              span {{$t('editor:conflict.overwrite.title')}}
            v-card-text.pa-4
              i18next.body-2(tag='div', path='editor:conflict.overwrite.description')
                strong(place='refEditsLost') {{$t('editor:conflict.overwrite.editsLost')}}
            v-card-chin
              v-spacer
              v-btn.rounded-button(
                outlined
                rounded
                :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite : colors.surfaceLight.primarySapHeavy'
                @click='isRemoteConfirmDiagShown = false'
                )
                v-icon(left) mdi-close
                span.text-none {{$t('common:actions.cancel')}}
              v-btn.rounded-button(
                rounded
                dark
                :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
                @click='useRemote'
                )
                v-icon(left, color='white') mdi-check
                span.text-none {{$t('common:actions.confirm')}}
        v-divider.mx-3(vertical)
        v-btn.rounded-button(
          outlined
          rounded
          :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite : "white"'
          @click='close'
          )
          v-icon(left) mdi-close
          span.text-none {{$t('common:actions.cancel')}}
      v-row.body-2(no-gutters, :style='`background-color: ${colors.blue[500]};`')
        v-col.pa-4
          v-icon.mr-3(color='white') mdi-alpha-l-box
          i18next.white--text(tag='span', path='editor:conflict.localVersion')
            em.white--text(place='refEditable', style='opacity: 0.8;') {{$t('editor:conflict.editable')}}
        v-divider(vertical)
        v-col.pa-4
          v-icon.mr-3(color='white') mdi-alpha-r-box
          i18next.white--text(tag='span', path='editor:conflict.remoteVersion')
            em.white--text(place='refReadOnly', style='opacity: 0.8;') {{$t('editor:conflict.readonly')}}
      v-row.body-2(no-gutters, :style='`background-color: ${$vuetify.theme.dark ? colors.surfaceDark.tertiaryNeutralLite : colors.surfaceLight.tertiaryNeutralLite};`')
        v-col.px-4.py-2
          i18next(tag='em', path='editor:conflict.leftPanelInfo', :style='`color: ${$vuetify.theme.dark ? colors.textDark.secondary : colors.textLight.secondary};`')
            span(place='date', :title='$options.filters.moment(checkoutDateActive, `LLL`)') {{ checkoutDateActive | moment('from') }}
        v-divider(vertical)
        v-col.px-4.py-2
          i18next(tag='em', path='editor:conflict.rightPanelInfo', :style='`color: ${$vuetify.theme.dark ? colors.textDark.secondary : colors.textLight.secondary};`')
            strong(place='authorName') {{latest.authorName}}
            span(place='date', :title='$options.filters.moment(latest.updatedAt, `LLL`)') {{ latest.updatedAt | moment('from') }}
      v-row.grey--text.text--darken-3(no-gutters, style='background-color: #1C4076;')
        v-col.pa-4
          .body-2
            strong(style='color: white;') {{$t('editor:conflict.pageTitle')}}
            strong.pl-2(style='color: white;') {{title}}
          .caption
            strong(style='color: white;') {{$t('editor:conflict.pageDescription')}}
            span.pl-2(style='color: rgba(255, 255, 255, 0.8);') {{description}}
        v-divider(vertical, light)
        v-col.pa-4
          .body-2
            strong(style='color: white;') {{$t('editor:conflict.pageTitle')}}
            strong.pl-2(style='color: white;') {{latest.title}}
          .caption
            strong(style='color: white;') {{$t('editor:conflict.pageDescription')}}
            span.pl-2(style='color: rgba(255, 255, 255, 0.8);') {{latest.description}}
      v-card.radius-7(:light='!$vuetify.theme.dark', :dark='$vuetify.theme.dark')
        div(ref='cm')
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { sync, get } from 'vuex-pathify'
import colors from '@/themes/default/js/color-scheme'

/* global siteConfig */

// ========================================
// IMPORTS
// ========================================

import '../../libs/codemirror-merge/diff-match-patch.js'

// Code Mirror
import CodeMirror from 'codemirror'
import 'codemirror/lib/codemirror.css'

// Language
import 'codemirror/mode/markdown/markdown.js'
import 'codemirror/mode/htmlmixed/htmlmixed.js'

// Addons
import 'codemirror/addon/selection/active-line.js'
import 'codemirror/addon/merge/merge.js'
import 'codemirror/addon/merge/merge.css'

export default {
  data() {
    return {
      cm: null,
      latest: {
        title: '',
        description: '',
        updatedAt: '',
        authorName: ''
      },
      isRemoteConfirmDiagShown: false,
      colors: colors
    }
  },
  computed: {
    editorKey: get('editor/editorKey'),
    activeModal: sync('editor/activeModal'),
    pageId: get('page/id'),
    title: get('page/title'),
    description: get('page/description'),
    updatedAt: get('page/updatedAt'),
    checkoutDateActive: sync('editor/checkoutDateActive')
  },
  methods: {
    close () {
      this.isRemoteConfirmDiagShown = false
      this.activeModal = ''
    },
    overwriteAndClose() {
      this.checkoutDateActive = this.latest.updatedAt
      this.$root.$emit('overwriteEditorContent')
      this.$root.$emit('resetEditorConflict')
      this.close()
    },
    useLocal () {
      this.$store.set('editor/content', this.cm.edit.getValue())
      this.overwriteAndClose()
    },
    useRemote () {
      this.$store.set('editor/content', this.latest.content)
      this.overwriteAndClose()
    }
  },
  async mounted () {
    let textMode = 'text/html'

    switch (this.editorKey) {
      case 'markdown':
        textMode = 'text/markdown'
        break
    }

    let resp = await this.$apollo.query({
      query: gql`
        query ($id: Int!) {
            conflictLatest(id: $id) {
              id
              authorId
              authorName
              content
              createdAt
              description
              isPublished
              locale
              path
              tags
              title
              updatedAt
            }
        }
      `,
      fetchPolicy: 'network-only',
      variables: {
        id: this.$store.get('page/id')
      }
    })
    resp = _.get(resp, 'data.conflictLatest', false)

    if (!resp) {
      return this.$store.commit('showNotification', {
        message: 'Failed to fetch latest version.',
        style: 'warning',
        icon: 'warning'
      })
    }
    this.latest = resp

    this.cm = CodeMirror.MergeView(this.$refs.cm, {
      value: this.$store.get('editor/content'),
      orig: resp.content,
      tabSize: 2,
      mode: textMode,
      lineNumbers: true,
      lineWrapping: true,
      connect: null,
      highlightDifferences: true,
      styleActiveLine: true,
      collapseIdentical: true,
      direction: siteConfig.rtl ? 'rtl' : 'ltr'
    })
    this.cm.rightOriginal().setSize(null, 'calc(100vh - 265px)')
    this.cm.editor().setSize(null, 'calc(100vh - 265px)')
    this.cm.wrap.style.height = 'calc(100vh - 265px)'
  }
}
</script>

<style lang='scss'>
.editor-modal-conflict {
  position: fixed !important;
  top: 0;
  left: 0;
  z-index: 10;
  width: 100%;
  height: 100vh;
  background-color: rgba(0, 0, 0, .9) !important;
  overflow: auto;
}

.v-btn.rounded-button {
  border-radius: 20px;
}

// Dark theme improvements for CodeMirror
.theme--dark {
  // CodeMirror merge view text improvements
  .CodeMirror {
    background-color: mc('neutral', '750') !important;
    color: mc('text-dark', 'primary') !important;
    
    .CodeMirror-gutters {
      background-color: mc('neutral', '700') !important;
      border-right: 1px solid mc('neutral', '600') !important;
    }
    
    .CodeMirror-linenumber {
      color: mc('text-dark', 'secondary') !important;
    }
    
    .CodeMirror-cursor {
      border-left-color: mc('text-dark', 'primary') !important;
    }
    
    .CodeMirror-selected {
      background-color: rgba(mc('blue', '500'), 0.3) !important;
    }
    
    .CodeMirror-line {
      color: mc('text-dark', 'primary') !important;
    }
    
    // Fix heading colors - remove blue and make bold
    .cm-header {
      color: mc('text-dark', 'primary') !important;
      font-weight: bold !important;
    }
    
    .cm-header-1,
    .cm-header-2,
    .cm-header-3,
    .cm-header-4,
    .cm-header-5,
    .cm-header-6 {
      color: mc('text-dark', 'primary') !important;
      font-weight: bold !important;
    }
    
    // Conflict highlighting - make it visible with white text
    .CodeMirror-merge-r-chunk {
      background-color: rgba(mc('yellow', '400'), 0.4) !important;
      color: mc('neutral', '100') !important;
    }
    
    .CodeMirror-merge-l-chunk {
      background-color: rgba(mc('yellow', '400'), 0.4) !important; 
      color: mc('neutral', '100') !important;
    }
    
    // Conflict markers - dark green for separation line
    .CodeMirror-merge-r-connect,
    .CodeMirror-merge-l-connect {
      background-color: mc('green', '700') !important;
    }
    
    // Active line in conflict
    .CodeMirror-activeline-background {
      background-color: rgba(mc('blue', '400'), 0.2) !important;
    }
  }
  
  // Merge view specific styling
  .CodeMirror-merge {
    .CodeMirror-merge-gap {
      background-color: #3e3f4b !important;
    }
    
    .CodeMirror-merge-scrolllock {
      background-color: mc('neutral', '600') !important;
    }
    
    // Merge view connectors for conflicts
    .CodeMirror-merge-copybuttons-left,
    .CodeMirror-merge-copybuttons-right {
      background-color: mc('neutral', '600') !important;
      color: mc('text-dark', 'primary') !important;
      border: 1px solid mc('neutral', '500') !important;
    }
  }
  
  // Diff highlighting improvements
  .CodeMirror-merge-r-inserted {
    background-color: rgba(mc('green', '600'), 0.4) !important;
    color: mc('green', '100') !important;
  }
  
  .CodeMirror-merge-r-deleted {
    background-color: rgba(mc('red', '500'), 0.5) !important;
    color: mc('red', '100') !important;
  }
  
  .CodeMirror-merge-l-inserted {
    background-color: rgba(mc('green', '600'), 0.4) !important;
    color: mc('green', '100') !important;
  }
  
  .CodeMirror-merge-l-deleted {
    background-color: rgba(mc('red', '500'), 0.5) !important;
    color: mc('red', '100') !important;
  }
  
  // Make sure all text in changed areas is readable
  .CodeMirror-merge-r-inserted .CodeMirror-line,
  .CodeMirror-merge-r-deleted .CodeMirror-line,
  .CodeMirror-merge-l-inserted .CodeMirror-line,
  .CodeMirror-merge-l-deleted .CodeMirror-line,
  .CodeMirror-merge-r-chunk .CodeMirror-line,
  .CodeMirror-merge-l-chunk .CodeMirror-line {
    color: inherit !important;
  }
}

// Light theme CodeMirror styling improvements
.theme--light {
  .CodeMirror {
    background-color: #ffffff !important;
    color: mc('text-light', 'primary') !important;
    
    .CodeMirror-gutters {
      background-color: mc('neutral', '50') !important;
      border-right: 1px solid mc('neutral', '200') !important;
    }
    
    .CodeMirror-linenumber {
      color: mc('text-light', 'secondary') !important;
    }
    
    // Fix heading colors - remove blue and make bold
    .cm-header {
      color: mc('text-light', 'primary') !important;
      font-weight: bold !important;
    }
    
    .cm-header-1,
    .cm-header-2,
    .cm-header-3,
    .cm-header-4,
    .cm-header-5,
    .cm-header-6 {
      color: mc('text-light', 'primary') !important;
      font-weight: bold !important;
    }
    
    // Conflict highlighting - visible with dark text
    .CodeMirror-merge-r-chunk {
      background-color: rgba(mc('yellow', '300'), 0.6) !important;
      color: mc('neutral', '800') !important;
    }
    
    .CodeMirror-merge-l-chunk {
      background-color: rgba(mc('yellow', '300'), 0.6) !important;
      color: mc('neutral', '800') !important;
    }
    
    // Conflict markers - light blue for separation line
    .CodeMirror-merge-r-connect,
    .CodeMirror-merge-l-connect {
      background-color: mc('blue', '300') !important;
    }
  }
  
  // Merge view specific styling for light theme
  .CodeMirror-merge {
    .CodeMirror-merge-gap {
      background-color: #d6d6d9 !important;
    }
    
    .CodeMirror-merge-scrolllock {
      background-color: mc('neutral', '200') !important;
    }
    
    // Merge view connectors for conflicts
    .CodeMirror-merge-copybuttons-left,
    .CodeMirror-merge-copybuttons-right {
      background-color: mc('neutral', '200') !important;
      color: mc('text-light', 'primary') !important;
      border: 1px solid mc('neutral', '300') !important;
    }
  }
  
  // Diff highlighting for light theme
  .CodeMirror-merge-r-inserted {
    background-color: rgba(mc('green', '200'), 0.8) !important;
    color: mc('green', '800') !important;
  }
  
  .CodeMirror-merge-r-deleted {
    background-color: rgba(mc('red', '100'), 0.8) !important;
    color: mc('red', '800') !important;
  }
  
  .CodeMirror-merge-l-inserted {
    background-color: rgba(mc('green', '200'), 0.8) !important;
    color: mc('green', '800') !important;
  }
  
  .CodeMirror-merge-l-deleted {
    background-color: rgba(mc('red', '100'), 0.8) !important;
    color: mc('red', '800') !important;
  }
}

// Global classes for button styling consistency
.v-btn.hover-btn {
  &:hover {
    background-color: mc('action-dark', 'highlight-on-lite') !important;
  }
}

.text-primary {
  color: mc("text-light", "primary") !important;

  &.dark {
    color: mc("text-dark", "primary") !important;
  }
}
</style>
