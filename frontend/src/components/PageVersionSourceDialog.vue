<template>
  <!-- Not `persistent`: nothing here is being filled in, so clicking away should just close it. -->
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="page-version-source" style="width: 1200px; max-width: 94vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-code.svg" left size="sm" />
        <span>{{ t('history.viewSource') }}</span>
        <w-space />
        <span class="page-version-source-date">{{ date }}</span>
      </w-card-section>
      <w-card-section class="page-version-source-body">
        <pre v-text="content" />
      </w-card-section>
      <!--
        Its own class rather than the shared `card-actions`: that one follows the app theme, and this
        dialog is dark whichever theme is on — a light toolbar under a black pane reads as a different
        component bolted to the bottom. Mirrors what `card-header` does at the top.
      -->
      <w-card-actions class="page-version-source-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          icon="la:copy"
          color="grey-5"
          padding="xs md"
          :label="t(`common.actions.copy`)"
          @click="copy" />
        <w-btn
          unelevated
          color="primary"
          padding="xs md"
          :label="t(`common.actions.close`)"
          @click="onDialogOK" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { copyToClipboard } from '@/helpers/clipboard'
import { notify } from '@/composables/notify'

/**
 * One version's source, as it stood.
 *
 * A dialog rather than the page source overlay, which shows the page as it is now: only one overlay
 * can be open at a time, and taking over the screen would close the history this was opened from.
 */

// PROPS

const props = defineProps({
  /** The source itself. */
  content: {
    type: String,
    default: ''
  },
  /** When this version was written, already formatted for reading. */
  date: {
    type: String,
    default: ''
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK } = useDialogComponent()

// I18N

const { t } = useI18n()

// METHODS

async function copy() {
  try {
    await copyToClipboard(props.content)
    notify({ type: 'positive', message: t('history.sourceCopied') })
  } catch (err) {
    notify({ type: 'negative', message: err.message })
  }
}
</script>

<style lang="scss">
.page-version-source {
  &-date {
    font-size: 0.8rem;
    opacity: 0.7;
  }

  /* -> Colour only: WCardActions already lays the bar out */
  &-actions {
    background-color: $dark-3;
    background-image: radial-gradient(at top left, $dark-3, $dark-5);
    border-top: 1px solid #000;
    box-shadow: 0 -1px 0 0 rgba(#fff, 0.06);
    color: #fff;
  }

  &-body {
    padding: 0;
    background-color: $dark-6;
    color: #fff;

    pre {
      /* -> Tall enough to be worth opening, short enough to leave the dialog on screen */
      max-height: 60vh;
      overflow: auto;
      padding: 1rem;
      font-family: 'Roboto Mono', monospace;
      font-size: 0.8rem;
      line-height: 1.5;
    }
  }
}
</style>
