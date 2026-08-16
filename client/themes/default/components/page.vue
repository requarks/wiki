<template lang="pug">
  v-app(v-scroll='upBtnScroll', :dark='$vuetify.theme.dark', :class='$vuetify.rtl ? `is-rtl` : `is-ltr`')
    nav-header(v-if='!printView')
    nav-mobile-drawer-host(v-if='!printView')
    v-navigation-drawer(
      v-if='navMode !== `NONE` && !printView && $vuetify.breakpoint.mdAndUp'
      :class='navDrawerClass'
      :dark='navDrawerDark'
      :app='true'
      :clipped='true'
      permanent
      v-model='navShown'
      :right='$vuetify.rtl'
      width='256'
      overlay-color='black'
      :overlay-opacity='0.55'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(
          :color='navSidebarColor'
          :dark='navSidebarDark'
          :items='sidebarDecoded'
          :nav-mode='navMode'
          )

    //- Mobile nav opens from profile icon in header (LinkedIn-style)
    v-main(ref='content')
      template(v-if='path !== `home`')
        v-toolbar(:color='$vuetify.theme.dark ? `grey darken-4-d3` : `grey lighten-3`', flat, dense, v-if='$vuetify.breakpoint.smAndUp')
          //- v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
          //-   v-icon(color='grey darken-2', left) menu
          //-   span Navigation
          v-breadcrumbs.breadcrumbs-nav.pl-0(
            :items='breadcrumbs'
            divider='/'
            )
            template(slot='item', slot-scope='props')
              v-icon(v-if='props.item.path === "/"', small, @click='goHome') mdi-home
              v-btn.ma-0(v-else, :href='props.item.path', small, text) {{props.item.name}}
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text {{$t('common:page.unpublished')}}
            status-indicator.ml-3(negative, pulse)
        v-divider
      v-container.pl-5(fluid, grid-list-xl, :class='path === `home` ? `pt-4` : ``')
        v-layout(row)
          v-flex.page-col-sd(
            v-if='tocPosition !== `off` && $vuetify.breakpoint.lgAndUp'
            :order-xs1='tocPosition !== `right`'
            :order-xs2='tocPosition === `right`'
            lg3
            xl2
            )
            v-card.page-toc-card.mb-5(v-if='tocDecoded.length')
              .overline.pa-5.pb-0(:class='$vuetify.theme.dark ? `blue--text text--lighten-2` : `primary--text`') {{$t('common:page.toc')}}
              v-list.pb-3(dense, nav, :class='$vuetify.theme.dark ? `darken-3-d3` : ``')
                template(v-for='(tocItem, tocIdx) in tocDecoded')
                  v-list-item(@click='$vuetify.goTo(tocItem.anchor, scrollOpts)')
                    v-icon(color='grey', small) {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
                    v-list-item-title.px-3 {{tocItem.title}}
                  //- v-divider(v-if='tocIdx < toc.length - 1 || tocItem.children.length')
                  template(v-for='tocSubItem in tocItem.children')
                    v-list-item(@click='$vuetify.goTo(tocSubItem.anchor, scrollOpts)')
                      v-icon.px-3(color='grey lighten-1', small) {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
                      v-list-item-title.px-3.caption.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-1`') {{tocSubItem.title}}
                    //- v-divider(inset, v-if='tocIdx < toc.length - 1')

            page-tags-card(v-if='tags.length > 0', :tags='tags')

            v-card.page-comments-card.mb-5(v-if='commentsEnabled && commentsPerms.read')
              .pa-5
                .overline.pb-2.blue-grey--text.d-flex.align-center(:class='$vuetify.theme.dark ? `text--lighten-3` : `text--darken-2`')
                  span {{$t('common:comments.sdTitle')}}
                  //- v-spacer
                  //- v-chip.text-center(
                  //-   v-if='!commentsExternal'
                  //-   label
                  //-   x-small
                  //-   :color='$vuetify.theme.dark ? `blue-grey darken-3` : `blue-grey darken-2`'
                  //-   dark
                  //-   style='min-width: 50px; justify-content: center;'
                  //-   )
                  //-   span {{commentsCount}}
                .d-flex
                  v-btn.text-none(
                    @click='goToComments()'
                    :color='$vuetify.theme.dark ? `blue-grey` : `blue-grey darken-2`'
                    outlined
                    style='flex: 1 1 100%;'
                    small
                    )
                    span.blue-grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-2`') {{$t('common:comments.viewDiscussion')}}
                  v-tooltip(right, v-if='commentsPerms.write')
                    template(v-slot:activator='{ on }')
                      v-btn.ml-2(
                        @click='goToComments(true)'
                        v-on='on'
                        outlined
                        small
                        :color='$vuetify.theme.dark ? `blue-grey` : `blue-grey darken-2`'
                        :aria-label='$t(`common:comments.newComment`)'
                        )
                        v-icon(:color='$vuetify.theme.dark ? `blue-grey lighten-1` : `blue-grey darken-2`', dense) mdi-comment-plus
                    span {{$t('common:comments.newComment')}}

            v-card.page-author-card.mb-5
              .pa-5
                .overline.indigo--text.d-flex(:class='$vuetify.theme.dark ? `text--lighten-3` : ``')
                  span {{$t('common:page.lastEditedBy')}}
                  v-spacer
                  v-tooltip(right, v-if='isAuthenticated')
                    template(v-slot:activator='{ on }')
                      v-btn.btn-animate-edit(
                        icon
                        :href='"/h/" + locale + "/" + path'
                        v-on='on'
                        x-small
                        v-if='hasReadHistoryPermission'
                        :aria-label='$t(`common:header.history`)'
                        )
                        v-icon(color='indigo', dense) mdi-history
                    span {{$t('common:header.history')}}
                .page-author-card-name.body-2.grey--text(:class='$vuetify.theme.dark ? `` : `text--darken-3`') {{ authorName }}
                .page-author-card-date.caption.grey--text.text--darken-1 {{ updatedAt | moment('calendar') }}

            //- v-card.mb-5
            //-   .pa-5
            //-     .overline.pb-2.yellow--text(:class='$vuetify.theme.dark ? `text--darken-3` : `text--darken-4`') Rating
            //-     .text-center
            //-       v-rating(
            //-         v-model='rating'
            //-         color='yellow darken-3'
            //-         background-color='grey lighten-1'
            //-         half-increments
            //-         hover
            //-       )
            //-       .caption.grey--text 5 votes

            v-card.page-shortcuts-card(flat)
              v-toolbar(:color='$vuetify.theme.dark ? `grey darken-4-d3` : `grey lighten-3`', flat, dense)
                v-spacer
                //- v-tooltip(bottom)
                //-   template(v-slot:activator='{ on }')
                //-     v-btn(icon, tile, v-on='on', :aria-label='$t(`common:page.bookmark`)'): v-icon(color='grey') mdi-bookmark
                //-   span {{$t('common:page.bookmark')}}
                v-menu(offset-y, bottom, min-width='300')
                  template(v-slot:activator='{ on: menu }')
                    v-tooltip(bottom)
                      template(v-slot:activator='{ on: tooltip }')
                        v-btn(icon, tile, v-on='{ ...menu, ...tooltip }', :aria-label='$t(`common:page.share`)'): v-icon(color='grey') mdi-share-variant
                      span {{$t('common:page.share')}}
                  social-sharing(
                    :url='pageUrl'
                    :title='title'
                    :description='description'
                  )
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, v-on='on', @click='print', :aria-label='$t(`common:page.printFormat`)')
                      v-icon(:color='printView ? `primary` : `grey`') mdi-printer
                  span {{$t('common:page.printFormat')}}
                v-spacer

          v-flex.page-col-content(
            xs12
            :lg9='tocPosition !== `off`'
            :xl10='tocPosition !== `off`'
            :order-xs1='tocPosition === `right`'
            :order-xs2='tocPosition !== `right`'
            )
            .page-header-block(v-if='path !== `home`')
              .page-header-section.is-page-header-title(
                :class='$vuetify.theme.dark ? `grey darken-4-l3` : `grey lighten-4`'
                )
                .page-header-headings
                  .headline.grey--text(:class='$vuetify.theme.dark ? `text--lighten-2` : `text--darken-3`') {{title}}
                .page-edit-shortcuts(
                  v-if='editShortcutsObj.editMenuBar'
                  :class='tocPosition === `right` ? `is-right` : ``'
                  )
                  v-btn(
                    v-if='editShortcutsObj.editMenuBtn && isAuthenticated && hasWritePagesPermission'
                    data-auth-required
                    @click='pageEdit'
                    depressed
                    small
                    )
                    v-icon.mr-2(small) mdi-pencil
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
              .page-header-section.is-page-header-subtitle(
                v-if='description'
                :class='$vuetify.theme.dark ? `grey darken-4-l3` : `grey lighten-4`'
                )
                .page-header-subheading
                  .caption.grey--text.text--darken-1 {{description}}
            v-divider(v-if='path !== `home`')
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
                  :style='mobileFabBottomOffset'
                  dark
                  )
                  template(v-slot:activator)
                    v-btn.btn-animate-edit(
                      fab
                      color='primary'
                      v-model='pageEditFab'
                      data-auth-required
                      @click='pageEdit'
                      v-on='onEditActivator'
                      :disabled='!hasWritePagesPermission'
                      :aria-label='$t(`common:page.editPage`)'
                      )
                      v-icon mdi-pencil
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasReadHistoryPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        color='white'
                        light
                        v-on='on'
                        @click='pageHistory'
                        )
                        v-icon(size='20') mdi-history
                    span {{$t('common:header.history')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasReadSourcePermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        color='white'
                        light
                        v-on='on'
                        @click='pageSource'
                        )
                        v-icon(size='20') mdi-code-tags
                    span {{$t('common:header.viewSource')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasWritePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        color='white'
                        light
                        v-on='on'
                        @click='pageConvert'
                        )
                        v-icon(size='20') mdi-lightning-bolt
                    span {{$t('common:header.convert')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasWritePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        color='white'
                        light
                        v-on='on'
                        @click='pageDuplicate'
                        )
                        v-icon(size='20') mdi-content-duplicate
                    span {{$t('common:header.duplicate')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasManagePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        small
                        color='white'
                        light
                        v-on='on'
                        @click='pageMove'
                        )
                        v-icon(size='20') mdi-content-save-move-outline
                    span {{$t('common:header.move')}}
                  v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='hasDeletePagesPermission')
                    template(v-slot:activator='{ on }')
                      v-btn(
                        fab
                        dark
                        small
                        color='red'
                        v-on='on'
                        @click='pageDelete'
                        )
                        v-icon(size='20') mdi-trash-can-outline
                    span {{$t('common:header.delete')}}
              span {{$t('common:page.editPage')}}
            v-alert.mb-5(v-if='!isPublished', color='red', outlined, icon='mdi-minus-circle', dense)
              .caption {{$t('common:page.unpublishedWarning')}}
            .contents.pt-4(ref='container')
              slot(name='contents')
            v-divider.my-3(v-if='(pageEmbedData || pageNavigationData || relatedPagesData) && !printView')
            page-navigation(v-if='pageNavigationData && !printView', :nav='pageNavigationData')
            page-related-pages(v-if='relatedPagesData && !printView', :related='relatedPagesData')
            page-tags-card(
              v-if='tags.length > 0 && $vuetify.breakpoint.mdAndDown && !printView'
              :tags='tags'
              mobile
            )
            page-telegram-comments(
              v-if='telegramCommentsConfig && !printView'
              id='discussion'
              :website-id='telegramCommentsConfig.websiteId'
              :limit='telegramCommentsConfig.limit'
              :page-url='telegramCommentsConfig.pageUrl'
              :page-title='telegramCommentsConfig.pageTitle'
            )
            .comments-container(
              v-if='commentsEnabled && commentsPerms.read && !printView'
              :id='telegramCommentsConfig ? undefined : "discussion"'
            )
              .comments-header
                v-icon.mr-2(dark) mdi-comment-text-outline
                span {{$t('common:comments.sdTitle')}}
              .comments-main
                slot(name='comments')
    nav-footer
    notify
    search-results
    v-fab-transition
      v-btn(
        v-if='upBtnShown'
        fab
        fixed
        :bottom='true'
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        :depressed='this.$vuetify.breakpoint.mdAndUp'
        @click='$vuetify.goTo(0, scrollOpts)'
        color='primary'
        dark
        :style='[upBtnPosition, mobileFabBottomOffset]'
        :aria-label='$t(`common:actions.returnToTop`)'
        )
        v-icon mdi-arrow-up
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import Tabset from './tabset.vue'
import NavSidebar from './nav-sidebar.vue'
import Prism from 'prismjs'
import mermaid from 'mermaid'
import { get, sync } from 'vuex-pathify'
import _ from 'lodash'
import ClipboardJS from 'clipboard'
import Vue from 'vue'
import { registerEmbeddedPermissions, syncPageEffectivePermissionsToStore } from '../../../helpers/auth-session'

/* global siteLangs, siteConfig */

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
    StatusIndicator
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
    pageNavigation: {
      type: String,
      default: ''
    },
    relatedPages: {
      type: String,
      default: ''
    },
    pageTelegramComments: {
      type: String,
      default: ''
    },
    pageIframeSettings: {
      type: String,
      default: ''
    },
    pageEmbed: {
      type: String,
      default: ''
    },
    sideNavSettings: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      locales: siteLangs,
      navShown: false,
      navExpanded: false,
      upBtnShown: false,
      pageEditFab: false,
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
          background: '#42A5F5',
          hoverStyle: {
            background: '#64B5F6'
          }
        }
      },
      winWidth: 0,
      pageEmbedVm: null
    }
  },
  computed: {
    isAuthenticated: get('user/authenticated'),
    permissions: get('user/permissions'),
    isAdmin () {
      return _.intersection(this.permissions, ['manage:system', 'write:users', 'manage:users', 'write:groups', 'manage:groups', 'manage:navigation', 'manage:theme', 'manage:api']).length > 0
    },
    showMobileBottomNav () {
      return this.$vuetify.breakpoint.smAndDown
    },
    navDrawerWidth () {
      return this.$vuetify.breakpoint.smAndDown ? Math.min(Math.round(window.innerWidth * 0.88), 320) : 256
    },
    navDrawerClass () {
      if (this.$vuetify.breakpoint.smAndDown) {
        return this.$vuetify.theme.dark ? 'nav-drawer-mobile blue darken-4' : 'nav-drawer-mobile primary'
      }
      return this.$vuetify.theme.dark ? 'grey darken-4-d4' : 'primary'
    },
    navDrawerDark () {
      if (this.$vuetify.breakpoint.smAndDown) {
        return true
      }
      return true
    },
    navSidebarColor () {
      if (this.$vuetify.breakpoint.smAndDown) {
        return this.$vuetify.theme.dark ? 'blue darken-4' : 'primary'
      }
      return this.$vuetify.theme.dark ? 'grey darken-4-d4' : 'primary'
    },
    navSidebarDark () {
      if (this.$vuetify.breakpoint.smAndDown) {
        return true
      }
      return true
    },
    mobileFabBottomOffset () {
      if (!this.showMobileBottomNav) { return {} }
      return { bottom: '72px' }
    },
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
    breadcrumbs() {
      return [{ path: '/', name: 'Home' }].concat(
        _.reduce(this.path.split('/'), (result, value) => {
          result.push({
            path: _.get(_.last(result), 'path', this.locales.length > 0 ? `/${this.locale}` : '') + `/${value}`,
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
      return JSON.parse(Buffer.from(this.toc, 'base64').toString())
    },
    tocPosition: get('site/tocPosition'),
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      if (!this.isAuthenticated) {
        return false
      }
      return this.hasAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    },
    printView: sync('site/printView'),
    editMenuExternalUrl () {
      if (this.editShortcutsObj.editMenuBar && this.editShortcutsObj.editMenuExternalBtn) {
        return this.editShortcutsObj.editMenuExternalUrl.replace('{filename}', this.filename)
      } else {
        return ''
      }
    },
    pageNavigationData () {
      if (!this.pageNavigation) {
        return null
      }
      try {
        return JSON.parse(Buffer.from(this.pageNavigation, 'base64').toString())
      } catch (err) {
        return null
      }
    },
    relatedPagesData () {
      if (!this.relatedPages) {
        return null
      }
      try {
        return JSON.parse(Buffer.from(this.relatedPages, 'base64').toString())
      } catch (err) {
        return null
      }
    },
    pageEmbedData () {
      if (!this.pageEmbed) {
        return null
      }
      try {
        return JSON.parse(Buffer.from(this.pageEmbed, 'base64').toString())
      } catch (err) {
        return null
      }
    },
    telegramCommentsConfig () {
      if (!this.pageTelegramComments) {
        return null
      }
      try {
        return JSON.parse(Buffer.from(this.pageTelegramComments, 'base64').toString())
      } catch (err) {
        return null
      }
    },
    pageIframeSettingsData () {
      if (!this.pageIframeSettings) {
        return null
      }
      try {
        return JSON.parse(Buffer.from(this.pageIframeSettings, 'base64').toString())
      } catch (err) {
        return null
      }
    },
    sideNavSettingsData () {
      if (!this.sideNavSettings) {
        return null
      }
      try {
        return JSON.parse(Buffer.from(this.sideNavSettings, 'base64').toString())
      } catch (err) {
        return null
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
      registerEmbeddedPermissions(this.effectivePermissions)
      syncPageEffectivePermissionsToStore(this.$store)
    }
    if (this.editShortcuts) {
      this.$store.set('page/editShortcuts', JSON.parse(Buffer.from(this.editShortcuts, 'base64').toString()))
    }

    this.$store.set('page/mode', 'view')
    this.$store.set('page/sidebar', this.sidebarDecoded)
    this.$store.set('page/navMode', this.navMode)
    if (this.sideNavSettingsData) {
      this.$store.set('page/sideNavSettings', this.sideNavSettingsData)
    } else {
      this.$store.set('page/sideNavSettings', {
        enabled: false,
        parentIconMatch: 'mdi-flower',
        childIconMatch: 'mdi-chevron-right',
        childIndentPx: 36
      })
    }
  },
  mounted () {
    if (this.$vuetify.theme.dark) {
      this.scrollStyle.bar.background = '#424242'
    }

    this.$root.$on('goToComments', () => {
      this.goToComments()
    })

    // -> Check side navigation visibility
    this.navShown = true

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
      this.mountPageEmbed()
    })
  },
  beforeDestroy () {
    this.destroyPageEmbed()
  },
  methods: {
    mountPageEmbed () {
      this.destroyPageEmbed()
      if (this.printView || !this.pageEmbedData || !this.$refs.container) {
        return
      }

      const host = this.$refs.container.querySelector('.page-embed-host')
      if (!host) {
        return
      }

      this.pageEmbedVm = new Vue({
        parent: this,
        render: (h) => h('page-embed', {
          props: {
            embed: this.pageEmbedData,
            iframeSettings: this.pageIframeSettingsData
          }
        })
      })
      this.pageEmbedVm.$mount(host)
    },
    destroyPageEmbed () {
      if (this.pageEmbedVm) {
        this.pageEmbedVm.$destroy()
        this.pageEmbedVm = null
      }
    },
    requireAuth () {
      if (!this.isAuthenticated) {
        window.location.assign('/login')
        return false
      }
      return true
    },
    getHomeLocale () {
      const urlSegment = _.get(window.location.pathname.split('/'), '[1]')
      if (urlSegment && siteLangs.some(lc => lc.code === urlSegment)) {
        return urlSegment
      }
      if (this.locale && siteLangs.some(lc => lc.code === this.locale)) {
        return this.locale
      }
      return siteConfig.lang
    },
    goHome () {
      const locale = this.getHomeLocale()
      window.location.assign(siteLangs.length > 0 ? `/${locale}/home` : '/')
    },
    toggleNavigation () {
      this.navOpen = !this.navOpen
    },
    upBtnScroll () {
      const scrollOffset = window.pageYOffset || document.documentElement.scrollTop
      this.upBtnShown = scrollOffset > window.innerHeight * 0.33
    },
    print () {
      if (this.printView) {
        this.printView = false
      } else {
        this.printView = true
        this.$nextTick(() => {
          window.print()
        })
      }
    },
    pageEdit () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageEdit')
    },
    pageHistory () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageHistory')
    },
    pageSource () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageSource')
    },
    pageConvert () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageConvert')
    },
    pageDuplicate () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageDuplicate')
    },
    pageMove () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageMove')
    },
    pageDelete () {
      if (!this.requireAuth()) { return }
      this.$root.$emit('pageDelete')
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

.page-header-block {
  position: relative;
  box-shadow: 0 4px 4px rgba(0, 0, 0, 0.1);
}

.page-header-section.is-page-header-title {
  position: relative;
  min-height: 70px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;

  .page-header-headings {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;

    .headline {
      text-align: center;
      width: 100%;
      margin-bottom: 0;
    }
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
        color: mc('blue', '700');
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

.page-header-section.is-page-header-subtitle {
  min-height: 36px;
  padding: 6px 16px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(0, 0, 0, 0.08);

  @at-root .theme--dark & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }

  .page-header-subheading {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    width: 100%;

    .caption {
      text-align: center;
      width: 100%;
      margin-bottom: 0;
    }
  }
}

.nav-drawer-mobile {
  padding-top: 0;
}

</style>
