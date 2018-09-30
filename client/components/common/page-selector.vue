<template lang="pug">
  v-dialog(v-model='isShown', lazy, max-width='850px')
    v-card
      .dialog-header
        span Select Page Location
        v-spacer
        v-text-field.mr-3(
          solo
          flat
          background-color='blue darken-2'
          dark
          prepend-inner-icon='search'
          label='Search...'
          clearable
          :height='20'
          hide-details
          )
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      .d-flex(style='min-height:400px;')
        v-flex(xs4).grey.lighten-3
          v-toolbar(color='grey lighten-2', dense, flat)
            v-btn(icon): v-icon(color='grey') arrow_upward
            v-spacer
            v-btn(icon): v-icon(color='grey darken-2') create_new_folder
          v-list.grey.lighten-3(dense)
            v-list-tile.primary(dark)
              v-list-tile-avatar: v-icon folder_open
              v-list-tile-title.white--text / (Site Root)
            v-divider
            v-list-tile
              v-list-tile-avatar: v-icon folder
              v-list-tile-title Folder B
        v-flex(xs8)
          v-toolbar(color='grey lighten-4', dense, flat)
            v-spacer
            v-btn(icon): v-icon(color='grey') forward
            v-btn(icon): v-icon(color='grey') delete
          v-list(dense)
            v-list-tile
              v-list-tile-avatar: v-icon insert_drive_file
              v-list-tile-title File A
            v-divider
            v-list-tile
              v-list-tile-avatar: v-icon insert_drive_file
              v-list-tile-title File B
            v-divider
            v-list-tile
              v-list-tile-avatar: v-icon insert_drive_file
              v-list-tile-title File C
            v-divider
            v-list-tile
              v-list-tile-avatar: v-icon insert_drive_file
              v-list-tile-title File D
      v-card-text.grey.lighten-2.pa-2
        v-text-field(
          solo
          hide-details
          v-model='location'
        )
      v-card-chin
        v-spacer
        v-btn(outline, @click='close') Cancel
        v-btn(color='primary')
          v-icon(left) check
          span Select
</template>

<script>
export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      searchLoading: true,
      location: '/new-page'
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  methods: {
    close() {
      this.isShown = false
    }
  }
}
</script>
