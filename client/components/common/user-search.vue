<template lang="pug">
  v-dialog(
    v-model='dialogOpen'
    max-width='650'
    )
    v-card.wiki-form
      .dialog-header
        span Search User
        v-spacer
        v-progress-circular(
          indeterminate
          color='white'
          :size='20'
          :width='2'
          v-show='searchLoading'
          )
      v-card-text
        v-text-field(
          outline
          label='Search Users...'
          v-model='search'
          prepend-inner-icon='search'
          color='primary'
          ref='searchIpt'
          hide-details
          )
        v-list.grey.mt-3.py-0.radius-7(
          :class='$vuetify.dark ? `darken-3-d5` : `lighten-3`'
          two-line
          dense
          )
          template(v-for='(usr, idx) in items')
            v-list-tile(:key='usr.id', @click='setUser(usr.id)')
              v-list-tile-avatar(size='40', color='primary')
                span.body-1.white--text {{usr.name | initials}}
              v-list-tile-content
                v-list-tile-title.body-2 {{usr.name}}
                v-list-tile-sub-title {{usr.email}}
              v-list-tile-action
                v-icon(color='primary') arrow_forward
            v-divider.my-0(v-if='idx < items.length - 1')
      v-card-chin
        v-spacer
        v-btn(
          flat
          @click='close'
          :disabled='loading'
          ) Cancel
</template>

<script>
import _ from 'lodash'

import searchUsersQuery from 'gql/common/common-users-query-search.gql'

export default {
  filters: {
    initials(val) {
      return val.split(' ').map(v => v.substring(0, 1)).join()
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
    }
  },
  data() {
    return {
      loading: false,
      searchLoading: false,
      search: '',
      items: []
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
    setUser(id) {
      this.$emit('select', id)
      this.close()
    },
    searchFilter(item, queryText, itemText) {
      return _.includes(_.toLower(item.email), _.toLower(queryText)) || _.includes(_.toLower(item.name), _.toLower(queryText))
    }
  },
  apollo: {
    items: {
      query: searchUsersQuery,
      variables() {
        return {
          query: this.search
        }
      },
      skip() {
        return !this.search || this.search.length < 2
      },
      update: (data) => data.users.search,
      watchLoading (isLoading) {
        this.searchLoading = isLoading
      }
    }
  }
}
</script>
