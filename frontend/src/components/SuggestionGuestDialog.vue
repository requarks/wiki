<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 550px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-inspection.svg" size="sm" class="mr-2" />
        <span>{{ t(`common.page.suggestIdentifyTitle`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">{{ t('common.page.suggestIdentifyHint') }}</div>
      </w-card-section>
      <w-form ref="guestForm" class="py-2" @submit="submit">
        <!--
          No `self-start` on these icons. A field's control carries a symmetric `my-2` -- room for the
          floated label, matched underneath precisely so the box stays centred on the control -- so
          letting both sections centre in the row is what lines the icon up with the field.
        -->
        <w-item>
          <blueprint-icon icon="contact" />
          <w-item-section>
            <w-input
              ref="iptName"
              v-model="state.name"
              outlined
              dense
              :rules="nameValidation"
              hide-bottom-space
              :label="t(`common.page.suggestName`)"
              autocomplete="name"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="envelope" />
          <w-item-section>
            <w-input
              v-model="state.email"
              outlined
              dense
              type="email"
              :rules="emailValidation"
              hide-bottom-space
              :label="t(`common.page.suggestEmail`)"
              :hint="t(`common.page.suggestEmailHint`)"
              autocomplete="email"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
      </w-form>
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
          :label="t(`common.actions.submitEdits`)"
          color="positive"
          padding="xs md"
          @click="submit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive, ref } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

/**
 * Who is suggesting this edit, asked of a reader with no account.
 *
 * A logged in author is already known, so this never opens for one. For everybody else it is the only
 * record of where the suggestion came from, which is what lets a reviewer answer them.
 */

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptName.value
})

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  name: '',
  email: ''
})

// REFS

const guestForm = ref(null)
const iptName = ref(null)

// VALIDATION RULES

const nameValidation = [(val) => (val ?? '').trim().length > 0 || t('auth.errors.missingName')]

const emailValidation = [
  (val) => (val ?? '').trim().length > 0 || t('auth.errors.missingEmail'),
  (val) => /^.+@.+\..+$/.test(val) || t('auth.errors.invalidEmail')
]

// METHODS

async function submit() {
  if (!(await guestForm.value.validate(true))) {
    return
  }
  onDialogOK({ guestName: state.name.trim(), guestEmail: state.email.trim() })
}
</script>
