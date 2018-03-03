<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .headline.blue--text.text--darken-2 System Info
        .subheading.grey--text Information about your system
        v-layout.mt-3(row wrap)
          v-flex(lg6 xs12)
            v-card
              v-btn(fab, absolute, right, top, small, light): v-icon refresh
              v-list(two-line, dense)
                v-subheader Wiki.js
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue.white--text system_update_alt
                  v-list-tile-content
                    v-list-tile-title Current Version
                    v-list-tile-sub-title 2.0.0
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue.white--text open_in_browser
                  v-list-tile-content
                    v-list-tile-title Latest Version
                    v-list-tile-sub-title 2.0.0
                  v-list-tile-action
                    v-list-tile-action-text Published 4 days ago

                v-divider

                v-subheader Host Information
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text bubble_chart
                  v-list-tile-content
                    v-list-tile-title Operating System
                    v-list-tile-sub-title Linux (linux) 4.4.0-116-generic x64
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text computer
                  v-list-tile-content
                    v-list-tile-title Hostname
                    v-list-tile-sub-title wikijs
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text nfc
                  v-list-tile-content
                    v-list-tile-title CPU Cores
                    v-list-tile-sub-title 8
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text memory
                  v-list-tile-content
                    v-list-tile-title Total RAM
                    v-list-tile-sub-title 16.0 Gb
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text last_page
                  v-list-tile-content
                    v-list-tile-title Working Directory
                    v-list-tile-sub-title /var/wiki

          v-flex(lg6 xs12)
            v-card.pb-3
              v-list(dense)
                v-subheader Node.js
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.light-green(size='40')
                      icon-node-js(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title v8.9.4

                v-divider

                v-subheader Redis
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.red(size='40')
                      icon-cube(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title 4.0.8

                v-divider

                v-subheader PostgreSQL
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.indigo.darken-1(size='40')
                      icon-database(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title 9.6.8

</template>

<script>
import IconCube from 'mdi/cube'
import IconDatabase from 'mdi/database'
import IconNodeJs from 'mdi/nodejs'

export default {
  components: {
    IconCube,
    IconDatabase,
    IconNodeJs
  },
  data() {
    return {}
  }
}
</script>

<style lang='scss'>

</style>
