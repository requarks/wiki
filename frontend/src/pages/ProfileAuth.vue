<template>
  <w-page class="py-4">
    <div class="w-section-header">{{ t('profile.auth') }}</div>
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
            <div v-if="!auth.config.isPasswordLoginEnabled" class="text-caption text-negative">
              {{ t('profile.authPasswordLoginOff') }}
            </div>
            <!--
              A disabled button with no reason next to it reads as a bug. This is the reason: the
              server refuses to turn password login off while it is the only way into the account.
            -->
            <div
              v-else-if="auth.strategyKey === `local` && !auth.config.canDisablePasswordLogin"
              class="text-caption text-grey">
              {{ t('profile.authPasswordLoginOnlyMethod') }}
            </div>
          </w-item-section>
          <!--
            One trigger rather than a row of buttons: these are occasional actions on a row that also
            has to stay readable, and a `w-item` puts every `side` section on the same line.
          -->
          <w-item-section v-if="auth.strategyKey === `local`" side>
            <div class="flex items-center gap-3">
              <!--
                Says at a glance that the account is protected, without opening the menu to find out.
                Only shown when 2FA is on: the absence of a badge is not a warning, since 2FA is
                optional unless an administrator requires it.
              -->
              <w-badge
                v-if="auth.config.isTfaSetup"
                class="gap-1"
                color="positive"
                rounded
                :title="t('profile.authTfaActive')">
                <w-icon name="la:check" />
                <span>{{ t('profile.authTfaBadge') }}</span>
              </w-badge>
              <!--
                Shaped like the Delete button on a passkey row -- same acrylic tint, drawn in the
                brand blue instead of the negative red, which `acrylic-btn` picks up on its own since
                it mixes its background out of `currentcolor`.
              -->
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:cog"
                color="primary"
                :aria-label="t(`profile.authActions`)">
                <w-menu class="translucent-menu" auto-close anchor="bottom right" self="top right">
                  <!--
                  `!min-w-0 !pr-2` on each icon section: an avatar section is a 56px column with 16px
                  of padding after it, which is the right metric for a 40px avatar in a list row and
                  far too much air beside a 24px icon in a menu. Both rules are scoped styles in
                  WItemSection, hence `!` -- a layered utility cannot outrank them.

                  The colours are literal classes rather than WIcon's `color` prop: that prop builds
                  `text-${color}` at runtime, and Tailwind only emits a utility it can see spelled out
                  in the source, so `color="blue-7"` would compile to a class that does not exist.
                -->
                  <w-list dense padding style="min-width: 240px">
                    <w-item clickable @click="changePassword(auth.authId)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:key" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('profile.authChangePassword') }}</w-item-section>
                    </w-item>
                    <w-item
                      v-if="auth.config.isTfaSetup"
                      clickable
                      @click="disableTfa(auth.authId)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:fingerprint" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('profile.authDisableTfa') }}</w-item-section>
                    </w-item>
                    <w-item v-else clickable @click="setupTfa(auth.authId)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:fingerprint" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('profile.authSetTfa') }}</w-item-section>
                    </w-item>
                    <w-separator class="my-2" />
                    <w-item
                      v-if="auth.config.isPasswordLoginEnabled"
                      clickable
                      :disabled="!auth.config.canDisablePasswordLogin"
                      @click="disablePasswordLogin(auth.authId)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:ban" class="text-negative" />
                      </w-item-section>
                      <w-item-section class="text-negative">
                        {{ t('profile.authDisablePasswordLogin') }}
                      </w-item-section>
                    </w-item>
                    <w-item v-else clickable @click="enablePasswordLogin(auth.authId)">
                      <w-item-section avatar class="!min-w-0 !pr-2">
                        <w-icon name="la:redo" class="text-blue-7" />
                      </w-item-section>
                      <w-item-section>{{ t('profile.authEnablePasswordLogin') }}</w-item-section>
                    </w-item>
                  </w-list>
                </w-menu>
              </w-btn>
            </div>
          </w-item-section>
        </w-item>
      </w-list>
    </div>

    <div class="w-section-header mt-4">{{ t('profile.passkeys') }}</div>
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
import { confirm, dialog } from '@/composables/dialog'
import { onMounted, reactive } from 'vue'
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser'
import { localizeError } from '@/helpers/localization'

import ChangePwdDialog from '@/components/ChangePwdDialog.vue'
import SetupTfaDialog from '@/components/SetupTfaDialog.vue'
import PasskeyCreateDialog from '@/components/PasskeyCreateDialog.vue'

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

/**
 * The reason the API gave, out of a response ky threw on (anything above 400) or out of the error
 * itself when the request never got an answer. An `ERR_*` code is translated on the way out.
 */
async function apiMessage(err) {
  const message =
    (await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)) ?? err.message
  return localizeError(message, t)
}

function humanizeDate(val) {
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

async function fetchAuthMethods() {
  state.loading++
  try {
    const resp = await API_CLIENT.get('users/profile/auth').json()
    state.authMethods = resp?.authMethods ?? []
    state.passkeys = resp?.passkeys ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.authLoadingFailed'),
      caption: await apiMessage(err)
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
  confirm({
    title: t('common.actions.confirm'),
    message: t('profile.authDisableTfaConfirm'),
    cancel: true,
    color: 'negative',
    okLabel: t('profile.authDisableTfa')
  }).onOk(async () => {
    loading.show()
    try {
      // -> Answers 204, so there is no body to read — only whether it succeeded
      const resp = await API_CLIENT.delete(`users/profile/tfa/${strategyId}`)
      if (!resp?.ok) {
        throw new Error(localizeError((await resp.json())?.message, t))
      }
      notify({
        type: 'positive',
        message: t('profile.authDisableTfaSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('profile.authDisableTfaFailed'),
        caption: await apiMessage(err)
      })
    }
    await fetchAuthMethods()
    loading.hide()
  })
}

function disablePasswordLogin(strategyId) {
  confirm({
    title: t('common.actions.confirm'),
    message: t('profile.authDisablePasswordLoginConfirm'),
    cancel: true,
    color: 'negative',
    okLabel: t('profile.authDisablePasswordLogin')
  }).onOk(() => setPasswordLogin(strategyId, false))
}

function enablePasswordLogin(strategyId) {
  setPasswordLogin(strategyId, true)
}

async function setPasswordLogin(strategyId, isEnabled) {
  loading.show()
  try {
    const resp = await API_CLIENT.put('users/profile/password-login', {
      json: {
        strategyId,
        isEnabled
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(localizeError(resp?.message, t))
    }
    notify({
      type: 'positive',
      message: isEnabled
        ? t('profile.authEnablePasswordLoginSuccess')
        : t('profile.authDisablePasswordLoginSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: isEnabled
        ? t('profile.authEnablePasswordLoginFailed')
        : t('profile.authDisablePasswordLoginFailed'),
      caption: await apiMessage(err)
    })
  }
  await fetchAuthMethods()
  loading.hide()
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

    // -> Generate registration options

    const genResp = await API_CLIENT.post('users/profile/passkeys/challenge').json()
    if (!genResp?.ok) {
      throw new Error(localizeError(genResp?.message, t))
    }

    // -> Start registration on the authenticator

    let attResp
    try {
      attResp = await startRegistration({ optionsJSON: genResp.registrationOptions })
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

    const resp = await API_CLIENT.post('users/profile/passkeys', {
      json: {
        name: passkeyName,
        registrationResponse: attResp
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(localizeError(resp?.message, t))
    }
    notify({
      type: 'positive',
      message: t('profile.passkeysSetupSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.passkeysSetupFailed'),
      caption: await apiMessage(err)
    })
  }
  await fetchAuthMethods()
  loading.hide()
}

async function deactivatePasskey(pkey) {
  confirm({
    title: t('common.actions.confirm'),
    message: t('profile.passkeysDeactivateConfirm'),
    cancel: true,
    color: 'negative',
    okLabel: t('common.actions.delete')
  }).onOk(async () => {
    loading.show()
    try {
      const resp = await API_CLIENT.delete(`users/profile/passkeys/${encodeURIComponent(pkey.id)}`)
      if (!resp?.ok) {
        throw new Error(localizeError((await resp.json())?.message, t))
      }
      notify({
        type: 'positive',
        message: t('profile.passkeysDeactivateSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('profile.passkeysDeactivateFailed'),
        caption: await apiMessage(err)
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
