<template>
  <div :class="classes">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * A column within a `WItem`. With no props it is the main section and takes the remaining width;
 * `avatar`, `thumbnail` and `side` make it a fixed-width flanking section instead.
 */
const props = defineProps({
  /** Trailing/secondary section: does not grow, and is dimmed. */
  side: {
    type: Boolean,
    default: false
  },
  /** Leading section sized for an icon or avatar. */
  avatar: {
    type: Boolean,
    default: false
  },
  /** Leading section sized for an image. */
  thumbnail: {
    type: Boolean,
    default: false
  },
  /** Vertical alignment within the row. */
  top: {
    type: Boolean,
    default: false
  }
})

const isFlanking = computed(() => props.side || props.avatar || props.thumbnail)

const classes = computed(() => [
  'w-item-section flex min-w-0 flex-col',
  props.top ? 'self-start' : 'justify-center',
  // -> Modifier classes drive the scoped rules below (icon sizing, trailing alignment)
  isFlanking.value ? 'w-item-section--side shrink-0' : 'w-item-section--main min-w-0 flex-1',
  props.avatar ? 'w-item-section--avatar' : '',
  // -> Matches the muted treatment secondary content had; avatars keep full contrast
  props.side && !props.avatar ? 'text-black/54 dark:text-white/70' : ''
])
</script>

<style scoped>
/*
  Ports Quasar's item-section rules. These live in the component's own stylesheet rather than in a
  Tailwind layer on purpose: Quasar declares `.q-icon { font-size: inherit }` unlayered, and a
  layered rule -- whatever its specificity -- would lose to it. A Vue SFC style block is emitted
  unlayered, so `.w-item-section--side > .w-icon` (0,2,0) wins on specificity as intended.
*/
/*
  Spacing between sections is section padding, not a gap on the item -- `.w-item` never had one.
  A gap would also apply to children that are not sections (BlueprintIcon renders its own avatar
  section), doubling their spacing.
*/
.w-item-section--side {
  align-items: flex-start;
  padding-right: 16px;
}

/* A side section that FOLLOWS the main one is trailing: padding and alignment flip. */
.w-item-section--main ~ .w-item-section--side {
  align-items: flex-end;
  padding-left: 16px;
  padding-right: 0;
}

/* Two adjacent main sections get a small gutter, as they did before. */
.w-item-section--main + .w-item-section--main {
  margin-left: 8px;
}

.w-item-section--avatar {
  min-width: 56px;
  align-items: center;
}

/* 24px icons / 40px avatars in a flanking section, matching Quasar's item metrics */
.w-item-section--side > :deep(.w-icon) {
  font-size: 24px;
}

/*
  A flanking avatar is 40px, not the 48px an avatar takes on its own. The box has to be set here, not
  just the font size: the avatar this replaces derived its dimensions from its font size, ours does
  not. Its own default is a CSS rule for exactly this reason -- an inline style could not be
  overridden, which is how BlueprintIcon quietly grew to 48px.
*/
.w-item-section--side > :deep(.w-avatar) {
  width: 40px;
  height: 40px;
  font-size: 24px;
}
</style>
