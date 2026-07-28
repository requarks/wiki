<template>
  <w-menu ref="menuRef" :anchor="anchor" :self="self" @hide="onHide">
    <div class="p-3">
      <!--
        The slot edits a WORKING COPY, not the model. `set` commits it and closes; dismissing the
        popup any other way discards it. That is the contract the callers are written against --
        an inline title editor must not write through on every keystroke.

        Handed over as ONE reactive object rather than as separate slot props, because the field
        inside binds `v-model="scope.value"` and needs a real setter to write through. Slot props
        are rebuilt on every render, so a plain value passed per-key would be a snapshot and the
        assignment would go nowhere.
      -->
      <slot :scope="scope" />
    </div>
  </w-menu>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import WMenu from './WMenu.vue'

/**
 * Edit a value in a popup anchored to the element this sits inside.
 *
 * Simplification: the component this replaces also offered its own buttons, validation, a title,
 * and a `label-set` / `label-cancel` pair. Both callers here supply their own field and commit on
 * Enter, so this is the popup and the working copy and nothing else.
 *
 * `auto-save` is accepted and ignored: it made the original commit on dismissal rather than
 * discard. Neither caller depends on that -- both commit explicitly from the field's Enter key --
 * and silently saving a half-typed title on a stray click is the worse default.
 */
const props = defineProps({
  modelValue: {
    type: null,
    default: null
  },
  anchor: {
    type: String,
    default: 'bottom left'
  },
  self: {
    type: String,
    default: 'top left'
  },
  /** Accepted for call-site compatibility; see the note above. */
  autoSave: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'save', 'cancel'])

const menuRef = ref(null)
const draft = ref(props.modelValue)

// -> Re-seed whenever the source changes, so re-opening never shows a stale edit
watch(
  () => props.modelValue,
  (value) => {
    draft.value = value
  }
)

const scope = reactive({
  value: computed({
    get: () => draft.value,
    set: (v) => {
      draft.value = v
    }
  }),
  initialValue: computed(() => props.modelValue),
  set: () => commit(),
  cancel: () => cancel()
})

function commit() {
  if (draft.value !== props.modelValue) {
    emit('update:modelValue', draft.value)
    emit('save', draft.value)
  }
  menuRef.value?.hide()
}

function cancel() {
  draft.value = props.modelValue
  menuRef.value?.hide()
}

/** Dismissed by click-away or Escape: the working copy goes back to the source, unsaved. */
function onHide() {
  draft.value = props.modelValue
  emit('cancel')
}
</script>
