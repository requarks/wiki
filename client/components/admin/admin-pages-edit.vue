<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap, v-if='page.id')
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-view-details.svg', alt='Edit Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Page Details
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s
              v-chip.ml-0.mr-2(label, small).caption ID {{page.id}}
              span /{{page.sitePath}}/{{page.locale}}/{{page.path}}
          v-spacer
          template(v-if='page.isPublished')
            status-indicator.mr-3(positive, pulse)
            .caption.green--text {{$t('common:page.published')}}
          template(v-else)
            status-indicator.mr-3(negative, pulse)
            .caption.red--text {{$t('common:page.unpublished')}}
          template(v-if='page.isPrivate')
            status-indicator.mr-3.ml-4(intermediary, pulse)
            .caption.deep-orange--text {{$t('common:page.private')}}
          template(v-else)
            status-indicator.mr-3.ml-4(active, pulse)
            .caption.blue--text {{$t('common:page.global')}}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(color='grey', icon, outlined, to='/pages')
            v-icon mdi-arrow-left
          v-menu(offset-y, origin='top right')
            template(v-slot:activator='{ on }')
              v-btn.mx-3.animated.fadeInDown.wait-p2s(color='black', v-on='on', depressed, dark)
                span Actions
                v-icon(right) mdi-chevron-down
            v-list(dense, nav)
              v-list-item(:href='`/` + page.sitePath + `/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-text-subject
                v-list-item-title View
              v-list-item(:href='`/e/` + page.sitePath + `/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-pencil
                v-list-item-title Edit
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-cube-scan
                v-list-item-title Re-Render
              v-list-item(v-if='page.isPublished', @click='unpublishPage')
                v-list-item-icon
                  v-icon(color='red') mdi-earth-remove
                v-list-item-title Unpublish
              v-list-item(v-else, @click='publishPage')
                v-list-item-icon
                  v-icon(color='green') mdi-earth
                v-list-item-title Publish
              v-list-item(:href='`/s/` + page.sitePath + `/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-code-tags
                v-list-item-title View Source
              v-list-item(:href='`/h/` + page.sitePath + `/` + page.locale + `/` + page.path')
                v-list-item-icon
                  v-icon(color='indigo') mdi-history
                v-list-item-title View History
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-content-duplicate
                v-list-item-title Duplicate
              v-list-item(@click='', disabled)
                v-list-item-icon
                  v-icon(color='grey') mdi-content-save-move-outline
                v-list-item-title Move/Reorder
              v-dialog(v-model='deletePageDialog', max-width='500')
                template(v-slot:activator='{ on }')
                  v-list-item(v-on='on')
                    v-list-item-icon
                      v-icon(color='red') mdi-trash-can-outline
                    v-list-item-title Delete
                v-card
                  .dialog-header.is-short(:style='`background-color: ${colors.red[450]} !important;`')
                    v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
                    span(:style='`color: ${colors.textLight.inverse};`') {{$t('common:page.delete')}}
                  v-card-text.pt-5
                    i18next.body-2(path='common:page.deleteTitle', tag='div', :style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`')
                      span(:style='`color: ${$vuetify.theme.dark ? colors.textDark.secondary : colors.textLight.secondary};`', place='title') {{page.title}}
                    .caption.mt-3(:style='`color: ${$vuetify.theme.dark ? colors.textDark.tertiary : colors.textLight.tertiary};`') {{$t('common:page.deleteSubtitle')}}
                    v-chip.mt-3.ml-0.mr-1(label, :color='$vuetify.theme.dark ? colors.surfaceDark.tertiary : colors.surfaceLight.tertiary', small)
                      .caption(:style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`') {{page.locale.toUpperCase()}}
                    v-chip.mt-3.mx-0(label, :color='$vuetify.theme.dark ? colors.surfaceDark.tertiary : colors.surfaceLight.tertiary', small)
                      span(:style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`') /{{page.path}}
                  v-card-chin
                    v-spacer
                    v-btn.btn-rounded(
                      outlined
                      rounded
                      :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
                      @click='deletePageDialog = false'
                      :disabled='loading'
                      ) {{$t('common:actions.cancel')}}
                    v-btn.btn-rounded(
                      rounded
                      dark
                      :color='colors.red[450]'
                      @click='deletePage'
                      :loading='loading'
                      )
                      v-icon(left, color='white') mdi-delete-forever
                      span.text-none.text-uppercase(:style='`color: ${colors.textLight.inverse};`') {{$t('common:actions.delete')}}
          v-btn.animated.fadeInDown(color='success', large, depressed, disabled)
            v-icon(left) mdi-check
            span Save Changes
      v-flex(xs12, lg6)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-text-subject
            span Properties
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Title
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.title }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Description
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.description || '-' }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Locale
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.locale }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Path
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.path }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Editor
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.editor || '?' }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Content Type
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.contentType || '?' }}
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Page Hash
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.hash }}

      v-flex(xs12, lg6)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-multiple
            span Users
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='24')
                v-btn(icon, :to='`/users/` + page.creatorId')
                  v-icon(color='grey') mdi-account
              v-list-item-content
                v-list-item-title: .overline.grey--text Creator
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.creatorName }} #[em.caption ({{ page.creatorEmail }})]
              v-list-item-action
                v-list-item-action-text {{ page.createdAt | moment('calendar') }}
            v-divider
            v-list-item
              v-list-item-avatar(size='24')
                v-btn(icon, :to='`/users/` + page.authorId')
                  v-icon(color='grey') mdi-account
              v-list-item-content
                v-list-item-title: .overline.grey--text Last Editor
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.authorName }} #[em.caption ({{ page.authorEmail }})]
              v-list-item-action
                v-list-item-action-text {{ page.updatedAt | moment('calendar') }}

    v-layout(row, align-center, v-else)
      v-progress-circular(indeterminate, width='2', color='grey')
      .body-2.pl-3.grey--text {{ $t('common:page.loading') }}

</template>
<script>
import _ from 'lodash'
import { StatusIndicator } from 'vue-status-indicator'
import gql from 'graphql-tag'
import colors from '@/themes/default/js/color-scheme'

import pageQuery from 'gql/admin/pages/pages-query-single.gql'
import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'
import childPagesQuery from '@/graph/common/common-pages-query-child-pages.gql'
import { PAGE_DELETE_HAS_SUBPAGES_MSG } from '@/messages'

export default {
  components: {
    StatusIndicator
  },
  data() {
    return {
      deletePageDialog: false,
      page: {},
      loading: false,
      colors: colors
    }
  },
  methods: {
    async deletePage() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-delete')
      try {
        // Check for subpages before allowing deletion — same guard as the user-facing delete
        const childResp = await this.$apollo.query({
          query: childPagesQuery,
          variables: {
            pageId: this.page.id,
            locale: this.page.locale,
            siteId: this.page.siteId
          },
          fetchPolicy: 'network-only'
        })
        const children = _.get(childResp, 'data.childPages', [])
        if (children && children.length > 0) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: PAGE_DELETE_HAS_SUBPAGES_MSG,
            icon: 'warning',
            close: true
          })
          this.deletePageDialog = false
          this.loading = false
          this.$store.commit(`loadingStop`, 'page-delete')
          return
        }
        const resp = await this.$apollo.mutate({
          mutation: deletePageMutation,
          variables: {
            id: this.page.id
          }
        })
        if (_.get(resp, 'data.pages.delete.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'green',
            message: `Page deleted successfully.`,
            icon: 'check'
          })
          this.$router.replace('/pages')
        } else {
          throw new Error(_.get(resp, 'data.pages.delete.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'page-delete')
    },
    async unpublishPage() {
      this.$store.commit('loadingStart', 'page-publish-toggle')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $content: String!, $editor: String!, $isPublished: Boolean!, $siteId: String!) {
              pages {
                update(id: $id, content: $content, editor: $editor, isPublished: $isPublished, siteId: $siteId) {
                  responseResult {
                    succeeded
                    errorCode
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.page.id,
            content: this.page.content,
            editor: this.page.editor,
            isPublished: false,
            siteId: this.page.siteId
          }
        })
        
        if (_.get(resp, 'data.pages.update.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'green',
            message: `"${this.page.title}" is now unpublished.`,
            icon: 'earth-remove'
          })
          // Refresh page data to update status
          this.$apollo.queries.page.refetch()
        } else {
          throw new Error(_.get(resp, 'data.pages.update.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit('loadingStop', 'page-publish-toggle')
    },
    async publishPage() {
      this.$store.commit('loadingStart', 'page-publish-toggle')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $content: String!, $editor: String!, $isPublished: Boolean!, $siteId: String!) {
              pages {
                update(id: $id, content: $content, editor: $editor, isPublished: $isPublished, siteId: $siteId) {
                  responseResult {
                    succeeded
                    errorCode
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.page.id,
            content: this.page.content,
            editor: this.page.editor,
            isPublished: true,
            siteId: this.page.siteId
          }
        })
        
        if (_.get(resp, 'data.pages.update.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'green',
            message: `"${this.page.title}" is now published.`,
            icon: 'earth'
          })
          // Refresh page data to update status
          this.$apollo.queries.page.refetch()
        } else {
          throw new Error(_.get(resp, 'data.pages.update.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit('loadingStop', 'page-publish-toggle')
    },
    async rerenderPage() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    }
  },
  apollo: {
    page: {
      query: pageQuery,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.pageById,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-pages-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
