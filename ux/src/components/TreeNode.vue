<template lang="pug">
li.treeview-node
  //- NODE
  .treeview-label(@click='toggleNode', :class='{ "active": isActive }')
    q-icon(:name='icon', size='sm')
    span {{node.text}}
    //- RIGHT-CLICK MENU
    q-menu(
      touch-position
      context-menu
      auto-close
      transition-show='jump-down'
      transition-hide='jump-up'
      @before-show='state.isContextMenuShown = true'
      @before-hide='state.isContextMenuShown = false'
      )
      q-card.q-pa-sm
        q-list(dense, style='min-width: 150px;')
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-plus-circle', color='primary')
            q-item-section New Folder
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-redo', color='teal')
            q-item-section Rename...
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-arrow-right', color='teal')
            q-item-section Move to...
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-trash-alt', color='negative')
            q-item-section.text-negative Delete
  //- SUB-LEVEL
  transition(name='treeview')
    tree-level(
      v-if='hasChildren && isOpened'
      :parent-id='props.node.id'
      :depth='props.depth + 1'
    )
</template>

<script setup>
import { computed, inject, reactive } from 'vue'

import TreeLevel from './TreeLevel.vue'

// PROPS

const props = defineProps({
  depth: {
    type: Number,
    default: 0
  },
  node: {
    required: true,
    type: Object
  },
  parentId: {
    type: String,
    default: null
  }
})

// INJECT

const opened = inject('opened')
const selection = inject('selection')

// DATA

const state = reactive({
  isContextMenuShown: false
})

// COMPUTED

const icon = computed(() => {
  if (props.node.icon) {
    return props.node.icon
  }
  return hasChildren.value && isOpened.value ? 'img:/_assets/icons/fluent-opened-folder.svg' : 'img:/_assets/icons/fluent-folder.svg'
})

const hasChildren = computed(() => {
  return props.node.children?.length > 0
})
const isOpened = computed(() => {
  return opened[props.node.id]
})
const isActive = computed(() => {
  return state.isContextMenuShown || selection.value === props.node.id
})

// METHODS

function toggleNode () {
  selection.value = props.node.id

  if (selection.value !== props.node.id && opened[props.node.id]) {
    return
  }
  opened[props.node.id] = !(opened[props.node.id] === true)
}

</script>
