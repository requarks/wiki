<template lang="pug">
  v-dialog(v-model='dialogOpen', max-width='650')
    v-card
      .dialog-header Search User
      v-card-text
        v-select(
          :items='items'
          :loading='searchLoading'
          :search-input.sync='search'
          autocomplete
          autofocus
          cache-items
          chips
          clearable
          hide-details
          item-text='name',
          item-value='id',
          label='Search users...'
          light
          multiple
          v-model='selectedItems'
        )
      v-card-actions
        v-spacer
        v-btn(flat, @click='close', :disabled='loading') Cancel
        v-btn(color='primary', dark, @click='setUser', :loading='loading', :disabled='loading')
          v-icon(left) assignment_ind
          span Select User
</template>

<script>
import searchUsersQuery from 'gql/common-users-query-search.gql'

export default {
  props: {
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
      items: [],
      selectedItems: []
    }
  },
  computed: {
    dialogOpen: {
      get() { return this.value },
      set(value) { this.$emit('input', value) }
    }
  },
  methods: {
    close() {
      this.$emit('input', false)
    },
    setUser() {

    }
  },
  apollo: {
    items: {
      query: searchUsersQuery,
      variables() {
        return {
          search: this.search
        }
      },
      skip() {
        return !this.search || this.search.length < 2
      },
      update: (data) => data.upsells.segments,
      watchLoading (isLoading) {
        this.searchLoading = isLoading
      }
    }
  }
}
</script>
