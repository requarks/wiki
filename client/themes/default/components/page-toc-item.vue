<template lang="pug">
  .page-toc-item
    template(v-if='level >= min')
      v-list-item(@click='click(item.anchor)', v-if='(item.children.length === 0 && max > level) || max > level',
        :key='item.anchor', :class='isNestedLevel ? `pl-9` : `pl-6`')
        v-icon.pl-0(small, color='grey lighten-1') {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
        v-list-item-title.pl-4(v-bind:class='titleClasses') {{item.title}}
      v-list-group(sub-group, v-else, v-bind:class='{"pl-3": isNestedLevel}')
        template(v-slot:activator)
          v-list-item.pl-0(@click='click(item.anchor)', :key='item.anchor')
            v-list-item-title(v-bind:class='titleClasses') {{item.title}}
        template(v-if='item.children.length !== 0', v-for='subItem in item.children')
          page-toc-item(:item='subItem', :level='level + 1', :min='min', :max='max')
      template(v-if='max > level', v-for='subItem in item.children')
        page-toc-item(:item='subItem', :level='level + 1', :min='min', :max='max')
    template(v-else, v-for='subItem in item.children')
      page-toc-item(:item='subItem', :level='level + 1', :min='min', :max='max')
</template>

<script>

export default {
  name: 'PageTocItem',
  props: {
    item: {
      type: Object,
      default: () => {}
    },
    min: {
      type: Number,
      default: 1
    },
    max: {
      type: Number,
      default: 2
    },
    level: {
      type: Number,
      default: 1
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
    isNestedLevel() {
      return this.level > this.min
    },
    titleClasses() {
      return {
        'caption': this.isNestedLevel,
        'grey--text': this.isNestedLevel,
        'text--lighten-1': this.$vuetify.theme.dark && this.isNestedLevel,
        'text--darken-1': !this.$vuetify.theme.dark && this.isNestedLevel
      }
    }
  },
  methods: {
    click (anchor) {
      this.$vuetify.goTo(anchor, this.scrollOpts)
    }
  }
}
</script>

<style lang='scss'>
// Hack to fix animations of multi level nesting v-list-group
.page-toc-item .v-list-group--sub-group.v-list-group--active .v-list-item:not(.v-list-item--active) .v-list-item__icon.v-list-group__header__prepend-icon .v-icon {
  transform: rotate(0deg)!important;
}
</style>
