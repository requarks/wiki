<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img(src='/_assets/svg/icon-social-group.svg', alt='Edit Group', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2 Edit Group
            .subtitle-1.grey--text {{group.name}}
          v-spacer
          v-btn(color='grey', icon, outlined, to='/groups')
            v-icon mdi-arrow-left
          v-dialog(v-model='deleteGroupDialog', max-width='500', v-if='!group.isSystem')
            template(v-slot:activator='{ on }')
              v-btn.ml-3(color='red', icon, outlined, v-on='on')
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-red Delete Group?
              v-card-text.pa-4 Are you sure you want to delete group #[strong {{ group.name }}]? All users will be unassigned from this group.
              v-card-actions
                v-spacer
                v-btn(text, @click='deleteGroupDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteGroup') Delete
          v-btn.ml-3(color='success', large, depressed, @click='updateGroup')
            v-icon(left) mdi-check
            span Update Group
        v-card.mt-3
          v-tabs.grad-tabs(v-model='tab', :color='$vuetify.theme.dark ? `blue` : `primary`', fixed-tabs, show-arrows, icons-and-text)
            v-tab(key='settings')
              span Settings
              v-icon mdi-cog-box
            v-tab(key='permissions')
              span Permissions
              v-icon mdi-lock-pattern
            v-tab(key='rules')
              span Page Rules
              v-icon mdi-file-lock
            v-tab(key='users')
              span Users
              v-icon mdi-account-group

            v-tab-item(key='settings', :transition='false', :reverse-transition='false')
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
                    label='Group Name'
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

            v-tab-item(key='permissions', :transition='false', :reverse-transition='false')
              group-permissions(v-model='group', @refresh='refresh')

            v-tab-item(key='rules', :transition='false', :reverse-transition='false')
              group-rules(v-model='group', @refresh='refresh')

            v-tab-item(key='users', :transition='false', :reverse-transition='false')
              group-users(v-model='group', @refresh='refresh')

          v-card-chin
            v-spacer
            .caption.grey--text.pr-2 Group ID #[strong {{group.id}}]

    page-selector(mode='select', v-model='selectPageModal', :open-handler='selectPageHandle', path='home', :locale='currentLang')
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
      deleteGroupDialog: false,
      tab: null,
      selectPageModal: false,
      currentLang: siteConfig.lang
    }
  },
  methods: {
    selectPage () {
      this.selectPageModal = true
    },
    selectPageHandle ({ path, locale }) {
      this.group.redirectOnLogin = `/${locale}/${path}`
    },
    async updateGroup() {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int!
              $name: String!
              $redirectOnLogin: String!
              $permissions: [String]!
              $pageRules: [PageRuleInput]!
            ) {
              groups {
                update(
                  id: $id
                  name: $name
                  redirectOnLogin: $redirectOnLogin
                  permissions: $permissions
                  pageRules: $pageRules
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
            pageRules: this.group.pageRules
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Group changes have been saved.`,
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deleteGroup() {
      this.deleteGroupDialog = false
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
          message: `Group ${this.group.name} has been deleted.`,
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
