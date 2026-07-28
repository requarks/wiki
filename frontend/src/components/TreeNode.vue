<template>
  <li class="treeview-node">
    <!-- NODE -->
    <div class="treeview-label" @click="openNode" :class='{ "active": isActive }'>
      <w-icon :name="icon" size="sm" @click.stop="toggleNode()" />
      <div class="treeview-label-text">{{displayMode === 'path' ? node.fileName : node.title}}</div>
      <w-spinner class="mr-1" color="primary" v-if="state.isLoading" />
      <w-icon
        v-if="isActive"
        name="la:angle-right"
        :color="dark.isActive ? `yellow-9` : `brown-4`" />
      <!-- RIGHT-CLICK MENU -->
      <w-menu
        v-if="contextActionList.length > 0"
        touch-position
        context-menu
        auto-close
        transition-show="jump-down"
        transition-hide="jump-up"
        @before-show="state.isContextMenuShown = true"
        @before-hide="state.isContextMenuShown = false">
        <w-card class="p-2">
          <w-list dense style="min-width: 150px;">
            <w-item
              v-for="action of contextActionList"
              :key="action.key"
              clickable
              @click="action.handler(node.id)">
              <w-item-section side>
                <w-icon :name="action.icon" :color="action.iconColor" />
              </w-item-section>
              <w-item-section :class="action.labelColor && (`text-` + action.labelColor)">{{action.label}}</w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </w-menu>
    </div>
    <!-- SUB-LEVEL -->
    <transition name="treeview">
      <tree-level
        v-if="hasChildren && isOpened"
        :parent-id="props.node.id"
        :depth="props.depth + 1" />
    </transition>
  </li>
</template>

<script setup>
import { computed, inject, reactive } from 'vue'

import { useDark } from '@/composables/dark'

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

const loaded = inject('loaded')
const opened = inject('opened')
const displayMode = inject('displayMode')
const selection = inject('selection')
const emitLazyLoad = inject('emitLazyLoad')
const contextActionList = inject('contextActionList')

// DATA

const state = reactive({
  isContextMenuShown: false,
  isLoading: false
})

// COMPOSABLES

const dark = useDark()

// COMPUTED

const icon = computed(() => {
  if (props.node.icon) {
    return props.node.icon
  }
  return isOpened.value
    ? 'img:/_assets/icons/fluent-opened-folder.svg'
    : 'img:/_assets/icons/fluent-folder.svg'
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

async function toggleNode(isCurrent = false) {
  opened[props.node.id] = !(opened[props.node.id] === true)
  if (opened[props.node.id] && !loaded[props.node.id]) {
    state.isLoading = true
    await Promise.race([
      new Promise((resolve, reject) => {
        emitLazyLoad(props.node.id, isCurrent, { done: resolve, fail: reject })
      }),
      new Promise((resolve, reject) => {
        setTimeout(() => reject(new Error('Async tree loading timeout')), 30000)
      })
    ])
    loaded[props.node.id] = true
    state.isLoading = false
  }
}

function openNode() {
  selection.value = props.node.id
  if (selection.value !== props.node.id && opened[props.node.id]) {
    return
  }
  toggleNode(true)
}
</script>
