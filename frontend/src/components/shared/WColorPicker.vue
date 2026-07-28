<template>
  <div class="w-color-picker w-[240px] select-none">
    <!-- Saturation / brightness field -->
    <div
      ref="fieldEl"
      class="relative h-[140px] w-full cursor-crosshair"
      :style="fieldStyle"
      @pointerdown="onFieldDown">
      <span
        class="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-card"
        :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }" />
    </div>

    <div class="flex items-center gap-2 p-2">
      <!-- Hue -->
      <div
        ref="hueEl"
        class="relative h-3 flex-1 cursor-pointer rounded-full"
        :style="hueStyle"
        @pointerdown="onHueDown">
        <span
          class="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-card"
          :style="{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }" />
      </div>
      <span
        class="h-6 w-6 shrink-0 rounded-full border border-black/12 dark:border-white/15"
        :style="{ backgroundColor: hex }" />
    </div>

    <div class="px-2 pb-2">
      <input
        class="w-unstyled w-full rounded px-2 py-1 text-center font-mono text-body2 uppercase"
        :class="inputRing"
        :value="hex"
        maxlength="7"
        spellcheck="false"
        aria-label="Hex color"
        @change="onHexInput"
        @blur="onHexInput" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

/**
 * Hex colour picker: saturation/brightness field, hue rail, and the hex value as text.
 *
 * Simplification: the picker this replaces also offered RGBA and named-palette tabs plus an alpha
 * channel. Everything here stores an opaque `#rrggbb` (site theme colours), so those modes had no
 * reachable use.
 *
 * Hue and saturation are held internally rather than being re-derived from the model on every
 * change: at zero brightness or zero saturation the hex value no longer carries them, so round-
 * tripping through it would snap the cursor back to red as soon as a colour got close to black.
 */
const props = defineProps({
  /** `#rrggbb` */
  modelValue: {
    type: String,
    default: '#000000'
  }
})

const emit = defineEmits(['update:modelValue'])

const fieldEl = ref(null)
const hueEl = ref(null)
const hsv = ref(rgbToHsv(hexToRgb(props.modelValue) ?? { r: 0, g: 0, b: 0 }))

const hex = computed(() => rgbToHex(hsvToRgb(hsv.value)))
const hueColor = computed(() => rgbToHex(hsvToRgb({ h: hsv.value.h, s: 1, v: 1 })))

const fieldStyle = computed(() => ({
  backgroundImage: [
    'linear-gradient(to top, #000, rgba(0, 0, 0, 0))',
    `linear-gradient(to right, #fff, ${hueColor.value})`
  ].join(', ')
}))

const hueStyle = {
  backgroundImage: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
}

const inputRing = 'w-input-control shadow-[inset_0_0_0_1px_var(--w-input-ring)]'

// -> Track outside edits (a different swatch being picked), but ignore our own emissions
watch(
  () => props.modelValue,
  (value) => {
    if (value?.toLowerCase() === hex.value.toLowerCase()) {
      return
    }
    const rgb = hexToRgb(value)
    if (rgb) {
      hsv.value = rgbToHsv(rgb)
    }
  }
)

function commit(next) {
  hsv.value = next
  emit('update:modelValue', hex.value)
}

function ratio(event, el, axis) {
  const rect = el.getBoundingClientRect()
  const size = axis === 'x' ? rect.width : rect.height
  const offset = axis === 'x' ? event.clientX - rect.left : event.clientY - rect.top
  return size === 0 ? 0 : Math.min(1, Math.max(0, offset / size))
}

/** Wires a press plus the subsequent drag on one of the two surfaces. */
function drag(ev, el, apply) {
  apply(ev)
  const move = (e) => apply(e)
  const up = () => {
    el.removeEventListener('pointermove', move)
    try {
      el.releasePointerCapture(ev.pointerId)
    } catch {}
  }
  // -> Throws for a synthetic pointer; the drag works regardless, so it must not abort here
  try {
    el.setPointerCapture(ev.pointerId)
  } catch {}
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up, { once: true })
  el.addEventListener('pointercancel', up, { once: true })
}

function onFieldDown(ev) {
  drag(ev, fieldEl.value, (e) => {
    commit({
      h: hsv.value.h,
      s: ratio(e, fieldEl.value, 'x'),
      v: 1 - ratio(e, fieldEl.value, 'y')
    })
  })
}

function onHueDown(ev) {
  drag(ev, hueEl.value, (e) => {
    commit({ ...hsv.value, h: ratio(e, hueEl.value, 'x') * 360 })
  })
}

function onHexInput(ev) {
  const rgb = hexToRgb(ev.target.value)
  if (rgb) {
    commit(rgbToHsv(rgb))
  } else {
    // -> Reject anything unparseable by restoring the current value
    ev.target.value = hex.value
  }
}

// -- colour conversion --------------------------------------------------------

function hexToRgb(value) {
  const m = /^#?([\da-f]{6}|[\da-f]{3})$/i.exec(String(value ?? '').trim())
  if (!m) {
    return null
  }
  const digits = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const int = Number.parseInt(digits, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')
}

function rgbToHsv({ r, g, b }) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255]
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6
    } else if (max === gn) {
      h = (bn - rn) / delta + 2
    } else {
      h = (rn - gn) / delta + 4
    }
    h = (h * 60 + 360) % 360
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max }
}

function hsvToRgb({ h, s, v }) {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x]
  ][Math.floor(h / 60) % 6]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}
</script>
