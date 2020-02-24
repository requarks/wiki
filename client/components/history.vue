<template lang='pug'>
  v-app(:dark='darkMode').history
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        .subheading Viewing history of #[strong /{{path}}]
        v-spacer
        .caption.blue--text.text--lighten-3.mr-4 Trail Length: {{total}}
        .caption.blue--text.text--lighten-3 ID: {{pageId}}
        v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') Return to Live Version
      v-container(fluid, grid-list-xl)
        v-layout(row, wrap)
          v-flex(xs12, md4)
            v-chip.my-0.ml-6(
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
                :color='trailColor(ph.actionType)'
                :icon='trailIcon(ph.actionType)'
                :class='idx >= trail.length - 1 ? `pb-4` : `pb-2`'
                )
                v-card.radius-7(flat, :class='trailBgColor(ph.actionType)')
                  v-toolbar(flat, :color='trailBgColor(ph.actionType)', height='40')
                    .caption(:title='$options.filters.moment(ph.createdAt, `LLL`)') {{ ph.createdAt | moment('ll') }}
                    v-divider.mx-3(vertical)
                    .caption(v-if='ph.actionType === `edit`') Edited by #[strong {{ ph.authorName }}]
                    .caption(v-else-if='ph.actionType === `move`') Moved from #[strong {{ph.valueBefore}}] to #[strong {{ph.valueAfter}}] by #[strong {{ ph.authorName }}]
                    .caption(v-else-if='ph.actionType === `initial`') Created by #[strong {{ ph.authorName }}]
                    .caption(v-else) Unknown Action by #[strong {{ ph.authorName }}]
                    v-spacer
                    v-menu(offset-x, left)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-2.radius-4(icon, v-on='on', small, tile): v-icon mdi-dots-horizontal
                      v-list(dense, nav).history-promptmenu
                        v-list-item(@click='setDiffSource(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-call-made
                          v-list-item-title Set as Differencing Source (A)
                        v-list-item(@click='setDiffTarget(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-call-received
                          v-list-item-title Set as Differencing Target (B)
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
                    v-btn.mr-2.radius-4(
                      @click='setDiffSource(ph.versionId)'
                      icon
                      small
                      depressed
                      tile
                      :class='diffSource === ph.versionId ? `pink white--text` : `grey lighten-2`'
                      ): strong A
                    v-btn.mr-0.radius-4(
                      @click='setDiffTarget(ph.versionId)'
                      icon
                      small
                      depressed
                      tile
                      :class='diffTarget === ph.versionId ? `pink white--text` : `grey lighten-2`'
                      ): strong B

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

          v-flex(xs12, md8)
            v-card.radius-7.mt-8
              v-card-text
                v-card.grey.radius-7(flat, :class='darkMode ? `darken-2` : `lighten-4`')
                  v-row(no-gutters, align='center')
                    v-col(cols='11')
                      v-card-text
                        .subheading {{target.title}}
                        .caption {{target.description}}
                    v-col.text-right.py-3
                      v-btn.mr-3(color='primary', small, dark, outlined, @click='toggleViewMode')
                        v-icon(left) mdi-eye
                        .overline View Mode
                v-card.mt-3(light, v-html='diffHTML', flat)

    nav-footer
    notify
    search-results
</template>

<script>
import * as Diff2Html from 'diff2html'
import { createPatch } from 'diff'
import { get } from 'vuex-pathify'
import _ from 'lodash'
import gql from 'graphql-tag'

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
  data () {
    return {
      source: {
        versionId: 0,
        content: '',
        title: '',
        description: ''
      },
      target: {
        versionId: 0,
        content: '',
        title: '',
        description: ''
      },
      trail: [],
      diffSource: 0,
      diffTarget: 0,
      offsetPage: 0,
      total: 0,
      viewMode: 'line-by-line',
      cache: []
    }
  },
  computed: {
    darkMode: get('site/dark'),
    diffs () {
      return createPatch(`/${this.path}`, this.source.content, this.target.content)
    },
    diffHTML () {
      return Diff2Html.html(this.diffs, {
        inputFormat: 'diff',
        drawFileList: false,
        matching: 'lines',
        outputFormat: this.viewMode
      })
    }
  },
  watch: {
    trail (newValue, oldValue) {
      if (newValue && newValue.length > 0) {
        this.diffTarget = _.get(_.head(newValue), 'versionId', 0)
        this.diffSource = _.get(_.nth(newValue, 1), 'versionId', 0)
      }
    },
    async diffSource (newValue, oldValue) {
      if (this.diffSource !== this.source.versionId) {
        const page = _.find(this.cache, { versionId: newValue })
        if (page) {
          this.source = page
        } else {
          this.source = await this.loadVersion(newValue)
        }
      }
    },
    async diffTarget (newValue, oldValue) {
      if (this.diffTarget !== this.target.versionId) {
        const page = _.find(this.cache, { versionId: newValue })
        if (page) {
          this.target = page
        } else {
          this.target = await this.loadVersion(newValue)
        }
      }
    }
  },
  created () {
    this.$store.commit('page/SET_ID', this.id)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'history')

    this.target.content = this.liveContent
  },
  methods: {
    async loadVersion (versionId) {
      this.$store.commit(`loadingStart`, 'history-version-' + versionId)
      const resp = await this.$apollo.query({
        query: gql`
          query ($pageId: Int!, $versionId: Int!) {
            pages {
              version (pageId: $pageId, versionId: $versionId) {
                action
                authorId
                authorName
                content
                contentType
                createdAt
                description
                editor
                isPrivate
                isPublished
                locale
                pageId
                path
                publishEndDate
                publishStartDate
                tags
                title
                versionId
              }
            }
          }
        `,
        variables: {
          versionId,
          pageId: this.pageId
        }
      })
      this.$store.commit(`loadingStop`, 'history-version-' + versionId)
      const page = _.get(resp, 'data.pages.version', null)
      if (page) {
        this.cache.push(page)
        return page
      } else {
        return { content: '' }
      }
    },
    toggleViewMode () {
      this.viewMode = (this.viewMode === 'line-by-line') ? 'side-by-side' : 'line-by-line'
    },
    goLive () {
      window.location.assign(`/${this.path}`)
    },
    setDiffSource (versionId) {
      this.diffSource = versionId
    },
    setDiffTarget (versionId) {
      this.diffTarget = versionId
    },
    loadMore () {
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
    trailColor (actionType) {
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
    trailIcon (actionType) {
      switch (actionType) {
        case 'edit':
          return '' // 'mdi-pencil'
        case 'move':
          return 'forward'
        case 'initial':
          return 'mdi-plus'
        default:
          return 'warning'
      }
    },
    trailBgColor (actionType) {
      switch (actionType) {
        case 'move':
          return this.darkMode ? 'purple' : 'purple lighten-5'
        case 'initial':
          return this.darkMode ? 'teal darken-3' : 'teal lighten-5'
        default:
          return this.darkMode ? 'grey darken-3' : 'grey lighten-4'
      }
    }
  },
  apollo: {
    trail: {
      query: gql`
        query($id: Int!, $offsetPage: Int, $offsetSize: Int) {
          pages {
            history(id:$id, offsetPage:$offsetPage, offsetSize:$offsetSize) {
              trail {
                versionId
                authorId
                authorName
                actionType
                valueBefore
                valueAfter
                createdAt
              }
              total
            }
          }
        }
      `,
      variables () {
        return {
          id: this.pageId,
          offsetPage: 0,
          offsetSize: 25
        }
      },
      manual: true,
      result ({ data, loading, networkStatus }) {
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

  .d2h-file-wrapper {
    border: 1px solid #EEE;
    border-left: none;
  }

  .d2h-file-header {
    display: none;
  }
}

</style>
