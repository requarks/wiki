<template>
  <!--
    Every branch lands on the same `w-icon` box, so a stylesheet has one stable hook regardless of
    which one renders, and carries `data-icon` so the rendered DOM says WHICH icon it is. An inline
    <svg> is otherwise anonymous -- there is no `icon` attribute to read, which makes a wrong or
    missing icon far harder to diagnose than it needs to be.
  -->
  <svg
    v-if="bundled"
    class="w-icon"
    :class="colorClass"
    :style="sizeStyle"
    :data-icon="name"
    :viewBox="`0 0 ${bundled.width} ${bundled.height}`"
    :transform="bundled.transform"
    aria-hidden="true"
    focusable="false"
    v-html="bundled.body" />
  <iconify-icon
    v-else-if="kind === 'iconify'"
    class="w-icon"
    :icon="name"
    :data-icon="name"
    :class="colorClass"
    :style="sizeStyle"
    aria-hidden="true" />
  <i
    v-else-if="kind === 'img'"
    class="w-icon"
    :class="colorClass"
    :style="sizeStyle"
    :data-icon="name"
    aria-hidden="true">
    <img :src="name.slice(4)" alt="" />
  </i>
</template>

<script setup>
import { computed } from 'vue'
import { BUNDLED_ICONS } from '@/assets/icons.generated'

/**
 * An icon reference, in any of the forms the wiki has to draw:
 *
 * - `<prefix>:<name>` — an Iconify reference, e.g. `mdi:account-edit`. Every reference written
 *   literally in this app's own source is inlined at build time (see `scripts/generate-icons.mjs`)
 *   and drawn straight from `BUNDLED_ICONS`, so the interface never waits on the icon service and
 *   nothing an administrator does to icon sets can blank it. Anything else — an icon a USER picked,
 *   stored in a page or a nav item — falls through to `iconify-icon`, which resolves it against
 *   this instance's `/_icons`.
 * - `img:<url>` — an image file, e.g. the blueprint SVGs under `/_assets/icons`.
 *
 * Anything else renders nothing.
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
  /** A theme color name, applied as a text color so that it works for every kind. */
  color: {
    type: String,
    default: null
  }
})

// -> Deliberately strict, so that `img:/_assets/x.svg` stays out of the Iconify branch
const ICONIFY_REF = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:[-.][a-z0-9]+)*$/

/** Quasar's named icon sizes, so `size="sm"` means what it always did. */
const NAMED_SIZES = {
  xs: '18px',
  sm: '24px',
  md: '32px',
  lg: '38px',
  xl: '46px'
}

// COMPUTED

const kind = computed(() => {
  const name = props.name ?? ''
  if (!name || name === 'none') {
    return 'none'
  }
  if (name.startsWith('img:')) {
    return 'img'
  }
  return ICONIFY_REF.test(name) ? 'iconify' : 'none'
})

/**
 * The inlined record, when this reference is one of ours.
 *
 * `transform` carries an alias's flip/rotate, which Iconify stores separately from the body — an
 * alias that is its parent mirrored would otherwise draw the parent.
 */
const bundled = computed(() => {
  if (kind.value !== 'iconify') {
    return null
  }
  const icon = BUNDLED_ICONS[props.name]
  if (!icon) {
    return null
  }
  const parts = []
  if (icon.rotate) {
    parts.push(`rotate(${icon.rotate * 90} ${icon.width / 2} ${icon.height / 2})`)
  }
  if (icon.hFlip) {
    parts.push(`translate(${icon.width} 0) scale(-1 1)`)
  }
  if (icon.vFlip) {
    parts.push(`translate(0 ${icon.height}) scale(1 -1)`)
  }
  return { ...icon, transform: parts.length ? parts.join(' ') : undefined }
})

const colorClass = computed(() => (props.color ? `text-${props.color}` : undefined))

/**
 * Both the inline SVG and `iconify-icon` size themselves in `em`, so one declaration covers them.
 */
const sizeStyle = computed(() => {
  if (!props.size) {
    return undefined
  }
  return { fontSize: NAMED_SIZES[props.size] ?? props.size }
})
</script>

<style scoped>
/*
  The icon box, ported from the component this replaces so that spacing and alignment are unchanged
  wherever an icon sits.

  `content-box` is deliberate and load-bearing: an icon is a 1em square of CONTENT, so a caller
  adding padding grows the box rather than squeezing the glyph.
*/
.w-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: content-box;
  width: 1em;
  height: 1em;
  flex-shrink: 0;
  line-height: 1;
  font-style: normal;
  letter-spacing: normal;
  text-align: center;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  user-select: none;
  cursor: inherit;
  /* -> the inlined bodies paint with `currentColor`, so the icon follows the text colour */
  fill: currentColor;
}

.w-icon > img {
  width: 100%;
  height: 100%;
}
</style>
