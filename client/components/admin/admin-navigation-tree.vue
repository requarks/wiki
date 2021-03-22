<template lang="pug">
  v-list.py-2(dense, nav, dark, class='blue darken-2', style='border-radius: 0;')
    draggable(
        :list="list"
        :group="{ name: 'g1' }"
        :class="{'empty-draggable': !list.length}"
      )
      template(v-for="navItem in list")
        v-list-item(
          v-if='navItem.kind === "link"'
          :key='navItem.id'
          :class='(navItem === current) ? "blue" : ""'
          @click.stop='selectItem(navItem)'
        )
          v-list-item-avatar(size='24', tile)
            v-icon(v-if='navItem.icon.match(/fa[a-z] fa-/)', size='19') {{ navItem.icon }}
            v-icon(v-else) {{ navItem.icon }}
          v-list-item-title {{navItem.label}}
        .py-2.clickable(
          v-else-if='navItem.kind === "divider"'
          :key='navItem.id'
          :class='(navItem === current) ? "blue" : ""'
          @click.stop='selectItem(navItem)'
        )
          v-divider
        v-subheader.pl-4.clickable(
          v-else-if='navItem.kind === "header"'
          :key='navItem.id'
          :class='(navItem === current) ? "blue" : ""'
          @click.stop='selectItem(navItem)'
        ) {{navItem.label}}
        .pl-4.clickable(
          v-else-if='navItem.kind === "group"'
          :key='navItem.id'
          :class='(navItem === current) ? "blue" : ""'
          @click.stop='selectItem(navItem)'
        )
          div.d-flex.align-center
            v-icon(v-if='navItem.icon.match(/fa[a-z] fa-/)', size='19') {{ navItem.icon }}
            v-icon(v-else) {{ navItem.icon }}
            span.ml-4.text-subtitle-2 {{ navItem.label }}

          admin-navigation-tree(v-if="level < 2" :list="navItem.items" :current="current" :level="level+1" @select-item="selectItem")
</template>

<script>
import draggable from 'vuedraggable'

export default {
  props: {
    list: {
      type: [Array],
      required: true
    },
    current: {
      type: Object,
      required: true
    },
    level: {
      type: Number,
      default: 0
    }
  },
  components: {
    draggable
  },
  methods: {
    selectItem(navItem) {
      this.$emit('select-item', navItem)
    }
  }
}
</script>

<style lang="scss">
.empty-draggable {
  min-height: 38px;
  border: 1px dashed #7b9cde;
  transition: all 0.5s;
}
</style>
