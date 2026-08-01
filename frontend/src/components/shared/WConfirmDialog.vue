<template>
  <w-dialog v-model="dialogVisible" :persistent="persistent" @hide="onDialogHide">
    <w-card style="min-width: 380px; max-width: 480px">
      <w-card-section class="card-header">
        <span>{{ title }}</span>
      </w-card-section>
      <w-card-section>
        <div
          v-for="(paragraph, pIdx) of paragraphs"
          :key="pIdx"
          class="text-body2"
          :class="pIdx > 0 ? 'mt-3' : ''">
          <template v-for="(run, rIdx) of runs(paragraph)" :key="rIdx">
            <strong v-if="run.strong">{{ run.text }}</strong>
            <template v-else>{{ run.text }}</template>
          </template>
        </div>

        <!-- An identifier, a path, a count: the quiet detail under the question, as the page
             deletion dialog shows the page's ID. -->
        <div v-if="caption" class="text-caption text-grey mt-2">{{ caption }}</div>

        <!--
          The one prompting variant in the codebase: pick one of a few named choices. `onOk`
          receives the chosen value rather than `true`, which is what the import-mode prompt reads.
        -->
        <div v-if="options" class="mt-3 flex flex-col gap-1" role="radiogroup" :aria-label="title">
          <label
            v-for="item of options.items"
            :key="item.value"
            class="flex cursor-pointer items-center gap-2">
            <input v-model="choice" type="radio" :value="item.value" :name="groupName" />
            <span class="text-body2">{{ item.label }}</span>
          </label>
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          v-if="cancel"
          class="acrylic-btn"
          flat
          :label="cancelLabel ?? t('common.actions.cancel')"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="okLabel ?? t('common.actions.ok')"
          :color="color"
          padding="xs md"
          @click="onDialogOK(options ? choice : true)" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

/**
 * Confirm / prompt dialog.
 *
 * Opened through `confirm()` in `composables/dialog` rather than directly. It exists because the
 * library this replaces had built-in title/message dialogs, and while nearly every call site in the
 * app passes its own component, four do not -- three plain confirmations and one radio prompt.
 * Reimplementing those as four bespoke components would be worse than one shared one.
 */
const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  /**
   * What is being confirmed. An array is rendered as one paragraph per entry, and `**like this**`
   * marks a run as bold — the one bit of emphasis these dialogs have ever needed, and cheaper than
   * a bespoke component per message.
   */
  message: {
    type: [String, Array],
    default: ''
  },
  /** A supporting detail, set smaller and greyer under the message. */
  caption: {
    type: String,
    default: ''
  },
  /** Show a cancel button. Without it the dialog is an acknowledgement, not a choice. */
  cancel: {
    type: Boolean,
    default: false
  },
  okLabel: {
    type: String,
    default: null
  },
  cancelLabel: {
    type: String,
    default: null
  },
  /** Theme colour for the confirming button -- `negative` for a destructive action. */
  color: {
    type: String,
    default: 'primary'
  },
  /** Do not close on a backdrop click or Escape. */
  persistent: {
    type: Boolean,
    default: false
  },
  /** `{ model, items: [{ label, value }] }` to prompt for one of several choices. */
  options: {
    type: Object,
    default: null
  }
})

defineEmits(dialogComponentEmits)

// I18N

const { t } = useI18n()

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

const paragraphs = computed(() => (Array.isArray(props.message) ? props.message : [props.message]))

/**
 * A paragraph split into plain and bold runs.
 *
 * Split on `**`, so every odd piece is what sat between a pair. Returned as data for the template to
 * render as real elements rather than as markup handed to `v-html`: a confirmation message is often
 * built from a page title or a file name, and none of those can become HTML this way.
 */
function runs(paragraph) {
  return String(paragraph)
    .split('**')
    .map((text, idx) => ({ text, strong: idx % 2 === 1 }))
}

/** Radios need a name unique to this instance, or two open dialogs would share a group. */
const groupName = useId()
const choice = ref(props.options?.model ?? null)
</script>
