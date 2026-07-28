<template>
  <nav class="w-breadcrumbs" :aria-label="ariaLabel">
    <ol class="flex flex-wrap items-center gap-2">
      <template v-for="(item, idx) of items" :key="item.key ?? idx">
        <li class="flex items-center" :style="idx < items.length - 1 ? activeStyle : null">
          <component
            :is="item.to ? 'router-link' : 'span'"
            :to="item.to"
            :aria-label="item.ariaLabel"
            :aria-current="idx === items.length - 1 ? 'page' : undefined"
            class="w-breadcrumbs__el relative inline-flex items-center text-inherit no-underline">
            <w-icon
              v-if="item.icon"
              :name="item.icon"
              class="w-breadcrumbs__el-icon"
              :class="item.label ? 'mr-2' : ''" />
            <span v-if="item.label">{{ item.label }}</span>
            <w-tooltip v-if="item.tooltip">{{ item.tooltip }}</w-tooltip>
          </component>
        </li>
        <li
          v-if="idx < items.length - 1"
          class="w-breadcrumbs__separator flex items-center"
          :style="separatorStyle"
          aria-hidden="true">
          <slot name="separator">{{ separator }}</slot>
        </li>
      </template>
    </ol>
  </nav>
</template>

<script setup>
import { computed } from 'vue'
import WTooltip from './WTooltip.vue'
import WIcon from './WIcon.vue'

/**
 * Breadcrumb trail.
 *
 * Simplification: the component this replaces took its crumbs as child components and then walked
 * its own default slot's vnodes to find them, so it could inject a separator between each and tag
 * the last one. Passing the trail as an array does the same job without the vnode inspection, and
 * lets the list be real `<ol>`/`<li>` markup -- which is what a breadcrumb trail is, and what
 * assistive technology expects. The only caller builds its crumbs from a store array anyway.
 *
 * Colour follows the original: every crumb BUT the last takes `active-color`, and the last one
 * inherits the surrounding text colour. That reads backwards until you notice the last crumb is
 * the current page -- it is the one that is not a destination.
 */
const props = defineProps({
  /**
   * The trail, root first. Each entry is
   * `{ key?, icon?, label?, ariaLabel?, to?, tooltip? }`; an entry with no `to` renders as plain
   * text rather than a link.
   */
  items: {
    type: Array,
    required: true
  },
  /** Theme colour for every crumb except the last. */
  activeColor: {
    type: String,
    default: 'primary'
  },
  /** Theme colour for the separators. */
  separatorColor: {
    type: String,
    default: null
  },
  /** Separator text, when the `separator` slot is not used. */
  separator: {
    type: String,
    default: '/'
  },
  /** Accessible name for the landmark. */
  ariaLabel: {
    type: String,
    default: 'Breadcrumb'
  }
})

/*
  Built as inline styles rather than `text-<colour>` classes: the colour names arrive at runtime, so
  a dynamic class string would never be seen by Tailwind's scanner and the utility would not be
  generated. Every other w-* component that takes a colour name does the same.
*/
const activeStyle = computed(() => ({ color: `var(--color-${props.activeColor})` }))
const separatorStyle = computed(() =>
  props.separatorColor ? { color: `var(--color-${props.separatorColor})` } : null
)
</script>

<style scoped>
/* Matches the 125% the original used, so an icon-only crumb stays larger than its label */
.w-breadcrumbs__el-icon {
  font-size: 125%;
}
</style>
