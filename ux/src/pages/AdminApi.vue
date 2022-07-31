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
        href='https://docs.js.wiki/admin/api'
        target='_blank'
        type='a'
        )
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='refresh'
        )
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
              q-icon(name='las la-key', :color='key.isRevoked ? `negative` : `positive`')
            q-item-section
              q-item-label {{key.name}}
              q-item-label(caption) Ending in {{key.keyShort}}
              q-item-label(caption) Created On: #[strong {{DateTime.fromISO(key.createdAt).toFormat('fff')}}]
              q-item-label(caption) Expiration: #[strong(:style='key.isRevoked ? `text-decoration: line-through;` : ``') {{DateTime.fromISO(key.expiration).toFormat('fff')}}]
            q-item-section(
              v-if='key.isRevoked'
              side
              style='flex-direction: row; align-items: center;'
              )
              q-icon.q-mr-sm(
                color='negative'
                size='xs'
                name='las la-exclamation-triangle'
              )
              .text-caption.text-negative {{t('admin.api.revoked')}}
              q-tooltip(anchor='center left', self='center right') {{t('admin.api.revokedHint')}}
            q-separator.q-ml-md(vertical)
            q-item-section(side, style='flex-direction: row; align-items: center;')
              q-btn.acrylic-btn(
                :color='key.isRevoked ? `gray` : `red`'
                icon='las la-ban'
                flat
                @click='revoke(key)'
                :disable='key.isRevoked'
              )
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'
import { DateTime } from 'luxon'

import ApiKeyCreateDialog from '../components/ApiKeyCreateDialog.vue'
import ApiKeyRevokeDialog from '../components/ApiKeyRevokeDialog.vue'

// QUASAR

const $q = useQuasar()

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
  isCreateDialogShown: false,
  isRevokeConfirmDialogShown: false,
  revokeLoading: false,
  current: {}
})

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query getApiKeys {
        apiKeys {
          id
          name
          keyShort
          expiration
          isRevoked
          createdAt
          updatedAt
        }
        apiState
      }
    `,
    fetchPolicy: 'network-only'
  })
  state.keys = cloneDeep(resp?.data?.apiKeys) ?? []
  state.enabled = resp?.data?.apiState === true
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
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation ($enabled: Boolean!) {
          setApiState (enabled: $enabled) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        enabled: !state.enabled
      }
    })
    if (resp?.data?.setApiState?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: state.enabled ? t('admin.api.toggleStateDisabledSuccess') : t('admin.api.toggleStateEnabledSuccess')
      })
      await load()
    } else {
      throw new Error(resp?.data?.setApiState?.operation?.message || 'An unexpected error occurred.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to switch API state.',
      caption: err.message
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
