<template>
  <w-dialog v-model="dialogVisible" max-width="850px" @hide="onDialogHide">
    <w-card style="min-width: 550px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-document-in-folder.svg" size="sm" class="mr-2" />
        <span>{{ t(`fileman.dropMove.title`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t keypath="fileman.dropMove.confirm">
            <template #name>
              <strong>{{ itemTitle }}</strong>
            </template>
            <template #destination>
              <strong>{{ folderTitle ?? t(`fileman.dropMove.root`) }}</strong>
            </template>
          </i18n-t>
        </div>
        <div class="text-caption text-grey mt-2">/{{ folderPath ? `${folderPath}/` : `` }}</div>
        <div v-if="itemType === `folder`" class="text-caption text-grey mt-2">
          {{ t(`fileman.dropMove.folderHint`) }}
        </div>
      </w-card-section>
      <!-- -> The same choice, and the same default, the Rename / Move Page dialog offers -->
      <w-list v-if="itemType === `page`">
        <w-item tag="label">
          <blueprint-icon icon="link" />
          <w-item-section>
            <w-item-label>{{ t(`pageRenameDialog.updateLinks`) }}</w-item-label>
            <w-item-label caption>{{ t(`pageRenameDialog.updateLinksHint`) }}</w-item-label>
          </w-item-section>
          <w-item-section avatar>
            <w-toggle v-model="state.updateLinks" :aria-label="t(`pageRenameDialog.updateLinks`)" />
          </w-item-section>
        </w-item>
      </w-list>
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
          :label="t(`common.actions.move`)"
          color="primary"
          padding="xs md"
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
/*
  Asks before a drop in the File Manager moves anything. It only asks: the move itself is the File
  Manager's to make, since what it refreshes afterwards depends on what moved.
*/
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

// PROPS

const props = defineProps({
  /** `page`, `asset` or `folder` -- which decides what else there is to say or ask. */
  itemType: {
    type: String,
    required: true
  },
  itemTitle: {
    type: String,
    required: true
  },
  /** The destination's title, or null for the root. */
  folderTitle: {
    type: String,
    default: null
  },
  /** The destination's path, empty for the root. */
  folderPath: {
    type: String,
    default: ''
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  updateLinks: true
})

// METHODS

function confirm() {
  onDialogOK(props.itemType === 'page' ? { updateLinks: state.updateLinks } : {})
}
</script>
