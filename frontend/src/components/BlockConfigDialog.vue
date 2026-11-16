<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 600px; max-width: 100%">
      <w-card-section class="card-header">
        <w-icon
          :name="`img:/_assets/icons/ultraviolet-${block.isCustom ? 'plugin' : block.icon}.svg`"
          size="sm"
          class="mr-2" />
        <span>{{ t('admin.blocks.configTitle', { name: block.name }) }}</span>
      </w-card-section>
      <w-card-section class="text-caption pb-0 text-black/70 dark:text-white/70">
        {{ t('admin.blocks.configHint') }}
      </w-card-section>
      <w-card-section>
        <block-props-form :fields="block.props" :values="state.values" :locks="state.locks" />
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-btn
          v-if="block.props.length > 0"
          class="acrylic-btn"
          flat
          icon="la:undo-alt"
          :label="t(`admin.blocks.configReset`)"
          color="cancel"
          padding="xs md"
          @click="reset" />
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
          :label="t(`common.actions.ok`)"
          color="primary"
          padding="xs md"
          @click="done" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { initialValues } from '@/helpers/blocks'

import BlockPropsForm from '@/components/BlockPropsForm.vue'

/**
 * What a site's block starts on when an author inserts it, and which of its props they may not
 * change -- the block's `config` (`BlockConfig` in `backend/models/blocks.ts`).
 *
 * The same form an author fills in (`BlockPropsForm`), with a lock beside every field. It opens on
 * what the site has now: the administrator's value where one is set, the block's own default where
 * not. What comes back is the config to stage on the row, which the page's Apply sends with the
 * enabled switches -- one save for the whole screen, as before.
 *
 * Only what says something goes back: a prop left unlocked on the block's own default has no entry,
 * so a block nobody configured stays `{}`. The server drops such an entry too; leaving it out here is
 * what keeps the row's "configured" mark honest before Apply.
 */

// PROPS

const props = defineProps({
  /** The block as the API describes it: its props, and the config it has now. */
  block: {
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
  values: initialValues(props.block),
  locks: Object.fromEntries(
    props.block.props.map((prop) => [prop.name, Boolean(props.block.config[prop.name]?.locked)])
  )
})

// METHODS

/** What a prop's field holds, as the type the API expects for it. */
function typedValue(prop, value) {
  if (prop.type === 'boolean') {
    return Boolean(value)
  }
  if (value === '' || value === null || value === undefined) {
    return ''
  }
  if (prop.type === 'number') {
    const number = Number(value)
    return Number.isFinite(number) ? number : ''
  }
  return String(value)
}

/** Back to the block as its component declares it: every default, nothing locked. */
function reset() {
  state.values = initialValues({ ...props.block, config: {} })
  state.locks = Object.fromEntries(props.block.props.map((prop) => [prop.name, false]))
}

function done() {
  const config = {}
  for (const prop of props.block.props) {
    const value = typedValue(prop, state.values[prop.name])
    const locked = Boolean(state.locks[prop.name])
    const blockDefault = prop.default ?? (prop.type === 'boolean' ? false : '')
    if (locked || (value !== '' && String(value) !== String(blockDefault))) {
      config[prop.name] = { value, locked }
    }
  }
  onDialogOK(config)
}
</script>
