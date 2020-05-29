<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-installing-updates.svg', alt='Extensions', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:extensions.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft {{ $t('admin:extensions.subtitle') }}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(xl6 lg8 xs12)
              v-alert.mb-4(outlined, color='error', icon='mdi-alert')
                span New extensions cannot be installed at the moment. This feature is coming in a future release.
              v-expansion-panels.admin-extensions-exp(hover, popout)
                v-expansion-panel(v-for='ext of extensions', :key='`ext-` + ext.key')
                  v-expansion-panel-header(disable-icon-rotate)
                    span {{ext.title}}
                    template(v-slot:actions)
                      v-chip(label, color='success', small, v-if='ext.isInstalled') Installed
                      v-chip(label, color='warning', small, v-else) Not Installed
                  v-expansion-panel-content.pa-0
                    v-card(flat, :class='$vuetify.theme.dark ? `grey darken-3` : `grey lighten-5`', tile)
                      v-card-text
                        .body-2 {{ext.description}}
                        v-divider.my-4
                        .body-2
                          strong.mr-2 This extension is
                          v-chip.mr-2(v-if='ext.isCompatible', label, outlined, small, color='success') compatible
                          v-chip.mr-2(v-else, label, small, color='error') not compatible
                          strong with your host.
                      v-card-chin
                        v-spacer
                        v-btn(disabled)
                          v-icon(left) mdi-plus
                          span Install
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      extensions: []
    }
  },
  methods: {
    async save () {
      // try {
      //   await this.$apollo.mutate({
      //     mutation: gql`
      //       mutation (
      //         $host: String!
      //       ) {
      //         site {
      //           updateConfig(
      //             host: $host
      //           ) {
      //             responseResult {
      //               succeeded
      //               errorCode
      //               slug
      //               message
      //             }
      //           }
      //         }
      //       }
      //     `,
      //     variables: {
      //       host: _.get(this.config, 'host', '')
      //     },
      //     watchLoading (isLoading) {
      //       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-extensions-update')
      //     }
      //   })
      //   this.$store.commit('showNotification', {
      //     style: 'success',
      //     message: 'Configuration saved successfully.',
      //     icon: 'check'
      //   })
      // } catch (err) {
      //   this.$store.commit('pushGraphError', err)
      // }
    }
  },
  apollo: {
    extensions: {
      query: gql`
        {
          system {
            extensions {
              key
              title
              description
              isInstalled
              isCompatible
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.system.extensions),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-extensions-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.admin-extensions-exp {
  .v-expansion-panel-content__wrap {
    padding: 0;
  }
}
</style>
