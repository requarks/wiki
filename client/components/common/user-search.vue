<template lang="pug">
  div
    v-dialog(
      v-model='dialogOpen'
      max-width='650'
    )
      v-card
        .dialog-header
          span {{$t('common:user.search')}}
          v-spacer
          v-progress-circular(
            indeterminate
            color='white'
            :size='20'
            :width='2'
            v-show='searchLoading'
            )
        v-card-text.pt-5
          v-text-field(
            outlined
            :label='$t(`common:user.searchPlaceholder`)'
            v-model='search'
            prepend-inner-icon='mdi-account-search-outline'
            color='primary'
            ref='searchIpt'
            hide-details
            )
          v-list.grey.mt-3.py-0.radius-7(
            :class='$vuetify.theme.dark ? `darken-3-d5` : `lighten-3`'
            two-line
            dense
            )
            template(v-for='(usr, idx) in items')
              v-list-item(:key='usr.id', @click='setUser(usr)')
                v-list-item-avatar(size='40', color='primary')
                  span.body-1.white--text {{usr.name | initials}}
                v-list-item-content
                  v-list-item-title.body-2 {{usr.name}}
                  v-list-item-subtitle {{usr.email}}
                v-list-item-action
                  v-btn(
                    color="primary"
                    @click="assignUserToGroup(usr, selectedGroup)"
                  )
                    v-icon mdi-account-plus
              v-divider.my-0(v-if='idx < items.length - 1')
        v-card-chin
          v-btn(
            color='primary'
            @click='createUser'
            :disabled='loading || searchLoading || !search || items.length > 0'
          )
            v-icon(left) mdi-plus
            span Create User
          v-spacer
          v-btn(
            text
            @click='close'
            :disabled='loading'
          ) {{$t('common:actions.cancel')}}
    UserCreate(
      v-model="isCreateDialogShown"
      :default-group="defaultGroup"
      :disable-group-select="!!defaultGroup"
      @refresh="onUserCreated"
    )
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import UserCreate from '../admin/admin-users-create.vue'

export default {
  filters: {
    initials(val) {
      return val.split(' ').map(v => v.substring(0, 1)).join('')
    }
  },
  props: {
    multiple: {
      type: Boolean,
      default: false
    },
    value: {
      type: Boolean,
      default: false
    },
    defaultGroup: {
      type: [String, Number, Array],
      default: null
    }
  },
  data() {
    return {
      loading: false,
      searchLoading: false,
      search: '',
      items: [],
      isCreateDialogShown: false
    }
  },
  computed: {
    dialogOpen: {
      get() { return this.value },
      set(value) { this.$emit('input', value) }
    }
  },
  watch: {
    value(newValue, oldValue) {
      if (newValue && !oldValue) {
        this.search = ''
        this.selectedItems = null
        _.delay(() => { this.$refs.searchIpt.focus() }, 100)
      }
    }
  },
  methods: {
    close() {
      this.$emit('input', false)
    },
    setUser(usr) {
      this.$emit('select', usr)
      this.close()
    },
    searchFilter(item, queryText, itemText) {
      return _.includes(_.toLower(item.email), _.toLower(queryText)) || _.includes(_.toLower(item.name), _.toLower(queryText))
    },
    createUser() {
      this.isCreateDialogShown = true
    },
    async assignUserToGroup(user, group) {
      try {
        // Assign the user to the group
        await this.$apollo.mutate({
          mutation: gql`
            mutation AssignUserToGroup($userId: Int!, $groupId: Int!) {
              assignUserToGroup(userId: $userId, groupId: $groupId)
            }
          `,
          variables: {
            userId: user.id,
            groupId: group.id
          }
        })

        // Now send the "added to group" email
        await this.sendUserAddedToGroupEmail(user, group)

        this.$store.commit('showNotification', {
          style: 'success',
          message: `${user.name} has been added to the group ${group.name} and notified by email.`,
          icon: 'check'
        })
      } catch (err) {
        console.error('Error assigning user to group or sending email:', err)
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Failed to assign user to group or send email.',
          icon: 'alert'
        })
      }
    },
    async sendUserAddedToGroupEmail(user, group) {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation SendUserAddedToGroupEmail($userId: Int!, $groupId: Int!) {
              sendUserAddedToGroupEmail(userId: $userId, groupId: $groupId)
            }
          `,
          variables: {
            userId: user.id,
            groupId: group.id
          }
        })
      } catch (err) {
        console.error('Failed to send user-added-to-group email:', err)
        this.$store.commit('showNotification', {
          style: 'error',
          message: 'Failed to send group notification email.',
          icon: 'alert'
        })
      }
    },
    onUserCreated() {
      this.$store.commit('showNotification', {
        style: 'success',
        message: 'New user created and added to the group.',
        icon: 'check'
      })
      this.$emit('refresh')
      this.isCreateDialogShown = false
      this.close()
      this.$emit('user-created-and-assigned')
    }
  },
  components: {
    UserCreate
  },
  apollo: {
    items: {
      query: gql`
        query ($query: String!) {
            searchUsers(query:$query) {
              id
              name
              email
              providerKey
            }
        }
      `,
      variables() {
        return {
          query: this.search
        }
      },
      fetchPolicy: 'cache-and-network',
      skip() {
        return !this.search || this.search.length < 2
      },
      update: (data) => data.searchUsers,
      watchLoading (isLoading) {
        this.searchLoading = isLoading
      }
    }
  }
}
</script>
