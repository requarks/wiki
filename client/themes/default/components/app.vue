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
      v-list(dense)
        v-list-tile.pt-2(href='/')
          v-list-tile-avatar: v-icon home
          v-list-tile-title Home
        v-divider.my-2
        v-subheader.pl-4 Navigation
        v-list-tile
          v-list-tile-avatar: v-icon stars
          v-list-tile-title The Universe
        v-list-tile
          v-list-tile-avatar: v-icon directions_boat
          v-list-tile-title Ships
        v-list-tile
          v-list-tile-avatar: v-icon local_airport
          v-list-tile-title Airports

    v-content
      v-toolbar(color='grey lighten-3', flat, dense)
        v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
          v-icon(color='grey darken-2', left) menu
          span Navigation
        v-breadcrumbs.pl-0(v-else, divider='/')
          v-breadcrumbs-item Universe
          v-breadcrumbs-item Galaxy
          v-breadcrumbs-item Solar System
          v-breadcrumbs-item Planet Earth

      v-divider
      v-layout(row)
        v-flex(xs12, lg9, xl10)
          v-toolbar(color='grey lighten-4', flat, :height='90')
            div
              .headline.grey--text.text--darken-3 {{title}}
              .caption.grey--text.text--darken-1 {{description}}
          .contents
            slot(name='contents')
        v-flex(lg3, xl2, fill-height, v-if='$vuetify.breakpoint.lgAndUp')
          v-toolbar(color='grey lighten-4', flat, :height='90')
            div
              .caption.grey--text.text--lighten-1 Last edited by
              .body-2.grey--text.text--darken-3 John Doe
              .caption.grey--text.text--darken-1 Monday at 12:34 PM
            v-spacer
            v-tooltip(bottom)
              v-btn(icon, slot='activator')
                v-icon(color='grey') edit
              span Edit Page
          v-list.grey.lighten-3(dense)
            v-subheader.pl-4 Table of contents
            v-list-tile
              v-list-tile-avatar: v-icon chevron_right
              v-list-tile-title Introduction
            v-list-tile
              v-list-tile-avatar: v-icon chevron_right
              v-list-tile-title Cities
            v-list-tile(inset)
              v-list-tile-avatar: v-icon chevron_right
              v-list-tile-title New York
            v-divider.my-2
            v-subheader.pl-4 Metadata
            v-list-tile
              v-list-tile-avatar: v-icon chevron_right
              v-list-tile-title Test
            v-list-tile
              v-list-tile-avatar: v-icon chevron_right
              v-list-tile-title Test
            v-list-tile
              v-list-tile-avatar: v-icon chevron_right
              v-list-tile-title Test
    nav-footer
</template>

<script>
export default {
  props: {
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      navOpen: false
    }
  },
  computed: {
    navShown: {
      get() { return this.navOpen || this.$vuetify.breakpoint.smAndUp },
      set(val) { this.navOpen = val }
    }
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
