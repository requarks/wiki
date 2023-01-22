<template lang="pug">
.treeview
  tree-level(
    :depth='0'
    :parent-id='null'
  )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, provide, reactive, toRef } from 'vue'
import { findKey } from 'lodash-es'

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
    default: () => ['newFolder', 'duplicate', 'rename', 'move', 'del']
  },
  displayMode: {
    type: String,
    default: 'title'
  }
})

// EMITS

const emit = defineEmits(['update:selected', 'lazyLoad', 'contextAction'])

// I18N

const { t } = useI18n()

// Context Actions

const contextActions = {
  newFolder: {
    icon: 'las la-plus-circle',
    iconColor: 'blue',
    label: t('common.actions.newFolder')
  },
  duplicate: {
    icon: 'las la-copy',
    iconColor: 'teal',
    label: t('common.actions.duplicate') + '...'
  },
  rename: {
    icon: 'las la-redo',
    iconColor: 'teal',
    label: t('common.actions.rename') + '...'
  },
  move: {
    icon: 'las la-arrow-right',
    iconColor: 'teal',
    label: t('common.actions.moveTo') + '...'
  },
  del: {
    icon: 'las la-trash-alt',
    iconColor: 'negative',
    label: t('common.actions.delete'),
    labelColor: 'negative'
  }
}
provide('contextActionList', props.contextActionList.map(key => ({
  key,
  ...contextActions[key],
  handler: (nodeId) => {
    emit('contextAction', nodeId, key)
  }
})))

// DATA

const state = reactive({
  loaded: {},
  opened: {}
})

// COMPUTED

const selection = computed({
  get () {
    return props.selected
  },
  set (val) {
    emit('update:selected', val)
  }
})

// METHODS

function emitLazyLoad (nodeId, isCurrent, clb) {
  if (props.useLazyLoad) {
    emit('lazyLoad', nodeId, isCurrent, clb)
  } else {
    clb.done()
  }
}

function setOpened (nodeId) {
  state.opened[nodeId] = true
}
function isLoaded (nodeId) {
  return state.loaded[nodeId]
}
function setLoaded (nodeId, value) {
  state.loaded[nodeId] = value
}
function resetLoaded () {
  state.loaded = {}
}

// PROVIDE

provide('roots', toRef(props, 'roots'))
provide('nodes', props.nodes)
provide('loaded', state.loaded)
provide('opened', state.opened)
provide('displayMode', toRef(props, 'displayMode'))
provide('selection', selection)
provide('emitLazyLoad', emitLazyLoad)

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
      const parentId = findKey(props.nodes, n => n.children?.includes(currentId))
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

      > .treeview-label {
        border-radius: 5px;
      }
    }
  }

  &-node {
    display: block;
    border-left: 2px solid rgba(0,0,0,.05);

    @at-root .body--light & {
      border-left: 2px solid rgba(0,0,0,.05);
    }
    @at-root .body--dark & {
      border-left: 2px solid rgba(255,255,255,.1);
    }
  }

  &-label {
    padding: 4px 8px;
    border-radius: 0 5px 5px 0;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background-color .4s ease;

    &:hover, &:focus, &.active {
      @at-root .body--light & {
        background-color: rgba(0,0,0,.05);
      }
      @at-root .body--dark & {
        background-color: rgba(255,255,255,.1);
      }
    }

    > .q-icon {
      margin-right: 5px;
    }

    &-text {
      flex: 1 0;
    }
  }

  // Animations

  &-enter-active, &-leave-active {
    transition: all 0.2s ease;
  }

  &-enter-from, &-leave-to {
    transform: translateY(-10px);
    opacity: 0;
  }
}
</style>
