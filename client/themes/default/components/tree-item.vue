<template lang="pug">
  div.d-flex.flex-column
    v-list-item.list-item-class
      div.d-flex.align-center
        v-icon.ml-2.mr-2(v-if="hasChildren", color="grey", small, @click.stop="toggle") {{ icon }}
        v-icon.ml-2.mr-2(v-else, color="transparent", small) mdi-chevron-right
        v-list-item-content
          v-list-item-title(
            @click='$vuetify.goTo(item.anchor, scrollOpts)'
            :style="{ cursor: 'pointer' }"
            :class="[getTitleClass(level), getTitleDarkModeClass()]") {{ item.title }}
    v-list(v-if="isOpen && hasChildren" dense :style="{ paddingLeft: `20px`, paddingTop: '0px', paddingBottom: '0px' }")
      TreeItem(v-for="(child, index) in item.children" :key="index" :item="child" :open.sync="open" :level="level + 1")
  </template>

<script>
export default {
  name: 'TreeItem',
  props: {
    item: {
      type: Object,
      default: () => ({})
    },
    open: {
      type: Array,
      default: () => []
    },
    level: {
      type: Number,
      default: 0
    }
  },
  data() {
    return {
      isOpen: false,
      scrollOpts: {
        duration: 1500,
        offset: 0,
        easing: 'easeInOutCubic'
      }
    }
  },
  computed: {
    hasChildren() {
      return this.item.children && this.item.children.length > 0
    },
    icon() {
      return this.isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'
    },
    titleClass() {
      return this.hasChildren ? '' : 'caption grey--text'
    }
  },
  methods: {
    toggle() {
      if (this.hasChildren) {
        this.isOpen = !this.isOpen
      }
    },
    getTitleDarkModeClass() {
      return this.$vuetify.theme.dark ? `text--lighten-1` : `text--darken-1`
    },
    getTitleClass(level) {
      return level > 0 ? 'caption grey--text' : ''
    }
  }
}
</script>

<style lang="scss" scoped>
  .list-item-class {
    transition: background-color 0.3s;
  }
  .list-item-class:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
</style>
