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
      <w-card-section>
        <block-props-form :fields="definition.props ?? []" :values="state.values" />
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
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
  values: { ...props.values }
})

// COMPUTED

// -> A required prop emptied out would leave a block that cannot draw anything
const canApply = computed(() => blockPropsFilled(props.definition, state.values))

// METHODS

function apply() {
  onDialogOK({ ...state.values })
}
</script>
