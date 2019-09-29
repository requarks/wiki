<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.importv1Title') }}
    v-card-text
      .text-center
        img.animated.fadeInUp.wait-p1s(src='/svg/icon-software.svg')
        .body-2 Import from Wiki.js 1.x
      v-divider.my-4
      .body-2 Data from a Wiki.js 1.x installation can easily be imported using this tool. What do you want to import?
      v-checkbox(
        label='Content + Uploads'
        value='content'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
        )
        template(v-slot:label)
          strong.deep-orange--text.text--darken-2 Content + Uploads
      .pl-8(v-if='wantContent')
        v-radio-group(v-model='contentMode', hide-details)
          v-radio(
            value='git'
            color='primary'
            )
            template(v-slot:label)
              div
                span Import from Git Connection
                .caption: em #[strong.primary--text Recommended] | The Git storage module will also be configured for you.
        .pl-8.mt-5(v-if='needGit')
          v-row
            v-col(cols='8')
              v-select(
                label='Authentication Mode'
                :items='gitAuthModes'
                v-model='gitAuthMode'
                outlined
                hide-details
              )
            v-col(cols='4')
              v-switch(
                label='Verify SSL Certificate'
                v-model='gitVerifySSL'
                hide-details
                color='primary'
              )
            v-col(cols='8')
              v-text-field(
                outlined
                label='Repository URL'
                :placeholder='(gitAuthMode === `ssh`) ? `e.g. git@github.com:orgname/repo.git` : `e.g. https://github.com/orgname/repo.git`'
                hide-details
                v-model='gitRepoUrl'
              )
            v-col(cols='4')
              v-text-field(
                label='Branch'
                placeholder='e.g. master'
                v-model='gitRepoBranch'
                outlined
                hide-details
              )
            v-col(v-if='gitAuthMode === `ssh`', cols='12')
              v-textarea(
                outlined
                label='Private Key'
                placeholder='-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'
                hide-details
                v-model='gitPrivKey'
              )
            template(v-else-if='gitAuthMode === `basic`')
              v-col(cols='6')
                v-text-field(
                  label='Username'
                  v-model='gitUserEmail'
                  outlined
                  hide-details
                )
              v-col(cols='6')
                v-text-field(
                  type='password'
                  label='Password / PAT'
                  v-model='gitUserName'
                  outlined
                  hide-details
                )
            v-col(cols='6')
              v-text-field(
                label='Default Author Email'
                placeholder='e.g. name@company.com'
                v-model='gitUserEmail'
                outlined
                hide-details
              )
            v-col(cols='6')
              v-text-field(
                label='Default Author Name'
                placeholder='e.g. John Smith'
                v-model='gitUserName'
                outlined
                hide-details
              )
            v-col(cols='12')
              v-text-field(
                label='Local Repository Path'
                placeholder='e.g. ./data/repo'
                v-model='gitRepoPath'
                outlined
                hide-details
              )
        v-radio-group(v-model='contentMode', hide-details)
          v-divider
          v-radio.mt-3(
            value='local'
            color='primary'
            )
            template(v-slot:label)
              div
                span Import from local folder
                .caption: em Choose this option only if you didn't have git configured in your Wiki.js 1.x installation.
        .pl-8.mt-5(v-if='needDisk')
          v-text-field(
            outlined
            label='Content Repo Path'
            hint='The absolute path to where the Wiki.js 1.x content is stored on disk.'
            persistent-hint
            v-model='contentPath'
          )

      v-checkbox(
        label='Users'
        value='users'
        color='deep-orange darken-2'
        v-model='importFilters'
        hide-details
        )
        template(v-slot:label)
          strong.deep-orange--text.text--darken-2 Users
      .pl-8.mt-5(v-if='wantUsers')
        v-text-field(
          outlined
          label='MongoDB Connection String'
          hint='The connection string to connect to the Wiki.js 1.x MongoDB database.'
          persistent-hint
          v-model='dbConnStr'
        )
        v-radio-group(v-model='groupMode', hide-details, mandatory)
          v-radio(
            value='MULTI'
            color='primary'
            )
            template(v-slot:label)
              div
                span Create groups for each unique user permissions configuration
                .caption: em Note that this can result in a large amount of groups being created.
          v-divider
          v-radio.mt-3(
            value='SINGLE'
            color='primary'
            )
            template(v-slot:label)
              div
                span Create a single group with all imported users
                .caption: em #[strong.primary--text Recommended] | The new group will have read permissions enabled by default.
          v-divider
          v-radio.mt-3(
            value='NONE'
            color='primary'
            )
            template(v-slot:label)
              div
                span Don't create any group
                .caption: em Users will not be able to access your wiki until they are assigned to a group.

    v-card-chin
      v-btn.px-3(depressed, color='deep-orange darken-2', :disabled='!wantUsers && !wantContent', @click='startImport').ml-0
        v-icon(left, color='white') mdi-database-import
        span.white--text Start Import
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
          .mt-5.body-1.white--text Importing from Wiki.js 1.x...
          .caption Please wait
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
      max-width='350'
      )
      v-card(color='green darken-2', dark)
        v-card-text.pa-10.text-center
          v-icon(size='60') mdi-check-circle-outline
          .my-5.body-1.white--text Import completed
          template(v-if='wantUsers')
            .body-2
              span #[strong {{successUsers}}] users imported
              v-btn.text-none.ml-3(
                v-if='failedUsers.length > 0'
                text
                color='white'
                dark
                @click='showFailedUsers = true'
                )
                v-icon(left) mdi-alert
                span {{failedUsers.length}} failed
            .body-2 #[strong {{successGroups}}] groups created
          template(v-if='wantContent')
            .body-2 #[strong {{successPages}}] pages
            .body-2 #[strong {{successAssets}}] assets
        v-card-actions.green.darken-1
          v-spacer
          v-btn.px-5(
            color='white'
            outlined
            @click='isSuccess = false'
          ) Close
          v-spacer
    v-dialog(
      v-model='showFailedUsers'
      persistent
      max-width='800'
      )
      v-card(color='red darken-2', dark)
        v-toolbar(color='red darken-2', dense)
          v-icon mdi-alert
          .body-2.pl-3 Failed User Imports
          v-spacer
          v-btn.px-5(
            color='white'
            text
            @click='showFailedUsers = false'
            ) Close
        v-simple-table(dense, fixed-header, height='300px')
          template(v-slot:default)
            thead
              tr
                th Provider
                th Email
                th Error
            tbody
              tr(v-for='(fusr, idx) in failedUsers', :key='`fusr-` + idx')
                td {{fusr.provider}}
                td {{fusr.email}}
                td {{fusr.error}}
</template>

<script>
import _ from 'lodash'

import { SemipolarSpinner } from 'epic-spinners'

import utilityImportv1UsersMutation from 'gql/admin/utilities/utilities-mutation-importv1-users.gql'

export default {
  components: {
    SemipolarSpinner
  },
  data() {
    return {
      importFilters: ['content', 'users'],
      groupMode: 'SINGLE',
      contentMode: 'git',
      dbConnStr: 'mongodb://',
      contentPath: '/wiki-v1/repo',
      isLoading: false,
      isSuccess: false,
      gitAuthMode: 'ssh',
      gitAuthModes: [
        { text: 'SSH', value: 'ssh' },
        { text: 'Basic', value: 'basic' }
      ],
      gitVerifySSL: true,
      gitRepoUrl: '',
      gitRepoBranch: 'master',
      gitPrivKey: '',
      gitUserEmail: '',
      gitUserName: '',
      gitRepoPath: './data/repo',
      progress: 0,
      successUsers: 0,
      successPages: 0,
      successGroups: 0,
      successAssets: 0,
      showFailedUsers: false,
      failedUsers: []
    }
  },
  computed: {
    wantContent () {
      return this.importFilters.indexOf('content') >= 0
    },
    wantUsers () {
      return this.importFilters.indexOf('users') >= 0
    },
    needDisk () {
      return this.contentMode === `local`
    },
    needGit () {
      return this.contentMode === `git`
    }
  },
  methods: {
    async startImport () {
      this.isLoading = true
      this.progress = 0
      this.failedUsers = []

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
            throw new Error(_.get(respObj, 'responseResult.message', 'An unexpected error occured'))
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

      }

      this.isLoading = false
      this.isSuccess = true
    }
  }
}
</script>

<style lang='scss'>

</style>
