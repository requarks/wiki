<template lang="pug">
  v-app(v-scroll='upBtnScroll', :dark='$vuetify.theme.dark', :class='$vuetify.rtl ? `is-rtl` : `is-ltr`')
    nav-header
    v-navigation-drawer(
      v-if='navMode !== `NONE`'
      :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[2]'
      dark
      app
      clipped
      mobile-breakpoint='600'
      :temporary='$vuetify.breakpoint.smAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      //- scrollbar colors are set in 'scrollStyle'
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(
          :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]'
          :items='sidebarDecoded'
          :nav-mode='navMode'
          :dark ='$vuetify.theme.dark'
          )

    //- Menu button for mobile view
    v-fab-transition
      v-btn(
        fab
        :color='$vuetify.theme.dark ? colors.teal[1]: colors.primary[2]'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='$vuetify.breakpoint.mdAndDown'
        v-show='!navShown'
        )
        v-icon(color='white') mdi-menu

    v-main(ref='content')
      template(v-if='path !== `home`')
        //- breadcrumbs toolbar
        v-toolbar(
          v-if='$vuetify.breakpoint.smAndUp'
          dense
          flat
          :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[2]'
          )
          //- v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
          //-   v-icon(color='grey darken-2', left) menu
          //-   span Navigation
          v-breadcrumbs.breadcrumbs-nav.pl-0(
            :items='breadcrumbs'
            divider='/'
            )
            template(slot='item', slot-scope='props')
              v-icon.hover-icon(
                v-if='props.item.path === "/"',
                small,
                @click='goHome',
                :color='$vuetify.theme.dark ? `white` : colors.primary[1]') mdi-home
              v-btn.ma-0(v-else, :href='props.item.path', small, text) {{props.item.name}}
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text {{$t('common:page.unpublished')}}
            status-indicator.ml-3(negative, pulse)
        v-divider
      v-container.grey.pa-0(fluid, :class='$vuetify.theme.dark ? `darken-4-l3` : `lighten-4`')
        v-row.page-header-section(no-gutters, align-content='center', style='height: 90px;')
          v-col.page-col-content.is-page-header(
            :offset-xl='tocPosition === `left` ? 2 : 0'
            :offset-lg='tocPosition === `left` ? 3 : 0'
            :xl='tocPosition === `right` ? 10 : false'
            :lg='tocPosition === `right` ? 9 : false'
            style='margin-top: auto; margin-bottom: auto;'
            :class='$vuetify.rtl ? `pr-4` : `pl-4`'
            )
            .page-header-headings
              .headline.grey--text(:class='$vuetify.theme.dark ? `text--lighten-2` : `text--darken-3`') {{title}}
              .caption.grey--text.text--darken-1 {{description}}
              v-btn.mr-5.white--text(
                v-if='isAuthenticated && isFollower != null && !isFollower'
                @click='followPage'
                :color='$vuetify.theme.dark ? colors.peacock[4] : colors.primary[1]'
                ) Follow
              v-btn.mr-5.white--text(
                v-if='isAuthenticated && isFollower != null && isFollower'
                @click='unfollowPage'
                :color='$vuetify.theme.dark ? colors.peacock[4] : colors.primary[1]'
                ) Unfollow
            .page-edit-shortcuts(
              v-if='editShortcutsObj.editMenuBar'
              :class='tocPosition === `right` ? `is-right` : ``'
              )
              v-btn(
                v-if='editShortcutsObj.editMenuBtn'
                @click='pageEdit'
                depressed
                small
                )
                v-icon.mr-2.hover-icon(small) mdi-pencil
                span.text-none {{$t(`common:actions.edit`)}}
              v-btn(
                v-if='editShortcutsObj.editMenuExternalBtn'
                :href='editMenuExternalUrl'
                target='_blank'
                depressed
                small
                )
                v-icon.mr-2(small) {{ editShortcutsObj.editMenuExternalIcon }}
                span.text-none {{$t(`common:page.editExternal`, { name: editShortcutsObj.editMenuExternalName })}}
      v-divider
      v-container.pl-5.pt-4(fluid, grid-list-xl)
        v-layout(row)
          v-flex.page-col-sd(
            v-if='tocPosition !== `off` && $vuetify.breakpoint.lgAndUp'
            :order-xs1='tocPosition !== `right`'
            :order-xs2='tocPosition === `right`'
            lg3
            xl2
            )
            v-card.page-toc-card.mb-5(
              v-if='tocDecoded.length'
              :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]'
              )
              .overline.pa-5.pb-0.card-title(
                :class='$vuetify.theme.dark ? `dark` : ``'
                ) {{$t('common:page.toc')}}
              v-list.d-flex.flex-column.mb-0.pb-3.pl-1.pr-1(
                dense
                nav
                :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]'
                )
                TreeItem(
                  v-for='(tocItem, tocIdx) in tocDecoded'
                  :key='tocIdx'
                  :item='tocItem'
                  :open.sync='openStates[tocItem.id]'
                  :toggleOpenState='toggleOpenState'
                  :openStates='openStates'
                  :level='0' :uniqueId='tocItem.id'
                  :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]'
                  )

            v-card.page-tags-card.mb-5(
              v-if='tags.length > 0'
              :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]'
              )
              .pa-5
                .overline.pb-2.card-title(:class='$vuetify.theme.dark ? `dark` : ``') {{$t('common:page.tags')}}
                v-chip.mr-1.mb-1(
                  label
                  :color='$vuetify.theme.dark ? colors.sapphire[3] : colors.sapphire[1]'
                  v-for='(tag, idx) in tags'
                  :href='`/t/` + sitePath + `/` + tag.tag'
                  :key='`tag-` + tag.tag'
                  )
                  v-icon(:color='$vuetify.theme.dark ? colors.peacock[1] : colors.green[1]', left, small) mdi-tag
                  span(class='white--text') {{tag.title}}
                v-chip.mr-1.mb-1(
                  label
                  :color='$vuetify.theme.dark ? colors.sapphire[3] : colors.sapphire[1]'
                  :href='`/t/` + sitePath + `/` + tags.map(t => t.tag).join(`/`)'
                  :aria-label='$t(`common:page.tagsMatching`)'
                  )
                  v-icon(:color='$vuetify.theme.dark ? colors.peacock[1] : colors.green[1]', size='20') mdi-tag-multiple

            v-card.page-comments-card.mb-5(
              v-if='commentsEnabled && commentsPerms.read'
              :color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]'
              )
              .pa-5
                .overline.pb-2.d-flex.align-center
                  span.card-title(
                    :class='$vuetify.theme.dark ? `dark` : ``'
                    ) {{$t('common:comments.sdTitle')}}
                .d-flex
                  v-btn.text-none(
                    @click='goToComments()'
                    :color='$vuetify.theme.dark ? colors.peacock[3] : `blue-grey darken-2`'
                    outlined
                    style='flex: 1 1 100%;'
                    small
                    )
                    span#view-discussion(
                      :class='$vuetify.theme.dark ? `dark` : ``'
                      ) {{$t('common:comments.viewDiscussion')}}
                  v-tooltip(right, v-if='commentsPerms.write')
                    template(v-slot:activator='{ on }')
                      v-btn.ml-2(
                        @click='goToComments(true)'
                        v-on='on'
                        outlined
                        small
                        :color='$vuetify.theme.dark ? colors.peacock[3] : `blue-grey darken-2`'
                        :aria-label='$t(`common:comments.newComment`)'
                        )
                        v-icon(:color='$vuetify.theme.dark ? colors.peacock[2] : `blue-grey darken-2`', dense) mdi-comment-plus
                    span {{$t('common:comments.newComment')}}

            v-card.page-author-card.mb-5(:color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]')
              .pa-5
                .overline.d-flex
                  span.card-title(
                    :class='$vuetify.theme.dark ? `dark` : ``'
                    ) {{$t('common:page.lastEditedBy')}}
                  v-spacer
                  v-tooltip(right, v-if='isAuthenticated')
                    template(v-slot:activator='{ on }')
                      v-btn.btn-animate-edit(
                        icon
                        :href='"/h/" + sitePath + "/" + locale + "/" + path'
                        v-on='on'
                        x-small
                        v-if='hasReadHistoryPermission'
                        :aria-label='$t(`common:header.history`)'
                        )
                        v-icon(:color='$vuetify.theme.dark ? colors.teal[1] : colors.sapphire[3]', dense) mdi-history
                    span {{$t('common:header.history')}}
                .page-author-card-name.body-2.grey--text(:class='$vuetify.theme.dark ? `` : `text--darken-3`') {{ authorName }}
                .page-author-card-date.caption.grey--text.text--darken-1 {{ updatedAt | moment('calendar') }}

            v-card.page-shortcuts-card(flat)
              v-toolbar(:color='$vuetify.theme.dark ? colors.primary[4] : colors.surface[1]', flat, dense)
                v-spacer
                //- v-tooltip(bottom)
                //-   template(v-slot:activator='{ on }')
                //-     v-btn(icon, tile, v-on='on', :aria-label='$t(`common:page.bookmark`)'): v-icon(color='grey') mdi-bookmark
                //-   span {{$t('common:page.bookmark')}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn.hover-icon(icon, tile, v-on='on', @click='print', :aria-label='$t(`common:page.printFormat`)')
                      v-icon(color='grey') mdi-printer
                  span {{messages.printToPdf}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn.hover-icon(icon, tile, v-on='on', @click='exportWord', :aria-label='$t(`common:page.exportWord`)')
                      v-icon(color='grey') mdi-file-word-box
                  span {{messages.exportToWord}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn.hover-icon(icon, tile, v-on='on', @click='exportPdf', :aria-label='$t(`common:page.exportPdf`)')
                      v-icon(color='grey') mdi-file-pdf-box
                  span {{messages.exportToPdf}}
                v-spacer

          //- Edit Page & Page Actions (floating button)
          v-flex.page-col-content(
            xs12
            :lg9='tocPosition !== `off`'
            :xl10='tocPosition !== `off`'
            :order-xs1='tocPosition === `right`'
            :order-xs2='tocPosition !== `right`'
            )
            v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasAnyPagePermissions && editShortcutsObj.editFab')
              template(v-slot:activator='{ on: onEditActivator }')
                v-speed-dial(
                  v-model='pageEditFab'
                  direction='top'
                  open-on-hover
                  transition='scale-transition'
                  bottom
                  :right='!$vuetify.rtl'
                  :left='$vuetify.rtl'
                  fixed
                  dark
                  )
                  template(v-slot:activator)
                    v-btn.btn-animate-edit(
                      fab
                      :color='$vuetify.theme.dark ? colors.peacock[4] : colors.primary[1]'
                      v-model='pageEditFab'
                      @click='pageEdit'
                      v-on='onEditActivator'
                      :disabled='!hasWritePagesPermission'
                      :aria-label='$t(`common:page.editPage`)'
                      )
                      v-icon(color='white') mdi-pencil
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasReadHistoryPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        :color='$vuetify.theme.dark ? colors.text.darkPurple : `white`'
                        light
                        v-on='on'
                        @click='pageHistory'
                        )
                        v-icon(
                          size='20'
                          :color='$vuetify.theme.dark ? colors.teal[1] : colors.teal[4]'
                          ) mdi-history
                    span {{$t('common:header.history')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasReadSourcePermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        :color='$vuetify.theme.dark ? colors.text.darkPurple : `white`'
                        light
                        v-on='on'
                        @click='pageSource'
                        )
                        v-icon(
                          size='20'
                          :color='$vuetify.theme.dark ? colors.teal[1] : colors.teal[4]'
                          ) mdi-code-tags
                    span {{$t('common:header.viewSource')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasWritePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        :color='$vuetify.theme.dark ? colors.text.darkPurple : `white`'
                        light
                        v-on='on'
                        @click='pageConvert'
                        )
                        v-icon(
                          size='20'
                          :color='$vuetify.theme.dark ? colors.teal[1] : colors.teal[4]'
                          ) mdi-lightning-bolt
                    span {{$t('common:header.convert')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasWritePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        :color='$vuetify.theme.dark ? colors.text.darkPurple : `white`'
                        light
                        v-on='on'
                        @click='pageDuplicate'
                        )
                        v-icon(
                          size='20'
                          :color='$vuetify.theme.dark ? colors.teal[1] : colors.teal[4]'
                          ) mdi-content-duplicate
                    span {{$t('common:header.duplicate')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasManagePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        :color='$vuetify.theme.dark ? colors.text.darkPurple : `white`'
                        light
                        v-on='on'
                        @click='pageMove'
                        )
                        v-icon(
                          size='20'
                          :color='$vuetify.theme.dark ? colors.teal[1] : colors.teal[4]'
                          ) mdi-content-save-move-outline
                    span {{$t('common:header.move')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasDeletePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        dark
                        small
                        :color='$vuetify.theme.dark ? colors.text.darkPurple : `white`'
                        v-on='on'
                        @click='pageDelete'
                        )
                        v-icon(
                          size='20'
                          :color='colors.red[5]'
                          ) mdi-trash-can-outline
                    span {{$t('common:header.delete')}}
              span {{$t('common:page.editPage')}}
            v-alert.mb-5(v-if='!isPublished', color='red', outlined, icon='mdi-minus-circle', dense)
              .caption {{$t('common:page.unpublishedWarning')}}
            .contents(ref='container')
              slot(name='contents')
            .comments-container#discussion(v-if='commentsEnabled && commentsPerms.read')
              .comments-header
                v-icon.mr-2(dark) mdi-comment-text-outline
                span {{$t('common:comments.title')}}
              .comments-main
                slot(name='comments')
    loader(v-model='isLoading', :title='messages.exporting')
    nav-footer
    notify
    search-results
    v-fab-transition
      v-btn(
        v-if='upBtnShown'
        fab
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        :depressed='this.$vuetify.breakpoint.mdAndUp'
        @click='$vuetify.goTo(0, scrollOpts)'
        :color='$vuetify.theme.dark ? colors.peacock[4] : colors.primary[1]'
        dark
        :style='upBtnPosition'
        :aria-label='$t(`common:actions.returnToTop`)'
        )
        v-icon mdi-arrow-up
    v-dialog(
      v-model='isExportModalVisible'
      max-width='750'
      persistent
      overlay-color='blue darken-4'
      overlay-opacity='.7'
    )
      v-card
        .dialog-header.is-short.is-blue
          v-icon.mr-2(
            v-if='exportFileType === `docx`'
            color='white'
            ) mdi-file-word-box
          v-icon.mr-2(
            v-else-if='exportFileType === `pdf`'
            color='white'
            ) mdi-file-pdf-box
          span(v-if='exportFileType === `docx`') {{ messages.exportToWord }}
          span(v-else-if='exportFileType === `pdf`') {{ messages.exportToPdf }}
        v-card-text.pt-5
          span {{ messages.exportModalSubtitle }}
        v-card-chin
          v-spacer
          v-btn(
            text
            @click='isExportModalVisible = false'
            ) {{ messages.cancel }}
          v-btn.px-4(
            v-if='exportFileType === `docx`'
            color='primary'
            @click='exportSinglePageToWord()'
            ) {{ messages.exportSinglePage }}
          v-btn.px-4(
            v-else-if='exportFileType === `pdf`'
            color='primary'
            @click='exportSinglePageToPdf()'
            ) {{ messages.exportSinglePage }}
          v-btn.px-4(
            v-if='exportFileType === `docx`'
            color='primary'
            @click='exportPageTreeToWord()'
            ) {{ messages.exportPageTree }}
          v-btn.px-4(
            v-else-if='exportFileType === `pdf`'
            color='primary'
            @click='exportPageTreeToPdf()'
            ) {{ messages.exportPageTree }}
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import Tabset from './tabset.vue'
import NavSidebar from './nav-sidebar.vue'
import Prism from 'prismjs'
import mermaid from 'mermaid'
import { get } from 'vuex-pathify'
import _ from 'lodash'
import ClipboardJS from 'clipboard'
import { v4 as uuidv4 } from 'uuid'
import Vue from 'vue'
import TreeItem from './tree-item.vue'
import { messages } from '@/messages'
import createFollowerMutation from 'gql/followers/create-follower.gql'
import deleteFollowerMutation from 'gql/followers/delete-follower.gql'
import isFollowingResponse from 'gql/followers/is-following.gql'
import colors from '@/themes/default/js/extended-color-scheme'

Vue.component('Tabset', Tabset)

Prism.plugins.autoloader.languages_path = '/_assets/js/prism/'
Prism.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true,
  'remove-initial-line-feed': true,
  'tabs-to-spaces': 2
})
Prism.plugins.toolbar.registerButton('copy-to-clipboard', (env) => {
  let linkCopy = document.createElement('button')
  linkCopy.textContent = 'Copy'

  const clip = new ClipboardJS(linkCopy, {
    text: () => { return env.code }
  })

  clip.on('success', () => {
    linkCopy.textContent = 'Copied!'
    resetClipboardText()
  })
  clip.on('error', () => {
    linkCopy.textContent = 'Press Ctrl+C to copy'
    resetClipboardText()
  })

  return linkCopy

  function resetClipboardText() {
    setTimeout(() => {
      linkCopy.textContent = 'Copy'
    }, 5000)
  }
})

export default {
  components: {
    NavSidebar,
    StatusIndicator,
    TreeItem
  },
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
    editor: {
      type: String,
      default: ''
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    toc: {
      type: String,
      default: ''
    },
    sidebar: {
      type: String,
      default: ''
    },
    navMode: {
      type: String,
      default: 'MIXED'
    },
    commentsEnabled: {
      type: Boolean,
      default: false
    },
    effectivePermissions: {
      type: String,
      default: ''
    },
    commentsExternal: {
      type: Boolean,
      default: false
    },
    editShortcuts: {
      type: String,
      default: ''
    },
    filename: {
      type: String,
      default: ''
    },
    siteId: {
      type: String,
      default: ''
    },
    siteName: {
      type: String,
      default: ''
    },
    sitePath: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      messages: messages,
      openStates: {},
      navShown: false,
      navExpanded: false,
      upBtnShown: false,
      pageEditFab: false,
      isFollowing: null,
      scrollOpts: {
        duration: 1500,
        offset: 0,
        easing: 'easeInOutCubic'
      },
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01, // fix scrollbar not disappearing on load
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: colors.surface[3],
          hoverStyle: {
            background: '#64B5F6' // where/when is this used?
          }
        }
      },
      winWidth: 0,
      isLoading: false,
      colors: colors,
      isExportModalVisible: false,
      wordDocumentType: 'docx',
      pdfDocumentType: 'pdf',
      exportFileType: ''
    }
  },
  computed: {
    isAuthenticated: get('user/authenticated'),
    commentsCount: get('page/commentsCount'),
    commentsPerms: get('page/effectivePermissions@comments'),
    editShortcutsObj: get('page/editShortcuts'),
    rating: {
      get () {
        return 3.5
      },
      set (val) {

      }
    },
    isFollower() {
      return this.isFollowing
    },
    breadcrumbs() {
      return [{ path: '/', name: 'Home' }].concat(_.reduce(this.path.split('/'), (result, value, key) => {
        result.push({
          path: _.get(_.last(result), 'path', `/${this.sitePath}/${this.locale}`) + `/${value}`,
          name: value
        })
        return result
      }, []))
    },
    pageUrl () { return window.location.href },
    upBtnPosition () {
      if (this.$vuetify.breakpoint.mdAndUp) {
        return this.$vuetify.rtl ? `right: 235px;` : `left: 235px;`
      } else {
        return this.$vuetify.rtl ? `right: 65px;` : `left: 65px;`
      }
    },
    sidebarDecoded () {
      return JSON.parse(Buffer.from(this.sidebar, 'base64').toString())
    },
    tocDecoded () {
      const toc = JSON.parse(Buffer.from(this.toc, 'base64').toString())
      const addUniqueId = (items) => {
        items.forEach(item => {
          item.id = uuidv4()
          if (item.children && item.children.length > 0) {
            addUniqueId(item.children)
          }
        })
      }
      addUniqueId(toc)
      return toc
    },
    tocPosition: get('site/tocPosition'),
    hasAdminPermission: get('page/effectivePermissions@system.manage') || get('page/effectivePermissions@sites.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      return this.hasAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    },
    editMenuExternalUrl () {
      if (this.editShortcutsObj.editMenuBar && this.editShortcutsObj.editMenuExternalBtn) {
        return this.editShortcutsObj.editMenuExternalUrl.replace('{filename}', this.filename)
      } else {
        return ''
      }
    }
  },
  watch: {
    tocDecoded: {
      immediate: true,
      handler(newVal) {
        const initializeOpenStates = (items) => {
          items.forEach(item => {
            this.$set(this.openStates, item.id, true)
            if (item.children && item.children.length > 0) {
              initializeOpenStates(item.children)
            }
          })
        }
        initializeOpenStates(newVal)
      }
    }
  },
  created() {
    this.$store.set('page/authorId', this.authorId)
    this.$store.set('page/authorName', this.authorName)
    this.$store.set('page/createdAt', this.createdAt)
    this.$store.set('page/description', this.description)
    this.$store.set('page/isPublished', this.isPublished)
    this.$store.set('page/id', this.pageId)
    this.$store.set('page/locale', this.locale)
    this.$store.set('page/path', this.path)
    this.$store.set('page/tags', this.tags)
    this.$store.set('page/title', this.title)
    this.$store.set('page/editor', this.editor)
    this.$store.set('page/updatedAt', this.updatedAt)
    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
    if (this.editShortcuts) {
      this.$store.set('page/editShortcuts', JSON.parse(Buffer.from(this.editShortcuts, 'base64').toString()))
    }

    // Ensure userId is set before calling checkIfFollowing
    if (this.$store.state.user && this.$store.state.user.id) {
      this.userId = this.$store.state.user.id
      this.checkIfFollowing()
    } else {
      console.error('User is not defined or user ID is missing')
    }

    this.$store.set('page/siteId', this.siteId)
    this.$store.set('page/siteName', this.siteName)
    this.$store.set('page/sitePath', this.sitePath)

    this.$store.set('page/mode', 'view')
  },
  mounted () {
    if (this.$vuetify.theme.dark) {
      this.scrollStyle.bar.background = '#FFFFFF'
    } else {
      this.scrollStyle.bar.background = colors.text.darkGrey
    }

    // -> Check side navigation visibility
    this.handleSideNavVisibility()
    window.addEventListener('resize', _.debounce(() => {
      this.handleSideNavVisibility()
    }, 500))

    // -> Highlight Code Blocks
    Prism.highlightAllUnder(this.$refs.container)

    // -> Render Mermaid diagrams
    mermaid.mermaidAPI.initialize({
      startOnLoad: true,
      theme: this.$vuetify.theme.dark ? `dark` : `default`
    })

    // -> Handle anchor scrolling
    if (window.location.hash && window.location.hash.length > 1) {
      if (document.readyState === 'complete') {
        this.$nextTick(() => {
          this.$vuetify.goTo(decodeURIComponent(window.location.hash), this.scrollOpts)
        })
      } else {
        window.addEventListener('load', () => {
          this.$vuetify.goTo(decodeURIComponent(window.location.hash), this.scrollOpts)
        })
      }
    }

    // -> Handle anchor links within the page contents
    this.$nextTick(() => {
      this.$refs.container.querySelectorAll(`a[href^="#"], a[href^="${window.location.href.replace(window.location.hash, '')}#"]`).forEach(el => {
        el.onclick = ev => {
          ev.preventDefault()
          ev.stopPropagation()
          this.$vuetify.goTo(decodeURIComponent(ev.currentTarget.hash), this.scrollOpts)
        }
      })

      window.boot.notify('page-ready')
    })
  },
  methods: {
    async checkIfFollowing() {
      try {
        const response = await this.$apollo.query({
          query: isFollowingResponse,
          variables: {
            siteId: this.siteId,
            pageId: this.pageId
          }
        })
        this.isFollowing = response.data.isFollowing.isFollowing
      } catch (error) {
        console.error('Error checking if following:', error)
      }
    },
    async followPage() {
      try {
        const response = await this.$apollo.mutate({
          mutation: createFollowerMutation,
          variables: {
            siteId: this.siteId,
            pageId: this.pageId
          }
        })
        if (response.data.createFollower.operation.succeeded) {
          this.isFollowing = true
          this.$store.commit('showNotification', {
            style: 'green',
            message: 'Successfully followed the page.',
            icon: 'check_circle'
          })
        } else {
          console.error('Error following page:', response.data.createFollower.operation.message)
          this.$store.commit('showNotification', {
            style: 'red',
            message: 'An error occurred while trying to follow the page.',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('Error following page:', error)
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'An error occurred while trying to follow the page.',
          icon: 'error'
        })
      }
    },
    async unfollowPage() {
      try {
        const response = await this.$apollo.mutate({
          mutation: deleteFollowerMutation,
          variables: {
            siteId: this.siteId,
            pageId: this.pageId
          }
        })
        if (response.data.deleteFollower.responseResult.succeeded) {
          this.isFollowing = false
          this.$store.commit('showNotification', {
            style: 'green',
            message: 'Successfully unfollowed the page.',
            icon: 'check_circle'
          })
        } else {
          console.error('Error unfollowing page:', response.data.deleteFollower.message)
          this.$store.commit('showNotification', {
            style: 'red',
            message: 'An error occurred while trying to unfollow the page.',
            icon: 'error'
          })
        }
      } catch (error) {
        console.error('Error unfollowing page:', error)
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'An error occurred while trying to unfollow the page.',
          icon: 'error'
        })
      }
    },
    toggleOpenState(id) {
      this.$set(this.openStates, id, !this.openStates[id])
    },
    goHome () {
      window.location.assign(`/${this.sitePath}`)
    },
    toggleNavigation () {
      this.navOpen = !this.navOpen
    },
    upBtnScroll () {
      const scrollOffset = window.pageYOffset || document.documentElement.scrollTop
      this.upBtnShown = scrollOffset > window.innerHeight * 0.33
    },
    print () {
      this.$nextTick(() => {
        window.print()
      })
    },
    async exportPdf () {
      this.exportFileType = 'pdf'
      if (this.$store.get('page/hasChildren')) {
        this.isExportModalVisible = true
      } else {
        await this.exportSinglePageToPdf()
      }
    },
    async exportWord () {
      this.exportFileType = 'docx'
      if (this.$store.get('page/hasChildren')) {
        this.isExportModalVisible = true
      } else {
        await this.exportSinglePageToWord()
      }
    },
    async exportPageTreeToWord () {
      this.exportToDocument(this.wordDocumentType, `path=${this.path}&locale=${this.locale}&sitePath=${this.sitePath}&isPageTreeExport=true`)
    },
    async exportSinglePageToWord () {
      this.exportToDocument(this.wordDocumentType, `path=${this.path}&locale=${this.locale}&sitePath=${this.sitePath}`)
    },
    async exportPageTreeToPdf () {
      this.exportToDocument(this.pdfDocumentType, `path=${this.path}&locale=${this.locale}&sitePath=${this.sitePath}&isPageTreeExport=true`)
    },
    async exportSinglePageToPdf () {
      this.exportToDocument(this.pdfDocumentType, `path=${this.path}&locale=${this.locale}&sitePath=${this.sitePath}`)
    },
    async exportToDocument(fileType, queryParams) {
      this.isExportModalVisible = false
      this.isLoading = true
      const response = await fetch(`/export/${fileType}/${this.siteId}/${this.pageId}?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      this.isLoading = false

      if (response.status === 200) {
        const blob = await response.blob()
        const header = window.document.getElementsByClassName(
          'row page-header-section no-gutters align-content-center'
        )[0]
        const title = header.getElementsByClassName('headline')[0].textContent

        // Download the file
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = title.replaceAll(' ', '_') + '.' + fileType
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        const message = fileType === 'pdf' ? 'Error exporting to PDF' : 'Error exporting to Word'
        this.$store.commit('showNotification', {
          message: message,
          style: 'error',
          icon: 'alert'
        })
      }
    },
    pageEdit () {
      this.$root.$emit('pageEdit')
    },
    pageHistory () {
      this.$root.$emit('pageHistory')
    },
    pageSource () {
      this.$root.$emit('pageSource')
    },
    pageConvert () {
      this.$root.$emit('pageConvert')
    },
    pageDuplicate () {
      this.$root.$emit('pageDuplicate')
    },
    pageMove () {
      this.$root.$emit('pageMove')
    },
    pageDelete () {
      this.$root.$emit('pageDelete')
    },
    handleSideNavVisibility () {
      if (window.innerWidth === this.winWidth) { return }
      this.winWidth = window.innerWidth
      if (this.$vuetify.breakpoint.mdAndUp) {
        this.navShown = true
      } else {
        this.navShown = false
      }
    },
    goToComments (focusNewComment = false) {
      this.$vuetify.goTo('#discussion', this.scrollOpts)
      if (focusNewComment) {
        document.querySelector('#discussion-new').focus()
      }
    }
  }
}
</script>

<style lang="scss">

.breadcrumbs-nav {
  .v-btn {
    min-width: 0;
    &__content {
      text-transform: none;
    }
  }
  .v-breadcrumbs__divider:nth-child(2n) {
    padding: 0 6px;
  }
  .v-breadcrumbs__divider:nth-child(2) {
    padding: 0 6px 0 12px;
  }
}

.page-col-sd {
  margin-top: -90px;
  align-self: flex-start;
  position: sticky;
  top: 64px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  -ms-overflow-style: none;
}

.page-col-sd::-webkit-scrollbar {
  display: none;
}

.page-header-section {
  position: relative;

  > .is-page-header {
    position: relative;
  }

  .page-header-headings {
    min-height: 52px;
    display: flex;
    justify-content: space-between;
    flex-direction: row;
  }

  .page-edit-shortcuts {
    position: absolute;
    bottom: -33px;
    right: 10px;

    .v-btn {
      border-right: 1px solid #DDD !important;
      border-bottom: 1px solid #DDD !important;
      border-radius: 0;
      color: #777;
      background-color: #FFF !important;

      @at-root .theme--dark & {
        background-color: #222 !important;
        border-right-color: #444 !important;
        border-bottom-color: #444 !important;
        color: #CCC;
      }

      .v-icon {
        color: mc('primary', '1');
      }

      &:first-child {
        border-top-left-radius: 5px;
        border-bottom-left-radius: 5px;
      }

      &:last-child {
        border-top-right-radius: 5px;
        border-bottom-right-radius: 5px;
      }
    }
  }
}

#view-discussion {
  color: rgba(mc("ext-sapphire", "5"), .75);

  &.dark {
    color: mc("ext-peacock", "2");
  }
}

.card-title {
  color: mc("ext-peacock", "4");

  &.dark {
    color: mc("ext-peacock", "1");
  }
}

.hover-icon {
  &:hover > .v-btn__content > .v-icon {
    color: mc("primary", "1") !important;
  }

  &.theme--dark {
    &:hover > .v-btn__content > .v-icon {
      color: mc("ext-teal", "1") !important;
    }
  }
}

</style>
