<template>
  <w-menu
    class="translucent-menu"
    anchor="bottom right"
    self="top right"
    :offset="[0, 10]"
    ref="menuRef"
    @show="load">
    <w-card style="width: 620px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-event-log.svg" left size="sm" />
        <span>{{ t('admin.audit.retention') }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2 text-black/60 dark:text-white/70">
          {{ t('admin.audit.retentionHint') }}
        </div>
        <!--
          Said here rather than left for somebody to discover by being refused: the options below
          simply stop at 30 days, and a floor with no reason given reads as an oversight.
        -->
        <div class="text-body2 mt-2 text-black/60 dark:text-white/70">
          {{ t('admin.audit.retentionFloorHint') }}
        </div>
        <div class="mt-4">
          <w-select
            outlined
            dense
            v-model="state.retentionDays"
            :options="retentionOptions"
            emit-value
            map-options
            :label="t('admin.audit.retentionPeriod')" />
        </div>
        <!--
          What is actually in the table, so that "keep 90 days" is chosen against a real number
          rather than in the abstract. Nothing is deleted by saving — the daily task is what applies
          it — and the copy says so.
        -->
        <div class="text-caption text-grey mt-4">
          <i18n-t keypath="admin.audit.retentionStats" tag="span">
            <template #count
              ><strong>{{ state.total }}</strong></template
            >
            <template #oldest
              ><strong>{{
                state.oldestEntry ? userStore.formatDateTime(t, state.oldestEntry) : '---'
              }}</strong></template
            >
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
          @click="close" />
        <w-btn
          unelevated
          :label="t(`common.actions.save`)"
          color="primary"
          padding="xs md"
          @click="save" />
      </w-card-actions>
      <w-inner-loading :showing="state.loading > 0" />
    </w-card>
  </w-menu>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { useUserStore } from '@/stores/user'

// I18N

const { t } = useI18n()

// STORES

const userStore = useUserStore()

// REFS

const menuRef = ref(null)

// DATA

const state = reactive({
  retentionDays: 90,
  total: 0,
  oldestEntry: null,
  loading: 0
})

// COMPUTED

/*
  Fixed periods rather than a free number: this is a compliance decision made once, and a typo in a
  days field silently throws away years of log. Zero is offered last and named for what it does.
*/
const retentionOptions = computed(() => [
  { label: t('admin.audit.retention30'), value: 30 },
  { label: t('admin.audit.retention90'), value: 90 },
  { label: t('admin.audit.retention180'), value: 180 },
  { label: t('admin.audit.retention365'), value: 365 },
  { label: t('admin.audit.retention730'), value: 730 },
  { label: t('admin.audit.retentionForever'), value: 0 }
])

// METHODS

async function load() {
  state.loading++
  try {
    const resp = await API_CLIENT.get('audit/config').json()
    state.retentionDays = resp?.retentionDays ?? 90
    state.total = resp?.total ?? 0
    state.oldestEntry = resp?.oldestEntry ?? null
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.audit.retentionLoadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

async function save() {
  state.loading++
  try {
    await API_CLIENT.put('audit/config', {
      json: { retentionDays: state.retentionDays }
    }).json()
    notify({
      type: 'positive',
      message: t('admin.audit.retentionSaveSuccess')
    })
    close()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.audit.retentionSaveFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

function close() {
  menuRef.value?.hide()
}
</script>
