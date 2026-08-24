<template>
  <ul class="treeview-level">
    <!-- ROOT NODE -->
    <li class="treeview-node" v-if="!props.parentId">
      <div class="treeview-label" @click="setRoot" :class="{ active: !selection }">
        <w-icon name="img:/_assets/icons/fluent-ftp.svg" size="sm" />
        <div class="treeview-label-text" :class="dark.isActive ? `text-purple-4` : `text-purple`">
          root
        </div>
        <w-menu
          v-if="rootContextActionList.length > 0"
          touch-position
          context-menu
          auto-close
          transition-show="jump-down"
          transition-hide="jump-up">
          <w-card class="p-2">
            <w-list dense style="min-width: 150px">
              <w-item
                v-for="action of rootContextActionList"
                :key="action.key"
                clickable
                @click="action.handler(null)">
                <w-item-section side>
                  <w-icon :name="action.icon" :color="action.iconColor" />
                </w-item-section>
                <w-item-section :class="action.labelColor && `text-` + action.labelColor">{{
                  action.label
                }}</w-item-section>
              </w-item>
            </w-list>
          </w-card>
        </w-menu>
        <w-icon
          v-if="!selection"
          name="la:angle-right"
          :color="dark.isActive ? `purple-4` : `purple`" />
      </div>
    </li>
    <!-- NORMAL NODES -->
    <tree-node
      v-for="node of level"
      :key="node.id"
      :node="node"
      :depth="props.depth"
      :parent-id="props.parentId" />
  </ul>
</template>

<script setup>
import { computed, inject } from 'vue'

import { useDark } from '@/composables/dark'

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

// INJECT

const roots = inject('roots')
const nodes = inject('nodes')
const selection = inject('selection')
const contextActionList = inject('contextActionList')

// COMPOSABLES

const dark = useDark()

// COMPUTED

const rootContextActionList = computed(() => {
  if (props.parentId) {
    return []
  }
  return contextActionList.filter((c) => c.key === 'newFolder')
})

const level = computed(() => {
  const items = []
  if (!props.parentId) {
    for (const root of roots.value) {
      items.push({
        id: root,
        ...nodes.value[root]
      })
    }
  } else {
    for (const node of nodes.value[props.parentId]?.children ?? []) {
      items.push({
        id: node,
        ...nodes.value[node]
      })
    }
  }
  return items
})

// METHODS

function setRoot() {
  selection.value = null
}
</script>
