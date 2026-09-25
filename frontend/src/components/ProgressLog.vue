<template>
  <div ref="panel" class="progress-log" role="log">
    <div v-if="entries.length < 1" class="progress-log__empty">
      {{ emptyText }}
    </div>
    <div
      v-for="(entry, idx) of entries"
      :key="`log-` + idx"
      class="progress-log__line"
      :class="`progress-log__line--` + entry.level">
      <span class="progress-log__ts">{{ entry.ts }}</span>
      <!-- -> Written tight: the line is `pre-wrap`, so any whitespace here would be drawn -->
      <span class="progress-log__msg"
        ><a
          v-if="entry.location && entry.url"
          class="progress-log__location"
          :href="entry.url"
          target="_blank"
          rel="noopener"
          >{{ entry.location }}</a
        ><span v-else-if="entry.location" class="progress-log__location">{{ entry.location }}</span
        >{{ entry.location ? ' ' : '' }}{{ entry.message }}</span
      >
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue'

/**
 * The terminal-style log a long-running admin utility writes into as it goes — the 2.x import and the
 * page problem scan.
 *
 * The owner holds the lines and pushes to them; this only draws them and keeps the panel at the
 * bottom. Each entry is `{ ts, level, message }`, `level` one of `info`, `success`, `warn` or `error`,
 * and optionally a `location` it is about, drawn ahead of the message and linked when it has a `url`.
 */
const props = defineProps({
  entries: {
    type: Array,
    required: true
  },
  /** What the panel says before anything has been logged. */
  emptyText: {
    type: String,
    default: ''
  }
})

const panel = ref(null)

/*
  Pinned to the bottom only when the reader is already there, so that scrolling back to read a warning
  is not undone by the next of the several thousand lines a large run writes. Measured before the new
  lines are drawn (`pre`), which is the only moment "was at the bottom" still means anything.
*/
watch(
  () => props.entries.length,
  () => {
    const el = panel.value
    const wasAtBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 40 : true
    if (wasAtBottom) {
      nextTick(() => {
        if (panel.value) {
          panel.value.scrollTop = panel.value.scrollHeight
        }
      })
    }
  },
  { flush: 'pre' }
)
</script>

<style scoped lang="scss">
/*
  The log is a terminal, so it looks like one: monospaced, dark, scrolling on its own and keeping a
  fixed height whether it holds two lines or two hundred -- a panel that grew with the run would move
  the form beside it on every message. `--font-mono` is the app's own, as `UtilCodeEditor` uses.

  Dark in both themes, rather than following the app. This is machine output scrolling past, and every
  other place anybody reads that -- a terminal, a CI log, the browser console -- is dark; a light one
  reads as a document. It also keeps the colours below meaning one thing: a warning and an error have
  to be legible against exactly one background instead of two, which is why they can be the brighter
  end of the ramp and stay readable.

  The palette is the app's own dark surfaces (`_theme.scss`), so the panel sits in an admin overlay
  rather than looking like a component from somewhere else.
*/
.progress-log {
  height: calc(100vh - 260px);
  min-height: 300px;
  overflow-y: auto;
  border-radius: 4px;
  padding: 12px;
  background-color: $dark-6;
  border: 1px solid $dark-3;
  color: $grey-4;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  line-height: 1.6;

  /*
    A step lighter than the timestamps, because it is not secondary the way they are: it is the only
    thing on the panel before a run starts, so it has to read as an instruction rather than as
    something greyed out. `$grey-7` was 4.3:1 against this background and `$grey-6` is 7.4:1, while
    still sitting a step below the message colour so it does not pass for output.
  */
  &__empty {
    color: $grey-6;
    font-style: italic;
  }

  &__line {
    display: flex;
    gap: 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__ts {
    flex: none;
    color: $grey-7;
  }

  /*
    Plain white rather than the line's own colour, so that what a line is ABOUT reads apart from what
    it says about it; underlined only where it goes somewhere.
  */
  &__location {
    color: #fff;
    font-weight: 600;
  }

  a.progress-log__location {
    text-decoration: underline;
    text-decoration-color: rgb(255 255 255 / 0.4);
    text-underline-offset: 2px;

    &:hover {
      text-decoration-color: currentColor;
    }
  }

  /*
    The full Material ramp is in `tailwind.css` as custom properties; `_palette.scss` carries only the
    steps its own stylesheets happened to need, and the mid tones a log wants are not among them.
    These are the light end of each hue, which is what stays legible on the dark panel above.
  */
  &__line--success .progress-log__msg {
    color: var(--color-green-4);
    font-weight: 600;
  }

  &__line--warn .progress-log__msg {
    color: var(--color-orange-4);
  }

  &__line--error .progress-log__msg {
    color: var(--color-red-4);
  }
}
</style>
