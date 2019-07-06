<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap, v-if='page.id')
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-view-details.svg', alt='Edit Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Page Details
            .subheading.grey--text.animated.fadeInLeft.wait-p2s
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
          v-btn.animated.fadeInRight.wait-p4s(color='grey', large, outline, to='/pages')
            v-icon arrow_back
          v-divider.animated.fadeInRight.wait-p3s.mx-3(vertical)
          v-dialog(v-model='deletePageDialog', max-width='500')
            v-btn.animated.fadeInDown.wait-p1s(color='red', large, outline, slot='activator')
              v-icon(color='red') delete
            v-card.wiki-form
              .dialog-header.is-short.is-red
                v-icon.mr-2(color='white') highlight_off
                span {{$t('common:page.delete')}}
              v-card-text
                i18next.body-2(path='common:page.deleteTitle', tag='div')
                  span.red--text.text--darken-2(place='title') {{page.title}}
                .caption {{$t('common:page.deleteSubtitle')}}
                v-chip.mt-3.ml-0.mr-1(label, color='red lighten-4', disabled, small)
                  .caption.red--text.text--darken-2 {{page.locale.toUpperCase()}}
                v-chip.mt-3.mx-0(label, color='red lighten-5', disabled, small)
                  span.red--text.text--darken-2 /{{page.path}}
              v-card-chin
                v-spacer
                v-btn(flat, @click='deletePageDialog = false', :disabled='loading') {{$t('common:actions.cancel')}}
                v-btn(color='red darken-2', @click='deletePage', :loading='loading').white--text {{$t('common:actions.delete')}}
          v-btn.animated.fadeInDown(color='teal', large, outline, @click='rerenderPage')
            v-icon(left) system_update_alt
            span Re-render
      v-flex(xs12, lg6)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 subject
            span Properties
          v-list.py-0(two-line, dense)
            v-list-tile
              v-list-tile-content
                v-list-tile-title.caption.grey--text Title
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.title }}
            v-divider
            v-list-tile
              v-list-tile-content
                v-list-tile-title.caption.grey--text Description
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.description || '-' }}
            v-divider
            v-list-tile
              v-list-tile-content
                v-list-tile-title.caption.grey--text Locale
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.locale }}
              v-list-tile-action
                v-btn(icon)
                  v-icon(color='grey') edit
            v-divider
            v-list-tile
              v-list-tile-content
                v-list-tile-title.caption.grey--text Path
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.path }}
              v-list-tile-action
                v-btn(icon)
                  v-icon(color='grey') edit
            v-divider
            v-list-tile
              v-list-tile-content
                v-list-tile-title.caption.grey--text Editor
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.editor || '?' }}
            v-divider
            v-list-tile
              v-list-tile-content
                v-list-tile-title.caption.grey--text Content Type
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.contentType || '?' }}

        v-toolbar.elevation-2.mt-3.animated.fadeInUp.wait-p4s(color='white', dense)
          v-spacer
          v-btn(color='primary', flat, :href='`/` + page.locale + `/` + page.path')
            v-icon(left) subject
            span View
          v-divider(vertical)
          v-btn(color='primary', flat, :href='`/e/` + page.locale + `/` + page.path')
            v-icon(left) edit
            span Edit
          v-divider(vertical)
          v-btn(color='primary', flat, :href='`/s/` + page.locale + `/` + page.path')
            v-icon(left) code
            span Source
          v-divider(vertical)
          v-btn(color='primary', flat, :href='`/h/` + page.locale + `/` + page.path')
            v-icon(left) history
            span History
          v-spacer

        .caption.mt-4.grey--text.animated.fadeInUp.wait-p6s Page Hash: {{ page.hash }}

      v-flex(xs12, lg6)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 people
            span Users
          v-list.py-0(two-line, dense)
            v-list-tile
              v-list-tile-avatar
                v-btn(icon, :to='`/users/` + page.creatorId')
                  v-icon(color='grey') person
              v-list-tile-content
                v-list-tile-title.caption.grey--text Creator
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.creatorName }} #[em.caption ({{ page.creatorEmail }})]
              v-list-tile-action
                v-list-tile-action-text {{ page.createdAt | moment('calendar') }}
            v-divider
            v-list-tile
              v-list-tile-avatar
                v-btn(icon, :to='`/users/` + page.authorId')
                  v-icon(color='grey') person
              v-list-tile-content
                v-list-tile-title.caption.grey--text Last Editor
                v-list-tile-sub-title.body-2.grey--text.text--darken-3 {{ page.authorName }} #[em.caption ({{ page.authorEmail }})]
              v-list-tile-action
                v-list-tile-action-text {{ page.updatedAt | moment('calendar') }}
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 history
            span Recent History
            v-spacer
            v-chip(label, color='white', small).primary--text coming soon
          v-timeline.mx-3(dense, clipped)
            v-timeline-item(color='teal', small, v-if='page.createdAt !== page.updatedAt')
              v-layout(justify-space-between)
                v-flex(xs7) Page Modified by #[strong {{ page.authorName }}] #[em.caption ({{ page.authorEmail }})]
                v-flex.text-xs-right(xs5).caption.grey--text.text-darken-2 {{ page.updatedAt | moment('calendar') }}
            v-timeline-item(hide-dot, small)
              .body-1 ...
              v-btn.mx-0(outline, color='grey', :href='`/h/` + page.locale + `/` + page.path') View Full History
              .body-1 ...
            v-timeline-item(color='pink', small)
              v-layout(justify-space-between)
                v-flex(xs7) Page created by #[strong {{ page.creatorName }}] #[em.caption ({{ page.creatorEmail }})]
                v-flex.text-xs-right(xs5).caption.grey--text.text-darken-2 {{ page.createdAt | moment('calendar') }}

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
