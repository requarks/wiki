<template>
  <div class="w-tree__node relative" :class="nodeClasses">
    <div
      class="w-tree__node-header relative flex flex-nowrap items-center rounded outline-0 hover:bg-black/8 dark:hover:bg-white/14"
      tabindex="0"
      role="treeitem"
      :aria-expanded="isParent ? isExpanded : undefined"
      :aria-selected="isSelected"
      @click="$emit('select', nodeId)"
      @keydown.enter.prevent="$emit('select', nodeId)"
      @keydown.space.prevent="isParent && $emit('toggle', nodeId)">
      <!--
        Only a parent draws an arrow, and clicking it toggles WITHOUT selecting -- the row click and
        the arrow click do different things, which is why the arrow stops propagation.
      -->
      <w-icon
        v-if="isParent"
        :name="icon"
        class="w-tree__arrow"
        :class="isExpanded ? 'w-tree__arrow--rotate' : ''"
        @click.stop="$emit('toggle', nodeId)" />
      <!--
        Selecting a node DIMS it to grey rather than highlighting it. That reads backwards, but it
        is what the original did with no `selected-color` set, and the contents sidebar relies on
        the default.

        The colours are arbitrary-value classes rather than `text-black` / `text-white`: Quasar
        declares those two unlayered and !important, so its rule would beat the dark-mode variant
        and pin the label black in both themes. Phase 5 can use the plain utilities.
      -->
      <div
        class="w-tree__node-header-content min-w-0 flex-1"
        :class="
          isSelected
            ? 'text-[var(--color-grey)]'
            : 'text-[var(--color-black)] dark:text-[var(--color-white)]'
        ">
        {{ node[labelKey] }}
      </div>
    </div>
    <div v-if="isParent && isExpanded" class="w-tree__children" role="group">
      <w-tree-node
        v-for="child of node[childrenKey]"
        :key="child[nodeKey]"
        :node="child"
        :node-key="nodeKey"
        :label-key="labelKey"
        :children-key="childrenKey"
        :icon="icon"
        :dense="dense"
        :expanded="expanded"
        :selected="selected"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import WIcon from './WIcon.vue'

/**
 * One node of a `WTree`, recursing into its own children.
 *
 * Internal to `WTree` -- not registered globally, not meant to be used directly. It holds no state:
 * expansion and selection both live on the root, and this only reports intent upward.
 *
 * `dense` and `root` are threaded down rather than read from an ancestor selector because the
 * connector geometry lives in this file's scoped block. A scoped rule cannot reach across from the
 * root component's `.w-tree--dense`, so each node is told what it is and styles itself.
 */
const props = defineProps({
  node: { type: Object, required: true },
  nodeKey: { type: String, required: true },
  labelKey: { type: String, required: true },
  childrenKey: { type: String, required: true },
  icon: { type: String, required: true },
  dense: Boolean,
  /** A top-level node, which draws no connector back to a parent that is not there. */
  root: Boolean,
  /** Keys of every expanded node. */
  expanded: { type: Array, required: true },
  /** Key of the selected node, or null. */
  selected: { type: [String, Number], default: null }
})

defineEmits(['toggle', 'select'])

const nodeId = computed(() => props.node[props.nodeKey])
const isParent = computed(() => props.node[props.childrenKey]?.length > 0)
const isExpanded = computed(() => props.expanded.includes(nodeId.value))
const isSelected = computed(() => props.selected === nodeId.value)

const nodeClasses = computed(() => [
  isParent.value ? 'w-tree__node--parent' : 'w-tree__node--child',
  props.dense ? 'w-tree__node--dense' : '',
  props.root ? 'w-tree__node--root' : ''
])
</script>

<style scoped>
/*
  Geometry is a port of the tree this replaces, so the contents sidebar keeps the same elbow
  connectors at the same offsets. The lines are drawn with borders on absolutely positioned
  pseudo-elements: `:after` on a node is the vertical run down to its next sibling, and `:before` on
  a header is the elbow that turns in towards the label.
*/
.w-tree__node {
  padding: 0 0 3px 22px;
}

.w-tree__node::after {
  content: '';
  position: absolute;
  top: -3px;
  bottom: 0;
  left: -13px;
  width: 2px;
  border-left: 1px solid currentColor;
}

/* The run stops at the last sibling -- otherwise it would trail past the end of the group */
.w-tree__node:last-child::after {
  display: none;
}

.w-tree__node-header::before {
  content: '';
  position: absolute;
  top: -3px;
  bottom: 50%;
  left: -35px;
  width: 31px;
  border-left: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
}

.w-tree__node--parent {
  padding-left: 2px;
}
.w-tree__node--parent > .w-tree__node-header::before {
  left: -15px;
  width: 15px;
}

.w-tree__children {
  padding-left: 25px;
}

.w-tree__node-header {
  padding: 4px;
  margin-top: 3px;
}

/* A top-level node has no parent to connect back to */
.w-tree__node--root {
  padding: 0;
}
.w-tree__node--root::after,
.w-tree__node--root > .w-tree__node-header::before {
  display: none;
}
/* ...but a childless one still indents to where a label with an arrow would start */
.w-tree__node--root.w-tree__node--child > .w-tree__node-header {
  padding-left: 24px;
}

.w-tree__node-header-content {
  transition: color 0.3s;
}

.w-tree__arrow {
  font-size: 16px;
  margin-right: 4px;
  transition: transform 0.3s;
}
.w-tree__arrow--rotate {
  transform: rotate(90deg);
}

/* -- Dense ---------------------------------------------------------------------------------- */

.w-tree__node--dense {
  padding: 0;
}
.w-tree__node--dense::after {
  top: 0;
  left: -8px;
}
.w-tree__node--dense > .w-tree__node-header {
  margin-top: 0;
  padding: 1px;
}
.w-tree__node--dense > .w-tree__node-header::before {
  top: 0;
  left: -8px;
  width: 8px;
}
.w-tree__node--dense.w-tree__node--child {
  padding-left: 17px;
}
.w-tree__node--dense.w-tree__node--child > .w-tree__node-header::before {
  left: -25px;
  width: 21px;
}
.w-tree__node--dense > .w-tree__children {
  padding-left: 16px;
}
.w-tree__node--dense .w-tree__arrow {
  margin-right: 1px;
}
.w-tree__node--dense.w-tree__node--root.w-tree__node--child > .w-tree__node-header {
  padding-left: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .w-tree__node-header-content,
  .w-tree__arrow {
    transition-duration: 0.01ms;
  }
}
</style>
