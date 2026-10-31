<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 550px">
      <w-card-section class="card-header">
        <w-icon
          :name="`img:/_assets/icons/ultraviolet-${definition.isCustom ? 'plugin' : definition.icon}.svg`"
          size="sm"
          class="mr-2" />
        <!-- -> The block is named in the title rather than over the form: one line of chrome above a
                short form is enough, and which block this is belongs with what is being done to it. -->
        <span>{{ t('editor.blockParams.title', { name: definition.name }) }}</span>
      </w-card-section>
      <!-- -> An inline block's value, what sits between its brackets: the thing it draws -->
      <w-card-section v-if="content !== null" class="pb-0">
        <w-input
          v-model="state.content"
          outlined
          dense
          autofocus
          :label="t('editor.blockParams.value')"
          :aria-label="t('editor.blockParams.value')"
          :hint="t('editor.blockParams.valueHint')"
          @keyup.enter="apply" />
      </w-card-section>
      <w-card-section v-if="content === null || (definition.props ?? []).length > 0">
        <block-props-form :fields="definition.props ?? []" :values="state.values" />
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.apply`)"
          color="primary"
          padding="xs md"
          :disabled="!canApply"
          @click="apply" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { blockPropsFilled } from '@/helpers/blocks'

import BlockPropsForm from '@/components/BlockPropsForm.vue'

/**
 * What a block already in the page was given, for changing.
 *
 * The same form the picker fills in for a new block — see `BlockPropsForm` — over the values read
 * back out of the page source. What comes back is only that: the caller knows which line the block
 * was on and what else was written on it, and is the one to put the answer back.
 *
 * The values are copied on the way in, so closing without applying leaves the page as it was.
 *
 * An inline block is given its `content` too -- the value between its brackets -- which is offered
 * above the props: for a timestamp or a colour it is the thing being edited, and the props only say
 * how it is drawn. A block on a line of its own passes none, and its body is not this dialog's.
 * What comes back is `{ values, content }` either way.
 */

// PROPS

const props = defineProps({
  /** The block as the API describes it: its name, its icon and the props it declares. */
  definition: {
    type: Object,
    required: true
  },
  /** What the page currently gives it, by prop name. */
  values: {
    type: Object,
    required: true
  },
  /** An inline block's value, or null for a block on a line of its own. */
  content: {
    type: String,
    default: null
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  values: { ...props.values },
  content: props.content ?? ''
})

// COMPUTED

// -> A required prop emptied out would leave a block that cannot draw anything; so would no value
const canApply = computed(
  () =>
    blockPropsFilled(props.definition, state.values) &&
    (props.content === null || state.content.trim().length > 0)
)

// METHODS

function apply() {
  if (!canApply.value) {
    return
  }
  onDialogOK({
    values: { ...state.values },
    content: props.content === null ? null : state.content.trim()
  })
}
</script>
