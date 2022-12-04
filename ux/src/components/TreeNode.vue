<template lang="pug">
li.treeview-node
  //- NODE
  .treeview-label(@click='openNode', :class='{ "active": isActive }')
    q-icon(
      :name='icon'
      size='sm'
      @click.stop='hasChildren ? toggleNode() : openNode()'
      )
    .treeview-label-text {{node.text}}
    q-spinner.q-mr-xs(
      color='primary'
      v-if='state.isLoading'
      )
    q-icon(
      v-if='isActive'
      name='las la-angle-right'
      :color='$q.dark.isActive ? `yellow-9` : `brown-4`'
      )
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
          q-item(clickable, @click='contextAction(`newFolder`)')
            q-item-section(side)
              q-icon(name='las la-plus-circle', color='primary')
            q-item-section New Folder
          q-item(clickable)
            q-item-section(side)
              q-icon(name='las la-copy', color='teal')
            q-item-section Duplicate...
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
import { useQuasar } from 'quasar'

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

// QUASAR

const $q = useQuasar()

// INJECT

const loaded = inject('loaded')
const opened = inject('opened')
const selection = inject('selection')
const emitLazyLoad = inject('emitLazyLoad')
const emitContextAction = inject('emitContextAction')

// DATA

const state = reactive({
  isContextMenuShown: false,
  isLoading: false
})

// COMPUTED

const icon = computed(() => {
  if (props.node.icon) {
    return props.node.icon
  }
  return isOpened.value ? 'img:/_assets/icons/fluent-opened-folder.svg' : 'img:/_assets/icons/fluent-folder.svg'
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

async function toggleNode () {
  opened[props.node.id] = !(opened[props.node.id] === true)
  if (opened[props.node.id] && !loaded[props.node.id]) {
    state.isLoading = true
    await Promise.race([
      new Promise((resolve, reject) => {
        emitLazyLoad(props.node.id, { done: resolve, fail: reject })
      }),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Async tree loading timeout')), 30000)
      })
    ])
    loaded[props.node.id] = true
    state.isLoading = false
  }
}

function openNode () {
  selection.value = props.node.id
  if (selection.value !== props.node.id && opened[props.node.id]) {
    return
  }
  toggleNode()
}

function contextAction (action) {
  emitContextAction(props.node.id, action)
}

</script>
