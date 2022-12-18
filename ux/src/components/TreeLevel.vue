<template lang="pug">
ul.treeview-level
  //- ROOT NODE
  li.treeview-node(v-if='!props.parentId')
    .treeview-label(@click='setRoot', :class='{ "active": !selection }')
      q-icon(name='img:/_assets/icons/fluent-ftp.svg', size='sm')
      .treeview-label-text(:class='$q.dark.isActive ? `text-purple-4` : `text-purple`') root
      q-menu(
        v-if='rootContextActionList.length > 0'
        touch-position
        context-menu
        auto-close
        transition-show='jump-down'
        transition-hide='jump-up'
        )
        q-card.q-pa-sm
          q-list(dense, style='min-width: 150px;')
            q-item(
              v-for='action of rootContextActionList'
              :key='action.key'
              clickable
              @click='action.handler(null)'
              )
              q-item-section(side)
                q-icon(:name='action.icon', :color='action.iconColor')
              q-item-section(:class='action.labelColor && (`text-` + action.labelColor)') {{action.label}}
      q-icon(
        v-if='!selection'
        name='las la-angle-right'
        :color='$q.dark.isActive ? `purple-4` : `purple`'
        )
  //- NORMAL NODES
  tree-node(
    v-for='node of level'
    :key='node.id'
    :node='node'
    :depth='props.depth'
    :parent-id='props.parentId'
  )
</template>

<script setup>
import { computed, inject } from 'vue'
import { useQuasar } from 'quasar'

import TreeNode from './TreeNode.vue'

// PROPS

const props = defineProps({
  depth: {
    required: true,
    type: Number
  },
  parentId: {
    type: String,
    default: null
  }
})

// QUASAR

const $q = useQuasar()

// INJECT

const roots = inject('roots')
const nodes = inject('nodes')
const selection = inject('selection')
const emitContextAction = inject('emitContextAction')
const contextActionList = inject('contextActionList')

// COMPUTED

const rootContextActionList = computed(() => {
  if (props.parentId) { return [] }
  return contextActionList.filter(c => c.key === 'newFolder')
})

const level = computed(() => {
  const items = []
  if (!props.parentId) {
    for (const root of roots.value) {
      items.push({
        id: root,
        ...nodes[root]
      })
    }
  } else {
    for (const node of nodes[props.parentId].children) {
      items.push({
        id: node,
        ...nodes[node]
      })
    }
  }
  return items
})

// METHODS

function setRoot () {
  selection.value = null
}

function createRootFolder () {
  emitContextAction(null, 'newFolder')
}

</script>
