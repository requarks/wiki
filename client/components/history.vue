<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').history
    nav-header
    v-main
      v-toolbar(:color='$vuetify.theme.dark ? colors.surfaceDark.primaryBlueHeavy : colors.surfaceLight.primaryBlueHeavy')
        .subheading
        span(:style='{"color": colors.textDark.primary}') Viewing history of #[strong /{{path}}]
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          .caption.blue--text.text--lighten-3.mr-4 Trail Length: {{total}}
          .caption.blue--text.text--lighten-3 ID: {{pageId}}
          v-btn#return-btn.ml-4.hover-btn.text-primary.text-none(
            :color='colors.actionLight.highlightOnLite'
            rounded
            @click='goLive'
            ) Return to Live Version
      v-container(
        fluid
        grid-list-xl
        :class='$vuetify.breakpoint.mdAndUp ? `mt-4` : ``'
        )
        v-layout(row, wrap)
          v-flex(xs12, md4)
            v-chip.my-0.ml-6.centered(
              label
              small
              :color='$vuetify.theme.dark ? colors.neutral[750] : colors.neutral[200]'
              )
              span(
                :style='{"color": $vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary}'
              ) Live
            v-timeline.centered(
              dense
              )
              v-timeline-item.pb-2(
                v-for='(ph, idx) in fullTrail'
                :key='ph.versionId'
                :small='ph.actionType === `edit`'
                :color='trailColor(ph.actionType)'
                :icon='trailIcon(ph.actionType)'
                )
                v-card(flat, rounded, :color='trailBgColor(ph.actionType)')
                  v-toolbar(flat, rounded, :color='trailBgColor(ph.actionType)', height='40')
                    .caption(
                      :style='{"color": trailTextColor(ph.actionType)}'
                      :title='$options.filters.moment(ph.versionDate, `LLL`)'
                      ) {{ ph.versionDate | moment('ll') }}
                    v-divider.mx-3(vertical)
                    .caption(
                      v-if='ph.actionType === `edit`'
                      :style='{"color": trailTextColor(ph.actionType)}'
                      ) Edited by #[strong {{ ph.authorName }}]
                    .caption(
                      v-else-if='ph.actionType === `move`'
                      :style='{"color": trailTextColor(ph.actionType)}'
                      ) Moved from #[strong {{ph.valueBefore}}] to #[strong {{ph.valueAfter}}] by #[strong {{ ph.authorName }}]
                    .caption(
                      v-else-if='ph.actionType === `initial`'
                      :style='{"color": trailTextColor(ph.actionType)}'
                      ) Created by #[strong {{ ph.authorName }}]
                    .caption(
                      v-else-if='ph.actionType === `live`'
                      :style='{"color": trailTextColor(ph.actionType)}'
                      ) Last Edited by #[strong {{ ph.authorName }}]
                    .caption(
                      v-else
                      :style='{"color": trailTextColor(ph.actionType)}'
                      ) Unknown Action by #[strong {{ ph.authorName }}]
                    v-spacer
                    v-menu(offset-x, left)
                      template(v-slot:activator='{ on }')
                        v-btn.mr-2(icon, v-on='on', small, rounded): v-icon(
                          :style='{"color": trailTextColor(ph.actionType)}'
                        ) mdi-dots-horizontal
                      v-list(dense, nav).history-promptmenu
                        v-list-item(@click='setDiffSource(ph.versionId)', :disabled='(ph.versionId >= diffTarget && diffTarget !== 0) || ph.versionId === 0')
                          v-list-item-avatar(size='24'): v-avatar A
                          v-list-item-title Set as Differencing Source
                        v-list-item(@click='setDiffTarget(ph.versionId)', :disabled='ph.versionId <= diffSource && ph.versionId !== 0')
                          v-list-item-avatar(size='24'): v-avatar B
                          v-list-item-title Set as Differencing Target
                        v-list-item(@click='viewSource(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-code-tags
                          v-list-item-title View Source
                        v-list-item(@click='download(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-cloud-download-outline
                          v-list-item-title Download Version
                        v-list-item(@click='restore(ph.versionId, ph.versionDate)', :disabled='ph.versionId === 0')
                          v-list-item-avatar(size='24'): v-icon(:disabled='ph.versionId === 0') mdi-history
                          v-list-item-title Restore
                        v-list-item(@click='branchOff(ph.versionId)')
                          v-list-item-avatar(size='24'): v-icon mdi-source-branch
                          v-list-item-title Branch off from here
                    v-btn.mr-2(
                      @click='setDiffSource(ph.versionId)'
                      icon
                      small
                      depressed
                      rounded
                      :style='getDiffSelectorStyle(\
                        ph.versionId,\
                        diffSource,\
                        isDiffSourceDisabled(ph.versionId)\
                        )'
                      :disabled='isDiffSourceDisabled(ph.versionId)'
                      ): strong A
                    v-btn.mr-0(
                      @click='setDiffTarget(ph.versionId)'
                      icon
                      small
                      depressed
                      rounded
                      :style='getDiffSelectorStyle(\
                        ph.versionId,\
                        diffTarget,\
                        isDiffTargetDisabled(ph.versionId)\
                        )'
                      :disabled='isDiffTargetDisabled(ph.versionId)'
                      ): strong B

            v-btn#load-more-btn.ml-8.rounded-button(
              v-if='total > trail.length'
              dark
              :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
              @click='loadMore'
              depressed
              )
              span.text-none Load More...

            v-chip.ma-0(
              v-else
              label
              small
              :color='$vuetify.theme.dark ? colors.neutral[750] : colors.neutral[200]'
              )
              span(
                :style='{"color": $vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary}'
              ) End of history trail

          v-flex(xs12, md8)
            v-card.radius-7
              v-card-text
                v-card.grey.radius-7(flat, :class='$vuetify.theme.dark ? `darken-2` : `lighten-4`')
                  v-row(no-gutters, align='center')
                    v-col
                      v-card-text
                        .subheading {{target.title}}
                        .caption {{target.description}}
                    v-col.text-right.py-3(cols='2', v-if='$vuetify.breakpoint.mdAndUp')
                      v-btn.mr-3(
                        small
                        dark
                        rounded
                        outlined
                        :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite : colors.surfaceLight.primarySapHeavy'
                        @click='toggleViewMode')
                        v-icon(left, :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite : colors.surfaceLight.inverse') mdi-eye
                        .overline.text-none View Mode
                v-card.mt-3(
                  v-html='diffHTML', 
                  flat,
                  :color='$vuetify.theme.dark ? colors.surfaceDark.secondaryNeutralHeavy : colors.surfaceLight.primaryNeutralLite'
                )

    v-dialog(v-model='isRestoreConfirmDialogShown', max-width='650', persistent)
      v-card
        .dialog-header.is-orange {{$t('history:restore.confirmTitle')}}
        v-card-text.pa-4
          i18next(tag='span', path='history:restore.confirmText')
            strong(place='date') {{ restoreTarget.versionDate | moment('LLL') }}
        v-card-actions
          v-spacer
          v-btn(text, @click='isRestoreConfirmDialogShown = false', :disabled='restoreLoading') {{$t('common:actions.cancel')}}
          v-btn(color='orange darken-2', dark, @click='restoreConfirm', :loading='restoreLoading') {{$t('history:restore.confirmButton')}}

    page-selector(
      mode='create',
      v-model='branchOffOpts.modal',
      :open-handler='branchOffHandle',
      :path='branchOffOpts.path',
      :locale='branchOffOpts.locale'
    )

    nav-footer
    notify
    search-results
</template>

<script>
import * as Diff2Html from 'diff2html'
import { createPatch } from 'diff'
import _ from 'lodash'
import gql from 'graphql-tag'
import colors from '@/themes/default/js/color-scheme'

export default {
  i18nOptions: { namespaces: 'history' },
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
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    },
    createdAt: {
      type: String,
      default: ''
    },
    updatedAt: {
      type: String,
      default: ''
    },
    tags: {
      type: Array,
      default: () => ([])
    },
    authorName: {
      type: String,
      default: 'Unknown'
    },
    authorId: {
      type: Number,
      default: 0
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    liveContent: {
      type: String,
      default: ''
    },
    effectivePermissions: {
      type: String,
      default: ''
    },
    siteId: {
      type: String,
      default: ''
    },
    sitePath: {
      type: String,
      default: ''
    },
    siteName: {
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
      cache: [],
      restoreTarget: {
        versionId: 0,
        versionDate: ''
      },
      branchOffOpts: {
        versionId: 0,
        locale: 'en',
        path: 'new-page',
        modal: false
      },
      isRestoreConfirmDialogShown: false,
      restoreLoading: false,
      colors: colors
    }
  },
  computed: {
    fullTrail () {
      const liveTrailItem = {
        versionId: 0,
        authorId: this.authorId,
        authorName: this.authorName,
        actionType: 'live',
        valueBefore: null,
        valueAfter: null,
        versionDate: this.updatedAt
      }
      // -> Check for move between latest and live
      const prevPage = _.find(this.cache, ['versionId', _.get(this.trail, '[0].versionId', -1)])
      if (prevPage && this.path !== prevPage.path) {
        liveTrailItem.actionType = 'move'
        liveTrailItem.valueBefore = prevPage.path
        liveTrailItem.valueAfter = this.path
      }
      // -> Combine trail with live
      return [
        liveTrailItem,
        ...this.trail
      ]
    },
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
        this.diffTarget = 0
        this.diffSource = _.get(_.head(newValue), 'versionId', 0)
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

    this.$store.commit('page/SET_SITE_ID', this.siteId)
    this.$store.commit('page/SET_SITE_NAME', this.siteName)
    this.$store.commit('page/SET_SITE_PATH', this.sitePath)

    this.cache.push({
      action: 'live',
      authorId: this.authorId,
      authorName: this.authorName,
      content: this.liveContent,
      contentType: '',
      createdAt: this.createdAt,
      description: this.description,
      editor: '',
      isPrivate: false,
      isPublished: this.isPublished,
      locale: this.locale,
      pageId: this.pageId,
      path: this.path,
      publishEndDate: '',
      publishStartDate: '',
      tags: this.tags,
      title: this.title,
      versionId: 0,
      versionDate: this.updatedAt,
      siteId: this.siteId,
      sitePath: this.sitePath,
      siteName: this.siteName
    })

    this.target = this.cache[0]

    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
  },
  methods: {
    async loadVersion (versionId) {
      this.$store.commit(`loadingStart`, 'history-version-' + versionId)
      const resp = await this.$apollo.query({
        query: gql`
          query ($pageId: Int!, $versionId: Int!) {
              version (pageId: $pageId, versionId: $versionId) {
                action
                authorId
                authorName
                content
                contentType
                createdAt
                versionDate
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
        `,
        variables: {
          versionId,
          pageId: this.pageId
        }
      })
      this.$store.commit(`loadingStop`, 'history-version-' + versionId)
      const page = _.get(resp, 'data.version', null)
      if (page) {
        this.cache.push(page)
        return page
      } else {
        return { content: '' }
      }
    },
    viewSource (versionId) {
      window.location.assign(`/s/${this.sitePath}/${this.locale}/${this.path}?v=${versionId}`)
    },
    download (versionId) {
      window.location.assign(`/d/${this.sitePath}/${this.locale}/${this.path}?v=${versionId}`)
    },
    restore (versionId, versionDate) {
      this.restoreTarget = {
        versionId,
        versionDate
      }
      this.isRestoreConfirmDialogShown = true
    },
    async restoreConfirm () {
      this.restoreLoading = true
      this.$store.commit(`loadingStart`, 'history-restore')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($pageId: Int!, $versionId: Int!) {
              pages {
                restore (pageId: $pageId, versionId: $versionId) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            versionId: this.restoreTarget.versionId,
            pageId: this.pageId
          }
        })
        if (_.get(resp, 'data.pages.restore.responseResult.succeeded', false) === true) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('history:restore.success'),
            icon: 'check'
          })
          this.isRestoreConfirmDialogShown = false
          setTimeout(() => {
            window.location.assign(`/${this.sitePath}/${this.locale}/${this.path}`)
          }, 1000)
        } else {
          throw new Error(_.get(resp, 'data.pages.restore.responseResult.message', 'An unexpected error occurred'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.$store.commit(`loadingStop`, 'history-restore')
      this.restoreLoading = false
    },
    branchOff (versionId) {
      const pathParts = this.path.split('/')
      this.branchOffOpts = {
        versionId: versionId,
        locale: this.locale,
        path: (pathParts.length > 1) ? _.initial(pathParts).join('/') + `/new-page` : `new-page`,
        modal: true
      }
    },
    branchOffHandle ({ locale, path }) {
      window.location.assign(`/e/${this.sitePath}/${locale}/${path}?from=${this.pageId},${this.branchOffOpts.versionId}`)
    },
    toggleViewMode () {
      this.viewMode = (this.viewMode === 'line-by-line') ? 'side-by-side' : 'line-by-line'
    },
    goLive () {
      window.location.assign(`/${this.sitePath}/${this.path}`)
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
          offsetSize: this.$vuetify.breakpoint.mdAndUp ? 25 : 5
        }
      })
    },
    trailColor (actionType) {
      if (actionType === 'edit') {
        return this.$vuetify.theme.dark ? colors.neutral[600] : colors.neutral[200]
      }
      if (actionType === 'move') {
        return this.$vuetify.theme.dark ? colors.red[800] : colors.red[400]
      }
      if (actionType === 'initial') {
        return this.$vuetify.theme.dark ? colors.sapphire[500] : colors.blue[300]
      }
      if (actionType === 'live') {
        return this.$vuetify.theme.dark ? colors.surfaceDark.noticeLite : colors.surfaceLight.noticeLite
      }
      return this.$vuetify.theme.dark ? colors.blue[800] : colors.blue[300]
    },

    trailIcon (actionType) {
      if (actionType === 'edit') {
        return '' // No icon for edit
      }
      if (actionType === 'move') {
        return 'mdi-forward'
      }
      if (actionType === 'initial') {
        return 'mdi-plus'
      }
      if (actionType === 'live') {
        return 'mdi-atom-variant'
      }
      return 'mdi-alert'
    },

    trailBgColor (actionType) {
      if (actionType === 'move') {
        return this.$vuetify.theme.dark ? colors.red[800] : colors.red[200]
      }
      if (actionType === 'initial') {
        return this.$vuetify.theme.dark ? colors.sapphire[500] : colors.blue[200]
      }
      if (actionType === 'live') {
        return this.$vuetify.theme.dark ? colors.surfaceDark.noticeLite : colors.surfaceLight.noticeHeavy
      }
      return this.$vuetify.theme.dark ? colors.neutral[550] : colors.neutral[100]
    },

    trailTextColor (actionType) {
      if (actionType === 'live') {
        return colors.textLight.primary
      }
      return this.$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary
    },

    isDiffSourceDisabled(sourceId) {
      return (sourceId >= this.diffTarget && this.diffTarget !== 0) || sourceId === 0
    },
    isDiffTargetDisabled(targetId) {
      return targetId <= this.diffSource && targetId !== 0
    },
    getDiffSelectorStyle(versionId, diffReference, isDisabled) {
      let diffBackgroundColor
      if (diffReference === versionId) {
        diffBackgroundColor = this.$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy
      } else {
        diffBackgroundColor = this.$vuetify.theme.dark ? colors.surfaceDark.noticeLite : colors.surfaceLight.noticeHeavy
      } 
      let diffColor
      if (diffReference === versionId) {
        diffColor = colors.surfaceLight.primaryNeutralLite
      } else if (isDisabled) {
        diffColor = colors.textLight.disabled
        diffBackgroundColor = this.$vuetify.theme.dark ? colors.neutral[700] : colors.neutral[150]
      } else {
        diffColor = colors.textLight.primary
      }
      return {
        'background-color': diffBackgroundColor,
        'color': diffColor
      }
    }
  },
  apollo: {
    trail: {
      query: gql`
        query($id: Int!, $offsetPage: Int, $offsetSize: Int) {
            history(id:$id, offsetPage:$offsetPage, offsetSize:$offsetSize) {
              trail {
                versionId
                authorId
                authorName
                actionType
                valueBefore
                valueAfter
                versionDate
              }
              total
            }
        }
      `,
      variables () {
        return {
          id: this.pageId,
          offsetPage: 0,
          offsetSize: this.$vuetify.breakpoint.mdAndUp ? 25 : 5
        }
      },
      manual: true,
      result ({ data, loading, networkStatus }) {
        this.total = data.history.total
        this.trail = data.history.trail
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'history-trail-refresh')
      }
    }
  }
}
</script>

<style lang='scss' scoped>
.v-chip--label {
  border-radius: 12px !important;

  &.centered {
    margin-left: 38px !important;
  }
}

::v-deep .v-timeline-item__body {
  margin-right: 16px !important;
}

.layout.row.wrap > .flex.xs12.md4{
  max-height: calc(100vh - 256px);
  overflow-y: auto;
  padding-left: 0px;
}

.v-timeline.v-timeline--dense.centered {
  margin-left: 14px;
}

.v-card__text {
  max-height: calc(100vh - 224px);

  .v-card.v-card--flat.v-sheet {
    max-height: calc(100vh - 360px);
    overflow: auto;
  }
}

// #return-btn styling now uses global .hover-btn and .text-primary classes

#load-more-btn {
  width: calc(100% - 24px);
}

.v-btn.rounded-button {
  border-radius: 20px;
}
</style>

// Global styling
<style lang='scss'>
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

// Light theme ins/del colors
.theme--light {
  ins {
    background-color: mc('green', '300') !important;
  }

  del {
    background-color: mc('red', '100') !important;
  }
}

// Dark theme ins/del colors - darker and more visible
.theme--dark {
  ins {
    background-color: mc('green', '700') !important;
    color: mc('green', '50') !important;
  }

  del {
    background-color: mc('red', '600') !important;
    color: mc('red', '50') !important;
  }
}

.history {
  &-promptmenu {
    border-top: 5px solid mc('blue', '700');
  }

  .d2h-file-header {
    display: none;
  }

  // Light theme - complete styling
  &.theme--light {
    .d2h-file-wrapper {
      border: 1px solid #EEE;
      border-left: none;
      background-color: #ffffff;
    }

    .d2h-code-line-added {
      background-color: rgba(mc('green', '200'), 0.9) !important;

      .d2h-code-line-ctn {
        background-color: rgba(mc('green', '200'), 0.9) !important;
      }
    }

    .d2h-addition {
      background-color: rgba(mc('green', '200'), 0.7) !important;
    }

    .d2h-ins {
      background-color: rgba(mc('green', '200'), 1.0) !important;
    }

    .d2h-code-line-removed {
      background-color: rgba(mc('red', '50'), 0.6) !important;

      .d2h-code-line-ctn {
        background-color: rgba(mc('red', '50'), 0.6) !important;
      }
    }

    .d2h-deletion {
      background-color: rgba(mc('red', '50'), 0.4) !important;
    }

    .d2h-del {
      background-color: rgba(mc('red', '100'), 0.7) !important;
    }
  }

  // Dark theme - complete styling
  &.theme--dark {
    .d2h-file-wrapper {
      border: 1px solid mc('neutral', '600');
      border-left: none;
      background-color: mc('neutral', '750') !important;
      color: mc('text-dark', 'primary') !important;
    }

    // Override all diff2html backgrounds and text colors for dark theme
    .d2h-code-wrapper,
    .d2h-code-line,
    .d2h-line-number,
    .d2h-code-linenumber,
    .d2h-info,
    tbody tr,
    tbody td {
      color: mc('text-dark', 'primary') !important;
      background-color: mc('neutral', '750') !important;
    }

    // Context lines only (not added/removed)
    .d2h-context .d2h-code-line-ctn {
      color: mc('text-dark', 'primary') !important;
      background-color: mc('neutral', '750') !important;
    }

    // Line numbers on the left side
    .d2h-code-linenumber {
      background-color: mc('neutral', '700') !important;
      color: mc('text-dark', 'secondary') !important;
      border-right: 1px solid mc('neutral', '600') !important;
    }

    // Table structure
    .d2h-diff-table {
      background-color: mc('neutral', '750') !important;
    }

    .d2h-code-line-added {
      background-color: rgba(mc('green', '600'), 0.3) !important;
      color: mc('green', '100') !important;

      .d2h-code-line-ctn {
        background-color: rgba(mc('green', '600'), 0.3) !important;
        color: mc('green', '100') !important;
      }
    }

    .d2h-addition {
      background-color: rgba(mc('green', '600'), 0.2) !important;
      color: mc('green', '100') !important;
    }

    .d2h-ins {
      background-color: rgba(mc('green', '500'), 0.4) !important;
      color: mc('green', '50') !important;
    }

    .d2h-code-line-removed {
      background-color: rgba(mc('red', '500'), 0.4) !important;
      color: mc('red', '100') !important;

      .d2h-code-line-ctn {
        background-color: rgba(mc('red', '500'), 0.4) !important;
        color: mc('red', '100') !important;
      }
    }

    .d2h-deletion {
      background-color: rgba(mc('red', '500'), 0.3) !important;
      color: mc('red', '100') !important;
    }

    .d2h-del {
      background-color: rgba(mc('red', '400'), 0.7) !important;
      color: mc('red', '50') !important;
    }
  }

  // Make text in changed sections more readable
  .d2h-code-line-added, .d2h-code-line-removed {
    .d2h-code-line-ctn {
      color: currentColor !important;
    }
  }
}
</style>
