<template>
  <!--
    Laid over the preview, the same size as it. Everything is placed in percentages of the image, so
    the box follows the preview whatever size it is drawn at, and only a drag has to know how many
    image pixels a screen pixel is.
  -->
  <div ref="root" class="image-region" :class="{ 'is-dragging': state.dragging }">
    <!--
      The dimming, in a layer of its own that clips: a shadow far larger than any image, cast by a hole
      the size of the box. The box itself is NOT clipped, or the handles on an edge of the image would
      be cut in half.
    -->
    <div class="image-region-shade" aria-hidden="true">
      <div class="image-region-hole" :style="boxStyle" />
    </div>
    <div
      class="image-region-box"
      :class="{ 'has-grid': grid }"
      :style="boxStyle"
      role="group"
      tabindex="0"
      :aria-label="label"
      @pointerdown.prevent="startDrag($event, 'move')"
      @keydown="onKeydown">
      <span
        v-for="handle of HANDLES"
        :key="handle"
        class="image-region-handle"
        :class="`is-${handle}`"
        @pointerdown.stop.prevent="startDrag($event, handle)" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

/**
 * A resizable rectangle over an image, for choosing a region of it: the image editor's Crop, Trim and
 * Redact.
 *
 * The region is in the IMAGE's pixels (`{ left, top, width, height }`), never in the screen's, since
 * that is what the editor sends to the server. The outside is dimmed with a box-shadow cast by a hole
 * placed exactly as the box is, so there is nothing to keep in step with it.
 *
 * Dragged with pointer events, so mouse, pen and touch alike; the box itself takes the arrow keys,
 * moving one image pixel at a time, ten with Shift.
 */

// PROPS

const props = defineProps({
  /** `{ left, top, width, height }`, in image pixels. */
  modelValue: {
    type: Object,
    required: true
  },
  /** The image's own size, in pixels. */
  imageWidth: {
    type: Number,
    required: true
  },
  imageHeight: {
    type: Number,
    required: true
  },
  /** Width over height, held while resizing. Null for a free rectangle. */
  aspect: {
    type: Number,
    default: null
  },
  /** Thirds drawn across the box, which is what a crop is composed by. */
  grid: {
    type: Boolean,
    default: false
  },
  /** What the box is announced as. */
  label: {
    type: String,
    default: ''
  }
})

// EMITS

const emit = defineEmits(['update:modelValue'])

// DATA

const HANDLES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

const state = reactive({
  dragging: null
})

let drag = null

// REFS

const root = ref(null)

// COMPUTED

const boxStyle = computed(() => {
  const r = props.modelValue
  return {
    left: `${(r.left / props.imageWidth) * 100}%`,
    top: `${(r.top / props.imageHeight) * 100}%`,
    width: `${(r.width / props.imageWidth) * 100}%`,
    height: `${(r.height / props.imageHeight) * 100}%`
  }
})

// METHODS

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val))
}

/** A region moved by whole image pixels, kept inside the image. */
function moved(start, dx, dy) {
  return {
    ...start,
    left: clamp(Math.round(start.left + dx), 0, props.imageWidth - start.width),
    top: clamp(Math.round(start.top + dy), 0, props.imageHeight - start.height)
  }
}

/**
 * A region resized from one of its handles, kept inside the image and at least one pixel each way.
 *
 * With an aspect ratio, the side the handle moves leads and the other follows: a corner leads with
 * whichever side has grown proportionally more, an edge handle grows the box about its centre along
 * the other axis. Then the whole box is scaled down, about the edges that are not moving, until it
 * fits the room it has.
 */
function resized(start, handle, dx, dy) {
  const W = props.imageWidth
  const H = props.imageHeight
  const startRight = start.left + start.width
  const startBottom = start.top + start.height
  let left = start.left
  let top = start.top
  let right = startRight
  let bottom = startBottom
  if (handle.includes('w')) {
    left = clamp(start.left + dx, 0, startRight - 1)
  }
  if (handle.includes('e')) {
    right = clamp(startRight + dx, start.left + 1, W)
  }
  if (handle.includes('n')) {
    top = clamp(start.top + dy, 0, startBottom - 1)
  }
  if (handle.includes('s')) {
    bottom = clamp(startBottom + dy, start.top + 1, H)
  }
  if (!props.aspect) {
    return {
      left: Math.round(left),
      top: Math.round(top),
      width: Math.max(1, Math.round(right - left)),
      height: Math.max(1, Math.round(bottom - top))
    }
  }

  const aspect = props.aspect
  const horizontal = /[ew]/.test(handle)
  const vertical = /[ns]/.test(handle)
  let w = right - left
  let h = bottom - top
  if (horizontal && !vertical) {
    h = w / aspect
  } else if (vertical && !horizontal) {
    w = h * aspect
  } else if (w / start.width > h / start.height) {
    h = w / aspect
  } else {
    w = h * aspect
  }

  // -> The room there is, measured from whatever the handle is NOT moving
  const cx = start.left + start.width / 2
  const cy = start.top + start.height / 2
  const roomW = handle.includes('w')
    ? startRight
    : handle.includes('e')
      ? W - start.left
      : 2 * Math.min(cx, W - cx)
  const roomH = handle.includes('n')
    ? startBottom
    : handle.includes('s')
      ? H - start.top
      : 2 * Math.min(cy, H - cy)
  const fit = Math.min(1, roomW / w, roomH / h)
  w = Math.max(1, Math.round(w * fit))
  h = Math.max(1, Math.round(h * fit))

  const x = handle.includes('w') ? startRight - w : handle.includes('e') ? start.left : cx - w / 2
  const y = handle.includes('n') ? startBottom - h : handle.includes('s') ? start.top : cy - h / 2
  return {
    left: clamp(Math.round(x), 0, W - w),
    top: clamp(Math.round(y), 0, H - h),
    width: w,
    height: h
  }
}

/** How many image pixels one screen pixel is, read when a drag starts. */
function pixelRatio() {
  const rect = root.value.getBoundingClientRect()
  return { x: props.imageWidth / rect.width, y: props.imageHeight / rect.height }
}

function startDrag(ev, handle) {
  // -> The main button only: a right-click or a second finger is not a drag
  if (ev.button !== 0) {
    return
  }
  drag = {
    handle,
    x: ev.clientX,
    y: ev.clientY,
    start: { ...props.modelValue },
    ratio: pixelRatio()
  }
  state.dragging = handle
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('pointercancel', endDrag)
}

function onPointerMove(ev) {
  if (!drag) {
    return
  }
  const dx = (ev.clientX - drag.x) * drag.ratio.x
  const dy = (ev.clientY - drag.y) * drag.ratio.y
  emit(
    'update:modelValue',
    drag.handle === 'move' ? moved(drag.start, dx, dy) : resized(drag.start, drag.handle, dx, dy)
  )
}

function endDrag() {
  drag = null
  state.dragging = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('pointercancel', endDrag)
}

const ARROWS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1]
}

function onKeydown(ev) {
  const arrow = ARROWS[ev.key]
  if (!arrow) {
    return
  }
  ev.preventDefault()
  // -> Kept from the editor's own shortcuts, which would otherwise read an arrow as nothing at all
  ev.stopPropagation()
  const step = ev.shiftKey ? 10 : 1
  emit('update:modelValue', moved(props.modelValue, arrow[0] * step, arrow[1] * step))
}

onBeforeUnmount(endDrag)
</script>

<style scoped lang="scss">
.image-region {
  position: absolute;
  inset: 0;
  touch-action: none;

  &-shade {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  &-hole {
    position: absolute;
    box-shadow: 0 0 0 100vmax rgba(0, 0, 0, 0.5);
  }

  &-box {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid rgba(255, 255, 255, 0.9);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
    cursor: move;
    outline: none;

    &:focus-visible {
      border-color: $primary;
    }

    &.has-grid {
      background-image:
        linear-gradient(to right, rgba(255, 255, 255, 0.4) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.4) 1px, transparent 1px);
      background-size: calc(100% / 3) calc(100% / 3);
      background-position: -1px -1px;
    }
  }

  &-handle {
    position: absolute;
    width: 14px;
    height: 14px;
    margin: -7px 0 0 -7px;
    border: 1px solid rgba(0, 0, 0, 0.5);
    border-radius: 2px;
    background-color: #fff;

    // -> A bigger target than the square drawn, for a finger
    &::after {
      content: '';
      position: absolute;
      inset: -8px;
    }

    &.is-n,
    &.is-s {
      left: 50%;
      cursor: ns-resize;
    }
    &.is-e,
    &.is-w {
      top: 50%;
      cursor: ew-resize;
    }
    &.is-n,
    &.is-ne,
    &.is-nw {
      top: 0;
    }
    &.is-s,
    &.is-se,
    &.is-sw {
      top: 100%;
    }
    &.is-w,
    &.is-nw,
    &.is-sw {
      left: 0;
    }
    &.is-e,
    &.is-ne,
    &.is-se {
      left: 100%;
    }
    &.is-ne,
    &.is-sw {
      cursor: nesw-resize;
    }
    &.is-nw,
    &.is-se {
      cursor: nwse-resize;
    }
  }

  // -> While dragging, the cursor stays what it was when the drag began, wherever the pointer goes
  &.is-dragging {
    cursor: grabbing;
  }
}
</style>
