<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.exportTitle') }}
    v-card-text
      .text-center
        img.animated.fadeInUp.wait-p1s(src='/_assets/svg/icon-archive-folder.svg')
        .body-2 Export to tarball / file system
      v-divider.my-4
      .body-2 What do you want to export?
      v-checkbox(
        v-for='choice of entityChoices'
        :key='choice.key'
        :label='choice.label'
        :value='choice.key'
        color='deep-orange darken-2'
        hide-details
        v-model='entities'
        )
        template(v-slot:label)
          div
            strong.deep-orange--text.text--darken-2 {{choice.label}}
            .text-caption {{choice.hint}}
      v-text-field.mt-7(
        outlined
        label='Target Folder Path'
        hint='Either an absolute path or relative to the Wiki.js installation folder.'
        persistent-hint
        v-model='filePath'
      )

      v-alert.mt-3(color='deep-orange', outlined, icon='mdi-alert', prominent)
        .body-2 Depending on your selection, the archive could contain sensitive data such as site configuration keys and user hashed passwords. Ensure the exported archive is treated accordingly.
        .body-2 For example, you may want to encrypt the archive if stored for backup purposes.

    v-card-chin
      v-btn.px-3(depressed, color='deep-orange darken-2', :disabled='entities.length < 1', @click='startExport').ml-0
        v-icon(left, color='white') mdi-database-export
        span.white--text Start Export
    v-dialog(
      v-model='isLoading'
      persistent
      max-width='350'
      )
      v-card(color='deep-orange darken-2', dark)
        v-card-text.pa-10.text-center
          semipolar-spinner.animated.fadeIn(
            :animation-duration='1500'
            :size='65'
            color='#FFF'
            style='margin: 0 auto;'
          )
          .mt-5.body-1.white--text Exporting...
          .caption Please wait
          v-progress-linear.mt-5(
            color='white'
            :value='progress'
            stream
            rounded
            :buffer-value='0'
          )
</template>

<script>
import _ from 'lodash'

import { SemipolarSpinner } from 'epic-spinners'

import utilityImportv1UsersMutation from 'gql/admin/utilities/utilities-mutation-importv1-users.gql'
import storageTargetsQuery from 'gql/admin/storage/storage-query-targets.gql'
import storageStatusQuery from 'gql/admin/storage/storage-query-status.gql'
import targetExecuteActionMutation from 'gql/admin/storage/storage-mutation-executeaction.gql'
import targetsSaveMutation from 'gql/admin/storage/storage-mutation-save-targets.gql'

export default {
  components: {
    SemipolarSpinner
  },
  data() {
    return {
      entities: [],
      filePath: './data/export',
      isLoading: false,
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
          key: 'comments',
          label: 'Comments',
          hint: 'Comments made using the default comment module only.'
        },
        {
          key: 'navigation',
          label: 'Navigation',
          hint: 'Sidebar links when using Static or Custom Navigation.'
        },
        {
          key: 'pages',
          label: 'Pages',
          hint: 'Page content, tags and related metadata.'
        },
        {
          key: 'history',
          label: 'Pages History',
          hint: 'All previous versions of pages and their related metadata.'
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
          hint: 'Users metadata and their group memberships.'
        }
      ]
    }
  },
  methods: {
    async startExport () {
      this.isLoading = true
      this.progress = 0
      this.failedUsers = []

      _.delay(async () => {
        // -> Import Users

        if (this.wantUsers) {
          try {
            const resp = await this.$apollo.mutate({
              mutation: utilityImportv1UsersMutation,
              variables: {
                mongoDbConnString: this.dbConnStr,
                groupMode: this.groupMode
              }
            })
            const respObj = _.get(resp, 'data.system.importUsersFromV1', {})
            if (!_.get(respObj, 'responseResult.succeeded', false)) {
              throw new Error(_.get(respObj, 'responseResult.message', 'An unexpected error occurred'))
            }
            this.successUsers = _.get(respObj, 'usersCount', 0)
            this.successGroups = _.get(respObj, 'groupsCount', 0)
            this.failedUsers = _.get(respObj, 'failed', [])
            this.progress += 50
          } catch (err) {
            this.$store.commit('pushGraphError', err)
            this.isLoading = false
            return
          }
        }

        // -> Import Content

        if (this.wantContent) {
          try {
            const resp = await this.$apollo.query({
              query: storageTargetsQuery,
              fetchPolicy: 'network-only'
            })
            if (_.has(resp, 'data.storage.targets')) {
              this.progress += 10
              let targets = resp.data.storage.targets.map(str => {
                let nStr = {
                  ...str,
                  config: _.sortBy(str.config.map(cfg => ({
                    ...cfg,
                    value: JSON.parse(cfg.value)
                  })), [t => t.value.order])
                }

                // -> Setup Git Module

                if (this.contentMode === 'git' && nStr.key === 'git') {
                  nStr.isEnabled = true
                  nStr.mode = 'sync'
                  nStr.syncInterval = 'PT5M'
                  nStr.config = [
                    { key: 'authType', value: { value: this.gitAuthMode } },
                    { key: 'repoUrl', value: { value: this.gitRepoUrl } },
                    { key: 'branch', value: { value: this.gitRepoBranch } },
                    { key: 'sshPrivateKeyMode', value: { value: 'contents' } },
                    { key: 'sshPrivateKeyPath', value: { value: '' } },
                    { key: 'sshPrivateKeyContent', value: { value: this.gitPrivKey } },
                    { key: 'verifySSL', value: { value: this.gitVerifySSL } },
                    { key: 'basicUsername', value: { value: this.gitUsername } },
                    { key: 'basicPassword', value: { value: this.gitPassword } },
                    { key: 'defaultEmail', value: { value: this.gitUserEmail } },
                    { key: 'defaultName', value: { value: this.gitUserName } },
                    { key: 'localRepoPath', value: { value: this.gitRepoPath } },
                    { key: 'gitBinaryPath', value: { value: '' } }
                  ]
                }

                // -> Setup Disk Module
                if (this.contentMode === 'disk' && nStr.key === 'disk') {
                  nStr.isEnabled = true
                  nStr.mode = 'push'
                  nStr.syncInterval = 'P0D'
                  nStr.config = [
                    { key: 'path', value: { value: this.contentPath } },
                    { key: 'createDailyBackups', value: { value: false } }
                  ]
                }
                return nStr
              })

              // -> Save storage modules configuration

              const respSv = await this.$apollo.mutate({
                mutation: targetsSaveMutation,
                variables: {
                  targets: targets.map(tgt => _.pick(tgt, [
                    'isEnabled',
                    'key',
                    'config',
                    'mode',
                    'syncInterval'
                  ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))}))
                }
              })
              const respObj = _.get(respSv, 'data.storage.updateTargets', {})
              if (!_.get(respObj, 'responseResult.succeeded', false)) {
                throw new Error(_.get(respObj, 'responseResult.message', 'An unexpected error occurred'))
              }

              this.progress += 10

              // -> Wait for success sync

              let statusAttempts = 0
              while (statusAttempts < 10) {
                statusAttempts++
                const respStatus = await this.$apollo.query({
                  query: storageStatusQuery,
                  fetchPolicy: 'network-only'
                })
                if (_.has(respStatus, 'data.storage.status[0]')) {
                  const st = _.find(respStatus.data.storage.status, ['key', this.contentMode])
                  if (!st) {
                    throw new Error('Storage target could not be configured.')
                  }
                  switch (st.status) {
                    case 'pending':
                      if (statusAttempts >= 10) {
                        throw new Error('Storage target is stuck in pending state. Try again.')
                      } else {
                        continue
                      }
                    case 'operational':
                      statusAttempts = 10
                      break
                    case 'error':
                      throw new Error(st.message)
                  }
                } else {
                  throw new Error('Failed to fetch storage sync status.')
                }
              }

              this.progress += 15

              // -> Perform import all

              const respImport = await this.$apollo.mutate({
                mutation: targetExecuteActionMutation,
                variables: {
                  targetKey: this.contentMode,
                  handler: 'importAll'
                }
              })

              const respImportObj = _.get(respImport, 'data.storage.executeAction', {})
              if (!_.get(respImportObj, 'responseResult.succeeded', false)) {
                throw new Error(_.get(respImportObj, 'responseResult.message', 'An unexpected error occurred'))
              }

              this.progress += 15
            } else {
              throw new Error('Failed to fetch storage targets.')
            }
          } catch (err) {
            this.$store.commit('pushGraphError', err)
            this.isLoading = false
            return
          }
        }

        this.isLoading = false
        this.isSuccess = true
      }, 1500)
    }
  }
}
</script>

<style lang='scss'>

</style>
