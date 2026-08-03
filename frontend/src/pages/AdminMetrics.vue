<template>
  <w-page class="admin-api">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-graph.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.metrics.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.metrics.subtitle') }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center">
          <template v-if="state.enabled">
            <w-signal class="mr-2" color="green" size="md" />
            <div class="text-caption text-green">{{ t('admin.metrics.enabled') }}</div>
          </template>
          <template v-else>
            <w-signal class="mr-2" color="red" size="md" />
            <div class="text-caption text-red">{{ t('admin.metrics.disabled') }}</div>
          </template>
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 ml-4 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/metrics`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2"
          unelevated
          icon="la:power-off"
          :label="!state.enabled ? t(`common.actions.activate`) : t(`common.actions.deactivate`)"
          :color="!state.enabled ? `positive` : `negative`"
          @click="globalSwitch"
          :loading="state.isToggleLoading"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12">
        <w-card
          class="rounded"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section>
              <i18n-t tag="span" keypath="admin.metrics.endpoint" scope="global">
                <template #endpoint><strong class="font-robotomono">/metrics</strong></template>
              </i18n-t>
              <div class="text-caption">{{ t('admin.metrics.endpointWarning') }}</div>
              <!-- The state is stored, but no route serves it yet — say so rather than let the card -->
              <!-- above read as a promise -->
              <i18n-t
                class="text-caption text-orange"
                tag="div"
                keypath="admin.metrics.notImplemented"
                scope="global">
                <template #endpoint><strong class="font-robotomono">/metrics</strong></template>
              </i18n-t>
            </w-card-section>
          </w-card-section>
        </w-card>
        <w-card
          class="rounded mt-4"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:key" size="sm" />
            </w-card-section>
            <w-card-section>
              <i18n-t tag="span" keypath="admin.metrics.auth" scope="global">
                <template #headerName>
                  <strong class="font-robotomono">Authorization</strong>
                </template>
                <template #tokenType><strong class="font-robotomono">Bearer</strong></template>
                <template #permission>
                  <strong class="font-robotomono">read:metrics</strong>
                </template>
              </i18n-t>
              <div class="text-caption font-robotomono">Authorization: Bearer API-KEY-VALUE</div>
            </w-card-section>
          </w-card-section>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.metrics.title')
})

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  isToggleLoading: false
})

// METHODS

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get('system/metrics').json()
    state.enabled = resp?.isEnabled === true
    // -> Keeps the status light in the admin sidebar in step without another round trip
    adminStore.info.isMetricsEnabled = state.enabled
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.metrics.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function refresh() {
  await load()
  notify({
    type: 'positive',
    message: t('admin.metrics.refreshSuccess')
  })
}

async function globalSwitch() {
  state.isToggleLoading = true
  const wanted = !state.enabled
  try {
    const resp = await API_CLIENT.put('system/metrics', {
      json: { isEnabled: wanted }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: wanted
        ? t('admin.metrics.toggleStateEnabledSuccess')
        : t('admin.metrics.toggleStateDisabledSuccess')
    })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.metrics.toggleStateFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.isToggleLoading = false
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss"></style>
