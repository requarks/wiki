<template>
  <component
    :is="entry.component"
    v-for="entry of openDialogs"
    :key="entry.id"
    v-bind="entry.props"
    @ok="onOk(entry.id, $event)"
    @hide="onHide(entry.id)" />
</template>

<script setup>
import { closeDialog, openDialogs } from '@/composables/dialog'

/**
 * Mounts dialogs opened programmatically via `dialog()`. Rendered once, in App.vue.
 *
 * Each dialog component signals itself through two events, which `useDialogComponent()` emits:
 *   `ok`   -- confirmed, carrying an optional payload
 *   `hide` -- finished closing, whether confirmed or not; the cue to unmount
 */

/**
 * A dialog can emit `ok` and then `hide` (the normal confirm path), so the payload is parked until
 * `hide` arrives and the entry is resolved exactly once.
 */
const okPayloads = new Map()

function onOk(id, payload) {
  okPayloads.set(id, payload)
}

function onHide(id) {
  const okFired = okPayloads.has(id)
  const payload = okPayloads.get(id)
  okPayloads.delete(id)
  closeDialog(id, okFired, payload)
}
</script>
