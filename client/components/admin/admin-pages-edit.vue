<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap, v-if='page.id')
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-view-details.svg', alt='Edit Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Page Details
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s
              v-chip.ml-0.mr-2(label, small).caption ID {{page.id}}
              span /{{page.locale}}/{{page.path}}
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
          v-btn.mx-1.animated.fadeInRight.wait-p4s(color='grey', large, outlined, to='/pages')
            v-icon mdi-arrow-left
          v-divider.mx-1.animated.fadeInRight.wait-p3s.mx-1(vertical)
          v-dialog(v-model='deletePageDialog', max-width='500')
            template(v-slot:activator='{ on }')
              v-btn.mx-1.animated.fadeInDown.wait-p1s(color='red', large, outlined, v-on='on')
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-short.is-red
                v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
                span {{$t('common:page.delete')}}
              v-card-text.pt-5
                i18next.body-2(path='common:page.deleteTitle', tag='div')
                  span.red--text.text--darken-2(place='title') {{page.title}}
                .caption {{$t('common:page.deleteSubtitle')}}
                v-chip.mt-3.ml-0.mr-1(label, color='red lighten-4', disabled, small)
                  .caption.red--text.text--darken-2 {{page.locale.toUpperCase()}}
                v-chip.mt-3.mx-0(label, color='red lighten-5', disabled, small)
                  span.red--text.text--darken-2 /{{page.path}}
              v-card-chin
                v-spacer
                v-btn(text, @click='deletePageDialog = false', :disabled='loading') {{$t('common:actions.cancel')}}
                v-btn(color='red darken-2', @click='deletePage', :loading='loading').white--text {{$t('common:actions.delete')}}
          v-btn.ml-1.animated.fadeInDown(color='teal', large, outlined, @click='rerenderPage')
            v-icon(left) mdi-cube-scan
            span Re-render
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
              v-list-item-action
                v-btn(icon, x-small)
                  v-icon(color='grey') mdi-pencil
            v-divider
            v-list-item
              v-list-item-content
                v-list-item-title: .overline.grey--text Path
                v-list-item-subtitle.body-2(:class='$vuetify.theme.dark ? `grey--text text--lighten-2` : `grey--text text--darken-3`') {{ page.path }}
              v-list-item-action
                v-btn(icon, x-small)
                  v-icon(color='grey') mdi-pencil
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

        v-toolbar.elevation-2.mt-3.animated.fadeInUp.wait-p4s(:color='$vuetify.theme.dark ? `grey darken-3-d5` : `white`', dense)
          v-spacer
          v-btn(color='primary', text, :href='`/` + page.locale + `/` + page.path')
            v-icon(left) mdi-text-subject
            span View
          v-divider.mx-2(vertical)
          v-btn(color='primary', text, :href='`/e/` + page.locale + `/` + page.path')
            v-icon(left) mdi-pencil
            span Edit
          v-divider.mx-2(vertical)
          v-btn(color='primary', text, :href='`/s/` + page.locale + `/` + page.path')
            v-icon(left) mdi-code-tags
            span Source
          v-divider.mx-2(vertical)
          v-btn(color='primary', text, :href='`/h/` + page.locale + `/` + page.path', disabled)
            v-icon(left) mdi-history
            span History
          v-spacer

        .caption.mt-4.grey--text.animated.fadeInUp.wait-p6s Page Hash: {{ page.hash }}

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
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-history
            span Recent History
            v-spacer
            v-chip(label, color='white', small).primary--text coming soon
          v-timeline.mx-3(dense, clipped)
            v-timeline-item(color='teal', small, v-if='page.createdAt !== page.updatedAt')
              v-layout(justify-space-between)
                v-flex(xs7).body-2 Page Modified by #[strong {{ page.authorName }}] #[em.caption ({{ page.authorEmail }})]
                v-flex.text-right(xs5).caption.grey--text.text-darken-2 {{ page.updatedAt | moment('calendar') }}
            v-timeline-item(hide-dot, small)
              .body-2 ...
              v-btn.mx-0.mt-1(outlined, color='grey', :href='`/h/` + page.locale + `/` + page.path') View Full History
              .body-2 ...
            v-timeline-item(color='pink', small)
              v-layout(justify-space-between)
                v-flex(xs7).body-2 Page created by #[strong {{ page.creatorName }}] #[em.caption ({{ page.creatorEmail }})]
                v-flex.text-right(xs5).caption.grey--text.text-darken-2 {{ page.createdAt | moment('calendar') }}

    v-layout(row, align-center, v-else)
      v-progress-circular(indeterminate, width='2', color='grey')
      .body-2.pl-3.grey--text {{ $t('common:page.loading') }}

</template>
<script>
import _ from 'lodash'
import { StatusIndicator } from 'vue-status-indicator'

import pageQuery from 'gql/admin/pages/pages-query-single.gql'
import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'

export default {
  components: {
    StatusIndicator
  },
  data() {
    return {
      deletePageDialog: false,
      page: {},
      loading: false
    }
  },
  methods: {
    async deletePage() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-delete')
      try {
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
      update: (data) => data.pages.single,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-pages-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
