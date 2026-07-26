<template lang='pug'>
iconify-icon(
  v-if='isIconifyRef'
  :icon='props.name'
  :class='colorClass'
  :style='sizeStyle'
  aria-hidden='true'
  )
q-icon(
  v-else
  :name='props.name'
  :size='props.size'
  :color='props.color'
  )
</template>

<script setup>
import { computed } from 'vue'

/**
 * An icon reference, either of the two kinds the wiki has to draw:
 *
 * - `<prefix>:<name>` — an Iconify reference, e.g. `mdi:account-edit`. This is what the icon picker
 *   stores and what everything new should use: the element asks `/_icons` for the icon data and inlines
 *   the SVG, so the icon takes its color from CSS like a glyph would.
 * - anything else — handed to `q-icon` untouched, which covers the webfont names used across the admin
 *   area (`las la-cog`, `mdi-check`) as well as its `img:` and `svguse:` forms.
 */
const props = defineProps({
  name: {
    type: String,
    default: ''
  },
  size: {
    type: String,
    default: null
  },
  /** A Quasar color name, applied as a text color so that it works for either kind. */
  color: {
    type: String,
    default: null
  }
})

// -> Deliberately strict, so that `img:/_assets/x.svg` and `svguse:...#id` stay with q-icon
const ICONIFY_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-.][a-z0-9]+)*$/

/** Quasar's named icon sizes, which `q-icon` resolves through its own size table. */
const NAMED_SIZES = {
  xs: '18px',
  sm: '24px',
  md: '32px',
  lg: '38px',
  xl: '46px'
}

// COMPUTED

const isIconifyRef = computed(() => ICONIFY_REF.test(props.name ?? ''))

const colorClass = computed(() => (props.color ? `text-${props.color}` : undefined))

/**
 * `iconify-icon` sizes itself in `em`, so setting the font size scales it the way q-icon does.
 */
const sizeStyle = computed(() => {
  if (!props.size) { return undefined }
  return { fontSize: NAMED_SIZES[props.size] ?? props.size }
})
</script>
