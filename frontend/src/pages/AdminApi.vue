<template>
  <w-page class="admin-api">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-rest-api-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.api.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.api.subtitle') }}
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center">
          <template v-if="state.enabled">
            <w-signal class="mr-2" color="green" size="md" />
            <div class="text-caption text-green">{{ t('admin.api.enabled') }}</div>
          </template>
          <template v-else>
            <w-signal class="mr-2" color="red" size="md" />
            <div class="text-caption text-red">{{ t('admin.api.disabled') }}</div>
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
          :href="siteStore.docsBase + `/dev/api`"
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
          :label="!state.enabled ? t(`admin.api.enableButton`) : t(`admin.api.disableButton`)"
          :color="!state.enabled ? `positive` : `negative`"
          @click="globalSwitch"
          :loading="state.isToggleLoading"
          :disabled="state.loading > 0" />
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.api.newKeyButton`)"
          color="primary"
          @click="newKey"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12" v-if="state.keys.length < 1">
        <w-card
          class="rounded"
          flat
          :class="dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`">
          <w-card-section class="items-center" horizontal>
            <w-card-section class="flex-none pr-0">
              <w-icon name="la:info-circle" size="sm" />
            </w-card-section>
            <w-card-section class="text-caption">{{ t('admin.api.none') }}</w-card-section>
          </w-card-section>
        </w-card>
      </div>
      <div class="col-span-12" v-else>
        <w-card>
          <w-list separator>
            <w-item v-for="key of state.keys" :key="key.id">
              <w-item-section side>
                <w-icon name="la:key" :color="isUsable(key) ? `positive` : `negative`" />
              </w-item-section>
              <w-item-section>
                <w-item-label>{{ key.name }}</w-item-label>
                <w-item-label caption>{{
                  t('admin.api.keyEndingIn', { suffix: key.keyShort })
                }}</w-item-label>
                <w-item-label caption>{{
                  t('admin.api.permissionsFrom', { groups: groupNames(key) })
                }}</w-item-label>
                <w-item-label caption>{{
                  t('admin.api.createdOn', { date: humanizeDate(key.createdAt) })
                }}</w-item-label>
                <w-item-label caption>
                  <span :style="key.isRevoked ? `text-decoration: line-through;` : ``">{{
                    t('admin.api.expiresOn', { date: humanizeDate(key.expiration) })
                  }}</span>
                </w-item-label>
              </w-item-section>
              <!-- Revoked wins over expired: it is the state an operator acted on -->
              <w-item-section
                v-if="key.isRevoked || isExpired(key)"
                side
                style="flex-direction: row; align-items: center">
                <w-icon
                  class="mr-2"
                  color="negative"
                  size="xs"
                  name="la:exclamation-triangle" />
                <div class="text-caption text-negative">
                  {{ key.isRevoked ? t('admin.api.revoked') : t('admin.api.expired') }}
                </div>
                <w-tooltip anchor="center left" self="center right">{{
                  key.isRevoked ? t('admin.api.revokedHint') : t('admin.api.expiredHint')
                }}</w-tooltip>
              </w-item-section>
              <w-separator class="ml-4" vertical />
              <w-item-section side style="flex-direction: row; align-items: center">
                <w-btn
                  class="acrylic-btn"
                  :color="key.isRevoked ? `gray` : `red`"
                  icon="la:ban"
                  flat
                  :aria-label="t(`admin.api.revoke`)"
                  @click="revoke(key)"
                  :disable="key.isRevoked">
                  <w-tooltip v-if="!key.isRevoked" anchor="center left" self="center right">{{
                    t('admin.api.revoke')
                  }}</w-tooltip>
                </w-btn>
              </w-item-section>
            </w-item>
          </w-list>
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
import { dialog } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import ApiKeyCreateDialog from '../components/ApiKeyCreateDialog.vue'
import ApiKeyRevokeDialog from '../components/ApiKeyRevokeDialog.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.api.title')
})

// DATA

const state = reactive({
  enabled: false,
  loading: 0,
  isToggleLoading: false,
  keys: [],
  groups: []
})

// METHODS

function humanizeDate(val) {
  if (!val) {
    return '---'
  }
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

/** A key past its expiration still authenticates nothing, even though it was never revoked. */
function isExpired(key) {
  return (
    Temporal.Instant.compare(Temporal.Instant.from(key.expiration), Temporal.Now.instant()) <= 0
  )
}

function isUsable(key) {
  return !key.isRevoked && !isExpired(key)
}

/** Group names rather than IDs, falling back to the ID for a group that has since been deleted. */
function groupNames(key) {
  return (key.groups ?? [])
    .map((id) => state.groups.find((g) => g.id === id)?.name ?? id)
    .join(', ')
}

async function load() {
  state.loading++
  loading.show()
  try {
    // -> Groups are fetched alongside the keys so the list can name the permissions each key carries
    const [keys, apiState, groups] = await Promise.all([
      API_CLIENT.get('api-keys').json(),
      API_CLIENT.get('system/api').json(),
      API_CLIENT.get('groups').json()
    ])
    state.keys = keys ?? []
    state.groups = groups ?? []
    state.enabled = apiState?.isEnabled === true
    // -> Keeps the status light in the admin sidebar in step without another round trip
    adminStore.info.isApiEnabled = state.enabled
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.api.loadFailed'),
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
    message: t('admin.api.refreshSuccess')
  })
}

async function globalSwitch() {
  state.isToggleLoading = true
  const wanted = !state.enabled
  try {
    const resp = await API_CLIENT.put('system/api', {
      json: { isEnabled: wanted }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    notify({
      type: 'positive',
      message: wanted
        ? t('admin.api.toggleStateEnabledSuccess')
        : t('admin.api.toggleStateDisabledSuccess')
    })
    await load()
  } catch (err) {
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.api.toggleStateFailed'),
      caption: apiMessage || err.message
    })
  }
  state.isToggleLoading = false
}

async function newKey() {
  dialog({
    component: ApiKeyCreateDialog
  }).onOk(() => {
    load()
  })
}

function revoke(key) {
  dialog({
    component: ApiKeyRevokeDialog,
    componentProps: {
      apiKey: key
    }
  }).onOk(() => {
    load()
  })
}

// MOUNTED

onMounted(load)
</script>

<style lang="scss"></style>
