<template lang="pug">
  div.d-flex.flex-column.w-100
    v-list-item.list-item-class.w-100.pl-0.pr-0
      div.d-flex.align-center.flex-grow-1.w-100.pl-2
        v-icon.mr-2(v-if="hasChildren", color="grey", small, @click.stop="handleToggle") {{ icon }}
        v-icon.mr-2(v-else, color="transparent", small) mdi-chevron-right
        v-list-item-content
          v-list-item-title.truncate(
            @click='$vuetify.goTo(item.anchor, scrollOpts)'
            :style="{ cursor: 'pointer' }"
            :class="[getTitleClass, getTitleDarkModeClass]") {{ item.title }}
    v-list(v-if="isOpen && hasChildren" dense :style="{ paddingLeft: `20px`, paddingTop: '0px', paddingBottom: '0px' }")
      TreeItem(v-for="(child, index) in item.children" :key="child.id" :item="child" :open.sync="openStates[child.id]" :toggleOpenState='toggleOpenState' :openStates='openStates' :level="level + 1" :uniqueId="child.id")
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
      type: Boolean,
      default: true
    },
    toggleOpenState: {
      type: Function,
      required: true
    },
    openStates: {
      type: Object,
      required: true
    },
    level: {
      type: Number,
      default: 0
    },
    uniqueId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      scrollOpts: {
        duration: 1500,
        offset: 0,
        easing: 'easeInOutCubic'
      }
    }
  },
  computed: {
    isOpen() {
      return this.open
    },
    hasChildren() {
      return this.item.children && this.item.children.length > 0
    },
    icon() {
      return this.isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right'
    },
    titleClass() {
      return this.hasChildren ? '' : 'caption grey--text'
    },
    getTitleDarkModeClass() {
      return this.$vuetify.theme.dark ? `text--lighten-1` : `text--darken-1`
    },
    getTitleClass(level) {
      return level > 0 ? 'caption grey--text' : ''
    }
  },
  methods: {
    handleToggle() {
      this.toggleOpenState(this.uniqueId)
    }
  }
}
</script>

<style lang="scss" scoped>
  .list-item-class {
    transition: background-color 0.3s;
    overflow: hidden;
  }
  .list-item-class:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  .truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .w-100 {
    width: 100%;
  }
</style>
