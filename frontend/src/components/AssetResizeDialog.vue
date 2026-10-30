<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="relative" style="min-width: 600px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/ultraviolet-full-image.svg" size="sm" class="mr-2" />
        <span>{{ t(`fileman.resizeImage`) }}</span>
      </w-card-section>
      <!-- -> As in the image editor: only the first frame of an animation is ever read -->
      <div v-if="state.frames > 1" class="card-notice flex items-center gap-3">
        <w-icon name="la:exclamation-triangle" color="warning" size="xs" class="shrink-0" />
        <span>{{ t('fileman.imageEditorAnimated') }}</span>
      </div>
      <w-form ref="resizeForm" class="py-2" @submit="resize">
        <!-- SIZE -->
        <w-item>
          <!-- -> Top-aligned, since the caption below would pull a centred icon off the fields, and
                then lowered to centre on them: an outlined field starts below its row's top, the
                space above it held for the floating label. As in LocaleAliasesDialog. -->
          <blueprint-icon icon="width" class="self-start mt-1.5" />
          <w-item-section>
            <div class="flex flex-nowrap items-start gap-2">
              <w-input
                ref="iptWidth"
                class="flex-1"
                :model-value="size.fields.width"
                type="number"
                outlined
                dense
                suffix="px"
                :label="t(`fileman.resizeImageWidth`)"
                :rules="size.widthValidation.value"
                hide-bottom-space
                lazy-rules="ondemand"
                :disable="!isMeasured"
                @update:model-value="size.setWidth"
                @keyup:enter="resize" />
              <w-btn
                class="mt-1"
                flat
                round
                dense
                :icon="size.fields.isRatioLocked ? `la:lock` : `la:lock-open`"
                :color="size.fields.isRatioLocked ? `primary` : `grey`"
                :aria-pressed="String(size.fields.isRatioLocked)"
                :aria-label="t(`fileman.resizeImageLockRatio`)"
                :disable="!isMeasured"
                @click="size.toggleRatioLock">
                <w-tooltip>{{
                  size.fields.isRatioLocked
                    ? t(`fileman.resizeImageUnlockRatio`)
                    : t(`fileman.resizeImageLockRatio`)
                }}</w-tooltip>
              </w-btn>
              <w-input
                class="flex-1"
                :model-value="size.fields.height"
                type="number"
                outlined
                dense
                suffix="px"
                :label="t(`fileman.resizeImageHeight`)"
                :rules="size.heightValidation.value"
                hide-bottom-space
                lazy-rules="ondemand"
                :disable="!isMeasured"
                @update:model-value="size.setHeight"
                @keyup:enter="resize" />
              <w-input
                class="w-28 shrink-0"
                :model-value="size.fields.percent"
                type="number"
                outlined
                dense
                suffix="%"
                :label="t(`fileman.resizeImagePercent`)"
                :rules="size.percentValidation"
                hide-bottom-space
                lazy-rules="ondemand"
                :disable="!isMeasured"
                @update:model-value="size.setPercent"
                @keyup:enter="resize" />
            </div>
            <div class="text-caption text-grey mt-1" v-if="isMeasured">
              {{
                t('fileman.resizeImageOriginal', {
                  width: state.originalWidth,
                  height: state.originalHeight
                })
              }}
            </div>
          </w-item-section>
        </w-item>
        <!-- QUALITY -->
        <w-item>
          <blueprint-icon icon="tune" top />
          <w-item-section>
            <div class="text-caption text-black/60 dark:text-white/70 mb-1">
              {{ t('fileman.resizeImageQuality') }}
            </div>
            <div class="px-2">
              <w-slider
                v-model="state.quality"
                :min="1"
                :max="100"
                :step="10"
                label
                markers
                :disable="!isLossy"
                :aria-label="t(`fileman.resizeImageQuality`)" />
            </div>
            <div class="text-caption text-grey" v-if="!isLossy">
              {{ t('fileman.resizeImageQualityLossless', { format: targetExt.toUpperCase() }) }}
            </div>
          </w-item-section>
        </w-item>
        <!-- OUTPUT -->
        <w-item>
          <blueprint-icon icon="file-submodule" top />
          <w-item-section>
            <div role="radiogroup" class="flex flex-col gap-2">
              <w-radio
                v-model="state.mode"
                val="replace"
                :label="t(`fileman.resizeImageReplace`)" />
              <w-radio v-model="state.mode" val="saveAs" :label="t(`fileman.resizeImageSaveAs`)" />
            </div>
            <w-input
              ref="iptFileName"
              class="mt-3"
              v-model="fileName"
              outlined
              dense
              :label="t(`fileman.resizeImageFileName`)"
              :hint="t(`fileman.resizeImageFileNameHint`)"
              :rules="fileNameValidation"
              lazy-rules="ondemand"
              :disable="state.mode !== `saveAs`"
              @keyup:enter="resize" />
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
          :label="t(`fileman.resizeImageAction`)"
          color="primary"
          padding="xs md"
          :loading="state.isSubmitting"
          :disable="!isMeasured"
          @click="resize" />
      </w-card-actions>
      <w-inner-loading :showing="state.isMeasuring" size="38px" spinner-class="text-accent" />
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { computed, onMounted, reactive, ref, watch } from 'vue'

import { useImageSaveFields } from '@/composables/imageSaveFields'
import { useImageSizeFields } from '@/composables/imageSizeFields'
import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  assetId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  /** The size recorded when the file arrived. Absent when it could not be read then. */
  width: {
    type: Number,
    default: null
  },
  height: {
    type: Number,
    default: null
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptWidth.value
})

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isMeasuring: false,
  isSubmitting: false,
  originalWidth: 0,
  originalHeight: 0,
  quality: 80,
  mode: 'replace',
  /** Known only for a GIF or WebP, the two formats that can be animated. */
  frames: 1
})

const size = useImageSizeFields(() => ({
  width: state.originalWidth,
  height: state.originalHeight
}))

const { fileName, sourceExt, targetExt, isLossy, fileNameValidation } = useImageSaveFields({
  sourceFileName: props.fileName,
  suffix: '-resized',
  isSaveAs: () => state.mode === 'saveAs'
})

// REFS

const resizeForm = ref(null)
const iptWidth = ref(null)
const iptFileName = ref(null)

// COMPUTED

const isMeasured = computed(() => state.originalWidth > 0 && state.originalHeight > 0)

// WATCHERS

/*
  The name field comes alive with the mode, so the caret goes there. Going back to Replace revalidates
  it instead, which with that mode is a pass: a complaint left on a field nobody can type into would
  be one there is no way to answer.
*/
watch(
  () => state.mode,
  (mode) => {
    if (mode === 'saveAs') {
      setTimeout(() => iptFileName.value?.focus())
    } else {
      iptFileName.value?.validate()
    }
  }
)

// METHODS

/**
 * Read the image's size in the browser, for a file whose size was not recorded when it arrived --
 * which is anything uploaded while the Sharp extension was missing.
 *
 * Fetched through the API rather than from `/_files/`, which resolves a path in the site's primary
 * locale and could hand back a different file of the same name. The browser applies EXIF orientation
 * when it decodes, so this is the size as displayed, which is what the server measures against.
 */
async function measureInBrowser() {
  const blob = await API_CLIENT.get(`sites/${siteStore.id}/assets/${props.assetId}/content`).blob()
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function resize() {
  if (state.isSubmitting || !isMeasured.value) {
    return
  }
  state.isSubmitting = true
  try {
    const isFormValid = await resizeForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('fileman.resizeImageInvalidData'))
    }
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/assets/${props.assetId}/resize`, {
      json: {
        width: Number(size.fields.width),
        height: Number(size.fields.height),
        quality: state.quality,
        mode: state.mode,
        ...(state.mode === 'saveAs' ? { fileName: fileName.value.trim() } : {})
      }
    }).json()
    // -> The API client does not throw on 400, so a refused resize comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('fileman.resizeImageSuccess')
    })
    onDialogOK(resp.asset)
  } catch (err) {
    // -> Sharp missing on the server is the likeliest failure, and answers 503 saying so
    notify({
      type: 'negative',
      message: t('fileman.resizeImageFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  state.isSubmitting = false
}

/**
 * How many frames the image has, so that an animation can be warned about. A failure only costs the
 * warning: the resize itself does not depend on it.
 */
async function countFrames() {
  if (!['gif', 'webp'].includes(sourceExt)) {
    return
  }
  try {
    const info = await API_CLIENT.get(
      `sites/${siteStore.id}/assets/${props.assetId}/editing`
    ).json()
    state.frames = info.frames ?? 1
  } catch {
    // -> No warning, rather than no resize
  }
}

// MOUNTED

onMounted(async () => {
  countFrames()
  let dimensions = props.width && props.height ? { width: props.width, height: props.height } : null
  if (!dimensions) {
    state.isMeasuring = true
    try {
      dimensions = await measureInBrowser()
    } catch (err) {
      notify({
        type: 'negative',
        message: t('fileman.resizeImageMeasureFailed'),
        caption: apiErrorMessage(err, 'An unexpected error occured.')
      })
      onDialogCancel()
      return
    } finally {
      state.isMeasuring = false
    }
  }
  state.originalWidth = dimensions.width
  state.originalHeight = dimensions.height
  size.reset()
})
</script>
