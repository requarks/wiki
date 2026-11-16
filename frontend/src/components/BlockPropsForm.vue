<template>
  <div v-if="fields.length < 1" class="text-caption text-black/60 dark:text-white/70">
    {{ t('editor.blockPicker.noProps') }}
  </div>
  <w-form v-else class="gap-4">
    <div v-for="field of fields" :key="field.name" class="flex flex-nowrap items-start gap-2">
      <div class="min-w-0 flex-1">
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
          :disable="isLocked(field)"
          :label="field.label ?? field.name"
          :aria-label="field.label ?? field.name"
          :required="field.required"
          :hint="field.hint" />
        <w-toggle
          v-else-if="field.type === `boolean`"
          v-model="values[field.name]"
          dense
          :disable="isLocked(field)"
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
          :disable="isLocked(field)"
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
          <template v-if="!isLocked(field)" #append>
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
          :disable="isLocked(field)"
          :type="field.type === `number` ? `number` : `text`"
          :label="field.label ?? field.name"
          :aria-label="field.label ?? field.name"
          :required="field.required"
          :hint="field.hint" />
      </div>
      <!--
        -> Centred on the field's box rather than on the row, which also holds the hint under it. An
           outlined field's box is 36px tall (`dense`) and 8px down, its top margin making room for the
           floated label, so this takes the same 8px and 36px. A toggle has neither margin nor hint,
           so beside one it is centred on the row.
      -->
      <div
        v-if="locks || isLocked(field)"
        class="flex shrink-0 items-center"
        :class="field.type === `boolean` ? `self-center` : `mt-2 h-9`">
        <!-- -> The administrator's switch, beside the value it fixes -->
        <w-btn
          v-if="locks"
          flat
          dense
          round
          :icon="locks[field.name] ? `la:lock` : `la:lock-open`"
          :color="locks[field.name] ? `negative` : `grey`"
          :aria-label="t('admin.blocks.lockProp', { name: field.label ?? field.name })"
          :aria-pressed="Boolean(locks[field.name])"
          @click="locks[field.name] = !locks[field.name]">
          <w-tooltip>{{
            t(locks[field.name] ? 'admin.blocks.propLocked' : 'admin.blocks.propUnlocked')
          }}</w-tooltip>
        </w-btn>
        <!--
          -> And what an author sees of it: the field is greyed out, and this says why. A span around
             the icon carries the tooltip, since a bundled icon renders no slot to put one in.
        -->
        <span
          v-else
          class="inline-flex"
          role="img"
          :aria-label="t('editor.blockPicker.propLocked')">
          <w-icon name="la:lock" size="20px" color="grey" />
          <w-tooltip>{{ t('editor.blockPicker.propLocked') }}</w-tooltip>
        </span>
      </div>
    </div>
  </w-form>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import IconPickerDialog from '@/components/IconPickerDialog.vue'

/**
 * The form a block's props make: one field per prop, in the order the block declares them.
 *
 * Shared by the block picker, which fills it in for a block about to be inserted, the parameters
 * dialog the editor's lens opens over one already in the page, and the administrator's block
 * settings. All three ask about the same props and must offer the same controls, so the fields are
 * described once here.
 *
 * A block with nothing to fill in is not a broken form: it is inserted, or left, as it stands. A
 * custom block reports no props at all, since only the compiled manifest carries them.
 *
 * It writes into the `values` object it is given rather than emitting: what a caller wants back is
 * "what is in the form now", and both of them already keep that object as their own state — a
 * `v-model` per field would be the same object, one indirection further away. `locks` is written into
 * the same way.
 *
 * Padding is the caller's: this sits in a panel in one and a card in the other.
 */

// PROPS

const props = defineProps({
  /** The props the block declares, as the API describes them. */
  fields: {
    type: Array,
    required: true
  },
  /** Values by prop name, written into as the author types. */
  values: {
    type: Object,
    required: true
  },
  /**
   * The props the site's administrator locked, by name -- shown greyed out, since whatever is put in
   * them is replaced by the locked value anyway. The caller puts that value into `values`.
   */
  locked: {
    type: Array,
    default: () => []
  },
  /**
   * The administrator's form instead: a lock switch beside every field, flipped in this object by
   * prop name, and no field ever disabled -- the value of a locked prop is exactly what is being set.
   */
  locks: {
    type: Object,
    default: null
  }
})

// I18N

const { t } = useI18n()

/** Whether this field's choices are `{ label, value }` objects rather than plain strings. */
function hasValueOptions(field) {
  return (field.options ?? []).some((option) => option !== null && typeof option === 'object')
}

/** Whether an author may not change this field, which is never the case in the administrator's form. */
function isLocked(field) {
  return !props.locks && props.locked.includes(field.name)
}
</script>
