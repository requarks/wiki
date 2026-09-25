<template>
  <div
    ref="trackEl"
    class="w-slider relative h-6 w-full cursor-pointer select-none"
    :class="[isDisabled ? 'pointer-events-none opacity-60' : '', label ? 'mb-7' : '']"
    @pointerdown="onPointerDown">
    <!-- Rail -->
    <div
      class="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-black/24 dark:bg-white/30" />

    <!-- Filled span, from the lower end to the handle -->
    <div
      class="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full"
      :style="{ width: `${toPercent(model)}%`, backgroundColor: `var(--color-${color})` }" />

    <!-- Stop markers -->
    <template v-if="markers">
      <div
        v-for="value of stops"
        :key="value"
        class="absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/38 dark:bg-white/50"
        :style="{ left: `${toPercent(value)}%` }" />
    </template>

    <button
      type="button"
      role="slider"
      class="w-unstyled absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full shadow-card transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
      :style="{ left: `${toPercent(model)}%`, backgroundColor: `var(--color-${color})` }"
      :aria-label="ariaLabel"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="model"
      :aria-valuetext="labelText"
      :disabled="isDisabled"
      @keydown="onKeydown">
      <span
        v-if="label"
        class="pointer-events-none absolute top-full left-1/2 mt-1 -translate-x-1/2 rounded px-1.5 py-0.5 text-caption whitespace-nowrap text-white"
        :style="{ backgroundColor: `var(--color-${color})` }">
        {{ labelText }}
      </span>
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

/**
 * Single-handle slider over a scale of discrete stops.
 *
 * `WRange`'s one-value sibling. The stops are `min`, `max`, and every multiple of `step` strictly
 * between them -- so `min: 1, max: 100, step: 10` is 1, 10, 20 ... 100, which is what a quality
 * setting wants and what a plain `min + k * step` could not give (it would stop at 91). With
 * `min: 0` the two readings are the same thing.
 */
const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  min: {
    type: Number,
    default: 0
  },
  max: {
    type: Number,
    default: 100
  },
  step: {
    type: Number,
    default: 1
  },
  color: {
    type: String,
    default: 'primary'
  },
  /** Shows a value bubble below the handle. */
  label: {
    type: Boolean,
    default: false
  },
  /** Overrides the text of the bubble, and of what assistive technology reads out. */
  labelValue: {
    type: String,
    default: null
  },
  /** Draws a dot at every stop. */
  markers: {
    type: Boolean,
    default: false
  },
  disable: {
    type: Boolean,
    default: false
  },
  ariaLabel: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const trackEl = ref(null)
const isDragging = ref(false)

const isDisabled = computed(() => props.disable)

const stops = computed(() => {
  const values = [props.min]
  const first = (Math.floor(props.min / props.step) + 1) * props.step
  for (let value = first; value < props.max; value += props.step) {
    values.push(value)
  }
  if (props.max > props.min) {
    values.push(props.max)
  }
  return values
})

/** The stop nearest to a value, which is the only thing the model is ever set to. */
function snap(value) {
  return stops.value.reduce((best, stop) =>
    Math.abs(stop - value) < Math.abs(best - value) ? stop : best
  )
}

const model = computed(() => snap(props.modelValue ?? props.min))

const labelText = computed(() => props.labelValue ?? String(model.value))

function toPercent(value) {
  const span = props.max - props.min
  return span === 0
    ? 0
    : ((Math.min(props.max, Math.max(props.min, value)) - props.min) / span) * 100
}

function update(value) {
  const next = snap(value)
  if (next !== model.value) {
    emit('update:modelValue', next)
  }
}

function valueAt(clientX) {
  const rect = trackEl.value.getBoundingClientRect()
  const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
  return props.min + ratio * (props.max - props.min)
}

/** Guarded as in `WRange`: capture throws for a synthetic pointer, and the drag works without it. */
function capturePointer(ev) {
  try {
    ev.currentTarget.setPointerCapture(ev.pointerId)
  } catch {}
}

function onPointerDown(ev) {
  isDragging.value = true
  update(valueAt(ev.clientX))

  capturePointer(ev)
  ev.currentTarget.addEventListener('pointermove', onPointerMove)
  ev.currentTarget.addEventListener('pointerup', onPointerUp, { once: true })
  ev.currentTarget.addEventListener('pointercancel', onPointerUp, { once: true })
}

function onPointerMove(ev) {
  if (isDragging.value) {
    update(valueAt(ev.clientX))
  }
}

function onPointerUp(ev) {
  isDragging.value = false
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

/** A key moves one stop, not one unit: the stops are the only values there are. */
function onKeydown(ev) {
  if (ev.key === 'Home' || ev.key === 'End') {
    ev.preventDefault()
    update(ev.key === 'Home' ? props.min : props.max)
    return
  }
  const delta = KEY_STEPS[ev.key]
  if (delta === undefined) {
    return
  }
  ev.preventDefault()
  const idx = stops.value.indexOf(model.value)
  const next = stops.value[Math.min(stops.value.length - 1, Math.max(0, idx + delta))]
  update(next)
}
</script>
