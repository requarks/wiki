<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 400px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="la:crop" size="sm" class="mr-2" />
        <span>{{ t('profile.avatarCropTitle') }}</span>
      </w-card-section>
      <w-card-section>
        <!--
          -> The stage is square and sized by the card, not by a fixed pixel figure, so it fits a
             phone as well. Everything about the crop is kept in units of the circle's diameter and
             only turned into pixels here, which is what lets the stage be any size at all.
          -> `touch-action: none` hands every touch to the pointer handlers below: without it the
             browser takes a one-finger drag as a scroll and a two-finger one as a page zoom.
        -->
        <div
          ref="stageEl"
          class="avatar-crop-stage relative mx-auto w-full overflow-hidden rounded bg-black select-none"
          :class="state.dragging ? 'cursor-grabbing' : 'cursor-grab'"
          tabindex="0"
          role="application"
          :aria-label="t('profile.avatarCropHint')"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
          @keydown="onKeydown">
          <img
            v-if="state.ready"
            :src="state.src"
            alt=""
            draggable="false"
            class="pointer-events-none absolute top-1/2 left-1/2 max-w-none"
            :style="imageStyle" />
          <!-- -> One element is both the ring and the dimming: its shadow covers everything outside it -->
          <div class="avatar-crop-mask pointer-events-none absolute rounded-full" />
        </div>
        <div class="mt-2 text-center text-caption">{{ t('profile.avatarCropHint') }}</div>
        <div class="mt-4 flex flex-nowrap items-center gap-2">
          <w-btn
            flat
            round
            dense
            icon="la:search-minus"
            :aria-label="t('profile.avatarCropZoomOut')"
            @click="zoomBy(1 / ZOOM_KEY_FACTOR)" />
          <w-slider
            v-model="zoomPercent"
            :min="100"
            :max="MAX_ZOOM * 100"
            :aria-label="t('profile.avatarCropZoom')" />
          <w-btn
            flat
            round
            dense
            icon="la:search-plus"
            :aria-label="t('profile.avatarCropZoomIn')"
            @click="zoomBy(ZOOM_KEY_FACTOR)" />
        </div>
      </w-card-section>
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
          icon="la:check"
          :label="t(`common.actions.apply`)"
          color="primary"
          padding="xs md"
          :disable="!state.ready"
          :loading="state.isSaving"
          @click="apply" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'

/**
 * Crops a picked image down to the square an avatar is, under a circular mask.
 *
 * The picture is dragged to position it and zoomed (slider, wheel, pinch or keyboard) to size it,
 * and never leaves a gap inside the circle. Confirming resolves with a `Blob` of just that square,
 * which is what gets uploaded — the server only ever sees the crop, so a photo far larger than the
 * upload limit is fine to pick.
 *
 * The output is square rather than cut to the circle: every place an avatar is drawn rounds it
 * already, and the server resizes it to a square either way.
 */

const props = defineProps({
  /** The image the user picked. */
  file: {
    type: Blob,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// REFS

const stageEl = ref(null)

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => stageEl.value
})

// I18N

const { t } = useI18n()

// CONSTANTS

/** Circle diameter as a share of the stage, leaving a dimmed margin to show what is cut away. */
const CIRCLE_RATIO = 0.8
/** How far in the picture may be zoomed, relative to just covering the circle. */
const MAX_ZOOM = 5
/** Zoom step of the buttons and of the +/- keys. */
const ZOOM_KEY_FACTOR = 1.1
/** Pan step of the arrow keys, in circle diameters (ten times that with Shift). */
const PAN_KEY_STEP = 0.02
/**
 * Side of the image produced, in pixels: twice the size an avatar is stored at, so that a server
 * without the Sharp extension — which stores the upload as it is — still has enough for a high
 * density screen.
 */
const OUTPUT_SIZE = 360

// DATA

const state = reactive({
  src: '',
  ready: false,
  isSaving: false,
  dragging: false,
  naturalWidth: 0,
  naturalHeight: 0,
  /** Stage side in CSS pixels, kept up to date by a ResizeObserver. */
  stageSize: 0,
  /** 1 is the picture just covering the circle. */
  zoom: 1,
  /** Offset of the picture's center from the circle's, in circle diameters. */
  x: 0,
  y: 0
})

/** Pointers currently down on the stage, for dragging with one and pinching with two. */
const pointers = new Map()
let pinchDistance = 0
let image = null
let resizeObserver = null

// COMPUTED

/** The picture's size in circle diameters. Its shorter side is exactly one at zoom 1. */
const imageSize = computed(() => {
  const shortSide = Math.min(state.naturalWidth, state.naturalHeight) || 1
  return {
    w: (state.zoom * state.naturalWidth) / shortSide,
    h: (state.zoom * state.naturalHeight) / shortSide
  }
})

const imageStyle = computed(() => {
  const d = state.stageSize * CIRCLE_RATIO
  const w = imageSize.value.w * d
  const h = imageSize.value.h * d
  return {
    width: `${w}px`,
    height: `${h}px`,
    transform: `translate(${state.x * d - w / 2}px, ${state.y * d - h / 2}px)`
  }
})

const zoomPercent = computed({
  get: () => Math.round(state.zoom * 100),
  set: (val) => setZoom(val / 100)
})

// METHODS

/** Keeps the picture covering the whole circle: it can be moved only as far as its overhang. */
function clampOffset() {
  const maxX = (imageSize.value.w - 1) / 2
  const maxY = (imageSize.value.h - 1) / 2
  state.x = Math.min(maxX, Math.max(-maxX, state.x))
  state.y = Math.min(maxY, Math.max(-maxY, state.y))
}

/**
 * Zooms about the circle's center, so the part of the picture under it stays put — scaling the
 * offset with the zoom is exactly that.
 */
function setZoom(next) {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, next))
  const ratio = zoom / state.zoom
  state.zoom = zoom
  state.x *= ratio
  state.y *= ratio
  clampOffset()
}

function zoomBy(factor) {
  setZoom(state.zoom * factor)
}

function panBy(dxPx, dyPx) {
  const d = state.stageSize * CIRCLE_RATIO
  if (d > 0) {
    state.x += dxPx / d
    state.y += dyPx / d
    clampOffset()
  }
}

function pointerDistance() {
  const [a, b] = [...pointers.values()]
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function pointerCenter() {
  const all = [...pointers.values()]
  return {
    x: all.reduce((sum, p) => sum + p.x, 0) / all.length,
    y: all.reduce((sum, p) => sum + p.y, 0) / all.length
  }
}

function onPointerDown(ev) {
  if (!state.ready || (ev.pointerType === 'mouse' && ev.button !== 0)) {
    return
  }
  // -> Guarded as in `WSlider`: capture throws for a synthetic pointer, and the drag works without it
  try {
    ev.currentTarget.setPointerCapture(ev.pointerId)
  } catch {}
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  if (pointers.size === 2) {
    pinchDistance = pointerDistance()
  }
  state.dragging = true
}

/**
 * Pans by how far the pointers' midpoint moved, and with two of them zooms by how far they spread —
 * so a pinch can move and resize the picture in one gesture, as a photo viewer does.
 */
function onPointerMove(ev) {
  const prev = pointers.get(ev.pointerId)
  if (!prev) {
    return
  }
  const before = pointerCenter()
  pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
  const after = pointerCenter()
  if (pointers.size === 2) {
    const distance = pointerDistance()
    if (pinchDistance > 0) {
      zoomBy(distance / pinchDistance)
    }
    pinchDistance = distance
  }
  panBy(after.x - before.x, after.y - before.y)
}

function onPointerUp(ev) {
  pointers.delete(ev.pointerId)
  try {
    ev.currentTarget.releasePointerCapture(ev.pointerId)
  } catch {}
  pinchDistance = pointers.size === 2 ? pointerDistance() : 0
  state.dragging = pointers.size > 0
}

function onWheel(ev) {
  if (state.ready) {
    // -> Exponential, so a trackpad's many small deltas and a mouse wheel's few large ones both
    //    feel even, and zooming in then out by the same scroll lands where it started
    zoomBy(Math.exp(-ev.deltaY * 0.002))
  }
}

const KEY_PANS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

function onKeydown(ev) {
  if (!state.ready) {
    return
  }
  if (KEY_PANS[ev.key]) {
    ev.preventDefault()
    const step = PAN_KEY_STEP * (ev.shiftKey ? 10 : 1)
    state.x += KEY_PANS[ev.key][0] * step
    state.y += KEY_PANS[ev.key][1] * step
    clampOffset()
  } else if (ev.key === '+' || ev.key === '=') {
    ev.preventDefault()
    zoomBy(ZOOM_KEY_FACTOR)
  } else if (ev.key === '-') {
    ev.preventDefault()
    zoomBy(1 / ZOOM_KEY_FACTOR)
  }
}

/** Draws the square under the circle onto a canvas and resolves the dialog with it. */
async function apply() {
  state.isSaving = true
  try {
    // -> One circle diameter, in the picture's own pixels
    const unit = Math.min(state.naturalWidth, state.naturalHeight) / state.zoom
    const srcX = state.naturalWidth / 2 - state.x * unit - unit / 2
    const srcY = state.naturalHeight / 2 - state.y * unit - unit / 2

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(image, srcX, srcY, unit, unit, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    // -> WebP keeps a transparent background; a browser that cannot encode it (Safari) hands back
    //    a PNG instead, which the upload passes on by the blob's own type
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.92))
    if (!blob) {
      throw new Error(t('profile.avatarCropFailed'))
    }
    onDialogOK(blob)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.avatarUploadFailed'),
      caption: err.message
    })
  }
  state.isSaving = false
}

// MOUNTED

onMounted(() => {
  state.src = URL.createObjectURL(props.file)
  image = new Image()
  image.onload = () => {
    state.naturalWidth = image.naturalWidth
    state.naturalHeight = image.naturalHeight
    state.ready = true
  }
  image.onerror = () => {
    notify({
      type: 'negative',
      message: t('profile.avatarUploadFailed'),
      caption: t('profile.avatarUploadInvalidType')
    })
    onDialogCancel()
  }
  image.src = state.src
})

// -> The stage is only in the DOM once the dialog has opened, which is after mounting
watch(stageEl, (el) => {
  if (el) {
    resizeObserver ??= new ResizeObserver((entries) => {
      state.stageSize = entries[0]?.contentRect.width ?? 0
    })
    resizeObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (state.src) {
    URL.revokeObjectURL(state.src)
  }
})
</script>

<style lang="scss">
.avatar-crop-stage {
  aspect-ratio: 1;
  max-width: 320px;
  touch-action: none;

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
}

.avatar-crop-mask {
  inset: 10%;
  border: 2px solid rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
}
</style>
