<template lang="pug">
  v-app(v-scroll='upBtnScroll', :dark='darkMode')
    nav-header
    v-navigation-drawer(
      :class='darkMode ? `grey darken-5` : `primary`'
      dark
      app
      clipped
      mobile-break-point='600'
      :temporary='$vuetify.breakpoint.mdAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(:color='darkMode ? `grey darken-5` : `primary`')
          slot(name='sidebar')

    v-fab-transition
      v-btn(
        fab
        color='primary'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='$vuetify.breakpoint.mdAndDown'
        v-show='!navShown'
        )
        v-icon menu

    v-content(ref='content')
      template(v-if='path !== `home`')
        v-toolbar(:color='darkMode ? `grey darken-4-d3` : `grey lighten-3`', flat, dense, v-if='$vuetify.breakpoint.smAndUp')
          //- v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
          //-   v-icon(color='grey darken-2', left) menu
          //-   span Navigation
          v-breadcrumbs.breadcrumbs-nav.pl-0(
            :items='breadcrumbs'
            divider='/'
            )
            template(slot='item', slot-scope='props')
              v-icon(v-if='props.item.path === "/"', small, @click='goHome') home
              v-btn.ma-0(v-else, :href='props.item.path', small, flat) {{props.item.name}}
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text {{$t('common:page.unpublished')}}
            status-indicator.ml-3(negative, pulse)
        v-divider
      v-layout(row)
        v-flex(xs12, lg9, xl10)
          v-toolbar(:color='darkMode ? `grey darken-4-l3` : `grey lighten-4`', flat, :height='90')
            div
              .headline.grey--text(:class='darkMode ? `text--lighten-2` : `text--darken-3`') {{title}}
              .caption.grey--text.text--darken-1 {{description}}
          v-divider
          .contents(ref='container')
            slot(name='contents')

        v-flex(lg3, xl2, fill-height, v-if='$vuetify.breakpoint.lgAndUp')
          v-toolbar(:color='darkMode ? `grey darken-4-l3` : `grey lighten-4`', flat, :height='90')
            div
              .caption.grey--text.text--lighten-1 {{$t('common:page.lastEditedBy')}}
              .body-2.grey--text(:class='darkMode ? `` : `text--darken-3`') {{ authorName }}
              .caption.grey--text.text--darken-1 {{ updatedAt | moment('calendar') }}
            template(v-if='isAuthenticated')
              v-spacer
              v-tooltip(left)
                v-btn.btn-animate-edit(icon, slot='activator', :href='"/e/" + locale + "/" + path')
                  v-icon(color='grey') edit
                span {{$t('common:page.editPage')}}
          v-divider
          template(v-if='toc.length')
            v-list.grey.pb-3(dense, :class='darkMode ? `darken-3-d3` : `lighten-3`')
              v-subheader.pl-4(:class='darkMode ? `indigo--text text--lighten-3` : `primary--text`') {{$t('common:page.toc')}}
              template(v-for='(tocItem, tocIdx) in toc')
                v-list-tile(@click='$vuetify.goTo(tocItem.anchor, scrollOpts)')
                  v-icon(color='grey') arrow_right
                  v-list-tile-title.pl-3 {{tocItem.title}}
                v-divider.ml-4(v-if='tocIdx < toc.length - 1 || tocItem.children.length')
                template(v-for='tocSubItem in tocItem.children')
                  v-list-tile(@click='$vuetify.goTo(tocSubItem.anchor, scrollOpts)')
                    v-icon.pl-3(color='grey lighten-1') arrow_right
                    v-list-tile-title.pl-3.caption {{tocSubItem.title}}
                  v-divider(inset, v-if='tocIdx < toc.length - 1')
            v-divider
          //- v-list.grey(dense, :class='darkMode ? `darken-3` : `lighten-4`')
          //-   v-subheader.pl-4.yellow--text.text--darken-4 Rating
          //-   .text-xs-center
          //-     v-rating(
          //-       v-model='rating'
          //-       color='yellow darken-3'
          //-       background-color='grey lighten-1'
          //-       half-increments
          //-       hover
          //-     )
          //-     .pb-2.caption.grey--text 5 votes
          //- v-divider
          template(v-if='tags.length')
            v-list.grey(dense, :class='darkMode ? `darken-3-d3` : `lighten-3`')
              v-subheader.pl-4.teal--text Tags
              template(v-for='(tag, idx) in tags')
                v-list-tile(:href='`/t/` + tag.slug')
                  v-list-tile-avatar: v-icon(color='teal') label
                  v-list-tile-title {{tag.title}}
                v-divider(inset, v-if='idx < tags.length - 1')
            v-divider
          v-toolbar(:color='darkMode ? `grey darken-3` : `grey lighten-4`', flat, dense)
            v-spacer
            v-tooltip(bottom)
              v-btn(icon, slot='activator'): v-icon(color='grey') bookmark
              span {{$t('common:page.bookmark')}}
            v-tooltip(bottom)
              v-btn(icon, slot='activator'): v-icon(color='grey') share
              span {{$t('common:page.share')}}
            v-tooltip(bottom)
              v-btn(icon, slot='activator'): v-icon(color='grey') print
              span {{$t('common:page.printFormat')}}
            v-spacer
    nav-footer
    notify
    search-results
    v-fab-transition
      v-btn(
        v-if='upBtnShown'
        fab
        fixed
        bottom
        :right='!$vuetify.rtl'
        :left='$vuetify.rtl'
        small
        @click='$vuetify.goTo(0, scrollOpts)'
        color='primary'
        )
        v-icon arrow_upward
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import Prism from 'prismjs'
import { get } from 'vuex-pathify'
import _ from 'lodash'

export default {
  components: {
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
    isPublished: {
      type: Boolean,
      default: false
    },
    toc: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      navShown: false,
      navExpanded: false,
      upBtnShown: false,
      scrollOpts: {
        duration: 1500,
        offset: -75,
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
      }
    }
  },
  computed: {
    darkMode: get('site/dark'),
    isAuthenticated: get('user/authenticated'),
    rating: {
      get () {
        return 3.5
      },
      set (val) {

      }
    },
    breadcrumbs() {
      return [{ path: '/', name: 'Home' }].concat(_.reduce(this.path.split('/'), (result, value, key) => {
        result.push({
          path: _.map(result, 'path').join('/') + `/${value}`,
          name: value
        })
        return result
      }, []))
    }
  },
  created() {
    this.$store.commit('page/SET_AUTHOR_ID', this.authorId)
    this.$store.commit('page/SET_AUTHOR_NAME', this.authorName)
    this.$store.commit('page/SET_CREATED_AT', this.createdAt)
    this.$store.commit('page/SET_DESCRIPTION', this.description)
    this.$store.commit('page/SET_IS_PUBLISHED', this.isPublished)
    this.$store.commit('page/SET_ID', this.pageId)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)
    this.$store.commit('page/SET_TAGS', this.tags)
    this.$store.commit('page/SET_TITLE', this.title)
    this.$store.commit('page/SET_UPDATED_AT', this.updatedAt)

    this.$store.commit('page/SET_MODE', 'view')
  },
  mounted () {
    Prism.highlightAllUnder(this.$refs.container)
    this.navShown = this.$vuetify.breakpoint.smAndUp
  },
  methods: {
    goHome () {
      window.location.assign('/')
    },
    toggleNavigation () {
      this.navOpen = !this.navOpen
    },
    upBtnScroll () {
      const scrollOffset = window.pageYOffset || document.documentElement.scrollTop
      this.upBtnShown = scrollOffset > window.innerHeight * 0.33
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

</style>
