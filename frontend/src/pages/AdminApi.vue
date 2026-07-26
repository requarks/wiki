<template lang='pug'>
q-page.admin-api
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-rest-api-animated.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.api.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.api.subtitle') }}
    .col
      .flex.items-center
        template(v-if='state.enabled')
          q-spinner-rings.q-mr-sm(color='green', size='md')
          .text-caption.text-green {{t('admin.api.enabled')}}
        template(v-else)
          q-spinner-rings.q-mr-sm(color='red', size='md')
          .text-caption.text-red {{t('admin.api.disabled')}}
    .col-auto
      q-btn.q-mr-sm.q-ml-md.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/dev/api`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='refresh'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn.q-mr-sm(
        unelevated
        icon='las la-power-off'
        :label='!state.enabled ? t(`admin.api.enableButton`) : t(`admin.api.disableButton`)'
        :color='!state.enabled ? `positive` : `negative`'
        @click='globalSwitch'
        :loading='state.isToggleLoading'
        :disabled='state.loading > 0'
      )
      q-btn(
        unelevated
        icon='las la-plus'
        :label='t(`admin.api.newKeyButton`)'
        color='primary'
        @click='newKey'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12(v-if='state.keys.length < 1')
      q-card.rounded-borders(
        flat
        :class='$q.dark.isActive ? `bg-dark-5 text-white` : `bg-grey-3 text-dark`'
        )
        q-card-section.items-center(horizontal)
          q-card-section.col-auto.q-pr-none
            q-icon(name='las la-info-circle', size='sm')
          q-card-section.text-caption {{ t('admin.api.none') }}
    .col-12(v-else)
      q-card
        q-list(separator)
          q-item(v-for='key of state.keys', :key='key.id')
            q-item-section(side)
              q-icon(name='las la-key', :color='isUsable(key) ? `positive` : `negative`')
            q-item-section
              q-item-label {{key.name}}
              q-item-label(caption) {{ t('admin.api.keyEndingIn', { suffix: key.keyShort }) }}
              q-item-label(caption) {{ t('admin.api.permissionsFrom', { groups: groupNames(key) }) }}
              q-item-label(caption) {{ t('admin.api.createdOn', { date: humanizeDate(key.createdAt) }) }}
              q-item-label(caption)
                span(:style='key.isRevoked ? `text-decoration: line-through;` : ``')
                  | {{ t('admin.api.expiresOn', { date: humanizeDate(key.expiration) }) }}
            //- Revoked wins over expired: it is the state an operator acted on
            q-item-section(
              v-if='key.isRevoked || isExpired(key)'
              side
              style='flex-direction: row; align-items: center;'
              )
              q-icon.q-mr-sm(
                color='negative'
                size='xs'
                name='las la-exclamation-triangle'
              )
              .text-caption.text-negative {{ key.isRevoked ? t('admin.api.revoked') : t('admin.api.expired') }}
              q-tooltip(anchor='center left', self='center right') {{ key.isRevoked ? t('admin.api.revokedHint') : t('admin.api.expiredHint') }}
            q-separator.q-ml-md(vertical)
            q-item-section(side, style='flex-direction: row; align-items: center;')
              q-btn.acrylic-btn(
                :color='key.isRevoked ? `gray` : `red`'
                icon='las la-ban'
                flat
                :aria-label='t(`admin.api.revoke`)'
                @click='revoke(key)'
                :disable='key.isRevoked'
              )
                q-tooltip(v-if='!key.isRevoked', anchor='center left', self='center right') {{ t('admin.api.revoke') }}
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'

import ApiKeyCreateDialog from '../components/ApiKeyCreateDialog.vue'
import ApiKeyRevokeDialog from '../components/ApiKeyRevokeDialog.vue'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

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

function humanizeDate (val) {
  if (!val) { return '---' }
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
function isExpired (key) {
  return Temporal.Instant.compare(Temporal.Instant.from(key.expiration), Temporal.Now.instant()) <= 0
}

function isUsable (key) {
  return !key.isRevoked && !isExpired(key)
}

/** Group names rather than IDs, falling back to the ID for a group that has since been deleted. */
function groupNames (key) {
  return (key.groups ?? [])
    .map(id => state.groups.find(g => g.id === id)?.name ?? id)
    .join(', ')
}

async function load () {
  state.loading++
  $q.loading.show()
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
    $q.notify({
      type: 'negative',
      message: t('admin.api.loadFailed'),
      caption: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

async function refresh () {
  await load()
  $q.notify({
    type: 'positive',
    message: t('admin.api.refreshSuccess')
  })
}

async function globalSwitch () {
  state.isToggleLoading = true
  const wanted = !state.enabled
  try {
    const resp = await API_CLIENT.put('system/api', {
      json: { isEnabled: wanted }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occurred.')
    }
    $q.notify({
      type: 'positive',
      message: wanted ? t('admin.api.toggleStateEnabledSuccess') : t('admin.api.toggleStateDisabledSuccess')
    })
    await load()
  } catch (err) {
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: t('admin.api.toggleStateFailed'),
      caption: apiMessage || err.message
    })
  }
  state.isToggleLoading = false
}

async function newKey () {
  $q.dialog({
    component: ApiKeyCreateDialog
  }).onOk(() => {
    load()
  })
}

function revoke (key) {
  $q.dialog({
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

<style lang='scss'>

</style>
