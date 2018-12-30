<template lang="pug">
  v-app.editor(:dark='darkMode')
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
        v-btn(
          outline
          color='blue'
          @click.native.stop='openPropsModal'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown, "mx-0": mode === `create`, "ml-0": mode !== `create` }'
          )
          v-icon(color='blue', :left='$vuetify.breakpoint.lgAndUp') sort_by_alpha
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ $t('editor:page') }}
        v-btn(
          v-if='mode === `create`'
          outline
          color='red'
          :class='{ "is-icon": $vuetify.breakpoint.mdAndDown }'
          @click.native.stop='exit'
          )
          v-icon(color='red', :left='$vuetify.breakpoint.lgAndUp') close
          span.white--text(v-if='$vuetify.breakpoint.lgAndUp') {{ $t('common:actions.discard') }}
    v-content
      component(:is='currentEditor')
      editor-modal-properties(v-model='dialogProps')
      v-dialog(v-model='dialogEditorSelector', persistent, max-width='700')
        v-card.radius-7(color='blue darken-3', dark)
          v-card-text.text-xs-center.py-4
            .subheading Which editor do you want to use for this page?
            v-container(grid-list-lg, fluid)
              v-layout(row, wrap, justify-center)
                v-flex(xs3)
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("api")')
                      img(src='/svg/icon-rest-api.svg', alt='API', style='width: 36px;')
                      .body-2.mt-2.grey--text.text--darken-2 API Docs
                      .caption.grey--text.text--darken-1 REST / GraphQL
                v-flex(xs3)
                  v-card.radius-7(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("code")')
                      img(src='/svg/icon-source-code.svg', alt='Code', style='width: 36px;')
                      .body-2.mt-2 Code
                      .caption.grey--text Raw HTML
                v-flex(xs3)
                  v-card.radius-7(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("markdown")')
                      img(src='/svg/icon-markdown.svg', alt='Markdown', style='width: 36px;')
                      .body-2.mt-2 Markdown
                      .caption.grey--text Default
                v-flex(xs3)
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-xs-center(@click='selectEditor("wysiwyg")')
                      img(src='/svg/icon-open-in-browser.svg', alt='Visual Builder', style='width: 36px;')
                      .body-2.mt-2.grey--text.text--darken-2 Visual Builder
                      .caption.grey--text.text--darken-1 Drag-n-drop
            .caption.blue--text.text--lighten-2 This cannot be changed once the page is created.

    loader(v-model='dialogProgress', :title='$t(`editor:save.processing`)', :subtitle='$t(`editor:save.pleaseWait`)')
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
      default: true
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
      currentEditor: '',
      dialogProps: false,
      dialogProgress: false,
      dialogEditorSelector: false
    }
  },
  computed: {
    darkMode: get('site/dark'),
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

    this.$store.commit('page/SET_MODE', 'edit')
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
          this.dialogProps = true
        }, 500)
      }
    },
    openPropsModal(name) {
      this.dialogProps = true
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
              publishEndDate: this.$store.get('page/publishEndDate') || '',
              publishStartDate: this.$store.get('page/publishStartDate') || '',
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
            window.location.assign(`/${this.$store.get('page/path')}`)
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
              publishEndDate: this.$store.get('page/publishEndDate') || '',
              publishStartDate: this.$store.get('page/publishStartDate') || '',
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
    },
    exit() {

    }
  }
}
</script>

<style lang='scss'>

  .editor {
    background-color: mc('grey', '900') !important;
    min-height: 100vh;
  }

  .atom-spinner.is-inline {
    display: inline-block;
  }

</style>
