<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-tune.svg', alt='System Info', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:system.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{ $t('admin:system.subtitle') }}
        v-layout.mt-3(row wrap)
          v-flex(lg6 xs12)
            v-card.animated.fadeInUp
              v-btn.animated.fadeInLeft.wait-p2s.btn-animate-rotate(fab, absolute, :right='!$vuetify.rtl', :left='$vuetify.rtl', top, small, light, @click='refresh'): v-icon(color='grey') mdi-refresh
              v-subheader Wiki.js
              v-list(two-line, dense)
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue.white--text mdi-application-export
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.currentVersion') }}
                    v-list-item-subtitle {{ info.currentVersion }}
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue.white--text mdi-inbox-arrow-up
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.latestVersion') }}
                    v-list-item-subtitle {{ info.latestVersion }}
                  v-list-item-action
                    v-list-item-action-text {{ $t('admin:system.published') }} {{ info.latestVersionReleaseDate | moment('from') }}

              v-divider.mt-3
              v-subheader {{ $t('admin:system.hostInfo') }}
              v-list(two-line, dense)
                v-list-item(avatar)
                  v-list-item-avatar
                    v-avatar.blue-grey(size='40')
                      v-icon(color='white') {{platformLogo}}
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.os') }}
                    v-list-item-subtitle {{ (info.platform === 'docker') ? 'Docker Container (Linux)' : info.operatingSystem }}
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue-grey.white--text mdi-desktop-classic
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.hostname') }}
                    v-list-item-subtitle {{ info.hostname }}
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue-grey.white--text mdi-cpu-64-bit
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.cpuCores') }}
                    v-list-item-subtitle {{ info.cpuCores }}
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue-grey.white--text mdi-memory
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.totalRAM') }}
                    v-list-item-subtitle {{ info.ramTotal }}
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue-grey.white--text mdi-iframe-outline
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.workingDirectory') }}
                    v-list-item-subtitle {{ info.workingDirectory }}
                v-list-item(avatar)
                  v-list-item-avatar
                    v-icon.blue-grey.white--text mdi-card-bulleted-settings-outline
                  v-list-item-content
                    v-list-item-title {{ $t('admin:system.configFile') }}
                    v-list-item-subtitle {{ info.configFile }}

          v-flex(lg6 xs12)
            v-card.pb-3.animated.fadeInUp.wait-p4s
              v-subheader Node.js
              v-list(dense)
                v-list-item(avatar)
                  v-list-item-avatar
                    v-avatar.light-green(size='40')
                      v-icon(color='white') mdi-nodejs
                  v-list-item-content
                    v-list-item-title {{ info.nodeVersion }}

              v-divider.mt-3
              v-subheader {{ info.dbType }}
              v-list(dense)
                v-list-item(avatar)
                  v-list-item-avatar
                    v-avatar.indigo.darken-1(size='40')
                      v-icon(color='white') mdi-database
                  v-list-item-content
                    v-list-item-title(v-html='dbVersion')
                    v-list-item-subtitle {{ info.dbHost }}

                v-alert.mt-3.mx-4(:value='isDbLimited', color='deep-orange darken-2', icon='mdi-alert', dark) {{ $t('admin:system.dbPartialSupport') }}
</template>

<script>
import _ from 'lodash'

import systemInfoQuery from 'gql/admin/system/system-query-info.gql'

export default {
  data() {
    return {
      info: {}
    }
  },
  computed: {
    dbVersion() {
      return _.get(this.info, 'dbVersion', '').replace(/(?:\r\n|\r|\n)/g, '<br />')
    },
    platformLogo() {
      switch (this.info.platform) {
        case 'docker':
          return 'mdi-docker'
        case 'darwin':
          return 'mdi-apple'
        case 'linux':
          if (this.info.operatingSystem.indexOf('Ubuntu')) {
            return 'mdi-ubuntu'
          } else {
            return 'mdi-linux'
          }
        case 'win32':
          return 'mdi-windows'
        default:
          return ''
      }
    },
    isDbLimited() {
      return this.info.dbType === 'MySQL' && this.dbVersion.indexOf('5.') === 0
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.info.refetch()
      this.$store.commit('showNotification', {
        message: this.$t('admin:system.refreshSuccess'),
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
