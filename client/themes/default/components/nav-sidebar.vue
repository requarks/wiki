<template lang="pug">
  div
    .blue.darken-3.pa-3.d-flex
      v-btn(depressed, color='blue darken-2', style='min-width:0;', href='/')
        v-icon(size='20') mdi-home
      v-btn.ml-3(depressed, color='blue darken-2', style='flex: 1 1 100%;')
        v-icon(left) mdi-file-tree
        .body-2.text-none Browse
    v-divider
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
