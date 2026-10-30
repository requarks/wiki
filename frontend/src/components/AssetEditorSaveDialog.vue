<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="relative" style="width: 520px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon :name="isSaveAs ? `la:copy` : `la:exclamation-triangle`" size="sm" class="mr-2" />
        <span>{{
          isSaveAs ? t(`fileman.imageEditorSaveAsTitle`) : t(`fileman.imageEditorReplaceTitle`)
        }}</span>
      </w-card-section>
      <!-- -> Whatever the format: only the first frame of an animation is ever edited. As in the
              Resize Image dialog -->
      <div v-if="frames > 1" class="card-notice flex items-center gap-3">
        <w-icon name="la:exclamation-triangle" color="warning" size="xs" class="shrink-0" />
        <span>{{ t('fileman.imageEditorAnimated') }}</span>
      </div>
      <w-form ref="saveForm" class="py-2" @submit="save">
        <!-- REPLACE: the warning is the dialog -->
        <w-item v-if="!isSaveAs">
          <w-item-section>
            <p>{{ t('fileman.imageEditorReplaceWarning') }}</p>
            <p class="mt-2 text-negative">{{ t('fileman.imageEditorReplaceIrreversible') }}</p>
          </w-item-section>
        </w-item>
        <!-- FILE NAME + FORMAT -->
        <w-item v-if="isSaveAs">
          <blueprint-icon icon="file-submodule" top />
          <w-item-section>
            <div class="flex flex-nowrap items-start gap-2">
              <w-input
                ref="iptFileName"
                class="flex-1"
                v-model="fileName"
                outlined
                dense
                :label="t(`fileman.resizeImageFileName`)"
                :hint="t(`fileman.resizeImageFileNameHint`)"
                :rules="fileNameValidation"
                lazy-rules="ondemand"
                @keyup:enter="save" />
              <w-select
                class="w-28 shrink-0"
                :model-value="formatValue"
                :options="FORMAT_OPTIONS"
                emit-value
                map-options
                outlined
                dense
                :label="t(`fileman.imageEditorFormat`)"
                @update:model-value="setFormat" />
            </div>
          </w-item-section>
        </w-item>
        <!-- QUALITY -->
        <w-item v-if="isSaveAs || isLossy">
          <blueprint-icon icon="tune" top />
          <w-item-section>
            <div class="text-caption text-black/60 dark:text-white/70 mb-1">
              {{ t('fileman.resizeImageQuality') }}
            </div>
            <div class="px-2">
              <w-slider
                v-model="state.quality"
                :min="5"
                :max="100"
                :step="5"
                label
                :disable="!isLossy"
                :aria-label="t(`fileman.resizeImageQuality`)" />
            </div>
            <div class="text-caption text-grey" v-if="!isLossy">
              {{ t('fileman.resizeImageQualityLossless', { format: targetExt.toUpperCase() }) }}
            </div>
          </w-item-section>
        </w-item>
      </w-form>
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
          :label="isSaveAs ? t(`common.actions.save`) : t(`fileman.imageEditorReplaceAction`)"
          :color="isSaveAs ? `primary` : `negative`"
          padding="xs md"
          @click="save" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { useImageSaveFields } from '@/composables/imageSaveFields'
import { EDITABLE_EXTS } from '@/helpers/imageEdit'

/**
 * How an edited image is saved: as a new file, with its name, format and quality, or over the
 * original, which is a confirmation with a quality slider for a lossy format.
 *
 * Says OK with `{ fileName, quality }` -- `fileName` only for a new file. The image editor does the
 * saving, so that it stays open with its edits if the server refuses.
 */

// PROPS

const props = defineProps({
  /** `saveAs` or `replace`. */
  mode: {
    type: String,
    required: true
  },
  /** The original's name, which a new file's is offered from. */
  fileName: {
    type: String,
    required: true
  },
  /** How many frames the original has: more than one for an animation. */
  frames: {
    type: Number,
    default: 1
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptFileName.value
})

// I18N

const { t } = useI18n()

// DATA

const FORMAT_OPTIONS = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpg' },
  { label: 'WebP', value: 'webp' },
  { label: 'GIF', value: 'gif' }
]

const isSaveAs = props.mode === 'saveAs'

const state = reactive({
  quality: 85
})

const { fileName, targetExt, isLossy, fileNameValidation, setFormat } = useImageSaveFields({
  sourceFileName: props.fileName,
  suffix: '-edited',
  isSaveAs: () => isSaveAs
})

// REFS

const saveForm = ref(null)
const iptFileName = ref(null)

// COMPUTED

/** The select's value, from the name: `.jpeg` is JPEG too, and a name with no format shows none. */
const formatValue = computed(() =>
  targetExt.value === 'jpeg'
    ? 'jpg'
    : EDITABLE_EXTS.includes(targetExt.value)
      ? targetExt.value
      : null
)

// METHODS

async function save() {
  if (isSaveAs && !(await saveForm.value.validate(true))) {
    return
  }
  onDialogOK({
    ...(isSaveAs ? { fileName: fileName.value.trim() } : {}),
    quality: state.quality
  })
}
</script>
