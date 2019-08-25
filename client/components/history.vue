<template lang='pug'>
  v-app(:dark='darkMode').history
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        .subheading Viewing history of page #[strong /{{path}}]
        v-spacer
        .caption.blue--text.text--lighten-3.mr-4 Trail Length: {{total}}
        .caption.blue--text.text--lighten-3 ID: {{pageId}}
        v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') Return to Live Version
      v-container(fluid, grid-list-xl)
        v-layout(row, wrap)
          v-flex(xs4)
            v-chip.ma-0(
              label
              small
              :color='darkMode ? `grey darken-2` : `grey lighten-2`'
              :class='darkMode ? `grey--text text--lighten-2` : `grey--text text--darken-2`'
              )
              span Live
            v-timeline(
              dense
              )
              v-timeline-item.pb-2(
                v-for='(ph, idx) in trail'
                :key='ph.versionId'
                :small='ph.actionType === `edit`'
                fill-dot
                :color='trailColor(ph.actionType)'
                :icon='trailIcon(ph.actionType)'
                :class='idx >= trail.length - 1 ? `pb-4` : `pb-2`'
                )
                v-card.radius-7(flat, :class='trailBgColor(ph.actionType)')
                  v-toolbar(flat, :color='trailBgColor(ph.actionType)', height='40')
                    v-chip.ml-0.mr-3(
                      v-if='diffSource === ph.versionId'
                      small
                      color='pink'
                      label
                      )
                      .caption.white--text Source
                    v-chip.ml-0.mr-3(
                      v-if='diffTarget === ph.versionId'
                      small
                      color='pink'
                      label
                      )
                      .caption.white--text Target
                    .caption(v-if='ph.actionType === `edit`') Edited by #[strong {{ ph.authorName }}]
                    .caption(v-else-if='ph.actionType === `move`') Moved from #[strong {{ph.valueBefore}}] to #[strong {{ph.valueAfter}}] by #[strong {{ ph.authorName }}]
                    .caption(v-else-if='ph.actionType === `initial`') Created by #[strong {{ ph.authorName }}]
                    .caption(v-else) Unknown Action by #[strong {{ ph.authorName }}]
                    v-spacer
                    .caption.mr-3 {{ ph.createdAt | moment('calendar') }}
                    v-menu(offset-x, left)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-0(icon, v-on='on', small, tile): v-icon mdi-dots-horizontal
                      v-list(dense, nav).history-promptmenu
                        v-list-item(@click='setDiffTarget(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-call-received
                          v-list-item-title Set as Differencing Target
                        v-list-item(@click='setDiffSource(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-call-made
                          v-list-item-title Set as Differencing Source
                        v-list-item
                          v-list-item-avatar(size='24'): v-icon mdi-code-tags
                          v-list-item-title View Source
                        v-list-item
                          v-list-item-avatar(size='24'): v-icon mdi-cloud-download-outline
                          v-list-item-title Download Version
                        v-list-item
                          v-list-item-avatar(size='24'): v-icon mdi-history
                          v-list-item-title Restore
                        v-list-item
                          v-list-item-avatar(size='24'): v-icon mdi-source-branch
                          v-list-item-title Branch off from here

            v-btn.ma-0.radius-7(
              v-if='total > trail.length'
              block
              color='grey darken-2'
              @click='loadMore'
              )
              .caption.white--text Load More...

            v-chip.ma-0(
              v-else
              label
              small
              :color='darkMode ? `grey darken-2` : `grey lighten-2`'
              :class='darkMode ? `grey--text text--lighten-2` : `grey--text text--darken-2`'
              ) End of history trail

          v-flex(xs8)
            v-card.radius-7
              v-card-text
                v-card.grey.radius-7(flat, :class='darkMode ? `darken-2` : `lighten-4`')
                  v-card-text
                    .subheading Page Title
                    .caption Some page description
                v-card.mt-3(light, v-html='diffHTML')

    nav-footer
    notify
    search-results
</template>

<script>
import { Diff2Html } from 'diff2html'
import { createPatch } from 'diff'
import { get } from 'vuex-pathify'
import _ from 'lodash'

import historyTrailQuery from 'gql/history/history-trail-query.gql'

export default {
  props: {
    pageId: {
      type: Number,
      default: 0
    },
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    liveContent: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      sourceText: '',
      targetText: '',
      trail: [],
      diffSource: 0,
      diffTarget: 0,
      offsetPage: 0,
      total: 0
    }
  },
  computed: {
    darkMode: get('site/dark'),
    diffs() {
      return createPatch(`/${this.path}`, this.sourceText, this.targetText)
    },
    diffHTML() {
      return Diff2Html.getPrettyHtml(this.diffs, {
        inputFormat: 'diff',
        showFiles: false,
        matching: 'lines',
        outputFormat: 'line-by-line'
      })
    }
  },
  watch: {
    trail(newValue, oldValue) {
      if (newValue && newValue.length > 0) {
        this.diffTarget = _.get(_.head(newValue), 'versionId', 0)
        this.diffSource = _.get(_.nth(newValue, 1), 'versionId', 0)
      }
    }
  },
  created () {
    this.$store.commit('page/SET_ID', this.id)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'history')

    this.targetText = this.liveContent
  },
  methods: {
    goLive() {
      window.location.assign(`/${this.path}`)
    },
    setDiffSource(versionId) {
      this.diffSource = versionId
    },
    setDiffTarget(versionId) {
      this.diffTarget = versionId
    },
    loadMore() {
      this.offsetPage++
      this.$apollo.queries.trail.fetchMore({
        variables: {
          id: this.pageId,
          offsetPage: this.offsetPage,
          offsetSize: 25
        },
        updateQuery: (previousResult, { fetchMoreResult }) => {
          return {
            pages: {
              history: {
                total: previousResult.pages.history.total,
                trail: [...previousResult.pages.history.trail, ...fetchMoreResult.pages.history.trail],
                __typename: previousResult.pages.history.__typename
              },
              __typename: previousResult.pages.__typename
            }
          }
        }
      })
    },
    trailColor(actionType) {
      switch (actionType) {
        case 'edit':
          return 'primary'
        case 'move':
          return 'purple'
        case 'initial':
          return 'teal'
        default:
          return 'grey'
      }
    },
    trailIcon(actionType) {
      switch (actionType) {
        case 'edit':
          return 'mdi-pencil'
        case 'move':
          return 'forward'
        case 'initial':
          return 'mdi-plus'
        default:
          return 'warning'
      }
    },
    trailBgColor(actionType) {
      switch (actionType) {
        case 'move':
          return this.darkMode ? 'purple' : 'purple lighten-5'
        case 'initial':
          return this.darkMode ? 'teal darken-3' : 'teal lighten-5'
        default:
          return this.darkMode ? 'grey darken-3' : 'grey lighten-3'
      }
    }
  },
  apollo: {
    trail: {
      query: historyTrailQuery,
      variables() {
        return {
          id: this.pageId,
          offsetPage: 0,
          offsetSize: 25
        }
      },
      manual: true,
      result({ data, loading, networkStatus }) {
        this.total = data.pages.history.total
        this.trail = data.pages.history.trail
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'history-trail-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

.history {
  &-promptmenu {
    border-top: 5px solid mc('blue', '700');
  }
}

</style>
