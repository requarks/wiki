<template>
  <div class="w-expansion-item">
    <!--
      `select-none`, as `WBtn` carries it: this row's whole job is to be pressed, and pressing it twice
      quickly -- opening a group, seeing it is the wrong one, closing it again -- is a double click, which
      otherwise leaves the label text selected behind the group that just shut.
    -->
    <w-item
      class="w-expansion-item__header select-none"
      :dense="dense"
      clickable
      :aria-expanded="String(isOpen)"
      :aria-controls="contentId"
      @click="toggle">
      <!--
        `header` replaces the whole row, which is how the nav sidebar draws its own icon and label.
        Falling back to the plain label keeps the simple case a one-liner.
      -->
      <slot name="header">
        <w-item-section v-if="icon" side><w-icon :name="icon" /></w-item-section>
        <w-item-section><w-item-label>{{ label }}</w-item-label></w-item-section>
      </slot>
      <w-item-section side>
        <w-icon
          name="mdi:chevron-down"
          class="w-expansion-item__arrow"
          :class="isOpen ? 'rotate-180' : ''" />
      </w-item-section>
    </w-item>
    <div v-show="isOpen" :id="contentId" class="w-expansion-item__content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import WIcon from './WIcon.vue'
import WItem from './WItem.vue'
import WItemLabel from './WItemLabel.vue'
import WItemSection from './WItemSection.vue'

/**
 * A row that expands to reveal its content.
 *
 * Simplification: the component this replaces also did accordion grouping, lazy rendering, routed
 * headers, a caption line, a side-mounted toggle and its own transition. The one caller -- a nav
 * group in the sidebar -- needs a header row and a body, so that is what this is.
 *
 * Works either uncontrolled (its own state, seeded from `defaultOpened`) or controlled through
 * `v-model`, which is what lets a caller keep a group open across a re-render.
 */
const props = defineProps({
  /** Controlled open state. Leave unset to let the component track its own. */
  modelValue: {
    type: Boolean,
    default: null
  },
  defaultOpened: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  dense: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const contentId = useId()
const innerOpen = ref(props.defaultOpened)

// -> `modelValue` is opt-in: null means uncontrolled, so only mirror it when actually provided
watch(
  () => props.modelValue,
  (value) => {
    if (value !== null) {
      innerOpen.value = value
    }
  },
  { immediate: true }
)

const isOpen = computed(() => (props.modelValue === null ? innerOpen.value : props.modelValue))

function toggle() {
  const next = !isOpen.value
  innerOpen.value = next
  emit('update:modelValue', next)
}
</script>

<style scoped>
.w-expansion-item__arrow {
  transition: transform 0.3s var(--ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .w-expansion-item__arrow {
    transition-duration: 0.01ms;
  }
}
</style>
