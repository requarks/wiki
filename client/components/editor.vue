<template lang="pug">
  .editor
    nav-header(dense)
      template(slot='actions')
        v-btn(
          outline
          color='green'
          @click.native.stop='save'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown }'
          )
          v-icon(color='green', :left='$vuetify.breakpoint.lgAndUp') check
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ mode === 'create' ? $t('common:actions.create') : $t('common:actions.save') }}
        v-btn.mx-0(
          outline
          color='red'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown }'
          )
          v-icon(color='red', :left='$vuetify.breakpoint.lgAndUp') close
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ $t('common:actions.discard') }}
        v-btn(
          outline
          color='blue'
          @click.native.stop='openModal(`properties`)'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown }'
          )
          v-icon(color='blue', :left='$vuetify.breakpoint.lgAndUp') sort_by_alpha
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ $t('editor:page') }}
    v-content
      component(:is='currentEditor')
      component(:is='currentModal')
      v-dialog(v-model='dialogProgress', persistent, max-width='350')
        v-card(color='blue darken-3', dark)
          v-card-text.text-xs-center.py-4
            atom-spinner.is-inline(
              :animation-duration='1000'
              :size='60'
              color='#FFF'
              )
            .subheading {{ $t('editor:save.processing') }}
            .caption.blue--text.text--lighten-3 {{ $t('editor:save.pleaseWait') }}
      v-dialog(v-model='dialogEditorSelector', persistent, max-width='550')
        v-card.radius-7(color='blue darken-3', dark)
          v-card-text.text-xs-center.py-4
            .subheading Which editor do you want to use for this page?
            v-container(grid-list-lg, fluid)
              v-layout(row, wrap, justify-center)
                v-flex(xs4)
                  v-card.radius-7(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("code")')
                      v-icon(large, color='primary') code
                      .body-2.mt-2 Code
                v-flex(xs4)
                  v-card.radius-7(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("markdown")')
                      v-icon(large, color='primary') list_alt
                      .body-2.mt-2 Markdown
                v-flex(xs4)
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("wysiwyg")')
                      v-icon(large, color='grey darken-1') web
                      .body-2.mt-2.grey--text.text--darken-2 Visual Builder
            .caption.blue--text.text--lighten-2 This cannot be changed later.

    v-snackbar(
      :color='notification.style'
      bottom,
      right,
      multi-line,
      v-model='notificationState'
    )
      .text-xs-left
        v-icon.mr-3(dark) {{ notification.icon }}
        span {{ notification.message }}
</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import { AtomSpinner } from 'epic-spinners'

import createPageMutation from 'gql/editor/create.gql'
import updatePageMutation from 'gql/editor/update.gql'

import editorStore from '@/store/editor'

/* global WIKI */

WIKI.$store.registerModule('editor', editorStore)

export default {
  components: {
    AtomSpinner,
    editorCode: () => import(/* webpackChunkName: "editor-code", webpackMode: "lazy" */ './editor/editor-code.vue'),
    editorMarkdown: () => import(/* webpackChunkName: "editor-markdown", webpackMode: "lazy" */ './editor/editor-markdown.vue'),
    editorWysiwyg: () => import(/* webpackChunkName: "editor-wysiwyg", webpackMode: "lazy" */ './editor/editor-wysiwyg.vue'),
    editorModalProperties: () => import(/* webpackChunkName: "editor", webpackMode: "eager" */ './editor/editor-modal-properties.vue')
  },
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    },
    tags: {
      type: Array,
      default: () => ([])
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    initEditor: {
      type: String,
      default: null
    },
    initMode: {
      type: String,
      default: 'create'
    },
    initContent: {
      type: String,
      default: null
    },
    pageId: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      currentModal: '',
      currentEditor: '',
      dialogProgress: false,
      dialogEditorSelector: false
    }
  },
  computed: {
    mode: get('editor/mode'),
    notification: get('notification'),
    notificationState: sync('notification@isActive')
  },
  created() {
    this.$store.commit('page/SET_ID', this.pageId)
    this.$store.commit('page/SET_DESCRIPTION', this.description)
    this.$store.commit('page/SET_IS_PUBLISHED', this.isPublished)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)
    this.$store.commit('page/SET_TAGS', this.tags)
    this.$store.commit('page/SET_TITLE', this.title)
  },
  mounted() {
    this.$store.set('editor/mode', this.initMode || 'create')
    this.$store.set('editor/content', this.initContent ? window.atob(this.initContent) : '# Header\n\nYour content here')
    if (this.mode === 'create') {
      _.delay(() => {
        this.dialogEditorSelector = true
      }, 500)
    } else {
      this.selectEditor(this.initEditor || 'markdown')
    }
  },
  methods: {
    selectEditor(name) {
      this.currentEditor = `editor${_.startCase(name)}`
      this.dialogEditorSelector = false
      if (this.mode === 'create') {
        _.delay(() => {
          this.openModal('properties')
        }, 500)
      }
    },
    openModal(name) {
      this.currentModal = `editorModal${_.startCase(name)}`
    },
    closeModal() {
      _.delay(() => {
        this.currentModal = ``
      }, 500)
    },
    showProgressDialog(textKey) {
      this.dialogProgress = true
    },
    hideProgressDialog() {
      this.dialogProgress = false
    },
    async save() {
      this.showProgressDialog('saving')
      try {
        if (this.$store.get('editor/mode') === 'create') {
          // --------------------------------------------
          // -> CREATE PAGE
          // --------------------------------------------

          let resp = await this.$apollo.mutate({
            mutation: createPageMutation,
            variables: {
              content: this.$store.get('editor/content'),
              description: this.$store.get('page/description'),
              editor: 'markdown',
              locale: this.$store.get('page/locale'),
              isPrivate: false,
              isPublished: this.$store.get('page/isPublished'),
              path: this.$store.get('page/path'),
              publishEndDate: this.$store.get('page/publishEndDate'),
              publishStartDate: this.$store.get('page/publishStartDate'),
              tags: this.$store.get('page/tags'),
              title: this.$store.get('page/title')
            }
          })
          resp = _.get(resp, 'data.pages.create', {})
          if (_.get(resp, 'responseResult.succeeded')) {
            this.$store.commit('showNotification', {
              message: this.$t('editor:save.success'),
              style: 'success',
              icon: 'check'
            })
            this.$store.set('editor/id', _.get(resp, 'page.id'))
            this.$store.set('editor/mode', 'update')
          } else {
            throw new Error(_.get(resp, 'responseResult.message'))
          }
        } else {
          // --------------------------------------------
          // -> UPDATE EXISTING PAGE
          // --------------------------------------------

          let resp = await this.$apollo.mutate({
            mutation: updatePageMutation,
            variables: {
              id: this.$store.get('page/id'),
              content: this.$store.get('editor/content'),
              description: this.$store.get('page/description'),
              editor: 'markdown',
              locale: this.$store.get('page/locale'),
              isPrivate: false,
              isPublished: this.$store.get('page/isPublished'),
              path: this.$store.get('page/path'),
              publishEndDate: this.$store.get('page/publishEndDate'),
              publishStartDate: this.$store.get('page/publishStartDate'),
              tags: this.$store.get('page/tags'),
              title: this.$store.get('page/title')
            }
          })
          resp = _.get(resp, 'data.pages.update', {})
          if (_.get(resp, 'responseResult.succeeded')) {
            this.$store.commit('showNotification', {
              message: this.$t('editor:save.success'),
              style: 'success',
              icon: 'check'
            })
          } else {
            throw new Error(_.get(resp, 'responseResult.message'))
          }
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          message: err.message,
          style: 'error',
          icon: 'warning'
        })
      }
      this.hideProgressDialog()
    }
  }
}
</script>

<style lang='scss'>

  .editor {
    background-color: mc('grey', '900');
    min-height: 100vh;
  }

  .atom-spinner.is-inline {
    display: inline-block;
  }

</style>
