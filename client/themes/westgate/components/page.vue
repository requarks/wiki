<template lang="pug">
  v-app.westgate-theme(v-scroll='upBtnScroll', :dark='$vuetify.theme.dark', :class='$vuetify.rtl ? `is-rtl` : `is-ltr`')
    nav-header(v-if='!printView')
    v-navigation-drawer(
      v-if='navMode !== `NONE` && !printView && !$vuetify.breakpoint.lgAndUp'
      :class='$vuetify.theme.dark ? `grey darken-4-d4` : `primary`'
      dark
      app
      clipped
      mobile-breakpoint='600'
      :temporary='!$vuetify.breakpoint.lgAndUp'
      v-model='navShown'
      :right='$vuetify.rtl'
      class='westgate-nav-drawer'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(color='westgate-sidebar-list', :items='sidebarDecoded', :nav-mode='navMode')

    v-fab-transition(v-if='navMode !== `NONE`')
      v-btn(
        fab
        color='primary'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='!$vuetify.breakpoint.lgAndUp'
        v-show='!navShown'
        )
        v-icon mdi-menu

    v-main(ref='content')
      template(v-if='path !== `home`')
        .westgate-reading-shell-inner.breadcrumbs-container(v-if='$vuetify.breakpoint.smAndUp')
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
      v-container.pa-0(fluid)
        .westgate-reading-shell-inner
          v-row.page-header-section(no-gutters, align-content='center')
            v-col.page-col-content.is-page-header(cols='12', style='margin-top: auto; margin-bottom: auto;', :class='$vuetify.rtl ? `pr-4` : `pl-4`')
              .page-header-headings
                .headline.westgate-page-title {{title}}
                .caption.westgate-page-description {{description}}
              .page-edit-shortcuts(
                v-if='editShortcutsObj.editMenuBar'
                :class='tocPosition !== `off` ? `is-right` : ``'
                )
                v-btn(
                  v-if='editShortcutsObj.editMenuBtn'
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
      v-container.westgate-page-body(fluid, grid-list-xl)
        .westgate-reading-shell-inner
          .westgate-reading-row(:class='readingRowClass')
            aside.westgate-read-nav.westgate-inline-nav(
              v-if='navMode !== `NONE` && !printView && $vuetify.breakpoint.lgAndUp'
              aria-label='Site navigation'
              )
              vue-scroll(:ops='scrollStyle')
                nav-sidebar(color='westgate-sidebar-list', :items='sidebarDecoded', :nav-mode='navMode')
            .westgate-read-main.page-col-content
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
                        color='primary'
                        v-model='pageEditFab'
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
              .contents(ref='container')
                slot(name='contents')
              div(style='margin: 20px 0;')
              .westgate-page-meta
                v-card.page-comments-card.mb-5.meta-card(v-if='commentsEnabled && commentsPerms.read')
                  .pa-5
                    .overline.westgate-card-title.pb-2.d-flex.align-center
                      span {{$t('common:comments.sdTitle')}}
                    .d-flex
                      v-btn.text-none(
                        @click='goToComments()'
                        outlined
                        style='flex: 1 1 100%;'
                        small
                        )
                        span {{$t('common:comments.viewDiscussion')}}
                      v-tooltip(right, v-if='commentsPerms.write')
                        template(v-slot:activator='{ on }')
                          v-btn.ml-2(
                            @click='goToComments(true)'
                            v-on='on'
                            outlined
                            small
                            :aria-label='$t(`common:comments.newComment`)'
                            )
                            v-icon(dense) mdi-comment-plus
                        span {{$t('common:comments.newComment')}}

                v-card.page-author-card.mb-5.meta-card
                  .pa-5
                    .overline.westgate-card-title.d-flex
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
                            v-icon(dense) mdi-history
                        span {{$t('common:header.history')}}
                    .page-author-card-name.body-2 {{ authorName }}
                    .page-author-card-date.caption.westgate-muted-text {{ updatedAt | moment('calendar') }}

                v-card.page-shortcuts-card(flat).meta-card
                  v-toolbar.westgate-shortcuts-toolbar.westgate-meta-buttons(flat, dense)
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

              .comments-container#discussion(v-if='commentsEnabled && commentsPerms.read && !printView')
                .comments-header
                  v-icon.mr-2(dark) mdi-comment-text-outline
                  span {{$t('common:comments.title')}}
                .comments-main
                  slot(name='comments')

            //- TOC + tags rail (right of article; gated by tocPosition !== off in tocRailVisible)
            aside.westgate-read-rail.westgate-read-rail--toc(
              v-if='tocPosition !== `off` && $vuetify.breakpoint.lgAndUp'
              )
              v-card.page-toc-card.mb-5(v-if='tocDecoded.length')
                .overline.westgate-card-title.pa-5.pb-0 {{$t('common:page.toc')}}
                v-list.pb-3(dense, nav, :class='$vuetify.theme.dark ? `darken-3-d3` : ``')
                  template(v-for='(tocItem, tocIdx) in tocDecoded')
                    v-list-item(v-if='tocItem.title', @click='$vuetify.goTo(tocItem.anchor, scrollOpts)')
                      v-icon(color='grey', small) {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
                      v-list-item-title.px-3 {{tocItem.title}}
                    template(v-for='tocSubItem in tocItem.children')
                      v-list-item(v-if='tocSubItem.title', @click='$vuetify.goTo(tocSubItem.anchor, scrollOpts)')
                        v-icon.px-3(color='grey lighten-1', small) {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
                        v-list-item-title.px-3.caption.westgate-muted-text {{tocSubItem.title}}

              .westgate-read-rail__toc-placeholder.mb-5(v-else, aria-hidden='true')

              v-card.page-tags-card.mb-5(v-if='tags.length > 0')
                .pa-5
                  .overline.westgate-card-title.pb-2 {{$t('common:page.tags')}}
                  v-chip.mr-1.mb-1(
                    label
                    v-for='(tag, idx) in tags'
                    :href='`/t/` + tag.tag'
                    :key='`tag-tr-` + tag.tag'
                    )
                    v-icon(left, small) mdi-tag
                    span {{tag.title}}
                  v-chip.mr-1.mb-1(
                    label
                    :href='`/t/` + tags.map(t => t.tag).join(`/`)'
                    :aria-label='$t(`common:page.tagsMatching`)'
                    )
                    v-icon(size='20') mdi-tag-multiple
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
        color='primary'
        dark
        :style='upBtnPosition'
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

/* global siteLangs */

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
          background: '#c2a35a',
          hoverStyle: {
            background: '#e0c878'
          }
        }
      },
      winWidth: 0
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
      if (this.$vuetify.breakpoint.lgAndUp) {
        return this.$vuetify.rtl ? `left: 24px; right: auto;` : `right: 24px; left: auto;`
      }
      if (this.$vuetify.breakpoint.mdAndUp) {
        return this.$vuetify.rtl ? `right: 235px;` : `left: 235px;`
      }
      return this.$vuetify.rtl ? `right: 65px;` : `left: 65px;`
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
    readingRowClass () {
      return {
        'westgate-reading-row--toc-off': this.tocPosition === 'off',
        'westgate-reading-row--toc-right': this.tocPosition !== 'off',
        'is-rtl': this.$vuetify.rtl
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

    this.$store.set('page/mode', 'view')
  },
  mounted () {
    if (this.$vuetify.theme.dark) {
      this.scrollStyle.bar.background = '#a8893f'
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
    goHome () {
      if (this.locales && this.locales.length > 0) {
        window.location.assign(`/${this.locale}/home`)
      } else {
        window.location.assign('/')
      }
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
      if (!this.$vuetify.breakpoint.lgAndUp) {
        if (this.$vuetify.breakpoint.mdAndUp) {
          this.navShown = true
        } else {
          this.navShown = false
        }
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

.westgate-read-nav,
.westgate-read-rail--toc {
  margin-top: 0;
  align-self: flex-start;
  position: sticky;
  top: 64px;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  -ms-overflow-style: none;
}

.westgate-read-nav::-webkit-scrollbar,
.westgate-read-rail--toc::-webkit-scrollbar {
  display: none;
}

@media print {
  .westgate-read-nav,
  .westgate-read-rail--toc {
    display: none !important;
  }

  .westgate-read-main {
    max-width: none !important;
  }
}

.page-header-section {
  position: relative;

  > .is-page-header {
    position: relative;
  }

  .page-header-headings {
    min-height: 52px;
    display: flex;
    justify-content: center;
    flex-direction: column;
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
        color: #c2a35a;
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

</style>
