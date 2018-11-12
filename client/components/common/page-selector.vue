<template lang="pug">
  v-dialog(v-model='isShown', lazy, max-width='850px')
    v-card.page-selector
      .dialog-header
        span Select Page Location
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      .d-flex(style='min-height:400px;')
        v-flex(xs4).grey.lighten-3
          v-toolbar(color='grey darken-3', dark, dense, flat)
            .body-2 Folders
            v-spacer
            v-btn(icon): v-icon create_new_folder
          v-treeview(
            v-model='tree'
            :items='treeFolders'
            :load-children='fetchFolders'
            activatable
            open-on-click
            hoverable
            )
            template(slot='prepend', slot-scope='{ item, open, leaf }')
              v-icon {{ open ? 'folder_open' : 'folder' }}
        v-flex(xs8)
          v-toolbar(color='grey darken-2', dark, dense, flat)
            .body-2 Pages
            v-divider.ml-4(vertical)
            v-text-field(
              prepend-inner-icon='search'
              label='Search...'
              hide-details
              solo
              background-color='grey darken-2'
              flat
              clearable
              )
            v-divider.mx-3(vertical)
            v-btn(icon): v-icon forward
            v-btn(icon): v-icon delete
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
          flat
          prepend-inner-icon='subdirectory_arrow_right'
          clearable
        )
      v-card-chin
        v-spacer
        v-btn(outline, @click='close') Cancel
        v-btn(color='primary', @click='open')
          v-icon(left) check
          span Select
</template>

<script>
export default {
  props: {
    value: {
      type: Boolean,
      default: false
    },
    mode: {
      type: String,
      default: 'create'
    }
  },
  data() {
    return {
      searchLoading: false,
      location: '/new-page',
      tree: [],
      treeChildren: []
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    treeFolders() {
      return [
        {
          id: '/',
          name: '/ (root)',
          children: []
        }
      ]
    }
  },
  methods: {
    close() {
      this.isShown = false
    },
    open() {
      if (this.mode === 'create') {
        window.location.assign(`/e${this.location}`)
      }
    },
    async fetchFolders(item) {
      console.info(item)
    }
  }
}
</script>

<style lang='scss'>

.page-selector {
  .v-treeview-node__label {
    font-size: 13px;
  }
}

</style>
