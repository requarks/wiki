<template lang='pug'>
  v-app(:dark='darkMode').history
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        .subheading Viewing history of page #[strong /{{path}}]
        v-spacer
        .caption.blue--text.text--lighten-3 ID {{pageId}}
        v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') Return to Live Version
      v-container(fluid, grid-list-xl)
        v-layout(row, wrap)
          v-flex(xs4)
            v-chip.ma-0.grey--text.text--darken-2(
              label
              small
              color='grey lighten-2'
              )
              span Live
            v-timeline(
              dense
              )
              v-timeline-item(
                v-for='ph in trail'
                :key='ph.versionId'
                :small='ph.actionType === `edit`'
                fill-dot
                :color='trailColor(ph.actionType)'
                :icon='trailIcon(ph.actionType)'
                )
                v-card.radius-7(flat, :class='trailBgColor(ph.actionType)')
                  v-toolbar(flat, :color='trailBgColor(ph.actionType)')
                    v-chip.ml-0.mr-3(
                      v-if='diffSource === ph.versionId'
                      label
                      small
                      color='pink'
                      )
                      .caption.white--text Source
                    v-chip.ml-0.mr-3(
                      v-if='diffTarget === ph.versionId'
                      label
                      small
                      color='pink'
                      )
                      .caption.white--text Target
                    .caption(v-if='ph.actionType === `edit`') Edited by {{ ph.authorName }}
                    .caption(v-else-if='ph.actionType === `move`') Moved from #[strong {{ph.valueBefore}}] to #[strong {{ph.valueAfter}}] by {{ ph.authorName }}
                    .caption(v-else-if='ph.actionType === `initial`') Created by {{ ph.authorName }}
                    .caption(v-else) Unknown Action by {{ ph.authorName }}
                    v-spacer
                    .caption {{ ph.createdAt | moment('calendar') }}
                    v-menu(offset-x, left)
                      v-btn(icon, slot='activator'): v-icon more_horiz
                      v-list(dense).history-promptmenu
                        v-list-tile(@click='setDiffTarget(ph.versionId)')
                          v-list-tile-avatar: v-icon call_made
                          v-list-tile-title Set as Differencing Target
                        v-divider
                        v-list-tile(@click='setDiffSource(ph.versionId)')
                          v-list-tile-avatar: v-icon call_received
                          v-list-tile-title Set as Differencing Source
                        v-divider
                        v-list-tile
                          v-list-tile-avatar: v-icon code
                          v-list-tile-title View Source
                        v-divider
                        v-list-tile
                          v-list-tile-avatar: v-icon cloud_download
                          v-list-tile-title Download Version
                        v-divider
                        v-list-tile
                          v-list-tile-avatar: v-icon restore
                          v-list-tile-title Restore
                        v-divider
                        v-list-tile
                          v-list-tile-avatar: v-icon call_split
                          v-list-tile-title Branch off from here

            v-chip.ma-0.grey--text.text--darken-2(
              label
              small
              color='grey lighten-2'
              ) End of history trail

          v-flex(xs8)
            v-card.radius-7
              v-card-text
                v-card.grey.lighten-4.radius-7(flat)
                  v-card-text
                    .subheading Page Title
                    .caption Some page description
                .mt-3(v-html='diffHTML')

    nav-footer
</template>

<script>
import { Diff2Html } from 'diff2html'
import { createPatch } from 'diff'
import _ from 'lodash'

import historyTrailQuery from 'gql/history/history-trail-query.gql'

/* global siteConfig */

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
      offset: 0
    }
  },
  computed: {
    darkMode() { return siteConfig.darkMode },
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
          return 'edit'
        case 'move':
          return 'forward'
        case 'initial':
          return 'add'
        default:
          return 'warning'
      }
    },
    trailBgColor(actionType) {
      switch (actionType) {
        case 'move':
          return 'purple lighten-5'
        case 'initial':
          return 'teal lighten-5'
        default:
          return 'grey lighten-3'
      }
    }
  },
  apollo: {
    trail: {
      query: historyTrailQuery,
      variables() {
        return {
          id: this.pageId,
          offset: 0
        }
      },
      update: (data) => data.pages.history,
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
