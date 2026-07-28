<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-shutdown.svg" size="sm" class="mr-2" />
        <span>{{
          props.targetState ? t(`admin.sites.activate`) : t(`admin.sites.deactivate`)
        }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t
            :keypath="
              props.targetState ? `admin.sites.activateConfirm` : `admin.sites.deactivateConfirm`
            ">
            <template #siteTitle>
              <strong>{{ props.site.title }}</strong>
            </template>
          </i18n-t>
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
          :label="props.targetState ? t(`common.actions.activate`) : t(`common.actions.deactivate`)"
          :color="props.targetState ? `positive` : `negative`"
          padding="xs md"
          :loading="state.isLoading"
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { cloneDeep } from 'es-toolkit/object'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { reactive, ref } from 'vue'

import { useAdminStore } from '../stores/admin'

// PROPS

const props = defineProps({
  site: {
    type: Object,
    required: true
  },
  targetState: {
    type: Boolean,
    default: false
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: false
})

// METHODS

async function confirm() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.put(`sites/${props.site.id}`, {
      json: {
        isEnabled: props.targetState
      }
    }).json()
    if (resp?.ok) {
      notify({
        type: 'positive',
        message: t('admin.sites.updateSuccess')
      })
      adminStore.$patch({
        sites: adminStore.sites.map((s) => {
          if (s.id === props.site.id) {
            const ns = cloneDeep(s)
            ns.isEnabled = props.targetState
            return ns
          } else {
            return s
          }
        })
      })
      onDialogOK()
    } else {
      throw new Error(
        t(`admin.sites.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
