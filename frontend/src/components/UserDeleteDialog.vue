<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-delete-bin.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.users.deleteConfirmTitle`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t keypath="admin.users.deleteConfirmText">
            <template #username>
              <strong>{{ props.user.name }}</strong>
            </template>
          </i18n-t>
        </div>
        <!--
          Said before the attempt rather than only when it fails: a user who has written anything
          cannot be deleted at all, and finding that out from an error after confirming is finding it
          out too late to have chosen deactivation instead.
        -->
        <div class="text-body2 mt-4">{{ t(`admin.users.deleteConfirmForeignNotice`) }}</div>
        <div class="text-body2 mt-4">
          <strong class="text-negative">{{ t(`admin.users.deleteHint`) }}</strong>
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.delete`)"
          color="negative"
          padding="xs md"
          :loading="state.isDeleting"
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  user: {
    type: Object,
    required: true
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
  isDeleting: false
})

// METHODS

async function confirm() {
  state.isDeleting = true
  try {
    const resp = await API_CLIENT.delete(`users/${props.user.id}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.users.deleteSuccess', { username: props.user.name })
    })
    onDialogOK()
  } catch (err) {
    /*
      ky throws for statuses above 400, and this endpoint has several things to say through one: the
      account owns pages, it is the last root administrator, it is a system user, it is the caller's
      own. The reason is in the body, so the dialog stays open with it rather than closing on a
      failure it did not report.
    */
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.isDeleting = false
}
</script>
