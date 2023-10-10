<template lang="pug">
q-page.q-py-md(:style-fn='pageStyle')
  .text-header {{t('profile.auth')}}
  .q-pa-md
    .text-body2 {{ t('profile.authInfo') }}
    q-list.q-mt-lg(
      bordered
      separator
      )
      q-item(
        v-for='auth of state.authMethods'
        :key='auth.id'
        )
        q-item-section(avatar)
          q-avatar(
            color='dark-5'
            text-color='white'
            rounded
            )
            q-icon(:name='`img:` + auth.strategyIcon')
        q-item-section
          strong {{auth.authName}}
        template(v-if='auth.strategyKey === `local`')
          q-item-section(v-if='auth.config.isTfaSetup', side)
            q-btn(
              icon='las la-fingerprint'
              unelevated
              :label='t(`profile.authDisableTfa`)'
              color='negative'
              @click='disableTfa(auth.authId)'
              :disable='auth.config.isTfaRequired'
            )
          q-item-section(v-else, side)
            q-btn(
              icon='las la-fingerprint'
              unelevated
              :label='t(`profile.authSetTfa`)'
              color='primary'
              @click='setupTfa(auth.authId)'
            )
          q-item-section(side)
            q-btn(
              icon='las la-key'
              unelevated
              :label='t(`profile.authChangePassword`)'
              color='primary'
              @click='changePassword(auth.authId)'
            )

  .text-header.q-mt-md {{t('profile.passkeys')}}
  .q-pa-md
    .text-body2 {{ t('profile.passkeysIntro') }}
    q-list.q-mt-lg(
      v-if="state.passkeys?.length > 0"
      bordered
      separator
      )
      q-item(
        v-for='pkey of state.passkeys'
        :key='pkey.id'
        )
        q-item-section(avatar)
          q-avatar(
            color='secondary'
            text-color='white'
            rounded
            )
            q-icon(name='las la-key')
        q-item-section
          strong {{pkey.name}}
          .text-caption {{ pkey.siteHostname }}
          .text-caption.text-grey-7 {{ humanizeDate(pkey.createdAt) }}
        q-item-section(side)
          q-btn.acrylic-btn(
            flat
            icon='las la-trash'
            :aria-label='t(`common.actions.delete`)'
            color='negative'
            @click='deactivatePasskey(pkey)'
          )
    .q-mt-md
      q-btn(
        icon='las la-plus'
        unelevated
        :label='t(`profile.passkeysAdd`)'
        color='primary'
        @click='setupPasskey'
      )

  q-inner-loading(:showing='state.loading > 0')
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { localizeError } from 'src/helpers/localization'
import { DateTime } from 'luxon'

import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

import ChangePwdDialog from 'src/components/ChangePwdDialog.vue'
import SetupTfaDialog from 'src/components/SetupTfaDialog.vue'
import PasskeyCreateDialog from 'src/components/PasskeyCreateDialog.vue'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('profile.auth')
})

// DATA

const state = reactive({
  authMethods: [],
  passkeys: [],
  loading: 0
})

// METHODS

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}

function humanizeDate (val) {
  return DateTime.fromISO(val).toLocaleString(DateTime.DATETIME_MED)
}

async function fetchAuthMethods () {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.query({
      query: gql`
        query getUserProfileAuthMethods (
          $id: UUID!
        ) {
          userById (
            id: $id
          ) {
            id
            auth {
              authId
              authName
              strategyKey
              strategyIcon
              config
            }
            passkeys {
              id
              name
              createdAt
              siteHostname
            }
          }
        }
      `,
      variables: {
        id: userStore.id
      },
      fetchPolicy: 'network-only'
    })
    state.authMethods = respRaw.data?.userById?.auth ?? []
    state.passkeys = respRaw.data?.userById?.passkeys ?? []
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('profile.authLoadingFailed'),
      caption: err.message
    })
  }
  state.loading--
}

function changePassword (strategyId) {
  $q.dialog({
    component: ChangePwdDialog,
    componentProps: {
      strategyId
    }
  })
}

function disableTfa (strategyId) {
  $q.dialog({
    title: t('common.actions.confirm'),
    message: t('profile.authDisableTfaConfirm'),
    cancel: true
  }).onOk(async () => {
    $q.loading.show()
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation deactivateTfa (
            $strategyId: UUID!
          ) {
            deactivateTFA(
              strategyId: $strategyId
            ) {
              operation {
                succeeded
                message
              }
            }
          }
        `,
        variables: {
          strategyId
        }
      })
      if (resp?.data?.deactivateTFA?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('profile.authDisableTfaSuccess')
        })
      } else {
        throw new Error(resp?.data?.deactivateTFA?.operation?.message)
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('profile.authDisableTfaFailed'),
        caption: err.message ?? 'An unexpected error occured.'
      })
    }
    await fetchAuthMethods()
    $q.loading.hide()
  })
}

function setupTfa (strategyId) {
  $q.dialog({
    component: SetupTfaDialog,
    componentProps: {
      strategyId
    }
  }).onOk(() => {
    fetchAuthMethods()
  })
}

async function setupPasskey () {
  try {
    if (!browserSupportsWebAuthn()) {
      throw new Error(t('profile.passkeysUnsupported'))
    }
    $q.loading.show()

    // -> Generation registration options

    const genResp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation setupPasskey (
          $siteId: UUID!
        ) {
          setupPasskey(
            siteId: $siteId
          ) {
            operation {
              succeeded
              message
            }
            registrationOptions
          }
        }
      `,
      variables: {
        siteId: siteStore.id
      }
    })
    if (genResp?.data?.setupPasskey?.operation?.succeeded) {
      state.registrationOptions = genResp.data.setupPasskey.registrationOptions
    } else {
      throw new Error(localizeError(genResp?.data?.setupPasskey?.operation?.message, t))
    }

    // -> Start registration on the authenticator

    let attResp
    try {
      attResp = await startRegistration(state.registrationOptions)
    } catch (err) {
      if (err.name === 'InvalidStateError') {
        throw new Error(t('error.ERR_PK_ALREADY_REGISTERED'))
      } else {
        throw err
      }
    }

    // -> Prompt for passkey name

    $q.loading.hide()
    const passkeyName = await new Promise((resolve, reject) => {
      $q.dialog({
        component: PasskeyCreateDialog
      }).onOk(({ name }) => {
        resolve(name)
      }).onCancel(() => {
        reject(new Error(t('error.ERR_PK_USER_CANCELLED')))
      })
    })
    $q.loading.show()

    // -> Verify the authenticator response

    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation finalizePasskey (
          $registrationResponse: JSON!
          $name: String!
        ) {
          finalizePasskey(
            registrationResponse: $registrationResponse
            name: $name
          ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        registrationResponse: attResp,
        name: passkeyName
      }
    })
    if (resp?.data?.finalizePasskey?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('profile.passkeysSetupSuccess')
      })
    } else {
      throw new Error(resp?.data?.finalizePasskey?.operation?.message)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('profile.passkeysSetupFailed'),
      caption: err.message ?? 'An unexpected error occured.'
    })
  }
  await fetchAuthMethods()
  $q.loading.hide()
}

async function deactivatePasskey (pkey) {
  $q.dialog({
    title: t('common.actions.confirm'),
    message: t('profile.passkeysDeactivateConfirm'),
    cancel: true
  }).onOk(async () => {
    $q.loading.show()
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: gql`
          mutation deactivatePasskey (
            $id: UUID!
          ) {
            deactivatePasskey(
              id: $id
            ) {
              operation {
                succeeded
                message
              }
            }
          }
        `,
        variables: {
          id: pkey.id
        }
      })
      if (resp?.data?.deactivatePasskey?.operation?.succeeded) {
        $q.notify({
          type: 'positive',
          message: t('profile.passkeysDeactivateSuccess')
        })
      } else {
        throw new Error(resp?.data?.deactivatePasskey?.operation?.message)
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('profile.passkeysDeactivateFailed'),
        caption: err.message ?? 'An unexpected error occured.'
      })
    }
    await fetchAuthMethods()
    $q.loading.hide()
  })
}

// MOUNTED

onMounted(() => {
  fetchAuthMethods()
})

</script>
