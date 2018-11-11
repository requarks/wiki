<template lang="pug">
  v-list(dense, :class='color', :dark='dark')
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
</template>

<script>
export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {}
  }
}
</script>
