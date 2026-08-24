<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-language.svg" size="sm" class="mr-2" />
        <span>{{ t('localeFetchDialog.title') }}</span>
      </w-card-section>
      <w-card-section>
        <div class="p-4 text-center">
          <img src="/_assets/illustrations/undraw_world.svg" class="mx-auto" style="width: 150px" />
        </div>
        <template v-if="state.isLoading">
          <w-linear-progress indeterminate size="lg" rounded />
          <div class="mt-2 text-center text-caption">{{ t('localeFetchDialog.loading') }}</div>
        </template>
        <div v-else-if="state.result" class="text-center">
          <strong v-if="isUpToDate" class="text-positive">{{
            t('localeFetchDialog.resultNone')
          }}</strong>
          <template v-else>
            <div v-if="state.result.added > 0" class="text-body2">
              {{
                t(
                  'localeFetchDialog.resultAdded',
                  { count: state.result.added },
                  state.result.added
                )
              }}
            </div>
            <div v-if="state.result.updated > 0" class="text-body2">
              {{
                t(
                  'localeFetchDialog.resultUpdated',
                  { count: state.result.updated },
                  state.result.updated
                )
              }}
            </div>
            <div class="text-body2 text-grey">
              {{ t('localeFetchDialog.resultUnchanged', { count: state.result.unchanged }) }}
            </div>
            <div v-if="state.result.failed > 0" class="text-body2 text-negative">
              {{ t('localeFetchDialog.resultFailed', { count: state.result.failed }) }}
            </div>
          </template>
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.close`)"
          color="grey"
          padding="xs md"
          :disabled="state.isLoading"
          @click="close" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: true,
  result: null
})

// COMPUTED

const isUpToDate = computed(
  () => state.result && state.result.added < 1 && state.result.updated < 1
)

// METHODS

async function fetchLocales() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.post('locales/fetch').json()
    state.result = {
      added: resp?.added ?? 0,
      updated: resp?.updated ?? 0,
      unchanged: resp?.unchanged ?? 0,
      failed: resp?.failed ?? 0
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('localeFetchDialog.failed'),
      caption: apiErrorMessage(err)
    })
    onDialogCancel()
  }
  state.isLoading = false
}

// MOUNTED

// -> No confirmation step: the button in the header IS the decision, and the run is cheap — one
//    small document, and only an installed locale whose hash moved is downloaded at all
onMounted(() => {
  fetchLocales()
})

// -> Anything downloaded has to reach the list behind the dialog, so a run that changed something
//    resolves rather than cancels even when the administrator closes it with the same button
function close() {
  if (state.result && (state.result.added > 0 || state.result.updated > 0)) {
    onDialogOK()
  } else {
    onDialogCancel()
  }
}
</script>
