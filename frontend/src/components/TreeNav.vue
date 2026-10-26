<template>
  <div class="treeview">
    <tree-level :depth="0" :parent-id="null" />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, provide, reactive, toRef, watch } from 'vue'
import { findKey } from 'es-toolkit/object'

import TreeLevel from './TreeLevel.vue'

// PROPS

const props = defineProps({
  nodes: {
    type: Object,
    default: () => ({})
  },
  roots: {
    type: Array,
    default: () => []
  },
  selected: {
    type: String,
    default: null
  },
  useLazyLoad: {
    type: Boolean,
    default: false
  },
  contextActionList: {
    type: Array,
    default: () => ['newFolder', 'color', 'duplicate', 'rename', 'move', 'del']
  },
  displayMode: {
    type: String,
    default: 'title'
  },
  /**
   * Whether something the parent cares about is being dragged right now. The tree cannot tell on its
   * own: a drag is started elsewhere (the File Manager's list), and one from outside the page -- a
   * file off the desktop -- must not open folders or light rows up.
   */
  dragActive: {
    type: Boolean,
    default: false
  },
  /**
   * Whether the item being dragged may be dropped on a node (`null` for the root). Leaving it unset
   * is what keeps the tree a plain picker: nothing is ever a drop target, which is how every dialog
   * that browses folders uses it.
   */
  canDrop: {
    type: Function,
    default: null
  }
})

// EMITS

const emit = defineEmits(['update:selected', 'lazyLoad', 'contextAction', 'dropItem'])

// I18N

const { t } = useI18n()

// Context Actions

/*
  Computed, and PROVIDED as a computed: the locale strings are fetched after the app mounts
  (`App.vue` -> `applyLocale`), so a `t()` called once during `setup()` can resolve before they
  land and leave the right-click menu showing raw keys for the life of the page — which is what a
  direct load of a screen carrying this tree does, as opposed to a navigation to it. Wrapping the
  labels alone would not be enough: the list handed to the descendants is built here too.
*/
const contextActions = computed(() => ({
  newFolder: {
    icon: 'la:plus-circle',
    iconColor: 'blue',
    label: t('common.actions.newFolder')
  },
  color: {
    icon: 'la:fill',
    iconColor: 'orange',
    label: t('common.actions.setColor') + '...'
  },
  duplicate: {
    icon: 'la:copy',
    iconColor: 'teal',
    label: t('common.actions.duplicate') + '...'
  },
  rename: {
    icon: 'la:redo',
    iconColor: 'teal',
    label: t('common.actions.rename') + '...'
  },
  move: {
    icon: 'la:arrow-right',
    iconColor: 'teal',
    label: t('common.actions.moveTo') + '...'
  },
  del: {
    icon: 'la:trash-alt',
    iconColor: 'negative',
    label: t('common.actions.delete'),
    labelColor: 'negative'
  }
}))
provide(
  'contextActionList',
  computed(() =>
    props.contextActionList.map((key) => ({
      key,
      ...contextActions.value[key],
      handler: (nodeId) => {
        emit('contextAction', nodeId, key)
      }
    }))
  )
)

// DATA

const state = reactive({
  loaded: {},
  opened: {},
  /**
   * The node a drag is over, droppable or not -- the folder the item already sits in still opens on a
   * hover, so that the folders under it can be reached. `null` is the root, so nothing is `undefined`.
   */
  dragOverId: undefined
})

// COMPUTED

const selection = computed({
  get() {
    return props.selected
  },
  set(val) {
    emit('update:selected', val)
  }
})

// METHODS

function emitLazyLoad(nodeId, isCurrent, clb) {
  if (props.useLazyLoad) {
    emit('lazyLoad', nodeId, isCurrent, clb)
  } else {
    clb.done()
  }
}

/*
  One set of handlers for every row, the root included, keyed by node. The drag is tracked from
  `dragover` rather than from `dragenter` / `dragleave` pairs: those fire for every child element a
  pointer crosses, and a row that missed one would stay lit. `dragover` keeps firing while the pointer
  is anywhere over the row, so a wrong guess is corrected a moment later.
*/
function acceptsDrop(nodeId) {
  return props.dragActive && Boolean(props.canDrop?.(nodeId))
}

const dropTarget = {
  isOver: (nodeId) => props.dragActive && state.dragOverId === nodeId,
  accepts: acceptsDrop,
  over(ev, nodeId) {
    if (!props.dragActive || !props.canDrop) {
      return
    }
    state.dragOverId = nodeId
    // -> Cancelling the event is what makes the row a drop target at all
    if (acceptsDrop(nodeId)) {
      ev.preventDefault()
      ev.dataTransfer.dropEffect = 'move'
    }
  },
  leave(ev, nodeId) {
    // -> Moving onto the row's own icon or label is not leaving it
    if (ev.currentTarget.contains(ev.relatedTarget)) {
      return
    }
    if (state.dragOverId === nodeId) {
      state.dragOverId = undefined
    }
  },
  drop(ev, nodeId) {
    state.dragOverId = undefined
    if (!acceptsDrop(nodeId)) {
      return
    }
    ev.preventDefault()
    emit('dropItem', nodeId)
  }
}

// -> A drag cancelled with Escape, or dropped anywhere else, ends here too
watch(
  () => props.dragActive,
  (active) => {
    if (!active) {
      state.dragOverId = undefined
    }
  }
)

function setOpened(nodeId) {
  state.opened[nodeId] = true
}
function isLoaded(nodeId) {
  return state.loaded[nodeId]
}
function setLoaded(nodeId, value) {
  state.loaded[nodeId] = value
}
function resetLoaded() {
  state.loaded = {}
}

// PROVIDE

provide('roots', toRef(props, 'roots'))
/*
  A ref, not `props.nodes`. Providing the object itself hands the levels below the map as it stood at
  setup, so a parent that REPLACES its map -- which is how starting a tree over reads -- leaves them
  looking up new ids in the old one. The rows still appeared, since `roots` was a ref and updated:
  each drew its icon and no label at all, `{ ...undefined }` having nothing to spread.
*/
provide('nodes', toRef(props, 'nodes'))
provide('loaded', state.loaded)
provide('opened', state.opened)
provide('displayMode', toRef(props, 'displayMode'))
provide('selection', selection)
provide('emitLazyLoad', emitLazyLoad)
provide('dropTarget', dropTarget)

// EXPOSE

defineExpose({
  setOpened,
  isLoaded,
  setLoaded,
  resetLoaded
})

// MOUNTED

onMounted(() => {
  if (props.selected) {
    let foundRoot = false
    let currentId = props.selected
    while (!foundRoot) {
      const parentId = findKey(props.nodes, (n) => n.children?.includes(currentId))
      if (parentId) {
        state.opened[parentId] = true
        currentId = parentId
      } else {
        foundRoot = true
      }
    }
    state.opened[props.selected] = true
  }
})
</script>

<style lang="scss">
.treeview {
  &-level {
    list-style: none;
    padding-left: 19px;
  }

  > .treeview-level {
    padding-left: 0;

    > .treeview-node {
      border-left: none;
    }
  }

  &-node {
    display: block;
    border-left: 2px solid rgba(0, 0, 0, 0.05);

    @at-root .body--light & {
      border-left: 2px solid rgba(0, 0, 0, 0.05);
    }
    @at-root .body--dark & {
      border-left: 2px solid rgba(255, 255, 255, 0.1);
    }
  }

  &-label {
    // -> 12px matches a toolbar's own side padding, which is what lines a row's folder icon up with
    //    the icon in the header above it. Applied here rather than on the container so the row's
    //    highlight still spans the full width.
    padding: 4px 12px;
    // -> Square: a row spans the full width of its container, and a radius on a full-width band reads
    //    as a pill that has been clipped rather than as a highlighted row
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background-color 0.4s ease;

    &:hover,
    &:focus,
    &.active {
      @at-root .body--light & {
        background-color: rgba(0, 0, 0, 0.05);
      }
      @at-root .body--dark & {
        background-color: rgba(255, 255, 255, 0.1);
      }
    }

    // -> Where a dragged item would land. Outlined rather than filled, so it reads over the selected
    //    row's fill as well as over a plain one
    &.is-drop-target {
      box-shadow: inset 0 0 0 2px var(--color-primary);
    }

    > .w-icon {
      margin-right: 5px;
    }

    &-text {
      flex: 1 0;
    }
  }

  // Animations

  &-enter-active,
  &-leave-active {
    transition: all 0.2s ease;
  }

  &-enter-from,
  &-leave-to {
    transform: translateY(-10px);
    opacity: 0;
  }
}
</style>
