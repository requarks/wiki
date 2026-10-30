<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- -> `dark-2`: two steps lighter than the image editor's sidebar, which this sits on -->
    <w-btn-toggle
      :model-value="choice"
      push
      no-caps
      color="dark-2"
      toggle-color="primary"
      :aria-label="label"
      :options="options"
      @update:model-value="choose" />
    <!-- -> The swatch opens the picker, and is only there once a colour of one's own is chosen -->
    <w-btn
      v-if="choice === `custom`"
      class="image-fill-swatch"
      unelevated
      dense
      :style="{ backgroundColor: modelValue }"
      :aria-label="t(`fileman.imageEditorFillPick`)">
      <w-tooltip>{{ t('fileman.imageEditorFillPick') }}</w-tooltip>
      <!-- -> Dark, since every picker this opens from sits on the image editor's dark sidebar -->
      <w-menu dark>
        <w-color-picker :model-value="modelValue" @update:model-value="pick" />
      </w-menu>
    </w-btn>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, ref } from 'vue'

import { TRANSPARENT } from '@/helpers/imageEdit'

/**
 * What the image editor fills with -- the corners a rotation exposes, a border, a redaction: none,
 * white, black, or a colour picked.
 *
 * The value is the colour the server is sent: `#rrggbb`, or `#00000000` for transparent.
 */

// PROPS

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  /** Off where there is nothing for a transparent fill to show, as for a redaction. */
  allowTransparent: {
    type: Boolean,
    default: true
  },
  label: {
    type: String,
    required: true
  }
})

// EMITS

const emit = defineEmits(['update:modelValue'])

// I18N

const { t } = useI18n()

// DATA

const PRESETS = { transparent: TRANSPARENT, white: '#ffffff', black: '#000000' }

/** The last colour of one's own, so that going to white and back does not lose it. */
const custom = ref(Object.values(PRESETS).includes(props.modelValue) ? '#ff0000' : props.modelValue)

// COMPUTED

const choice = computed(
  () => Object.keys(PRESETS).find((key) => PRESETS[key] === props.modelValue) ?? 'custom'
)

const options = computed(() => [
  ...(props.allowTransparent
    ? [{ label: t('fileman.imageEditorFillTransparent'), value: 'transparent' }]
    : []),
  { label: t('fileman.imageEditorFillWhite'), value: 'white' },
  { label: t('fileman.imageEditorFillBlack'), value: 'black' },
  { label: t('fileman.imageEditorFillCustom'), value: 'custom' }
])

// METHODS

function choose(value) {
  emit('update:modelValue', value === 'custom' ? custom.value : PRESETS[value])
}

function pick(value) {
  custom.value = value
  emit('update:modelValue', value)
}
</script>

<style scoped lang="scss">
.image-fill-swatch {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(128, 128, 128, 0.5);
}
</style>
