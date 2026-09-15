<template>
  <div v-if="fields.length < 1" class="text-caption text-black/60 dark:text-white/70">
    {{ t('editor.blockPicker.noProps') }}
  </div>
  <w-form v-else class="gap-4">
    <template v-for="field of fields" :key="field.name">
      <!--
        A block's choices are plain strings where the value is the wording, and `{ label, value }`
        objects where they differ -- a tab's header level reads "Heading 3" and is written as `3`. Only
        the second kind needs the value taken out of the option and resolved back to it for display,
        and asking for that on a list of strings would read `undefined` off each one.
      -->
      <w-select
        v-if="field.type === `select`"
        v-model="values[field.name]"
        :options="field.options ?? []"
        :emit-value="hasValueOptions(field)"
        :map-options="hasValueOptions(field)"
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
      <!--
        An Iconify reference, with the picker on the end of the field and a preview of what is in it —
        the same control the page properties panel offers for a page's own icon, because it is the same
        question. The reference can still be typed, which is the quicker way when it is already known.
      -->
      <w-input
        v-else-if="field.type === `icon`"
        v-model="values[field.name]"
        outlined
        dense
        :label="field.label ?? field.name"
        :aria-label="field.label ?? field.name"
        :required="field.required"
        :hint="field.hint">
        <template #prepend>
          <w-icon
            v-if="values[field.name]"
            :name="values[field.name]"
            size="20px"
            color="primary" />
        </template>
        <template #append>
          <!--
            A button rather than a bare `w-icon`: for a bundled icon WIcon renders an `<svg>` whose
            body is set through `v-html`, which renders no slot — so a menu inside one never exists.
            The same note as in `PagePropertiesDialog`, where that was found the hard way.
          -->
          <w-btn
            flat
            dense
            round
            icon="la:icons"
            color="primary"
            :aria-label="t(`iconPicker.open`)">
            <w-tooltip>{{ t('iconPicker.open') }}</w-tooltip>
            <w-menu content-class="shadow-7" anchor="bottom right" self="top right">
              <icon-picker-dialog v-model="values[field.name]" />
            </w-menu>
          </w-btn>
        </template>
      </w-input>
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

import IconPickerDialog from '@/components/IconPickerDialog.vue'

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

/** Whether this field's choices are `{ label, value }` objects rather than plain strings. */
function hasValueOptions(field) {
  return (field.options ?? []).some((option) => option !== null && typeof option === 'object')
}
</script>
