<template lang="pug">
  v-app(v-scroll='upBtnScroll')
    nav-header
    v-navigation-drawer.primary(
      dark
      app
      clipped
      :mini-variant='$vuetify.breakpoint.md || $vuetify.breakpoint.sm'
      mini-variant-width='80'
      mobile-break-point='600'
      :temporary='$vuetify.breakpoint.xs'
      v-model='navShown'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar
          slot(name='sidebar')

    v-content
      template(v-if='path !== `home`')
        v-toolbar(color='grey lighten-3', flat, dense)
          v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
            v-icon(color='grey darken-2', left) menu
            span Navigation
          v-breadcrumbs.breadcrumbs-nav.pl-0(
            v-else
            :items='breadcrumbs'
            divider='/'
            )
            template(slot='item', slot-scope='props')
              v-icon(v-if='props.item.path === "/"', small) home
              v-btn.ma-0(v-else, :href='props.item.path', small, flat) {{props.item.name}}
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text Unpublished
            status-indicator.ml-3(negative, pulse)
        v-divider
      v-layout(row)
        v-flex(xs12, lg9, xl10)
          v-toolbar(color='grey lighten-4', flat, :height='90')
            div
              .headline.grey--text.text--darken-3 {{title}}
              .caption.grey--text.text--darken-1 {{description}}
          v-divider
          .contents(ref='container')
            slot(name='contents')

        v-flex(lg3, xl2, fill-height, v-if='$vuetify.breakpoint.lgAndUp')
          v-toolbar(color='grey lighten-4', flat, :height='90')
            div
              .caption.grey--text.text--lighten-1 Last edited by
              .body-2.grey--text.text--darken-3 {{ authorName }}
              .caption.grey--text.text--darken-1 {{ updatedAt | moment('calendar') }}
            v-spacer
            v-tooltip(left)
              v-btn.btn-animate-edit(icon, slot='activator', :href='"/e/" + path')
                v-icon(color='grey') edit
              span Edit Page
          v-divider
          template(v-if='toc.length')
            v-list.grey.lighten-3.pb-3(dense)
              v-subheader.pl-4.primary--text Table of contents
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
          v-list.grey.lighten-4(dense)
            v-subheader.pl-4.yellow--text.text--darken-4 Rating
            .text-xs-center
              v-rating(
                v-model='rating'
                color='yellow darken-3'
                background-color='grey lighten-1'
                half-increments
                hover
              )
              .pb-2.caption.grey--text 5 votes
          v-divider
          v-list.grey.lighten-3(dense)
            v-subheader.pl-4.teal--text Tags
            v-list-tile
              v-list-tile-avatar: v-icon(color='teal') label
              v-list-tile-title Astrophysics
            v-divider(inset)
            v-list-tile
              v-list-tile-avatar: v-icon(color='teal') label
              v-list-tile-title Space
            v-divider(inset)
            v-list-tile
              v-list-tile-avatar: v-icon(color='teal') label
              v-list-tile-title Planets
          v-divider
          v-toolbar(color='grey lighten-4', flat, dense)
            v-spacer
            v-tooltip(bottom)
              v-btn(icon, slot='activator'): v-icon(color='grey') bookmark
              span Bookmark
            v-tooltip(bottom)
              v-btn(icon, slot='activator'): v-icon(color='grey') share
              span Share
            v-tooltip(bottom)
              v-btn(icon, slot='activator'): v-icon(color='grey') print
              span Print Format
            v-spacer
    nav-footer
    v-fab-transition
      v-btn(v-if='upBtnShown', fab, fixed, bottom, right, small, @click='$vuetify.goTo(0, scrollOpts)', color='primary')
        v-icon arrow_upward
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import Prism from '@/libs/prism/prism.js'

export default {
  components: {
    StatusIndicator
  },
  props: {
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
      navOpen: false,
      upBtnShown: false,
      scrollOpts: {
        duration: 1500,
        offset: -75,
        easing: 'easeInOutCubic'
      },
      breadcrumbs: [
        { path: '/', name: 'Home' },
        { path: '/universe', name: 'Universe' },
        { path: '/universe/galaxy', name: 'Galaxy' },
        { path: '/universe/galaxy/solar-system', name: 'Solar System' },
        { path: '/universe/galaxy/solar-system/planet-earth', name: 'Planet Earth' }
      ],
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
    navShown: {
      get() { return this.navOpen || this.$vuetify.breakpoint.smAndUp },
      set(val) { this.navOpen = val }
    },
    rating: {
      get () {
        return 3.5
      },
      set (val) {

      }
    }
  },
  created() {
    this.$store.commit('page/SET_AUTHOR_ID', this.authorId)
    this.$store.commit('page/SET_AUTHOR_NAME', this.authorName)
    this.$store.commit('page/SET_CREATED_AT', this.createdAt)
    this.$store.commit('page/SET_DESCRIPTION', this.description)
    this.$store.commit('page/SET_IS_PUBLISHED', this.isPublished)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)
    this.$store.commit('page/SET_TAGS', this.tags)
    this.$store.commit('page/SET_TITLE', this.title)
    this.$store.commit('page/SET_UPDATED_AT', this.updatedAt)

    this.$store.commit('page/SET_MODE', 'view')
  },
  mounted () {
    Prism.highlightAllUnder(this.$refs.container)
  },
  methods: {
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
