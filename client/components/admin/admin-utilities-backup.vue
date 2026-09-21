<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 Export for Wiki.js 3.x
    v-card-text
      .text-center
        img.animated.fadeInUp.wait-p1s(src='/_assets/svg/icon-big-parcel.svg')
        .body-2 Export to a .wkbackup migration package
      v-divider.my-4
      .body-2 What do you want to include?
      v-checkbox(
        v-for='choice of entityChoices'
        :class='choice.requires ? `ml-6` : ``'
        :key='choice.key'
        :label='choice.label'
        :value='choice.key'
        :disabled='choice.requires && !entities.includes(choice.requires)'
        color='deep-orange darken-2'
        hide-details
        v-model='entities'
        )
        template(v-slot:label)
          div
            strong.deep-orange--text.text--darken-2 {{choice.label}}
            .text-caption {{choice.hint}}

      v-alert.mt-7(color='blue-grey darken-2', outlined, icon='mdi-information-outline', prominent)
        .body-2 The package is written to the #[strong backup] folder of your Wiki.js data path, and offered as a download once it's ready.
        .body-2 Import it from Wiki.js 3.x using #[strong Administration → Utilities → Import from Wiki.js 2.x]. The file is read by your browser, so it's never uploaded anywhere.

      v-alert.mt-3(color='deep-orange', outlined, icon='mdi-alert', prominent)
        .body-2 The package carries hashed user passwords, 2FA secrets and site configuration keys, and it is neither encrypted nor signed. Treat it as you would the database itself.
        .body-2 Carrying those credentials is what lets everyone keep their password and their authenticator app after the migration.

    v-card-chin
      v-btn.px-3(depressed, color='deep-orange darken-2', :disabled='entities.length < 1', @click='startBackup').ml-0
        v-icon(left, color='white') mdi-package-variant-closed
        span.white--text Create Package
    v-dialog(
      v-model='isLoading'
      persistent
      max-width='350'
      )
      v-card(color='deep-orange darken-2', dark)
        v-card-text.pa-10.text-center
          self-building-square-spinner.animated.fadeIn(
            :animation-duration='4500'
            :size='40'
            color='#FFF'
            style='margin: 0 auto;'
          )
          .mt-5.body-1.white--text Creating package...
          .caption Please wait, this may take a while
          v-progress-linear.mt-5(
            color='white'
            :value='progress'
            stream
            rounded
            :buffer-value='0'
          )
    v-dialog(
      v-model='isSuccess'
      persistent
      max-width='450'
      )
      v-card(color='green darken-2', dark)
        v-card-text.pa-10.text-center
          v-icon(size='60') mdi-check-circle-outline
          .mt-5.body-1.white--text Package created
          .mt-2.caption.white--text {{filename}}
          .caption(v-if='fileSize') {{prettyFileSize}}
          .mt-3.caption.text-truncate(v-if='filePath', :title='filePath') {{filePath}}
        v-card-actions.green.darken-1
          v-spacer
          v-btn.px-5(
            color='white'
            outlined
            @click='downloadBackup'
          )
            v-icon(left) mdi-download
            span Download
          v-btn.px-5(
            color='white'
            text
            @click='isSuccess = false'
          ) Close
          v-spacer
    v-dialog(
      v-model='isFailed'
      persistent
      max-width='800'
      )
      v-card(color='red darken-2', dark)
        v-toolbar(color='red darken-2', dense)
          v-icon mdi-alert
          .body-2.pl-3 Package creation failed
          v-spacer
          v-btn.px-5(
            color='white'
            text
            @click='isFailed = false'
            ) Close
        v-card-text.pa-5.red.darken-4.white--text
          span {{errorMessage}}
</template>

<script>
import { SelfBuildingSquareSpinner } from 'epic-spinners'

import gql from 'graphql-tag'
import _get from 'lodash/get'

export default {
  components: {
    SelfBuildingSquareSpinner
  },
  data() {
    return {
      entities: ['assets', 'navigation', 'pages', 'history', 'comments', 'settings', 'groups', 'users'],
      isLoading: false,
      isSuccess: false,
      isFailed: false,
      errorMessage: '',
      filename: '',
      filePath: '',
      fileSize: 0,
      progress: 0
    }
  },
  computed: {
    entityChoices () {
      return [
        {
          key: 'assets',
          label: 'Assets',
          hint: 'Media files such as images, documents, etc.'
        },
        {
          key: 'navigation',
          label: 'Navigation',
          hint: 'Sidebar links when using Static or Custom Navigation.'
        },
        {
          key: 'pages',
          label: 'Pages',
          hint: 'Page content, tags and related metadata. Rendered HTML is not included, as Wiki.js 3.x renders pages itself.'
        },
        // -> Neither of these makes sense without the pages they belong to.
        {
          key: 'history',
          label: 'Pages History',
          hint: 'All previous versions of pages and their related metadata.',
          requires: 'pages'
        },
        {
          key: 'comments',
          label: 'Comments',
          hint: 'Comments made using the default comment module only.',
          requires: 'pages'
        },
        {
          key: 'settings',
          label: 'Settings',
          hint: 'Site configuration and modules settings.'
        },
        {
          key: 'groups',
          label: 'User Groups',
          hint: 'Group permissions and page rules.'
        },
        {
          key: 'users',
          label: 'Users',
          hint: 'Users metadata, group memberships, password hashes and 2FA secrets.'
        }
      ]
    },
    prettyFileSize () {
      const units = ['bytes', 'KB', 'MB', 'GB', 'TB']
      let size = this.fileSize
      let unit = 0
      while (size >= 1024 && unit < units.length - 1) {
        size /= 1024
        unit++
      }
      return `${unit === 0 ? size : size.toFixed(2)} ${units[unit]}`
    }
  },
  watch: {
    entities (newEntities) {
      const orphaned = this.entityChoices
        .filter(choice => choice.requires && !newEntities.includes(choice.requires))
        .map(choice => choice.key)
      if (orphaned.some(key => newEntities.includes(key))) {
        this.entities = newEntities.filter(key => !orphaned.includes(key))
      }
    }
  },
  methods: {
    downloadBackup () {
      window.location.assign(`/_backup/${this.filename}`)
    },
    async checkProgress () {
      try {
        const respStatus = await this.$apollo.query({
          query: gql`
            {
              system {
                backupStatus {
                  status
                  progress
                  message
                  startedAt
                  filename
                  filePath
                  fileSize
                }
              }
            }
          `,
          fetchPolicy: 'network-only'
        })
        const respStatusObj = _get(respStatus, 'data.system.backupStatus', {})
        if (!respStatusObj) {
          throw new Error('An unexpected error occured.')
        } else {
          switch (respStatusObj.status) {
            case 'error': {
              throw new Error(respStatusObj.message || 'An unexpected error occured.')
            }
            case 'running': {
              this.progress = respStatusObj.progress || 0
              window.requestAnimationFrame(() => {
                setTimeout(() => {
                  this.checkProgress()
                }, 5000)
              })
              break
            }
            case 'success': {
              this.filename = respStatusObj.filename
              this.filePath = respStatusObj.filePath || ''
              this.fileSize = respStatusObj.fileSize || 0
              this.isLoading = false
              this.isSuccess = true
              break
            }
            default: {
              throw new Error('Invalid backup status.')
            }
          }
        }
      } catch (err) {
        this.errorMessage = err.message
        this.isLoading = false
        this.isFailed = true
      }
    },
    async startBackup () {
      this.isFailed = false
      this.isSuccess = false
      this.isLoading = true
      this.progress = 0

      setTimeout(async () => {
        try {
          // -> Initiate backup
          const respBackup = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $entities: [String]!
              ) {
                system {
                  createBackup (
                    entities: $entities
                  ) {
                    responseResult {
                      succeeded
                      message
                    }
                  }
                }
              }
            `,
            variables: {
              entities: this.entities
            }
          })

          const respBackupObj = _get(respBackup, 'data.system.createBackup', {})
          if (!_get(respBackupObj, 'responseResult.succeeded', false)) {
            this.errorMessage = _get(respBackupObj, 'responseResult.message', 'An unexpected error occurred')
            this.isLoading = false
            this.isFailed = true
            return
          }

          // -> Check for progress
          this.checkProgress()
        } catch (err) {
          this.$store.commit('pushGraphError', err)
          this.isLoading = false
        }
      }, 1500)
    }
  }
}
</script>

<style lang='scss'>

</style>
