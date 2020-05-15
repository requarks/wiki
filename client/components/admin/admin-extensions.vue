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
                v-expansion-panel(v-for='ext of extensions')
                  v-expansion-panel-header(disable-icon-rotate)
                    span {{ext.title}}
                    template(v-slot:actions)
                      v-chip(label, color='success', small, v-if='ext.installed') Installed
                      v-chip(label, color='warning', small, v-else) Not Installed
                  v-expansion-panel-content.pa-0
                    v-card.grey.lighten-5.radius-7(flat)
                      v-card-text
                        .body-2 {{ext.description}}
                        v-divider.my-4
                        .body-2
                          strong.mr-3 Supported Platforms:
                          v-chip.mr-1(label, small, :color='ext.platforms[`linux-amd64`] ? `success` : `error`') Linux (x64)
                          v-chip.mr-1(label, small, :color='ext.platforms[`linux-arm64`] ? `success` : `error`') Linux (arm64)
                          v-chip.mr-1(label, small, :color='ext.platforms[`linux-armv7`] ? `success` : `error`') Linux (armv7)
                          v-chip.mr-1(label, small, :color='ext.platforms.macos ? `success` : `error`') MacOS
                          v-chip.mr-1(label, small, :color='ext.platforms.windows ? `success` : `error`') Windows
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
      config: {},
      extensions: [
        {
          title: 'Git',
          description: 'Distributed version control system. Required for the Git storage module.',
          platforms: {
            'linux-amd64': true,
            'linux-arm64': true,
            'linux-armv7': true,
            'macos': true,
            'windows': true
          },
          installed: true
        },
        {
          title: 'Pandoc',
          description: 'Convert between markup formats. Required for converting from other formats such as MediaWiki, AsciiDoc, Textile and other wikis.',
          platforms: {
            'linux-amd64': true,
            'linux-arm64': false,
            'linux-armv7': false,
            'macos': true,
            'windows': true
          },
          installed: false
        },
        {
          title: 'Puppeteer',
          description: 'Headless chromium browser for server-side rendering. Required for generating PDF versions of pages and render content elements on the server (e.g. Mermaid diagrams)',
          platforms: {
            'linux-amd64': true,
            'linux-arm64': false,
            'linux-armv7': false,
            'macos': true,
            'windows': true
          },
          installed: false
        },
        {
          title: 'Sharp',
          description: 'Process and transform images. Required to generate thumbnails of uploaded images and perform transformations.',
          platforms: {
            'linux-amd64': true,
            'linux-arm64': false,
            'linux-armv7': false,
            'macos': true,
            'windows': true
          },
          installed: false
        }
      ]
    }
  },
  computed: {
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $host: String!
            ) {
              site {
                updateConfig(
                  host: $host
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            host: _.get(this.config, 'host', '')
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Configuration saved successfully.',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  }
  // apollo: {
  //   config: {
  //     query: gql`
  //       {
  //         site {
  //           config {
  //             host
  //           }
  //         }
  //       }
  //     `,
  //     fetchPolicy: 'network-only',
  //     update: (data) => _.cloneDeep(data.site.config),
  //     watchLoading (isLoading) {
  //       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-refresh')
  //     }
  //   }
  // }
}
</script>

<style lang='scss'>
.admin-extensions-exp {
  .v-expansion-panel-content__wrap {
    padding: 0;
  }
}
</style>
