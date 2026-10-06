<template>
  <w-menu class="translucent-menu" auto-close anchor="bottom left" self="top left">
    <w-list padding style="min-width: 280px">
      <w-item
        v-for="mode of modes"
        :key="mode.value"
        clickable
        :active="mode.value === props.mode"
        @click="emit('select', mode.value)">
        <w-item-section avatar>
          <!--
            The disc the rule itself is drawn with, so a choice here looks like what it turns the rule
            into. Its colour through the CSS variable rather than a `bg-*` class built at runtime,
            which Tailwind would never emit.
          -->
          <span class="rule-mode-disc" :style="{ backgroundColor: `var(--color-${mode.color})` }">
            <w-icon :name="mode.icon" size="14px" />
          </span>
        </w-item-section>
        <w-item-section class="pr-2">
          <w-item-label>{{ mode.label }}</w-item-label>
          <w-item-label caption>{{ mode.hint }}</w-item-label>
        </w-item-section>
      </w-item>
    </w-list>
  </w-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * The choice of what a page rule does: Allow, Deny or Force Allow.
 *
 * Written as the last child of its trigger, like any `WMenu` -- the group editor opens it from both the
 * rule's disc and the mode name beside it. It only reports the choice (`select`); the rule is the
 * caller's to change.
 */

// PROPS

const props = defineProps({
  /** The mode the rule has now, which the menu marks. */
  mode: {
    type: String,
    default: null
  }
})

// EMITS

const emit = defineEmits(['select'])

// I18N

const { t } = useI18n()

// COMPUTED

/**
 * Weakest first, which is also the order they outrank each other in when two rules are equally
 * specific -- see `helpers/pageRules.ts`. Icon names are literals for the icon bundle's sake.
 */
const modes = computed(() => [
  {
    value: 'ALLOW',
    label: t('admin.groups.ruleAllow'),
    hint: t('admin.groups.ruleAllowHint'),
    icon: 'la:check',
    color: 'positive'
  },
  {
    value: 'DENY',
    label: t('admin.groups.ruleDeny'),
    hint: t('admin.groups.ruleDenyHint'),
    icon: 'la:ban',
    color: 'negative'
  },
  {
    value: 'FORCEALLOW',
    label: t('admin.groups.ruleForceAllow'),
    hint: t('admin.groups.ruleForceAllowHint'),
    icon: 'la:check-double',
    color: 'blue'
  }
])
</script>

<style lang="scss">
.rule-mode-disc {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 100%;
  color: #fff;
}
</style>
