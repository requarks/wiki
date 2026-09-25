<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="relative" style="min-width: 600px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/ultraviolet-full-image.svg" size="sm" class="mr-2" />
        <span>{{ t(`fileman.resizeImage`) }}</span>
      </w-card-section>
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
                :model-value="state.width"
                type="number"
                outlined
                dense
                suffix="px"
                :label="t(`fileman.resizeImageWidth`)"
                :rules="widthValidation"
                hide-bottom-space
                lazy-rules="ondemand"
                :disable="!isMeasured"
                @update:model-value="setWidth"
                @keyup:enter="resize" />
              <w-btn
                class="mt-1"
                flat
                round
                dense
                :icon="state.isRatioLocked ? `la:lock` : `la:lock-open`"
                :color="state.isRatioLocked ? `primary` : `grey`"
                :aria-pressed="String(state.isRatioLocked)"
                :aria-label="t(`fileman.resizeImageLockRatio`)"
                :disable="!isMeasured"
                @click="toggleRatioLock">
                <w-tooltip>{{
                  state.isRatioLocked
                    ? t(`fileman.resizeImageUnlockRatio`)
                    : t(`fileman.resizeImageLockRatio`)
                }}</w-tooltip>
              </w-btn>
              <w-input
                class="flex-1"
                :model-value="state.height"
                type="number"
                outlined
                dense
                suffix="px"
                :label="t(`fileman.resizeImageHeight`)"
                :rules="heightValidation"
                hide-bottom-space
                lazy-rules="ondemand"
                :disable="!isMeasured"
                @update:model-value="setHeight"
                @keyup:enter="resize" />
              <w-input
                class="w-28 shrink-0"
                :model-value="state.percent"
                type="number"
                outlined
                dense
                suffix="%"
                :label="t(`fileman.resizeImagePercent`)"
                :rules="percentValidation"
                hide-bottom-space
                lazy-rules="ondemand"
                :disable="!isMeasured"
                @update:model-value="setPercent"
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
              v-model="state.fileName"
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
          color="grey"
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

/**
 * What a resized image can be saved as, by extension. The same list the server holds, since the
 * extension of the name it is stored under is what decides the format.
 */
const RESIZABLE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif']

/** PNG and GIF are lossless: the server ignores a quality for them, so the slider says so. */
const LOSSY_EXTS = new Set(['jpg', 'jpeg', 'webp'])

const extIndex = props.fileName.lastIndexOf('.')
const sourceStem = extIndex > 0 ? props.fileName.slice(0, extIndex) : props.fileName
const sourceExt = extIndex > 0 ? props.fileName.slice(extIndex + 1).toLowerCase() : ''

const state = reactive({
  isMeasuring: false,
  isSubmitting: false,
  originalWidth: 0,
  originalHeight: 0,
  // -> Strings, as the inputs hand them back: a field being typed into is not always a number yet
  width: '',
  height: '',
  percent: '100',
  isRatioLocked: true,
  quality: 80,
  mode: 'replace',
  fileName: `${sourceStem}-resized.${sourceExt}`
})

// REFS

const resizeForm = ref(null)
const iptWidth = ref(null)
const iptFileName = ref(null)

// COMPUTED

const isMeasured = computed(() => state.originalWidth > 0 && state.originalHeight > 0)

/** The extension the result is written under, which is what decides its format. */
const targetExt = computed(() => {
  if (state.mode !== 'saveAs') {
    return sourceExt
  }
  const idx = state.fileName.lastIndexOf('.')
  return idx > 0 ? state.fileName.slice(idx + 1).toLowerCase() : ''
})

// -> A name that is not one of the formats yet has no say: the field's own rule complains about it
const isLossy = computed(
  () => !RESIZABLE_EXTS.includes(targetExt.value) || LOSSY_EXTS.has(targetExt.value)
)

// VALIDATION RULES

/** A whole number of pixels, at least one and no more than the original: this only makes smaller. */
function dimensionRule(max) {
  return (val) => {
    const n = Number(val)
    return (
      (Number.isInteger(n) && n >= 1 && n <= max) ||
      t('fileman.resizeImageDimensionInvalid', { max })
    )
  }
}

const widthValidation = computed(() => [dimensionRule(state.originalWidth)])
const heightValidation = computed(() => [dimensionRule(state.originalHeight)])

// -> Empty is allowed: an unlocked pair that is not the same scale both ways has no one percentage
const percentValidation = [
  (val) => {
    if (val === '') {
      return true
    }
    const n = Number(val)
    return (n > 0 && n <= 100) || t('fileman.resizeImagePercentInvalid')
  }
]

const fileNameValidation = [
  (val) =>
    state.mode !== 'saveAs' || val.trim().length > 0 || t('fileman.resizeImageFileNameMissing'),
  (val) =>
    state.mode !== 'saveAs' ||
    RESIZABLE_EXTS.some((ext) => val.trim().toLowerCase().endsWith(`.${ext}`)) ||
    t('fileman.resizeImageFileNameInvalid')
]

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

/** A scale as the percent field shows it: at most one decimal, and no trailing `.0`. */
function formatPercent(ratio) {
  return String(Math.round(ratio * 1000) / 10)
}

/**
 * Bring the percent field in line with the two dimensions.
 *
 * Locked, it is simply the width's scale. Unlocked, it is only shown when both sides are at the same
 * scale -- to the same tenth of a percent, which is as fine as the field is drawn -- since a stretched
 * pair has no single number that describes it.
 */
function syncPercent() {
  const w = Number(state.width)
  const h = Number(state.height)
  if (!(w > 0) || !(h > 0)) {
    return
  }
  const scaleW = formatPercent(w / state.originalWidth)
  state.percent =
    state.isRatioLocked || scaleW === formatPercent(h / state.originalHeight) ? scaleW : ''
}

function setWidth(val) {
  state.width = val
  const w = Number(val)
  if (state.isRatioLocked && w > 0) {
    state.height = String(Math.max(1, Math.round((w * state.originalHeight) / state.originalWidth)))
  }
  syncPercent()
}

function setHeight(val) {
  state.height = val
  const h = Number(val)
  if (state.isRatioLocked && h > 0) {
    state.width = String(Math.max(1, Math.round((h * state.originalWidth) / state.originalHeight)))
  }
  syncPercent()
}

/** A percentage scales both sides alike, whether or not the ratio is locked: that is what it means. */
function setPercent(val) {
  state.percent = val
  const p = Number(val)
  if (val === '' || !(p > 0)) {
    return
  }
  state.width = String(Math.max(1, Math.round((state.originalWidth * p) / 100)))
  state.height = String(Math.max(1, Math.round((state.originalHeight * p) / 100)))
}

/** Locking again puts the height back in proportion to the width, which is the side typed first. */
function toggleRatioLock() {
  state.isRatioLocked = !state.isRatioLocked
  if (state.isRatioLocked) {
    setWidth(state.width)
  }
}

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
        width: Number(state.width),
        height: Number(state.height),
        quality: state.quality,
        mode: state.mode,
        ...(state.mode === 'saveAs' ? { fileName: state.fileName.trim() } : {})
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

// MOUNTED

onMounted(async () => {
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
  state.width = String(dimensions.width)
  state.height = String(dimensions.height)
  state.percent = '100'
})
</script>
