<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img(src='/_assets/svg/icon-social-group.svg', alt='Edit Site Page', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2 Edit Site Page
            .subtitle-1.grey--text {{group.name}}
          v-spacer
          v-btn(color='grey', icon, outlined, to='/sites')
            v-icon mdi-arrow-left
          v-dialog(v-model='deleteSitePageDialog', max-width='500', v-if='!group.isSystem')
            template(v-slot:activator='{ on }')
              v-btn.ml-3(color='red', icon, outlined, v-on='on')
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-red Delete Site Page?
              v-card-text.pa-4 Are you sure you want to delete site page #[strong {{ group.name }}]? All users will be unassigned from this site page.
              v-card-actions
                v-spacer
                v-btn(text, @click='deleteSitePageDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteSitePage') Delete
          v-btn.ml-3(color='success', large, depressed, @click='updateSitePage')
            v-icon(left) mdi-check
            span Update Site Page
        v-card.mt-3
          v-card(flat)
                template(v-if='group.id <= 2')
                  v-card-text
                    v-alert.radius-7.mb-0(
                      color='orange darken-2'
                      :class='$vuetify.theme.dark ? "grey darken-4" : "orange lighten-5"'
                      outlined
                      :value='true'
                      icon='mdi-lock-outline'
                      ) This is a system group and its settings cannot be modified.
                  v-divider
                v-card-text
                  v-text-field(
                    outlined
                    v-model='group.name'
                    label='Site Name'
                    hide-details
                    prepend-icon='mdi-account-group'
                    style='max-width: 600px;'
                    :disabled='group.id <= 2'
                  )
                template(v-if='group.id !== 2')
                  v-divider
                  v-card-text
                    v-text-field(
                      outlined
                      v-model='group.redirectOnLogin'
                      label='Redirect on Login'
                      persistent-hint
                      hint='The path / URL where the user will be redirected upon successful login.'
                      prepend-icon='mdi-arrow-top-left-thick'
                      append-icon='mdi-folder-search'
                      @click:append='selectPage'
                      style='max-width: 850px;'
                      :counter='255'
                    )

                    v-radio-group(v-model="siteStatus")
                     v-radio(label="Enabled" value="enabled")
                     v-radio(label="Disabled" value="disabled")
                    </v-radio-group>
                    p Site Status: {{ siteStatus === 'enabled' ? 'Enabled' : 'Disabled' }}
                    p Site Status: {{ siteStatus }}
                    
      
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

import GroupPermissions from './admin-groups-edit-permissions.vue'
import GroupRules from './admin-groups-edit-rules.vue'
import GroupUsers from './admin-groups-edit-users.vue'

/* global siteConfig */

export default {
  components: {
    GroupPermissions,
    GroupRules,
    GroupUsers
  },
  data() {
    return {
      group: {
        id: 0,
        name: '',
        isSystem: false,
        permissions: [],
        pageRules: [],
        users: [],
        redirectOnLogin: '/'
      },
      deleteSiteDialog: false,
      tab: null,
      selectPageModal: false,
      currentLang: siteConfig.lang,
      siteStatus: 'enabled',
    }
  },
  methods: {
    selectPage () {
      this.selectPageModal = true
    },
    selectPageHandle ({ path, locale }) {
      this.group.redirectOnLogin = `/${locale}/${path}`
    },
    async updateSite() {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int!
              $name: String!
              $redirectOnLogin: String!
              $permissions: [String]!
              $pageRules: [PageRuleInput]!
              $siteStatus: String! 
            ) {
              groups {
                update(
                  id: $id
                  name: $name
                  redirectOnLogin: $redirectOnLogin
                  permissions: $permissions
                  pageRules: $pageRules
                  siteStatus: $siteStatus
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
            id: this.group.id,
            name: this.group.name,
            redirectOnLogin: this.group.redirectOnLogin,
            permissions: this.group.permissions,
            pageRules: this.group.pageRules,
            siteStatus: this.siteStatus
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Site changes have been saved.`,
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async S() {
      this.deleteSiteDialog = false
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              groups {
                delete(id: $id) {
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
            id: this.group.id
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-delete')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Site ${this.group.name} has been deleted.`,
          icon: 'delete'
        })
        this.$router.replace('/groups')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async refresh() {
      return this.$apollo.queries.group.refetch()
    }
  },
  apollo: {
    group: {
      query: gql`
        query ($id: Int!) {
          groups {
            single(id: $id) {
              id
              name
              redirectOnLogin
              isSystem
              permissions
              pageRules {
                id
                path
                roles
                match
                deny
                locales
              }
              users {
                id
                name
                email
              }
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.groups.single),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>