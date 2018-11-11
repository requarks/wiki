<template lang="pug">
  v-app
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
      nav-sidebar

    v-content
      v-toolbar(color='grey lighten-3', flat, dense)
        v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
          v-icon(color='grey darken-2', left) menu
          span Navigation
        v-breadcrumbs.pl-0(v-else, divider='/')
          v-breadcrumbs-item: v-icon home
          v-breadcrumbs-item Universe
          v-breadcrumbs-item Galaxy
          v-breadcrumbs-item Solar System
          v-breadcrumbs-item Planet Earth
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
          v-list.grey.lighten-3.pb-3(dense)
            v-subheader.pl-4.primary--text Table of contents
            vue-tree-navigation.treenav(:items='toc', :defaultOpenLevel='1')
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
    }
  },
  data() {
    return {
      navOpen: false,
      toc: [
        {
          name: 'Introduction',
          element: 'introduction'
        },
        {
          name: 'Cities',
          element: 'cities',
          children: [
            {
              name: 'New York',
              element: 'contact',
              children: [
                { name: 'E-mail', element: 'email' },
                { name: 'Phone', element: 'phone' }
              ]
            },
            {
              name: 'Chicago',
              element: 'contact',
              children: [
                { name: 'E-mail', element: 'email' },
                { name: 'Phone', element: 'phone' }
              ]
            }
          ]
        },
        { name: 'Population', external: 'https://github.com' }
      ]
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
  },
  mounted () {
    Prism.highlightAllUnder(this.$refs.container)
  },
  methods: {
    toggleNavigation () {
      this.navOpen = !this.navOpen
    }
  }
}
</script>

<style lang="scss">

</style>
