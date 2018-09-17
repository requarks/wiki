<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header-icon: v-icon(size='80', color='grey lighten-2') tune
        .headline.primary--text {{ $t('admin:system.title') }}
        .subheading.grey--text {{ $t('admin:system.subtitle') }}
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
                    v-list-tile-title {{ $t('admin:system.currentVersion') }}
                    v-list-tile-sub-title {{ info.currentVersion }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue.white--text open_in_browser
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.latestVersion') }}
                    v-list-tile-sub-title {{ info.latestVersion }}
                  v-list-tile-action
                    v-list-tile-action-text {{ $t('admin:system.published') }} {{ info.latestVersionReleaseDate | moment('from') }}

                v-divider.mt-3

                v-subheader {{ $t('admin:system.hostInfo') }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text bubble_chart
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.os') }}
                    v-list-tile-sub-title {{ info.operatingSystem }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text computer
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.hostname') }}
                    v-list-tile-sub-title {{ info.hostname }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text nfc
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.cpuCores') }}
                    v-list-tile-sub-title {{ info.cpuCores }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text memory
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.totalRAM') }}
                    v-list-tile-sub-title {{ info.ramTotal }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text last_page
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.workingDirectory') }}
                    v-list-tile-sub-title {{ info.workingDirectory }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-icon.blue-grey.white--text settings
                  v-list-tile-content
                    v-list-tile-title {{ $t('admin:system.configFile') }}
                    v-list-tile-sub-title {{ info.configFile }}

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

                v-divider.mt-3

                v-subheader Redis
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.red(size='40')
                      icon-cube(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title {{ info.redisVersion }}
                    v-list-tile-sub-title {{ info.redisHost }}
                  v-list-tile-action
                    v-list-tile-action-text {{ $t('admin:system.ramUsage', { used: info.redisUsedRAM, total: info.redisTotalRAM }) }}

                v-divider.mt-3

                v-subheader {{ info.dbType }}
                v-list-tile(avatar)
                  v-list-tile-avatar
                    v-avatar.indigo.darken-1(size='40')
                      icon-database(fillColor='#FFFFFF')
                  v-list-tile-content
                    v-list-tile-title(v-html='dbVersion')
                    v-list-tile-sub-title {{ info.dbHost }}
</template>

<script>
import _ from 'lodash'

import systemInfoQuery from 'gql/admin/system/system-query-info.gql'

export default {
  components: {
  },
  data() {
    return {
      info: {}
    }
  },
  computed: {
    dbVersion() {
      return _.get(this.info, 'dbVersion', '').replace(/(?:\r\n|\r|\n)/g, '<br />')
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.info.refetch()
      this.$store.commit('showNotification', {
        message: 'System Info has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    }
  },
  apollo: {
    info: {
      query: systemInfoQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.system.info,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-system-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
