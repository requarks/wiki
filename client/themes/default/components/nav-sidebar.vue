<template lang="pug">
  v-list.py-2(dense, :class='color', :dark='dark')
    template(v-for='item of items')
      v-list-item(
        v-if='item.kind === `link`'
        :href='item.target'
        )
        v-list-item-avatar(size='24')
          v-icon {{ item.icon }}
        v-list-item-title {{ item.label }}
      v-divider.my-2(v-else-if='item.kind === `divider`')
      v-subheader.pl-4(v-else-if='item.kind === `header`') {{ item.label }}
</template>

<script>
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
  data() {
    return {}
  }
}
</script>
