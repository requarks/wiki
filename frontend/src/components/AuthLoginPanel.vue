<template>
  <div>
    <!-- ----------------------------------------------------- -->
    <!-- LOGIN SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-if="state.screen === `login`">
      <template v-if="formStrategies.length > 1">
        <p>{{ t('auth.selectAuthProvider') }}</p>
        <div class="auth-strategies mb-4">
          <w-btn
            v-for="str of formStrategies"
            :label="str.activeStrategy.displayName"
            :icon="`img:` + str.activeStrategy.strategy.icon"
            push
            no-caps
            :color="
              str.id === state.selectedStrategyId
                ? `primary`
                : dark.isActive
                  ? `blue-grey-9`
                  : `grey-1`
            "
            :text-color="
              str.id === state.selectedStrategyId || dark.isActive ? `white` : `blue-grey-9`
            "
            @click="state.selectedStrategyId = str.id" />
        </div>
      </template>
      <w-form ref="loginForm" @submit="login">
        <w-input
          ref="loginEmailIpt"
          v-model="state.username"
          autofocus
          outlined
          :label="
            t(`auth.fields.` + (selectedStrategy.activeStrategy?.strategy?.usernameType ?? `email`))
          "
          :rules="
            selectedStrategy.activeStrategy?.strategy?.usernameType === `username`
              ? loginUsernameValidation
              : userEmailValidation
          "
          lazy-rules="ondemand"
          hide-bottom-space
          :autocomplete="selectedStrategy.activeStrategy?.strategy?.usernameType ?? `email`">
          <template #prepend><w-icon name="la:user" /></template>
        </w-input>
        <w-input
          class="mt-2"
          v-model="state.password"
          outlined
          :label="t(`auth.fields.password`)"
          :rules="loginPasswordValidation"
          lazy-rules="ondemand"
          hide-bottom-space
          type="password"
          autocomplete="current-password">
          <template #prepend><w-icon name="la:key" /></template>
        </w-input>
        <w-btn
          class="w-full mt-2"
          type="submit"
          push
          color="primary"
          :label="t(`auth.actions.login`)"
          no-caps
          icon="la:sign-in-alt" />
      </w-form>
      <!--
        Straight into the browser's passkey prompt: a passkey is a discoverable credential, so the
        authenticator knows which accounts it holds for this site and asking for an email address first
        would only be a step in the way.
      -->
      <template v-if="canUsePasskeys">
        <w-separator class="my-4" />
        <w-btn
          class="acrylic-btn w-full"
          flat
          color="primary"
          :label="t(`auth.passkeys.signin`)"
          no-caps
          icon="la:key"
          @click="loginWithPasskey" />
      </template>
      <!--
        The providers that sign a user in elsewhere. A link rather than a form submit, because what
        follows is a page at the provider and not an answer to a request: pressing it hands the browser
        over, and it comes back at the callback route with a session already established.
      -->
      <template v-if="redirectStrategies.length > 0">
        <w-separator class="my-4" />
        <w-btn
          class="acrylic-btn w-full mb-2"
          v-for="str of redirectStrategies"
          :key="str.id"
          flat
          color="primary"
          :label="t(`auth.actions.loginWith`, { provider: str.activeStrategy.displayName })"
          no-caps
          :icon="`img:` + str.activeStrategy.strategy.icon"
          :href="authorizeUrl(str)"
          type="a" />
      </template>
      <template v-if="selectedStrategy.activeStrategy?.strategy?.key === `local`">
        <w-separator class="my-4" />
        <w-btn
          class="acrylic-btn w-full mb-2"
          v-if="selectedStrategy.activeStrategy.registration"
          flat
          color="primary"
          :label="t(`auth.switchToRegister.link`)"
          no-caps
          icon="la:user-plus"
          @click="switchTo(`register`)" />
        <w-btn
          class="acrylic-btn w-full"
          flat
          color="primary"
          :label="t(`auth.forgotPasswordLink`)"
          no-caps
          icon="la:life-ring"
          @click="switchTo(`forgot`)" />
      </template>
    </template>
    <!-- ----------------------------------------------------- -->
    <!-- FORGOT PASSWORD SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `forgot`">
      <p>{{ t('auth.forgotPasswordSubtitle') }}</p>
      <w-form ref="forgotForm" @submit="forgotPassword">
        <w-input
          ref="forgotEmailIpt"
          v-model="state.username"
          outlined
          :rules="userEmailValidation"
          lazy-rules="ondemand"
          hide-bottom-space
          :label="t(`auth.fields.email`)"
          autocomplete="email">
          <template #prepend><w-icon name="la:envelope" /></template>
        </w-input>
        <w-btn
          class="w-full mt-2"
          type="submit"
          push
          color="primary"
          :label="t(`auth.sendResetPassword`)"
          no-caps
          icon="la:life-ring" />
      </w-form>
      <w-separator class="my-4" />
      <w-btn
        class="acrylic-btn w-full"
        flat
        color="primary"
        :label="t(`auth.forgotPasswordCancel`)"
        no-caps
        icon="la:arrow-circle-left"
        @click="switchTo(`login`)" />
    </template>
    <!-- ----------------------------------------------------- -->
    <!-- REGISTER SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `register`">
      <p>{{ t('auth.registerSubTitle') }}</p>
      <w-form ref="registerForm" @submit="register">
        <w-input
          ref="registerNameIpt"
          v-model="state.newName"
          outlined
          :rules="userNameValidation"
          lazy-rules="ondemand"
          hide-bottom-space
          :label="t(`auth.fields.name`)"
          autocomplete="name">
          <template #prepend><w-icon name="la:user-circle" /></template>
        </w-input>
        <w-input
          class="mt-2"
          type="email"
          v-model="state.newEmail"
          outlined
          :rules="userEmailValidation"
          lazy-rules="ondemand"
          hide-bottom-space
          :label="t(`auth.fields.email`)"
          autocomplete="email">
          <template #prepend><w-icon name="la:envelope" /></template>
        </w-input>
        <w-input
          class="mt-2"
          v-model="state.newPassword"
          outlined
          :label="t(`auth.fields.password`)"
          type="password"
          autocomplete="new-password"
          :rules="userPasswordValidation"
          hide-bottom-space
          lazy-rules="ondemand">
          <template #append>
            <w-badge
              v-show="state.newPassword"
              :color="passwordStrength.color"
              :label="passwordStrength.label" />
          </template>
          <template #prepend><w-icon name="la:key" /></template>
        </w-input>
        <w-input
          class="mt-2"
          v-model="state.newPasswordVerify"
          outlined
          :label="t(`auth.fields.verifyPassword`)"
          type="password"
          autocomplete="new-password"
          :rules="userPasswordVerifyValidation"
          hide-bottom-space
          lazy-rules="ondemand">
          <template #prepend><w-icon name="la:key" /></template>
        </w-input>
        <w-btn
          class="w-full mt-2"
          type="submit"
          push
          color="primary"
          :label="t(`auth.actions.register`)"
          no-caps
          icon="la:user-plus" />
      </w-form>
      <w-separator class="my-4" />
      <w-btn
        class="acrylic-btn w-full"
        flat
        color="primary"
        :label="t(`auth.switchToLogin.link`)"
        no-caps
        icon="la:arrow-circle-left"
        @click="switchTo(`login`)" />
    </template>
    <!-- ----------------------------------------------------- -->
    <!-- CHANGE PASSWORD SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `changePwd`">
      <p v-if="state.continuationToken">{{ t('auth.changePwd.instructions') }}</p>
      <w-form ref="changePwdForm" @submit="changePwd">
        <w-input
          v-if="!state.continuationToken"
          ref="changePwdCurrentIpt"
          v-model="state.password"
          outlined
          type="password"
          :rules="loginPasswordValidation"
          lazy-rules="ondemand"
          hide-bottom-space
          :label="t(`auth.changePwd.currentPassword`)"
          autocomplete="password">
          <template #prepend><w-icon name="la:key" /></template>
        </w-input>
        <w-input
          class="mt-2"
          ref="changePwdNewPwdIpt"
          v-model="state.newPassword"
          outlined
          :label="t(`auth.changePwd.newPassword`)"
          type="password"
          autocomplete="new-password"
          :rules="userPasswordValidation"
          hide-bottom-space
          lazy-rules="ondemand">
          <template #append>
            <w-badge
              v-show="state.newPassword"
              :color="passwordStrength.color"
              :label="passwordStrength.label" />
          </template>
          <template #prepend><w-icon name="la:key" /></template>
        </w-input>
        <w-input
          class="mt-2"
          v-model="state.newPasswordVerify"
          outlined
          :label="t(`auth.changePwd.newPasswordVerify`)"
          type="password"
          autocomplete="new-password"
          :rules="userPasswordVerifyValidation"
          hide-bottom-space
          lazy-rules="ondemand">
          <template #prepend><w-icon name="la:key" /></template>
        </w-input>
        <w-btn
          class="w-full mt-2"
          type="submit"
          push
          color="primary"
          :label="t(`auth.changePwd.proceed`)"
          no-caps
          icon="la:sync-alt" />
      </w-form>
    </template>
    <!-- ----------------------------------------------------- -->
    <!-- TFA SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `tfa`">
      <p>{{ t('auth.tfa.subtitle') }}</p>
      <v-otp-input
        v-model:value="state.securityCode"
        :num-inputs="6"
        :should-auto-focus="true"
        input-classes="otp-input"
        input-type="number"
        separator=""
        @on-complete="verifyTFA" />
      <w-btn
        class="w-full mt-4"
        push
        color="primary"
        :label="t(`auth.tfa.verifyToken`)"
        no-caps
        icon="la:sign-in-alt"
        @click="verifyTFA" />
    </template>
    <!-- ----------------------------------------------------- -->
    <!-- TFA SETUP SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `tfasetup`">
      <p>{{ t('auth.tfaSetupTitle') }}</p>
      <p>{{ t('auth.tfaSetupInstrFirst') }}</p>
      <div style="justify-content: center; display: flex">
        <div v-html="state.tfaQRImage" style="width: 200px" />
      </div>
      <p class="mt-2">{{ t('auth.tfaSetupInstrSecond') }}</p>
      <v-otp-input
        v-model:value="state.securityCode"
        :num-inputs="6"
        :should-auto-focus="true"
        input-classes="otp-input"
        input-type="number"
        separator="" />
      <w-btn
        class="w-full mt-4"
        push
        color="primary"
        :label="t(`auth.tfa.verifyToken`)"
        no-caps
        icon="la:sign-in-alt"
        @click="finishSetupTFA" />
    </template>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { loading } from '@/composables/loading'
import { notify } from '@/composables/notify'
import { useDark } from '@/composables/dark'
import { localizeError } from '@/helpers/localization'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import Cookies from 'js-cookie'
import zxcvbn from 'zxcvbn'
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser'
import VOtpInput from 'vue3-otp-input'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  strategies: [],
  selectedStrategyId: null,
  screen: 'login',
  username: '',
  password: '',
  securityCode: '',
  continuationToken: '',
  newName: '',
  newEmail: '',
  newPassword: '',
  newPasswordVerify: '',
  isTFAShown: false,
  isTFASetupShown: false,
  tfaQRImage: ''
})

// REFS

const loginEmailIpt = ref(null)
const forgotEmailIpt = ref(null)
const registerNameIpt = ref(null)
const changePwdCurrentIpt = ref(null)
const changePwdNewPwdIpt = ref(null)
const loginForm = ref(null)
const forgotForm = ref(null)
const registerForm = ref(null)
const changePwdForm = ref(null)

// COMPUTED

/*
  The two kinds of strategy this screen deals with, and they are drawn nothing alike: one is a username
  and a password typed here, the other is a button that leaves for the provider. Splitting them is also
  what stops a provider from being picked in the selector above the form, where it would then be asked
  for a password it has no use for.
*/
const formStrategies = computed(() =>
  state.strategies.filter((str) => str.activeStrategy?.strategy?.useForm !== false)
)

const redirectStrategies = computed(() =>
  state.strategies.filter((str) => str.activeStrategy?.strategy?.useForm === false)
)

const selectedStrategy = computed(() => {
  return (
    (state.selectedStrategyId && state.strategies.find((s) => s.id === state.selectedStrategyId)) ||
    {}
  )
})

const passwordStrength = computed(() => {
  if (state.newPassword.length < 8) {
    return {
      color: 'negative',
      label: t('common.password.weak')
    }
  } else {
    switch (zxcvbn(state.newPassword).score) {
      case 1:
        return {
          color: 'deep-orange-7',
          label: t('common.password.poor')
        }
      case 2:
        return {
          color: 'purple-7',
          label: t('common.password.average')
        }
      case 3:
        return {
          color: 'blue-7',
          label: t('common.password.good')
        }
      case 4:
        return {
          color: 'green-7',
          label: t('common.password.strong')
        }
      default:
        return {
          color: 'negative',
          label: t('common.password.weak')
        }
    }
  }
})

const canUsePasskeys = computed(() => {
  return browserSupportsWebAuthn()
})

// VALIDATION RULES

const loginUsernameValidation = [(val) => val.length > 0 || t('auth.errors.missingUsername')]

const loginPasswordValidation = [(val) => val.length > 0 || t('auth.errors.missingPassword')]

const userNameValidation = [
  (val) => val.length > 0 || t('auth.errors.missingName'),
  (val) => /^[^<>"]+$/.test(val) || t('auth.errors.invalidName')
]

const userEmailValidation = [
  (val) => val.length > 0 || t('auth.errors.missingEmail'),
  (val) => /^.+@.+\..+$/.test(val) || t('auth.errors.invalidEmail')
]

const userPasswordValidation = [
  (val) => val.length > 0 || t('auth.errors.missingPassword'),
  (val) => val.length >= 8 || t('auth.errors.passwordTooShort')
]

const userPasswordVerifyValidation = [
  (val) => val.length > 0 || t('auth.errors.missingVerifyPassword'),
  (val) => val === state.newPassword || t('auth.errors.passwordsNotMatch')
]

// METHODS

/**
 * The reason the API gave, untranslated: the `ERR_*` code out of a response ky threw on (anything
 * above 400), or the error's own message when the request never got an answer. Kept as the raw code so
 * that callers can both display it and act on it.
 */
async function apiError(err) {
  return (
    (await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)) ?? err.message
  )
}

function switchTo(screen) {
  switch (screen) {
    case 'login': {
      state.screen = 'login'
      nextTick(() => {
        loginEmailIpt.value.focus()
      })
      break
    }
    case 'forgot': {
      state.screen = 'forgot'
      nextTick(() => {
        forgotEmailIpt.value.focus()
      })
      break
    }
    case 'register': {
      state.screen = 'register'
      nextTick(() => {
        registerNameIpt.value.focus()
      })
      break
    }
    default: {
      throw new Error('Invalid Screen')
    }
  }
}

async function fetchStrategies(showAll = false) {
  state.strategies = await API_CLIENT.get(`sites/${siteStore.id}/auth/strategies`, {
    searchParams: {
      visibleOnly: !showAll
    }
  }).json()
  // -> The selection drives the form, so it has to be a strategy that has one
  state.selectedStrategyId = formStrategies.value[0]?.id ?? null
}

/**
 * Where a provider button goes: the backend builds the URL at the provider, because everything that
 * ties the answer back to this browser — `state`, `nonce`, the PKCE verifier — is generated there and
 * kept on the session.
 */
function authorizeUrl(str) {
  const params = new URLSearchParams({ siteId: siteStore.id })
  /*
    The same cookie a form login reads on its way out: whatever sent the reader to the login screen
    left where they were going in it. The provider flow cannot come back through the code above — it
    lands on the callback route, which redirects — so the destination travels with the request and is
    handed back by the callback instead.
  */
  const loginRedirect = Cookies.get('loginRedirect')
  if (loginRedirect) {
    params.set('redirect', loginRedirect)
  }
  return `/_api/auth/${str.id}/authorize?${params.toString()}`
}

async function handleLoginResponse(resp) {
  state.continuationToken = resp.continuationToken
  switch (resp.nextAction) {
    case 'changePassword': {
      state.screen = 'changePwd'
      nextTick(() => {
        if (state.continuationToken) {
          changePwdNewPwdIpt.value.focus()
        } else {
          changePwdCurrentIpt.value.focus()
        }
      })
      loading.hide()
      break
    }
    case 'provideTfa': {
      state.securityCode = ''
      state.screen = 'tfa'
      loading.hide()
      break
    }
    case 'setupTfa': {
      state.securityCode = ''
      state.screen = 'tfasetup'
      state.tfaQRImage = resp.tfaQRImage
      loading.hide()
      break
    }
    case 'redirect': {
      loading.show({
        message: t('auth.loginSuccess')
      })
      setTimeout(() => {
        const loginRedirect = Cookies.get('loginRedirect')
        if (loginRedirect === '/' && resp.redirect) {
          Cookies.remove('loginRedirect')
          window.location.replace(resp.redirect)
        } else if (loginRedirect) {
          Cookies.remove('loginRedirect')
          window.location.replace(loginRedirect)
        } else if (resp.redirect) {
          window.location.replace(resp.redirect)
        } else {
          window.location.replace('/')
        }
      }, 1000)
      break
    }
    default: {
      loading.hide()
      notify({
        type: 'negative',
        message: 'Unexpected Authentication Response'
      })
    }
  }
}

/**
 * LOGIN
 */
async function login() {
  loading.show({
    message: t('auth.signingIn')
  })
  try {
    const isFormValid = await loginForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.login'))
    }
    const resp = await API_CLIENT.put(`sites/${siteStore.id}/auth/login`, {
      json: {
        strategyId: state.selectedStrategyId,
        username: state.username,
        password: state.password
      },
      throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
    }).json()
    if (resp.ok) {
      state.password = ''
      handleLoginResponse(resp)
    } else {
      throw new Error(resp.message || 'ERR_LOGIN_FAILED')
    }
  } catch (err) {
    console.warn(err)
    loading.hide()
    notify({
      type: 'negative',
      message: localizeError(await apiError(err), t)
    })
  }
}

/**
 * LOGIN WITH PASSKEY
 */
async function loginWithPasskey() {
  loading.show({
    message: t('auth.signingIn')
  })
  try {
    const respGen = await API_CLIENT.post(`sites/${siteStore.id}/auth/passkey/challenge`).json()
    if (!respGen?.ok) {
      throw new Error(respGen?.message || 'ERR_LOGIN_FAILED')
    }

    // -> No `useBrowserAutofill`: that fills a passkey into a form field the user is typing in, and
    //    there is no field here -- this opens the browser's own account picker instead
    const authResp = await startAuthentication({ optionsJSON: respGen.authOptions })

    const respVerif = await API_CLIENT.put(`sites/${siteStore.id}/auth/passkey/login`, {
      json: {
        authResponse: authResp
      }
    }).json()
    if (!respVerif?.ok) {
      throw new Error(respVerif?.message || 'ERR_LOGIN_FAILED')
    }
    await handleLoginResponse(respVerif)
  } catch (err) {
    loading.hide()
    // -> Dismissing the browser's passkey prompt is not a failure to report: the user asked for the
    //    prompt and then changed their mind, and is looking at the login form again either way
    if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
      return
    }
    notify({
      type: 'negative',
      message: localizeError(await apiError(err), t)
    })
  }
}

/**
 * FORGOT PASSWORD
 */
async function forgotPassword() {
  try {
    const isFormValid = await forgotForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.forgotPassword'))
    }
    // TODO: Implement forgot password
    notify({
      type: 'negative',
      message: 'Not implemented yet.'
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * REGISTER
 */
async function register() {
  try {
    const isFormValid = await registerForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.register'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: `
        mutation(
          $email: String!
          $password: String!
          $name: String!
          ) {
          register(
            email: $email
            password: $password
            name: $name
            ) {
            operation {
              succeeded
              message
            }
            jwt
            nextAction
            continuationToken
            redirect
            tfaQRImage
          }
        }
      `,
      variables: {
        email: state.newEmail,
        password: state.newPassword,
        name: state.newName
      }
    })
    if (resp.data?.register?.operation?.succeeded) {
      state.password = ''
      state.newPassword = ''
      state.newPasswordVerify = ''
      await handleLoginResponse(resp.data.register)
    } else {
      throw new Error(resp.data?.register?.operation?.message || t('auth.errors.registerError'))
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * CHANGE PASSWORD
 */
async function changePwd() {
  try {
    const isFormValid = await changePwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.register'))
    }
    const resp = await API_CLIENT.put(`sites/${siteStore.id}/auth/changePassword`, {
      json: {
        strategyId: state.selectedStrategyId,
        continuationToken: state.continuationToken,
        newPassword: state.newPassword
      },
      throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
    }).json()
    if (resp.ok) {
      state.password = ''
      notify({
        type: 'positive',
        message: t('auth.changePwd.success')
      })
      await handleLoginResponse(resp)
    } else {
      throw new Error(resp.message || 'ERR_CHANGE_PASSWORD_FAILED')
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: localizeError(await apiError(err), t)
    })
  }
}

/**
 * Send the security code for the login this panel is in the middle of.
 *
 * The continuation token is only cleared once the code is accepted: a mistyped one can be entered
 * again, up to the handful of attempts the server allows before it discards the token.
 *
 * @param setup True on the setup screen, where a correct code also activates the new secret
 * @returns The login response, to be handed to `handleLoginResponse()`
 */
async function submitTFA(setup) {
  if (!/^[0-9]{6}$/.test(state.securityCode)) {
    throw new Error(t('auth.errors.tfaMissing'))
  }
  const resp = await API_CLIENT.put(`sites/${siteStore.id}/auth/tfa`, {
    json: {
      strategyId: state.selectedStrategyId,
      continuationToken: state.continuationToken,
      securityCode: state.securityCode,
      setup
    }
  }).json()
  if (!resp?.ok) {
    throw new Error(resp?.message || 'ERR_LOGIN_FAILED')
  }
  state.continuationToken = ''
  state.securityCode = ''
  return resp
}

/**
 * Report a failed 2FA attempt, and start the login over when there is nothing left to continue: an
 * expired token, or one the server has discarded after too many wrong codes, leaves this screen with
 * no way forward.
 */
async function handleTFAError(err) {
  const code = await apiError(err)
  loading.hide()
  notify({
    type: 'negative',
    message: localizeError(code, t)
  })
  if (code === 'ERR_INVALID_VALIDATION_TOKEN' || code === 'ERR_EXPIRED_VALIDATION_TOKEN') {
    state.continuationToken = ''
    state.securityCode = ''
    state.password = ''
    switchTo('login')
  }
}

async function verifyTFA() {
  loading.show({
    message: t('auth.signingIn')
  })
  try {
    await handleLoginResponse(await submitTFA(false))
  } catch (err) {
    await handleTFAError(err)
  }
}

/**
 * FINISH TFA SETUP
 */
async function finishSetupTFA() {
  loading.show({
    message: t('auth.tfaSetupVerifying')
  })
  try {
    const resp = await submitTFA(true)
    notify({
      type: 'positive',
      message: t('auth.tfaSetupSuccess')
    })
    await handleLoginResponse(resp)
  } catch (err) {
    await handleTFAError(err)
  }
}

// MOUNTED

onMounted(async () => {
  await fetchStrategies()
  reportRedirectLoginError()
})

/**
 * Say what went wrong on a login that happened somewhere else.
 *
 * A provider login fails at the callback route, which has a browser to redirect and no request to
 * answer — so it puts the reason in the URL and this puts it in front of the reader. Taken out of the
 * address bar afterwards, so that reloading the page does not report it a second time.
 */
function reportRedirectLoginError() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('error')
  if (!code) {
    return
  }
  notify({
    type: 'negative',
    message: t('auth.errors.loginError'),
    caption: localizeError(code, t)
  })
  params.delete('error')
  const query = params.toString()
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}`
  )
}
</script>
