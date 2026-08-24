<template>
  <!--
    A `w-menu` and nothing else, so that the placeholder the menu uses to locate its trigger lands
    directly inside the row this is written into. A wrapper element of its own would become the anchor
    instead, and the rows of the editor are drawn by sibling selectors (the nesting elbows) that an
    extra element between them would break.
  -->
  <w-menu class="translucent-menu" context-menu auto-close>
    <!--
      The file manager's right-click menu, to the class and the padding: the blurred translucent panel
      comes from `translucent-menu`, and the inset card is what keeps the rows off its edges — the
      stylesheet clears that card's own background so the blur still shows through it.
    -->
    <w-card class="p-2">
      <w-list dense style="min-width: 150px">
        <w-item v-for="action of actions" :key="action.key" clickable @click="action.handler">
          <w-item-section side>
            <w-icon :name="action.icon" :color="action.color" />
          </w-item-section>
          <w-item-section :class="action.labelClass">{{ action.label }}</w-item-section>
        </w-item>
      </w-list>
    </w-card>
  </w-menu>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Right-click menu for one row of the navigation editor.
 *
 * The row markup differs per item type — a header and a separator are plain divs, a link is a
 * `w-item` — but the menu offered on all three is the same, which is why it lives here rather than
 * being written into each branch of the list.
 *
 * Acting on the row is the parent's business: this component knows what is on offer, the overlay
 * holding the list knows how to carry it out.
 */
const props = defineProps({
  /** The item the menu acts on, as held in the editor's flat list. */
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['duplicate', 'toggleNesting', 'delete'])

// I18N

const { t } = useI18n()

// COMPUTED

const actions = computed(() => {
  const list = [
    {
      key: 'duplicate',
      icon: 'la:copy',
      color: 'teal',
      label: t('common.actions.duplicate'),
      handler: () => emit('duplicate', props.item)
    }
  ]
  /*
    Nesting is a link's affair alone. `isNested` says a row belongs to the link above it, and the
    sidebar reads it off links only — a nested header or separator is not a shape it can draw, which
    is also why the properties panel offers this same pair of actions there and nowhere else.

    Offered even where the result would be invalid (a first row, or one following a header), matching
    that panel: the list shows an unparented child in red and says why, rather than quietly refusing
    a step that is on the way to somewhere valid.
  */
  if (props.item.type === 'link') {
    list.push({
      key: 'nesting',
      icon: props.item.isNested ? 'mdi:format-indent-decrease' : 'mdi:format-indent-increase',
      color: 'teal',
      label: props.item.isNested ? t('navEdit.unnestItem') : t('navEdit.nestItem'),
      handler: () => emit('toggleNesting', props.item)
    })
  }
  list.push({
    key: 'delete',
    icon: 'la:trash-alt',
    color: 'negative',
    labelClass: 'text-negative',
    label: t('common.actions.delete'),
    handler: () => emit('delete', props.item)
  })
  return list
})
</script>
