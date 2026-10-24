<template>
  <!--
    No `color` on the chip, which would paint it solid: the tint and the ink are the stylesheet's
    below, both mixed from the one hue handed over as `--status-hue`.
  -->
  <w-chip
    class="feedback-status-badge"
    dense
    :size="size"
    :icon="look.icon"
    :style="{ '--status-hue': `var(--color-${look.color})` }"
    :label="t(`common.feedback.statuses.${status}`)" />
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { FEEDBACK_STATUS_LOOK } from '@/helpers/pageFeedback'

/**
 * Where an idea stands, as a tinted chip: the listing's rows, the head of an idea, the duplicate
 * check and the status dialog all draw it, and all draw it the same way.
 */
const props = defineProps({
  status: {
    type: String,
    default: 'open'
  },
  size: {
    type: String,
    default: 'sm'
  }
})

const { t } = useI18n()

const look = computed(() => FEEDBACK_STATUS_LOOK[props.status] ?? FEEDBACK_STATUS_LOOK.open)
</script>

<style lang="scss">
/*
  A pale tint of the status's hue, with its label in a dark shade of the same hue -- both mixed from
  the one colour rather than picked as a pair, so that a status changing colour changes in one place
  (`FEEDBACK_STATUS_LOOK`). Unlayered, so it outranks the neutral tint `WChip` gives a chip with no
  colour of its own, which is a Tailwind utility.

  The dark theme turns it over: a pale chip is a glare on a dark page, so there the tint is the hue
  over the surface, translucent, and the label a light shade of it.
*/
.feedback-status-badge {
  background-color: color-mix(in srgb, var(--status-hue) 14%, #fff);
  color: color-mix(in srgb, var(--status-hue) 60%, #000);
  font-weight: 500;

  @at-root .body--dark & {
    background-color: color-mix(in srgb, var(--status-hue) 26%, transparent);
    color: color-mix(in srgb, var(--status-hue) 45%, #fff);
  }
}
</style>
