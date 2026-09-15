<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 420px; max-width: 90vw">
      <w-card-header>{{ t('editor.visual.image.title') }}</w-card-header>
      <w-card-section class="flex flex-col gap-4">
        <!--
          First, because it is the half of this dialog that is about what the picture MEANS -- and the
          half an author is most likely to have come here without knowing they needed.
        -->
        <w-input
          v-model="state.alt"
          :label="t('editor.visual.image.alt')"
          :hint="t('editor.visual.image.altHint')"
          autofocus />

        <div class="flex items-start gap-3">
          <w-input
            class="flex-1"
            v-model="state.width"
            :label="t('editor.visual.image.width')"
            :rules="[sizeRule]"
            spellcheck="false" />
          <w-input
            class="flex-1"
            v-model="state.height"
            :label="t('editor.visual.image.height')"
            :rules="[sizeRule]"
            spellcheck="false" />
        </div>

        <!--
          Both empty is what an image with no size suffix at all is, so it is offered as a value and
          not as a thing to be cleared field by field.
        -->
        <div class="text-caption text-black/60 dark:text-white/70">
          {{ t('editor.visual.image.sizeHint') }}
          <template v-if="naturalWidth > 0">
            <br />
            {{ t('editor.visual.image.natural', { width: naturalWidth, height: naturalHeight }) }}
          </template>
        </div>
      </w-card-section>
      <w-card-actions align="right">
        <w-btn flat :label="t('common.actions.cancel')" @click="onDialogCancel" />
        <w-btn
          unelevated
          color="primary"
          :label="t('common.actions.apply')"
          :disabled="!isValid"
          @click="submit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

/**
 * What an image is, besides the file it points at: the words that stand in for it, and how big it is
 * drawn.
 *
 * The alt text is what a reader who cannot see the picture is given, and what stands in its place
 * when it fails to load — so it belongs to the page rather than to the file, which is why it is
 * edited here and not left to whatever the file manager called it. Empty is a real answer: a picture
 * that carries no meaning of its own is better skipped by a screen reader than described.
 *
 * Both dimensions are text and not numbers, because `markdown-it-imsize` takes a percentage as
 * readily as a pixel count — `=50%x` is a legitimate half-width image — and a number field would
 * refuse to hold one. Either may be left empty: with only a width, the browser keeps the picture's
 * own proportions, which is what an author resizing a photograph almost always means.
 */

// PROPS

const props = defineProps({
  /** What stands in for the picture. Empty where it is decoration and says nothing. */
  alt: {
    type: String,
    default: ''
  },
  /** The width as the page holds it — a pixel count or a percentage, both as written. */
  width: {
    type: String,
    default: ''
  },
  /** The height, likewise. */
  height: {
    type: String,
    default: ''
  },
  /** The picture's own size, from the element that is drawing it. Zero when it has not loaded. */
  naturalWidth: {
    type: Number,
    default: 0
  },
  naturalHeight: {
    type: Number,
    default: 0
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
  alt: props.alt,
  width: props.width,
  height: props.height
})

// COMPUTED

/*
  Exactly what `markdown-it-imsize` parses: digits, optionally followed by a percent sign. Anything
  else is not rejected by the plugin so much as ignored by it — it stops reading at the first
  character it does not know and the whole suffix stops being a size — so a value it cannot read would
  silently do nothing at all.
*/
const SIZE = /^\d+%?$/

const isValid = computed(() => sizeRule(state.width) === true && sizeRule(state.height) === true)

// METHODS

function sizeRule(value) {
  const text = String(value ?? '').trim()
  return text === '' || SIZE.test(text) ? true : t('editor.visual.image.sizeInvalid')
}

function submit() {
  onDialogOK({
    // -> Not trimmed away to nothing by accident: a lone space is emptiness, and emptiness is a value
    alt: state.alt.trim(),
    width: state.width.trim(),
    height: state.height.trim()
  })
}
</script>
