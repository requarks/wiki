<template lang="pug">
  v-list.py-2(dense, :class='color', :dark='dark')
    template(v-for='item of items')
      v-list-item(
        v-if='item.kind === `link` && toShow(item)'
        :href='item.target'
        )
        v-list-item-avatar(size='24')
          v-icon {{ item.icon }}
        v-list-item-title {{ item.label }}
      v-divider.my-2(v-else-if='item.kind === `divider` && toShow(item)')
      v-subheader.pl-4(v-else-if='item.kind === `header` && toShow(item)') {{ item.label }}
</template>

<script>

import _ from 'lodash'
import { get } from 'vuex-pathify'

export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    },
    items: {
      type: Array,
      default: () => []
    }
  },
  computed: {
    permissions: get('user/permissions'),
    groups: get('user/groups'),
  },
  data() {
    return {}
  },
  methods: {
    toShow(item) {
      if (!item.groups || !item.groups.length) {
        return true
      }
      return _.intersection(item.groups, this.groups).length > 0
    }
  }
}
</script>
