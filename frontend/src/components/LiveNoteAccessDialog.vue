<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <!-- -> A fixed width, so that the note below appearing makes it taller and never wider -->
    <w-card style="width: 500px; max-width: calc(100vw - 32px)">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-locked-note.svg" size="sm" class="mr-2" />
        <span>{{ t('liveNote.access.title') }}</span>
      </w-card-section>
      <!--
        One row per choice, the radio beside a name and what it means -- the shape `NavEditMenu` gives
        its modes. The row is the label, so the whole of it is what to click.
      -->
      <w-list padding role="radiogroup" :aria-label="t(`liveNote.access.title`)">
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.access" val="editable" /></w-item-section>
          <w-item-section>
            <w-item-label>{{ t('liveNote.access.editable') }}</w-item-label>
            <w-item-label caption>{{ t('liveNote.access.editableHint') }}</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.access" val="locked" /></w-item-section>
          <w-item-section>
            <w-item-label>{{ t('liveNote.access.locked') }}</w-item-label>
            <w-item-label caption>{{ t('liveNote.access.lockedHint') }}</w-item-label>
          </w-item-section>
        </w-item>
        <w-item tag="label">
          <w-item-section side><w-radio v-model="state.access" val="private" /></w-item-section>
          <w-item-section>
            <w-item-label>{{ t('liveNote.access.private') }}</w-item-label>
            <w-item-label caption>{{ t('liveNote.access.privateHint') }}</w-item-label>
          </w-item-section>
        </w-item>
      </w-list>
      <!--
        Said before it happens: anybody else in the note is about to be put back through the door.
        Only once another choice is picked, so the dialog grows by its height then -- and only in
        height: the card's fixed width above is what has the text wrap rather than widen it.
      -->
      <w-card-section v-if="state.access !== props.access" class="text-caption text-orange-9 pt-0">
        {{ t('liveNote.access.reconnectHint') }}
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
          :label="t(`common.actions.save`)"
          color="primary"
          padding="xs md"
          :disabled="state.access === props.access"
          @click="onDialogOK(state.access)" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

/**
 * Who besides its owners may read and write a live note -- opened from the note's menu, by an owner.
 *
 * Answers with the access chosen; the caller saves it. "Only me" in the descriptions is the note's
 * owners, which to the person choosing is themselves: whoever created the note, plus `manage:system`,
 * who is not worth a sentence here.
 */

const props = defineProps({
  /** The note's access as it stands, which the dialog opens on. */
  access: {
    type: String,
    required: true
  }
})

defineEmits(dialogComponentEmits)

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

const { t } = useI18n()

const state = reactive({
  access: props.access
})
</script>
