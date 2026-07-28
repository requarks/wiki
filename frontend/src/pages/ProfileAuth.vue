<template>
  <w-page class="py-4">
    <div class="text-header">{{ t('profile.auth') }}</div>
    <div class="p-4">
      <div class="text-body2">{{ t('profile.authInfo') }}</div>
      <w-list class="mt-6" bordered separator>
        <w-item v-for="auth of state.authMethods" :key="auth.id">
          <w-item-section avatar>
            <w-avatar color="dark-5" text-color="white" rounded>
              <w-icon :name="`img:` + auth.strategyIcon" />
            </w-avatar>
          </w-item-section>
          <w-item-section>
            <strong>{{ auth.authName }}</strong>
          </w-item-section>
          <template v-if="auth.strategyKey === `local`">
            <w-item-section v-if="auth.config.isTfaSetup" side>
              <w-btn
                icon="la:fingerprint"
                unelevated
                :label="t(`profile.authDisableTfa`)"
                color="negative"
                :disable="auth.config.isTfaRequired"
                @click="disableTfa(auth.authId)" />
            </w-item-section>
            <w-item-section v-else side>
              <w-btn
                icon="la:fingerprint"
                unelevated
                :label="t(`profile.authSetTfa`)"
                color="primary"
                @click="setupTfa(auth.authId)" />
            </w-item-section>
            <w-item-section side>
              <w-btn
                icon="la:key"
                unelevated
                :label="t(`profile.authChangePassword`)"
                color="primary"
                @click="changePassword(auth.authId)" />
            </w-item-section>
          </template>
        </w-item>
      </w-list>
    </div>

    <div class="text-header mt-4">{{ t('profile.passkeys') }}</div>
    <div class="p-4">
      <div class="text-body2">{{ t('profile.passkeysIntro') }}</div>
      <w-list v-if="state.passkeys?.length > 0" class="mt-6" bordered separator>
        <w-item v-for="pkey of state.passkeys" :key="pkey.id">
          <w-item-section avatar>
            <w-avatar color="secondary" text-color="white" rounded>
              <w-icon name="la:key" />
            </w-avatar>
          </w-item-section>
          <w-item-section>
            <strong>{{ pkey.name }}</strong>
            <div class="text-caption">{{ pkey.siteHostname }}</div>
            <div class="text-caption text-grey-7">{{ humanizeDate(pkey.createdAt) }}</div>
          </w-item-section>
          <w-item-section side>
            <w-btn
              class="acrylic-btn"
              flat
              icon="la:trash"
              :aria-label="t(`common.actions.delete`)"
              color="negative"
              @click="deactivatePasskey(pkey)" />
          </w-item-section>
        </w-item>
      </w-list>
      <div class="mt-4">
        <w-btn
          icon="la:plus"
          unelevated
          :label="t(`profile.passkeysAdd`)"
          color="primary"
          @click="setupPasskey" />
      </div>
    </div>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'
import { onMounted, reactive } from 'vue'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { localizeError } from '@/helpers/localization'
import { DateTime } from 'luxon'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import ChangePwdDialog from '@/components/ChangePwdDialog.vue'
import SetupTfaDialog from '@/components/SetupTfaDialog.vue'
import PasskeyCreateDialog from '@/components/PasskeyCreateDialog.vue'

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

function humanizeDate(val) {
  return DateTime.fromISO(val).toLocaleString(DateTime.DATETIME_MED)
}

async function fetchAuthMethods() {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.query({
      query: `
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
    notify({
      type: 'negative',
      message: t('profile.authLoadingFailed'),
      caption: err.message
    })
  }
  state.loading--
}

function changePassword(strategyId) {
  dialog({
    component: ChangePwdDialog,
    componentProps: {
      strategyId
    }
  })
}

function disableTfa(strategyId) {
  dialog({
    title: t('common.actions.confirm'),
    message: t('profile.authDisableTfaConfirm'),
    cancel: true
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: `
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
        notify({
          type: 'positive',
          message: t('profile.authDisableTfaSuccess')
        })
      } else {
        throw new Error(resp?.data?.deactivateTFA?.operation?.message)
      }
    } catch (err) {
      notify({
        type: 'negative',
        message: t('profile.authDisableTfaFailed'),
        caption: err.message ?? 'An unexpected error occured.'
      })
    }
    await fetchAuthMethods()
    loading.hide()
  })
}

function setupTfa(strategyId) {
  dialog({
    component: SetupTfaDialog,
    componentProps: {
      strategyId
    }
  }).onOk(() => {
    fetchAuthMethods()
  })
}

async function setupPasskey() {
  try {
    if (!browserSupportsWebAuthn()) {
      throw new Error(t('profile.passkeysUnsupported'))
    }
    loading.show()

    // -> Generation registration options

    const genResp = await APOLLO_CLIENT.mutate({
      mutation: `
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

    loading.hide()
    const passkeyName = await new Promise((resolve, reject) => {
      dialog({
        component: PasskeyCreateDialog
      })
        .onOk(({ name }) => {
          resolve(name)
        })
        .onCancel(() => {
          reject(new Error(t('error.ERR_PK_USER_CANCELLED')))
        })
    })
    loading.show()

    // -> Verify the authenticator response

    const resp = await APOLLO_CLIENT.mutate({
      mutation: `
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
      notify({
        type: 'positive',
        message: t('profile.passkeysSetupSuccess')
      })
    } else {
      throw new Error(resp?.data?.finalizePasskey?.operation?.message)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.passkeysSetupFailed'),
      caption: err.message ?? 'An unexpected error occured.'
    })
  }
  await fetchAuthMethods()
  loading.hide()
}

async function deactivatePasskey(pkey) {
  dialog({
    title: t('common.actions.confirm'),
    message: t('profile.passkeysDeactivateConfirm'),
    cancel: true
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await APOLLO_CLIENT.mutate({
        mutation: `
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
        notify({
          type: 'positive',
          message: t('profile.passkeysDeactivateSuccess')
        })
      } else {
        throw new Error(resp?.data?.deactivatePasskey?.operation?.message)
      }
    } catch (err) {
      notify({
        type: 'negative',
        message: t('profile.passkeysDeactivateFailed'),
        caption: err.message ?? 'An unexpected error occured.'
      })
    }
    await fetchAuthMethods()
    loading.hide()
  })
}

// MOUNTED

onMounted(() => {
  fetchAuthMethods()
})
</script>
