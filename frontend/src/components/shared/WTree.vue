<template>
  <div class="w-tree relative" :class="dense ? 'w-tree--dense' : ''" role="tree">
    <w-tree-node
      v-for="node of nodes"
      :key="node[nodeKey]"
      root
      :node="node"
      :node-key="nodeKey"
      :label-key="labelKey"
      :children-key="childrenKey"
      :icon="icon"
      :dense="dense"
      :expanded="expanded"
      :selected="selected"
      @toggle="onToggle"
      @select="onSelect" />
  </div>
</template>

<script setup>
import WTreeNode from './WTreeNode.vue'

/**
 * Collapsible tree.
 *
 * Simplification: the component this replaces also did checkbox ticking, lazy-loaded children,
 * filtering, accordion mode, per-node body/header slots, avatars and images, and a spinner per
 * node. The one caller -- the page contents sidebar -- draws a static heading tree, so this keeps
 * expansion, selection and the connector lines and drops the rest.
 *
 * Both expansion and selection are controlled: this component holds no state of its own, so the
 * caller's `v-model:expanded` / `v-model:selected` are the only source of truth.
 */
const props = defineProps({
  /** The tree, as nested `{ [nodeKey], [labelKey], [childrenKey] }` objects. */
  nodes: {
    type: Array,
    required: true
  },
  nodeKey: {
    type: String,
    default: 'id'
  },
  labelKey: {
    type: String,
    default: 'label'
  },
  childrenKey: {
    type: String,
    default: 'children'
  },
  /** Icon reference for the expand arrow. It is rotated 90 degrees when open. */
  icon: {
    type: String,
    default: 'mdi:play'
  },
  dense: Boolean,
  /** Keys of every expanded node. */
  expanded: {
    type: Array,
    default: () => []
  },
  /** Key of the selected node, or null. */
  selected: {
    type: [String, Number],
    default: null
  }
})

const emit = defineEmits(['update:expanded', 'update:selected'])

function onToggle(key) {
  emit(
    'update:expanded',
    props.expanded.includes(key) ? props.expanded.filter((k) => k !== key) : [...props.expanded, key]
  )
}

/** Clicking the selected node clears the selection, as the original did. */
function onSelect(key) {
  emit('update:selected', props.selected === key ? null : key)
}
</script>

<style scoped>
/*
  The connectors and arrows inherit this; the labels set their own colour. Kept on the root so a
  single declaration covers every level of the recursion.
*/
.w-tree {
  color: var(--color-grey);
}
</style>
