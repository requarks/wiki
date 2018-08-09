<template lang="pug">
  v-app
    nav-header
    v-navigation-drawer.primary(dark, app, clipped, permanent)
      v-list(dense)
        v-list-tile.pt-2
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
        v-breadcrumbs.pl-0(divider='/')
          v-breadcrumbs-item Universe
          v-breadcrumbs-item Galaxy
          v-breadcrumbs-item Solar System
          v-breadcrumbs-item Planet Earth

      v-divider
      v-layout(row)
        v-flex(xs10)
          v-toolbar(color='grey lighten-4', flat, :height='90')
            div
              .headline.grey--text.text--darken-3 {{title}}
              .caption.grey--text.text--darken-1 {{description}}
          .contents
            slot(name='contents')
        v-flex(xs2, fill-height)
          v-toolbar(color='grey lighten-4', flat, :height='90')
            div
              .caption.grey--text.text--lighten-1 Last edited by
              .body-2.grey--text.text--darken-3 John Doe
              .caption.grey--text.text--darken-1 Monday at 12:34 PM
            v-spacer
            v-icon edit
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
  }
}
</script>

<style lang="scss">

</style>
