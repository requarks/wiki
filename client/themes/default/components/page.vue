<template lang="pug">
  v-app.page-bg(v-scroll='upBtnScroll', :dark='$vuetify.theme.dark', :class='$vuetify.rtl ? `is-rtl` : `is-ltr`')
    nav-header
    v-navigation-drawer(
      v-if='navMode !== `NONE`'
      :color='$vuetify.theme.dark ? colors.surfaceDark.black : colors.surfaceLight.white'
      :style='"border-right: 1px solid " + ($vuetify.theme.dark ? colors.borderDark.primary : colors.borderLight.primary)'
      :width='sidebarWidth'
      :class='{ resizing: isResizing }'
      :dark='$vuetify.theme.dark'
      app
      clipped
      mobile-breakpoint='600'
      :temporary='$vuetify.breakpoint.smAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      //- Resize handle
      .sidebar-resize-handle(
        v-if='!$vuetify.breakpoint.smAndDown'
        :class='$vuetify.rtl ? "resize-handle-left" : "resize-handle-right"'
        @mousedown='startResize'
        @dblclick='resetSidebarWidth'
      )

      //- scrollbar colors are set in 'scrollStyle'
      vue-scroll.sidebar-scroll-container(:ops='scrollStyle')
        nav-sidebar(
          :color='$vuetify.theme.dark ? colors.surfaceDark.primaryBlueLite : colors.neutral[50]'
          :items='sidebarDecoded'
          :nav-mode='navMode'
          :dark ='$vuetify.theme.dark'
          )
    //- Menu button for mobile view
    v-fab-transition(v-if='navMode !== `NONE`')
      v-btn(
        fab
        :color='$vuetify.theme.dark ? colors.actionDark.focusOnLite : colors.actionLight.focusOnLite'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='$vuetify.breakpoint.mdAndDown'
        v-show='!navShown'
        )
        v-icon(:color='$vuetify.theme.dark ? colors.actionLight.primaryDefaultOnLite : colors.actionLight.primaryDefaultOnHeavy') mdi-menu

    v-main(ref='content')
      notification-banner
      template(v-if='path !== `home`')
        //- breadcrumbs toolbar
        v-toolbar(
          v-if='$vuetify.breakpoint.smAndUp'
          dense
          flat
          :color='$vuetify.theme.dark ? colors.surfaceDark.black : colors.surfaceLight.white'
          )
          v-breadcrumbs.breadcrumbs-nav.pl-0(
            :items='breadcrumbs'
            divider='/'
            )
            template(slot='item', slot-scope='props')
              v-icon.hover-icon(
                v-if='props.item.path === "/"',
                small,
                @click='goHome',
                :color='$vuetify.theme.dark ? colors.surfaceDark.tertiaryBlueLite : colors.actionLight.active') mdi-home
              v-btn.ma-0.text-none(
                v-else
                :href='props.item.path'
                small
                text
                rounded
                ) {{props.item.name}}
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text {{$t('common:page.unpublished')}}
            status-indicator.ml-3(negative, pulse)
        v-divider

      //- Page header
      v-container.pa-0.page-header-container(fluid, :class='$vuetify.theme.dark ? `dark-theme` : ``')
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
              .headline {{title}}
              .caption.grey--text.text--darken-1 {{description}}
              v-btn.mr-5.hover-btn.text-primary.text-none(
                v-if='isAuthenticated && isFollower != null && !isFollower'
                @click='followPage'
                :color='colors.actionLight.highlightOnLite'
                rounded
                data-tour='follow-page'
                ) Follow
              v-btn.mr-5.hover-btn.text-primary.text-none(
                v-if='isAuthenticated && isFollower != null && isFollower'
                @click='unfollowPage'
                :color='colors.actionLight.highlightOnLite'
                rounded
                data-tour='unfollow-page'
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
      v-container.pl-5.pt-4.page-bg(
        fluid,
        grid-list-xl
        :class='$vuetify.theme.dark ? `theme--dark` : ``'
        )
        v-layout(row)
          v-flex.page-col-sd(
            v-if='tocPosition !== `off` && $vuetify.breakpoint.lgAndUp'
            :order-xs1='tocPosition !== `right`'
            :order-xs2='tocPosition === `right`'
            lg3
            xl2
            )
            v-card.page-toc-card.mb-5.tile-border(
              v-if='tocDecoded.length'
              :color='tileColor'
              )
              .overline.pa-5.pb-0.card-title.text-primary(
                :class='$vuetify.theme.dark ? `dark` : ``'
                ) {{$t('common:page.toc')}}
              v-list.d-flex.flex-column.mb-0.pb-3.pl-1.pr-1(
                dense
                nav
                :color='tileColor'
                )
                TreeItem(
                  v-for='(tocItem, tocIdx) in tocDecoded'
                  :key='tocIdx'
                  :item='tocItem'
                  :open.sync='openStates[tocItem.id]'
                  :toggleOpenState='toggleOpenState'
                  :openStates='openStates'
                  :level='0' :uniqueId='tocItem.id'
                  :color='tileColor'
                  )

            v-card.page-tags-card.mb-5.tile-border(
              v-if='tags.length > 0'
              :color='tileColor'
              )
              .pa-5
                .overline.pb-2.card-title.text-primary(:class='$vuetify.theme.dark ? `dark` : ``') {{$t('common:page.tags')}}
                v-chip.hover-chip.mr-1.mb-1(
                  outlined
                  :color='tileBtnColor'
                  :class='$vuetify.theme.dark ? `dark` : ``'
                  v-for='(tag, idx) in tags'
                  :href='`/t/` + sitePath + `/` + tag.tag'
                  :key='`tag-` + tag.tag'
                  )
                  v-icon(
                    left
                    small
                    :color='tileBtnColor'
                    ) mdi-tag
                  span.tag-title(:class='$vuetify.theme.dark ? `dark` : ``') {{tag.title}}
                v-chip.mr-1.mb-1.hover-chip(
                  outlined
                  :color='tileBtnColor'
                  :class='$vuetify.theme.dark ? `dark` : ``'
                  :href='`/t/` + sitePath + `/` + tags.map(t => t.tag).join(`/`)'
                  :aria-label='$t(`common:page.tagsMatching`)'
                  )
                  v-icon(
                    size='20'
                    :color='tileBtnColor'
                    ) mdi-tag-multiple

            v-card.page-comments-card.mb-5.tile-border(
              v-if='commentsEnabled && commentsPerms.read'
              :color='tileColor'
              )
              .pa-5
                .overline.pb-2.d-flex.align-center
                  span.card-title.text-primary(
                    :class='$vuetify.theme.dark ? `dark` : ``'
                    ) {{$t('common:comments.sdTitle')}}
                .d-flex
                  v-btn.inverse-hover-btn.text-none(
                    @click='goToComments()'
                    :color='tileBtnColor'
                    :class='$vuetify.theme.dark ? `dark` : ``'
                    outlined
                    rounded
                    style='flex: 1 1 100%;'
                    small
                    )
                    span#view-discussion(
                      :class='$vuetify.theme.dark ? `dark` : ``'
                      ) {{$t('common:comments.viewDiscussion')}}
                  v-tooltip(bottom, v-if='commentsPerms.write')
                    template(v-slot:activator='{ on }')
                      v-btn.inverse-hover-btn.ml-2(
                        @click='goToComments(true)'
                        v-on='on'
                        outlined
                        rounded
                        small
                        :color='tileBtnColor'
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        :aria-label='$t(`common:comments.newComment`)'
                        )
                        v-icon(:color='tileBtnColor', dense) mdi-comment-plus
                    span {{$t('common:comments.newComment')}}

            v-card.page-author-card.mb-5.tile-border(:color='tileColor')
              .pa-5
                .overline.d-flex
                  span.card-title.text-primary(
                    :class='$vuetify.theme.dark ? `dark` : ``'
                    ) {{$t('common:page.lastEditedBy')}}
                  v-spacer
                  v-tooltip(bottom, v-if='isAuthenticated')
                    template(v-slot:activator='{ on }')
                      v-btn.btn-animate-edit.inverse-hover-btn(
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        icon
                        :href='"/h/" + sitePath + "/" + locale + "/" + path'
                        v-on='on'
                        x-small
                        v-if='hasReadHistoryPermission'
                        :aria-label='$t(`common:header.history`)'
                        )
                        v-icon(:color='tileBtnColor', dense) mdi-history
                    span {{$t('common:header.history')}}
                .page-author-card-name.body-2.grey--text(:class='$vuetify.theme.dark ? `` : `text--darken-3`') {{ authorName }}
                .page-author-card-date.caption.grey--text(:class='$vuetify.theme.dark ? `` : `text--darken-2`') {{ updatedAt | moment('calendar') }}

            v-card.page-shortcuts-card.tile-border(flat)
              v-toolbar(:color='tileColor', flat, dense)
                v-spacer
                //- v-tooltip(bottom)
                //-   template(v-slot:activator='{ on }')
                //-     v-btn(icon, tile, v-on='on', :aria-label='$t(`common:page.bookmark`)'): v-icon(color='grey') mdi-bookmark
                //-   span {{$t('common:page.bookmark')}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn.hover-icon.rounded-fully(icon, tile, v-on='on', @click='print', :aria-label='$t(`common:page.printFormat`)')
                      v-icon(color='grey') mdi-printer
                  span {{messages.printPage}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn.hover-icon.rounded-fully(icon, tile, v-on='on', @click='exportWord', :aria-label='$t(`common:page.exportWord`)')
                      v-icon(color='grey') mdi-file-word-box
                  span {{messages.exportToWord}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn.hover-icon.rounded-fully(icon, tile, v-on='on', @click='exportPdf', :aria-label='$t(`common:page.exportPdf`)')
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
                      :color='actionBtnColor'
                      v-model='pageEditFab'
                      @click='pageEdit'
                      v-on='onEditActivator'
                      :disabled='!hasWritePagesPermission'
                      :aria-label='$t(`common:page.editPage`)'
                      )
                      v-icon(color='white') mdi-pencil
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasReadHistoryPermission')
                    template(v-slot:activator='{ on }')
                      v-btn.border-btn.hover-btn(
                        fab
                        small
                        :color='pageActionBgColor'
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        v-on='on'
                        @click='pageHistory'
                        )
                        v-icon(
                          size='20'
                          :color='pageActionIconColor'
                          ) mdi-history
                    span {{$t('common:header.history')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasReadSourcePermission')
                    template(v-slot:activator='{ on }')
                      v-btn.border-btn.hover-btn(
                        fab
                        small
                        :color='pageActionBgColor'
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        v-on='on'
                        @click='pageSource'
                        )
                        v-icon(
                          size='20'
                          :color='pageActionIconColor'
                          ) mdi-code-tags
                    span {{$t('common:header.viewSource')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasWritePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn.border-btn.hover-btn(
                        fab
                        small
                        :color='pageActionBgColor'
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        v-on='on'
                        @click='pageConvert'
                        )
                        v-icon(
                          size='20'
                          :color='pageActionIconColor'
                          ) mdi-lightning-bolt
                    span {{$t('common:header.convert')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasWritePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn.border-btn.hover-btn(
                        fab
                        small
                        :color='pageActionBgColor'
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        v-on='on'
                        @click='pageDuplicate'
                        )
                        v-icon(
                          size='20'
                          :color='pageActionIconColor'
                          ) mdi-content-duplicate
                    span {{$t('common:header.duplicate')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasManagePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn.border-btn.hover-btn(
                        fab
                        small
                        :color='pageActionBgColor'
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        v-on='on'
                        @click='pageMove'
                        )
                        v-icon(
                          size='20'
                          :color='pageActionIconColor'
                          ) mdi-content-save-move-outline
                    span {{$t('common:header.move')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasDeletePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn.border-btn.hover-btn.delete-btn(
                        fab
                        :class='$vuetify.theme.dark ? `dark` : ``'
                        small
                        :color='pageActionBgColor'
                        v-on='on'
                        @click='pageDelete'
                        )
                        v-icon(
                          size='20'
                          :color='$vuetify.theme.dark ? colors.warningActionDark.secondaryDefault : colors.warningActionLight.secondaryDefault'
                          ) mdi-trash-can-outline
                    span {{$t('common:header.delete')}}
              span {{$t('common:page.editPage')}}
            v-alert.mb-5(
              v-if='!isPublished',
              :color='$vuetify.theme.dark ? colors.warningActionDark.secondaryDefault : colors.warningActionLight.secondaryDefault',
              outlined,
              icon='mdi-minus-circle',
              dense
              )
              .caption {{$t('common:page.unpublishedWarning')}}
            .contents(ref='container', data-tour='page-content')
                slot(name='contents')
                // Image overlay viewer
                div.image-overlay(v-if='isImageOverlayVisible' role='dialog' aria-modal='true' @click.self='closeImageOverlay')
                  span.image-overlay-name {{ imageOverlayName }}
                  button.image-overlay-close(@click='closeImageOverlay' aria-label='Close image')
                    v-icon(color='black') mdi-close
                  img.image-overlay-img(:src='imageOverlaySrc' :alt='imageOverlayName')
            .comments-container#discussion(v-if='commentsEnabled && commentsPerms.read')
              .comments-header
                v-icon.mr-2(dark, :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite :colors.surfaceLight.inverse') mdi-comment-text-outline
                span {{$t('common:comments.title')}}
              .comments-main
                slot(name='comments')
    loader(v-model='isLoading', :title='messages.exporting')
    nav-footer(:is-home='path === "home"')
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
        :color='actionBtnColor'
        dark
        :style='upBtnPosition'
        :aria-label='$t(`common:actions.returnToTop`)'
        )
        v-icon mdi-arrow-up
    //- Export to File Modal
    v-dialog(
      v-model='isExportModalVisible'
      max-width='750'
      persistent
      overlay-color='black'
      overlay-opacity='.7'
    )
      v-card
        .dialog-header.is-short(:style='`background-color: ${colors.blue[500]} !important;`')
          v-icon.mr-2(
            v-if='exportFileType === `docx`'
            color='white'
            ) mdi-file-word-box
          v-icon.mr-2(
            v-else-if='exportFileType === `pdf`'
            color='white'
            ) mdi-file-pdf-box
          span(v-if='exportFileType === `docx`', style='color: white;') {{ messages.exportToWord }}
          span(v-else-if='exportFileType === `pdf`', style='color: white;') {{ messages.exportToPdf }}
        v-card-text.pt-5
          span(:style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`') {{ messages.exportModalSubtitle }}
        v-card-chin(
          :class='$vuetify.theme.dark ? `theme--dark` : ``'
          )
          v-spacer
          v-btn.btn-rounded(
            outlined
            rounded
            :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
            @click='isExportModalVisible = false'
            ) {{ messages.cancel }}
          v-btn.px-4.btn-rounded(
            v-if='exportFileType === `docx`'
            rounded
            dark
            :color='primaryActionBtnColor'
            @click='exportSinglePageToWord()'
            ) {{ messages.exportSinglePage }}
          v-btn.px-4.btn-rounded(
            v-else-if='exportFileType === `pdf`'
            rounded
            dark
            :color='primaryActionBtnColor'
            @click='exportSinglePageToPdf()'
            ) {{ messages.exportSinglePage }}
          v-btn.px-4.btn-rounded(
            v-if='exportFileType === `docx`'
            rounded
            dark
            :color='primaryActionBtnColor'
            @click='exportPageTreeToWord()'
            ) {{ messages.exportPageTree }}
          v-btn.px-4.btn-rounded(
            v-else-if='exportFileType === `pdf`'
            rounded
            dark
            :color='primaryActionBtnColor'
            @click='exportPageTreeToPdf()'
            ) {{ messages.exportPageTree }}
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import Tabset from './tabset.vue'
import NavSidebar from './nav-sidebar.vue'
import NotificationBanner from './notification-banner.vue'
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
import colors from '@/themes/default/js/color-scheme'

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
    NotificationBanner,
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
      sidebarWidth: 300,
      sidebarMinWidth: 200,
      sidebarMaxWidth: 600,
      isResizing: false,
      resizeStartX: 0,
      resizeStartWidth: 0,

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
          scrollingX: true,
          scrollingY: true,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: colors.neutral[200],
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
      exportFileType: '',
      // Image overlay viewer state
      isImageOverlayVisible: false,
      imageOverlaySrc: '',
      imageOverlayName: ''
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
    hasSuperAdminPermission: get('page/effectivePermissions@system.manage'),
    hasSiteAdminPermission: get('page/effectivePermissions@sites.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      return this.hasSuperAdminPermission || this.hasSiteAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    },
    editMenuExternalUrl () {
      if (this.editShortcutsObj.editMenuBar && this.editShortcutsObj.editMenuExternalBtn) {
        return this.editShortcutsObj.editMenuExternalUrl.replace('{filename}', this.filename)
      } else {
        return ''
      }
    },
    tileColor() {
      return this.$vuetify.theme.dark ?
        this.colors.neutral[850] :
        this.colors.surfaceLight.white
    },
    tileBtnColor() {
      return this.$vuetify.theme.dark ?
        this.colors.actionDark.highlightOnLite :
        this.colors.actionLight.active
    },
    pageActionBgColor() {
      return this.$vuetify.theme.dark ?
        this.colors.surfaceDark.primaryNeutralLite :
        this.colors.surfaceLight.secondaryNeutralLite
    },
    pageActionIconColor() {
      return this.$vuetify.theme.dark ?
        this.colors.teal[500] :
        this.colors.teal[800]
    },
    actionBtnColor () {
      return this.$vuetify.theme.dark ?
        this.colors.surfaceDark.secondarySapHeavy :
        this.colors.surfaceLight.secondaryBlueHeavy
    },
    primaryActionBtnColor () {
      return this.$vuetify.theme.dark ?
        this.colors.surfaceDark.secondarySapHeavy :
        this.colors.surfaceLight.secondaryBlueHeavy
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
      this.scrollStyle.bar.background = this.colors.surfaceDark.tertiaryNeutralLite
    } else {
      this.scrollStyle.bar.background = this.colors.surfaceLight.tertiaryNeutralLite
    }

    // -> Load sidebar width from localStorage
    this.loadSidebarWidth()

    // -> Set footer margin based on navMode
    if (this.navMode === 'NONE' || this.$vuetify.breakpoint.smAndDown) {
      document.documentElement.style.setProperty('--sidebar-width', '0px')
    }

    // -> Check side navigation visibility
    this.handleSideNavVisibility()
    window.addEventListener('resize', _.debounce(() => {
      this.handleSideNavVisibility()
    }, 500))

    // -> Highlight Code Blocks
    Prism.highlightAllUnder(this.$refs.container)

    // -> Render Mermaid diagrams (Mermaid v10)
    const mermaidTheme = this.$vuetify.theme.dark ? 'dark' : 'default'
    mermaid.initialize({
      startOnLoad: false,
      theme: mermaidTheme,
      securityLevel: 'loose'
    })

    // Only run mermaid within this page container
    if (this.$refs.container) {
      const mermaidDivs = this.$refs.container.querySelectorAll('.mermaid:not([data-processed])')
      if (mermaidDivs && mermaidDivs.length > 0) {
        mermaid.run({ nodes: Array.from(mermaidDivs) })
      }
    }

    // Protect diagrams from browser color adjustments
    this.$nextTick(() => {
      if (typeof this.applyColorSchemeProtection === 'function') {
        this.applyColorSchemeProtection()
      }
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

      // Delegated image click: open image source in a new tab (Confluence-like behavior)
      const container = this.$refs.container
      if (container) {
        container.addEventListener('click', (ev) => {
          const target = ev.target
          if (target && target.tagName === 'IMG') {
            if (target.closest('a')) return
            const src = target.getAttribute('src') || target.dataset.src
            if (src) {
              ev.preventDefault()
              ev.stopPropagation()
              this.openImageOverlay(src, target.getAttribute('alt') || '')
            }
          }
        })
        // Add cursor hint
        container.querySelectorAll('img').forEach(img => {
          if (!img.closest('a')) {
            img.style.cursor = 'zoom-in'
          }
        })
      }

      window.boot.notify('page-ready')
    })

    // ESC key closes image overlay
    this._imageOverlayEscHandler = (e) => {
      if (e.key === 'Escape' && this.isImageOverlayVisible) {
        this.closeImageOverlay()
      }
    }
    document.addEventListener('keydown', this._imageOverlayEscHandler)
  },
  beforeDestroy() {
    // Clean up resize event listeners
    if (this.isResizing) {
      document.removeEventListener('mousemove', this.handleResize)
      document.removeEventListener('mouseup', this.stopResize)
      document.body.style.cursor = 'auto'
      document.body.style.userSelect = 'auto'
    }
    if (this._imageOverlayEscHandler) {
      document.removeEventListener('keydown', this._imageOverlayEscHandler)
    }
  },
  methods: {
    applyColorSchemeProtection () {
      // Protect mermaid / svg diagrams from browser auto color adjustments (forced-colors / dark mode)
      // Keep this scoped to the page container to avoid touching other parts of the DOM.
      const colorScheme = this.$vuetify.theme.dark ? 'dark' : 'light'

      const containerRoot = this.$refs.container
      if (!containerRoot || !containerRoot.querySelectorAll) return

      // Mermaid
      containerRoot.querySelectorAll('.mermaid').forEach(container => {
        container.style.setProperty('color-scheme', colorScheme, 'important')
        container.style.setProperty('forced-color-adjust', 'none', 'important')
        container.style.setProperty('filter', 'none', 'important')

        container.querySelectorAll('svg').forEach(svg => {
          svg.style.setProperty('color-scheme', colorScheme, 'important')
          svg.style.setProperty('forced-color-adjust', 'none', 'important')
          svg.style.setProperty('filter', 'none', 'important')
        })
      })

      // Draw.io / other diagram blocks (same approach as editor preview)
      containerRoot.querySelectorAll('pre.diagram').forEach(diagram => {
        diagram.style.setProperty('color-scheme', colorScheme, 'important')
        diagram.style.setProperty('forced-color-adjust', 'none', 'important')
        diagram.style.setProperty('filter', 'none', 'important')

        diagram.querySelectorAll('svg').forEach(svg => {
          svg.style.setProperty('color-scheme', colorScheme, 'important')
          svg.style.setProperty('forced-color-adjust', 'none', 'important')
          svg.style.setProperty('filter', 'none', 'important')
        })
      })
    },
    startResize(e) {
      if (this.$vuetify.breakpoint.smAndDown) return

      this.isResizing = true
      this.resizeStartX = e.clientX
      this.resizeStartWidth = this.sidebarWidth

      document.addEventListener('mousemove', this.handleResize)
      document.addEventListener('mouseup', this.stopResize)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      e.preventDefault()
    },
    handleResize(e) {
      if (!this.isResizing) return

      const deltaX = this.$vuetify.rtl ?
        (this.resizeStartX - e.clientX) :
        (e.clientX - this.resizeStartX)

      const newWidth = this.resizeStartWidth + deltaX

      if (newWidth >= this.sidebarMinWidth && newWidth <= this.sidebarMaxWidth) {
        this.sidebarWidth = newWidth
        localStorage.setItem('navSidebarWidth', newWidth)
        document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`)
      }
    },
    stopResize() {
      this.isResizing = false
      document.removeEventListener('mousemove', this.handleResize)
      document.removeEventListener('mouseup', this.stopResize)
      document.body.style.cursor = 'auto'
      document.body.style.userSelect = 'auto'
    },
    resetSidebarWidth() {
      this.sidebarWidth = 300
      localStorage.setItem('navSidebarWidth', 300)
      document.documentElement.style.setProperty('--sidebar-width', '300px')
    },
    loadSidebarWidth() {
      const savedWidth = localStorage.getItem('navSidebarWidth')
      if (savedWidth) {
        const width = parseInt(savedWidth)
        if (width >= this.sidebarMinWidth && width <= this.sidebarMaxWidth) {
          this.sidebarWidth = width
          document.documentElement.style.setProperty('--sidebar-width', `${width}px`)
        }
      } else {
        document.documentElement.style.setProperty('--sidebar-width', '300px')
      }
    },
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
    openImageOverlay(src, alt = '') {
      this.imageOverlaySrc = src
      // derive a display name from src (strip query/hash, take filename)
      try {
        const clean = src.split(/[?#]/)[0]
        this.imageOverlayName = clean.split('/').pop() || 'image'
      } catch (e) {
        this.imageOverlayName = 'image'
      }
      this.isImageOverlayVisible = true
      document.documentElement.classList.add('image-overlay-active')
    },
    closeImageOverlay() {
      this.isImageOverlayVisible = false
      this.imageOverlaySrc = ''
      document.documentElement.classList.remove('image-overlay-active')
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

<style lang="scss" scoped>
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
        color: mc('surface-light', 'secondary-blue-heavy');
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
  color: mc("action-light", "active");

  &.dark {
    color: mc("action-dark", "highlight-on-lite");
  }
}

.inverse-hover-btn:hover {
  background-color: mc("action-light", "primary-hover-on-lite") !important;

  .v-icon, span{
    color: mc("surface-light", "white") !important;
  }

  &.dark {
    background-color: mc("action-dark", "highlight-on-lite") !important;

    .v-icon, span{
      color: mc("neutral", "850") !important;
    }
  }
}

.hover-icon.v-btn {
  &:hover > .v-btn__content > .v-icon {
    color: mc("action-light", "active") !important;
  }

  &.theme--dark {
    &:hover > .v-btn__content > .v-icon {
      color: mc("action-dark", "highlight-on-lite") !important;
    }
  }
}

.v-btn.hover-btn {
  &:hover {
    background-color: mc('action-dark', 'highlight-on-lite') !important;
  }
}

.v-btn.rounded-fully {
  border-radius: 100% !important;
}

.v-btn.action-btn {
  background-color: mc("action-light", "highlight-on-lite") !important;
  color: mc("text-light", "primary") !important;
}

.v-btn.border-btn {
  border: 1px solid mc("border-light", "primary") !important;
  box-shadow: none !important;

  &.hover-btn:hover {
    background-color: mc("teal", "800") !important;
    border: 1px solid mc("teal", "800") !important;

    .v-icon {
      color: mc("surface-light", "white") !important;
    }

    &.delete-btn {
      background-color: mc("warning-action-light", "secondary-default") !important;
      border: 1px solid mc("warning-action-light", "secondary-default") !important;

      .v-icon {
        color: mc("action-light", "content-white") !important;
      }
    }

    &.dark {
      background-color: mc("teal", "500") !important;
      border: 1px solid mc("teal", "500") !important;

      .v-icon {
        color: mc("action-dark", "content-on-lite") !important;
      }

      &.delete-btn {
        background-color: mc("warning-action-dark", "secondary-default") !important;
        border: 1px solid mc("warning-action-dark", "secondary-default") !important;

        .v-icon {
          color: mc("action-dark", "content-on-lite") !important;
        }
      }
    }
  }

  &.theme--dark {
    border: 1px solid mc("border-dark", "primary") !important;

    &.hover-btn:hover {
      background-color: mc("action-dark", "highlight-on-lite") !important;
      border: 1px solid mc("action-dark", "highlight-on-lite") !important;

      .v-icon {
        color: mc("action-dark", "content-on-lite") !important;
      }
    }
  }
}

.text-primary {
  color: mc("text-light", "primary") !important;

  &.dark {
    color: mc("text-dark", "primary") !important;
  }
}

.page-header-container {
  background-color: mc("surface-light", "tertiary-neutral-lite");

  .headline {
    color: mc("text-light", "primary");
  }

  &.dark-theme {
    background-color: mc("surface-dark", "info-heavy");

    .headline {
      color: mc("text-dark", "primary");
    }
  }
}

.page-bg {
  background-color: mc("surface-light", "white");

  &.theme--dark {
    background-color: mc("surface-dark", "black");
  }
}

.tile-border {
  border: 1px solid mc("border-light", "primary") !important;
  box-shadow: none !important;

  &.theme--dark {
    border: 1px solid mc("border-dark", "primary") !important;
  }

  .tag-title {
    color: mc("action-light", "active");

    &.dark {
      color: mc("action-dark", "highlight-on-lite");
    }
  }

  .v-chip.hover-chip:hover {
    background-color: mc("action-light", "primary-hover-on-lite") !important;
    border: 1px solid mc("action-light", "primary-hover-on-lite") !important;

    .v-icon, .tag-title {
      color: mc("surface-light", "white") !important;
    }

    &.dark {
      background-color: mc("action-dark", "highlight-on-lite") !important;

      .v-icon, .tag-title {
        color: mc("neutral", "850") !important;
      }
    }
  }
}

.dialog-header {
  background-color: mc("surface-dark", "primary-blue-lite");
}

.v-tooltip__content{
  border-radius: 16px;
}

// Resizable sidebar styles
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  cursor: col-resize;
  background: transparent;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  opacity: 0;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      mc('blue', '300') 20%,
      mc('blue', '400') 50%,
      mc('blue', '300') 80%,
      transparent 100%
    );
    border-radius: 2px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    transform: scaleY(0);
    left: 4.5px;
  }

  &::after {
    content: '⋮⋮';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 14px;
    line-height: 0.8;
    letter-spacing: 2px;
    color: mc('blue', '400');
    opacity: 0;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    font-weight: bold;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  &.resize-handle-right {
    right: -6px;
  }

  &.resize-handle-left {
    left: -6px;
  }

  .v-navigation-drawer:hover &,
  &:hover {
    opacity: 1;

    &::before {
      transform: scaleY(1);
    }

    &::after {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  &:hover {
    background: mc('action-light', 'highlight-on-lite');
    border-radius: 0 4px 4px 0;

    &::before {
      background: linear-gradient(
        180deg,
        mc('blue', '200') 0%,
        mc('blue', '500') 20%,
        mc('blue', '600') 50%,
        mc('blue', '500') 80%,
        mc('blue', '200') 100%
      );
      box-shadow: 0 0 8px mc('blue', '300');
    }

    &::after {
      color: mc('blue', '600');
      text-shadow: 0 0 4px mc('blue', '400');
    }
  }

  &:active {
    background: mc('action-light', 'primary-hover-on-lite');
    border-radius: 0 4px 4px 0;

    &::before {
      background: linear-gradient(
        180deg,
        mc('blue', '300') 0%,
        mc('blue', '600') 20%,
        mc('blue', '700') 50%,
        mc('blue', '600') 80%,
        mc('blue', '300') 100%
      );
      box-shadow: 0 0 12px mc('blue', '400');
      transform: scaleY(1.05);
    }

    &::after {
      color: mc('blue', '700');
      transform: translate(-50%, -50%) scale(1.2);
    }
  }

  &.resize-handle-left:hover,
  &.resize-handle-left:active {
    border-radius: 4px 0 0 4px;
  }
}

// Image overlay styles
.image-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000; // above drawers & tooltips
  background: rgba(0,0,0,0.65);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  backdrop-filter: blur(6px);
}
.image-overlay-img {
  max-width: 90vw;
  max-height: 80vh;
  object-fit: contain;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  border-radius: 6px;
}
.image-overlay-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.2);
  color: #000;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: box-shadow .15s ease, transform .15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-overlay-close:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transform: scale(1.05);
}
.image-overlay-name {
  position: absolute;
  top: 16px;
  left: 16px;
  background: rgba(255,255,255,0.9);
  color: #000;
  padding: 6px 12px;
  font-size: 14px;
  font-family: monospace;
  border-radius: 4px;
  max-width: 50vw;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
}

// Blur underlying app when overlay active
.image-overlay-active .v-application--wrap {
  filter: blur(3px) brightness(.8);
  transition: filter .2s ease;
}

.v-navigation-drawer {
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  // Make scrollbar stick to bottom of sidebar
  .sidebar-scroll-container {
    height: 100% !important;
    
    // vuescroll container and panel should fill height
    ::v-deep .__container,
    ::v-deep .__panel {
      height: 100% !important;
      min-height: 0 !important;
    }
    
    // Content wrapper for horizontal scroll
    ::v-deep .__view {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      min-width: min-content;
      padding-bottom: 12px;
    }
    
    // Pin horizontal scrollbar to bottom
    ::v-deep .__rail-is-horizontal {
      position: absolute !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      top: auto !important;
      z-index: 10 !important;
      margin: 0 !important;
    }
    
    // Vertical scrollbar styling
    ::v-deep .__rail-is-vertical {
      top: 0 !important;
      bottom: 0 !important;
    }
  }

  &.resizing {
    transition: none;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
  }

  &:hover .sidebar-resize-handle {
    opacity: 1;
    transition-delay: 0.3s;
  }

  .sidebar-resize-handle:hover {
    transition-delay: 0s !important;
  }
}
.theme--dark {
  .sidebar-resize-handle {
    &::before {
      background: linear-gradient(
        180deg,
        transparent 0%,
        mc('text-dark', 'brand-primary') 20%,
        mc('action-dark', 'active') 50%,
        mc('text-dark', 'brand-primary') 80%,
        transparent 100%
      );
    }

    &::after {
      color: mc('action-dark', 'active');
    }

    &:hover {
      background: mc('action-dark', 'highlight-on-lite');

      &::before {
        background: linear-gradient(
          180deg,
          mc('text-dark', 'brand-primary') 0%,
          mc('action-dark', 'active') 20%,
          mc('blue', '200') 50%,
          mc('action-dark', 'active') 80%,
          mc('text-dark', 'brand-primary') 100%
        );
        box-shadow: 0 0 8px mc('action-dark', 'active');
      }

      &::after {
        color: mc('blue', '200');
        text-shadow: 0 0 4px mc('action-dark', 'active');
      }
    }

    &:active {
      background: mc('action-dark', 'primary-hover-on-lite');

      &::before {
        background: linear-gradient(
          180deg,
          mc('action-dark', 'active') 0%,
          mc('blue', '200') 20%,
          mc('blue', '100') 50%,
          mc('blue', '200') 80%,
          mc('action-dark', 'active') 100%
        );
        box-shadow: 0 0 12px mc('blue', '200');
      }

      &::after {
        color: mc('blue', '100');
      }
    }
  }
}
</style>

// Global styles
<style lang="scss">
.theme--dark .v-application--wrap {
  background-color: mc("surface-dark", "black");
}
</style>
