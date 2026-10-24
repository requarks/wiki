<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 420px; max-width: 94vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-bulb.svg" size="sm" class="mr-2" />
        <span>{{ t('common.feedback.submitIdea') }}</span>
      </w-card-section>
      <w-card-section>
        {{ t('common.feedback.submitLoginHint') }}
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t('common.actions.cancel')"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          icon="la:sign-in-alt"
          :label="t('common.actions.login')"
          color="primary"
          padding="xs md"
          @click="goToLogin" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

import { loginLocation } from '@/helpers/loginRedirect'

/**
 * What a guest pressing Submit Idea on a feedback board is shown: that submitting takes an account,
 * and the way to log in. The button is offered to guests rather than hidden from them, since a board
 * that looks closed to everybody not yet signed in is not asking for their ideas.
 *
 * Back to the board afterwards, as from the vote box (`FeedbackVote.vue`).
 */

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

// METHODS

function goToLogin() {
  onDialogOK()
  router.push(loginLocation(route.fullPath))
}
</script>
