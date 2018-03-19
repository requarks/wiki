<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .headline.primary--text System Info
        .subheading.grey--text Information about your system
        v-layout.mt-3(row wrap)
          v-flex(lg6 xs12)
            v-card
              v-btn(fab, absolute, right, top, small, light, @click='refresh'): v-icon refresh
              v-list(two-line, dense)
                v-subheader Wiki.js
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue.white--text system_update_alt
                  v-list-tile-content
                    v-list-tile-title Current Version
                    v-list-tile-sub-title {{ info.currentVersion }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue.white--text open_in_browser
                  v-list-tile-content
                    v-list-tile-title Latest Version
                    v-list-tile-sub-title {{ info.latestVersion }}
                  v-list-tile-action
                    v-list-tile-action-text Published X days ago

                v-divider

                v-subheader Host Information
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text bubble_chart
                  v-list-tile-content
                    v-list-tile-title Operating System
                    v-list-tile-sub-title {{ info.operatingSystem }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text computer
                  v-list-tile-content
                    v-list-tile-title Hostname
                    v-list-tile-sub-title {{ info.hostname }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text nfc
                  v-list-tile-content
                    v-list-tile-title CPU Cores
                    v-list-tile-sub-title {{ info.cpuCores }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text memory
                  v-list-tile-content
                    v-list-tile-title Total RAM
                    v-list-tile-sub-title {{ info.ramTotal }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text last_page
                  v-list-tile-content
                    v-list-tile-title Working Directory
                    v-list-tile-sub-title {{ info.workingDirectory }}

          v-flex(lg6 xs12)
            v-card.pb-3
              v-list(dense)
                v-subheader Node.js
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.light-green(size='40')
                      icon-node-js(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title {{ info.nodeVersion }}

                v-divider

                v-subheader Redis
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.red(size='40')
                      icon-cube(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title {{ info.redisVersion }}
                    v-list-tile-sub-title {{ info.redisHost }}
                  v-list-tile-action
                    v-list-tile-action-text RAM Usage: {{ info.redisUsedRAM }} / {{ info.redisTotalRAM }}

                v-divider

                v-subheader PostgreSQL
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.indigo.darken-1(size='40')
                      icon-database(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title {{ info.postgreVersion }}
                    v-list-tile-sub-title {{ info.postgreHost }}

    v-snackbar(
      color='success'
      top
      v-model='refreshCompleted'
    )
      v-icon.mr-3(dark) cached
      | System Info has been refreshed.

</template>

<script>
import gql from 'graphql-tag'

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
    return {
      info: {},
      refreshCompleted: false
    }
  },
  apollo: {
    info: {
      query: gql`
        query {
          system {
            info {
              currentVersion
              latestVersion
              latestVersionReleaseDate
              operatingSystem
              hostname
              cpuCores
              ramTotal
              workingDirectory
              nodeVersion
              redisVersion
              redisUsedRAM
              redisTotalRAM
              redisHost
              postgreVersion
              postgreHost
            }
          }
        }
      `,
      update: (data) => data.system.info
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.info.refetch()
      this.refreshCompleted = true
    }
  }
}
</script>

<style lang='scss'>

</style>
