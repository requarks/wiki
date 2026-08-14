<template>
  <div v-if="fields.length < 1" class="text-caption text-black/60 dark:text-white/70">
    {{ t('editor.blockPicker.noProps') }}
  </div>
  <w-form v-else class="gap-4">
    <template v-for="field of fields" :key="field.name">
      <w-select
        v-if="field.type === `select`"
        v-model="values[field.name]"
        :options="field.options ?? []"
        outlined
        dense
        options-dense
        :label="field.label ?? field.name"
        :aria-label="field.label ?? field.name"
        :required="field.required"
        :hint="field.hint" />
      <w-toggle
        v-else-if="field.type === `boolean`"
        v-model="values[field.name]"
        dense
        :label="field.label ?? field.name" />
      <w-input
        v-else
        v-model="values[field.name]"
        outlined
        dense
        :type="field.type === `number` ? `number` : `text`"
        :label="field.label ?? field.name"
        :aria-label="field.label ?? field.name"
        :required="field.required"
        :hint="field.hint" />
    </template>
  </w-form>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

/**
 * The form a block's props make: one field per prop, in the order the block declares them.
 *
 * Shared by the block picker, which fills it in for a block about to be inserted, and the parameters
 * dialog the editor's lens opens over one already in the page. The two ask the same thing of an
 * author and must offer the same controls, so the fields are described once here.
 *
 * A block with nothing to fill in is not a broken form: it is inserted, or left, as it stands. A
 * custom block reports no props at all, since only the compiled manifest carries them.
 *
 * It writes into the `values` object it is given rather than emitting: what a caller wants back is
 * "what is in the form now", and both of them already keep that object as their own state — a
 * `v-model` per field would be the same object, one indirection further away.
 *
 * Padding is the caller's: this sits in a panel in one and a card in the other.
 */

// PROPS

defineProps({
  /** The props the block declares, as the API describes them. */
  fields: {
    type: Array,
    required: true
  },
  /** Values by prop name, written into as the author types. */
  values: {
    type: Object,
    required: true
  }
})

// I18N

const { t } = useI18n()
</script>
