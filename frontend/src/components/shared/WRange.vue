<template>
  <div
    ref="trackEl"
    class="w-range relative h-6 w-full cursor-pointer select-none"
    :class="[isDisabled ? 'pointer-events-none opacity-60' : '', label ? 'mb-7' : '']"
    @pointerdown="onPointerDown">
    <!-- Rail -->
    <div
      class="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-black/24 dark:bg-white/30" />

    <!-- Selected span -->
    <div
      class="absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
      :style="{
        left: `${toPercent(model.min)}%`,
        width: `${toPercent(model.max) - toPercent(model.min)}%`,
        backgroundColor: `var(--color-${color})`
      }" />

    <!-- Step markers -->
    <template v-if="markers">
      <div
        v-for="value of steps"
        :key="value"
        class="absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/38 dark:bg-white/50"
        :style="{ left: `${toPercent(value)}%` }" />
    </template>

    <button
      v-for="handle of ['min', 'max']"
      :key="handle"
      type="button"
      role="slider"
      class="w-unstyled absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full shadow-card transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
      :style="{ left: `${toPercent(model[handle])}%`, backgroundColor: `var(--color-${color})` }"
      :aria-label="handle === 'min' ? ariaLabelMin : ariaLabelMax"
      :aria-valuemin="handle === 'min' ? min : model.min"
      :aria-valuemax="handle === 'min' ? model.max : max"
      :aria-valuenow="model[handle]"
      :aria-valuetext="labelFor(handle)"
      @keydown="onKeydown(handle, $event)">
      <span
        v-if="label"
        class="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-caption whitespace-nowrap text-white"
        :style="{ backgroundColor: `var(--color-${color})` }">
        {{ labelFor(handle) }}
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

/**
 * Two-handle range selector over a small integer scale.
 *
 * The model is `{ min, max }`, matching the shape the config object already stores. Values always
 * snap to whole steps -- the only use is a heading-depth range (H1..H6), where a fractional value
 * would be meaningless -- so there is no continuous mode.
 */
const props = defineProps({
  /** `{ min, max }` */
  modelValue: {
    type: Object,
    default: () => ({ min: 0, max: 0 })
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  color: {
    type: String,
    default: 'primary'
  },
  /** Shows a value bubble above each handle. */
  label: {
    type: Boolean,
    default: false
  },
  /** Overrides the text of the lower handle's bubble. */
  leftLabelValue: {
    type: String,
    default: null
  },
  /** Overrides the text of the upper handle's bubble. */
  rightLabelValue: {
    type: String,
    default: null
  },
  /** Draws a dot at every step. */
  markers: {
    type: Boolean,
    default: false
  },
  disable: {
    type: Boolean,
    default: false
  },
  ariaLabelMin: {
    type: String,
    default: null
  },
  ariaLabelMax: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const trackEl = ref(null)
/** Which handle the current drag is moving. */
const dragging = ref(null)

const isDisabled = computed(() => props.disable)

const model = computed(() => ({
  min: clamp(props.modelValue?.min ?? props.min),
  max: clamp(props.modelValue?.max ?? props.max)
}))

const steps = computed(() =>
  Array.from({ length: props.max - props.min + 1 }, (_, i) => props.min + i)
)

function clamp(value) {
  return Math.min(props.max, Math.max(props.min, Math.round(value)))
}

function toPercent(value) {
  const span = props.max - props.min
  return span === 0 ? 0 : ((clamp(value) - props.min) / span) * 100
}

function labelFor(handle) {
  const override = handle === 'min' ? props.leftLabelValue : props.rightLabelValue
  return override ?? String(model.value[handle])
}

/** Writes a handle, keeping the two from crossing over. */
function update(handle, value) {
  const next = { ...model.value }
  next[handle] =
    handle === 'min' ? Math.min(clamp(value), next.max) : Math.max(clamp(value), next.min)
  if (next.min !== model.value.min || next.max !== model.value.max) {
    emit('update:modelValue', next)
  }
}

function valueAt(clientX) {
  const rect = trackEl.value.getBoundingClientRect()
  const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
  return props.min + ratio * (props.max - props.min)
}

/**
 * Routes the rest of the gesture to this element.
 *
 * Guarded because capture throws when the event did not come from a real pointer -- which is the
 * case for a synthetic `PointerEvent`. The drag itself works either way, so a failure here must
 * not abort it.
 */
function capturePointer(ev) {
  try {
    ev.currentTarget.setPointerCapture(ev.pointerId)
  } catch {}
}

function onPointerDown(ev) {
  const value = valueAt(ev.clientX)
  // -> Grab whichever handle is nearer to the press, so a click anywhere on the rail works
  dragging.value =
    Math.abs(value - model.value.min) <= Math.abs(value - model.value.max) ? 'min' : 'max'
  update(dragging.value, value)

  capturePointer(ev)
  ev.currentTarget.addEventListener('pointermove', onPointerMove)
  ev.currentTarget.addEventListener('pointerup', onPointerUp, { once: true })
  ev.currentTarget.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onPointerMove(ev) {
  if (dragging.value) {
    update(dragging.value, valueAt(ev.clientX))
  }
}

function onPointerUp(ev) {
  dragging.value = null
  try {
    ev.currentTarget.releasePointerCapture(ev.pointerId)
  } catch {}
  ev.currentTarget.removeEventListener('pointermove', onPointerMove)
}

const KEY_STEPS = {
  ArrowLeft: -1,
  ArrowDown: -1,
  ArrowRight: 1,
  ArrowUp: 1,
  PageDown: -1,
  PageUp: 1
}

function onKeydown(handle, ev) {
  if (ev.key === 'Home' || ev.key === 'End') {
    ev.preventDefault()
    update(handle, ev.key === 'Home' ? props.min : props.max)
    return
  }
  const delta = KEY_STEPS[ev.key]
  if (delta === undefined) {
    return
  }
  ev.preventDefault()
  update(handle, model.value[handle] + delta)
}
</script>
