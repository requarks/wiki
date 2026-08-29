<template>
  <div>
    <!--
      Nothing until the strategies are known.

      Every screen below depends on them — which fields the form has, what the username is called,
      whether there is a register link or a forgot-password one, which providers get a button. Drawn
      before the answer arrives, the panel is a guess that then corrects itself, and the correction
      moved the form ~34px up the page a beat after it was first painted: this column is vertically
      centred, so anything added below the form shifts the form. A field that jumps out from under
      the pointer is a field that cannot be clicked, which is what made focusing the email address
      take two tries.
    -->
    <div v-if="!state.strategiesLoaded" class="flex justify-center py-8">
      <w-spinner color="primary" size="lg" />
    </div>
    <!-- ----------------------------------------------------- -->
    <!-- LOGIN SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `login`">
      <p v-if="formStrategies.length < 2">{{ t('auth.enterCredentials') }}</p>
      <template v-else>
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
        <!--
          `username`, whatever the strategy calls this field. It is the account identifier of a login
          form, which is what that token means — an address typed here is not an email address being
          collected, it is the name of an account, and `email` is the token for the former. What reads
          the difference is the browser's password manager and every extension standing in for one:
          `username` beside `current-password` is the pair they look for, and a form they classify
          some other way gets treated some other way.

          The LABEL still follows the strategy, since that is what the reader is being asked for.
        -->
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
          autocomplete="username">
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
        <!-- -> Off where the strategy says so: a wiki that hands passwords out rather than letting
                them be chosen has nothing for this to do -->
        <w-btn
          class="acrylic-btn w-full"
          v-if="selectedStrategy.activeStrategy.allowForgotPassword"
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
    <!-- CONFIRM EMAIL SCREEN -->
    <!-- ----------------------------------------------------- -->
    <!--
      A button rather than something this screen does on arrival. The link that leads here is fetched
      by the scanners some mail providers put in front of a mailbox — Outlook's Safe Links among them
      — and anything that confirmed the address on load would be spent by the scanner, leaving the
      reader with a link that has already been used.
    -->
    <template v-else-if="state.screen === `verifyEmail`">
      <p>{{ t('auth.verifyEmail.instructions') }}</p>
      <w-btn
        class="w-full mt-2"
        push
        color="primary"
        :label="t(`auth.verifyEmail.proceed`)"
        no-caps
        icon="la:check-circle"
        @click="confirmEmail" />
      <w-separator class="my-4" />
      <w-btn
        class="acrylic-btn w-full"
        flat
        color="primary"
        :label="t(`auth.switchToLogin.link`)"
        no-caps
        icon="la:arrow-circle-left"
        @click="cancelVerifyEmail" />
    </template>
    <!-- ----------------------------------------------------- -->
    <!-- RESET PASSWORD SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `resetPwd`">
      <p>{{ t('auth.resetPwd.instructions') }}</p>
      <w-form ref="resetPwdForm" @submit="resetPassword">
        <w-input
          v-model="state.newPassword"
          autofocus
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
      <w-separator class="my-4" />
      <w-btn
        class="acrylic-btn w-full"
        flat
        color="primary"
        :label="t(`auth.switchToLogin.link`)"
        no-caps
        icon="la:arrow-circle-left"
        @click="cancelReset" />
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
import { apiErrorMessage } from '@/helpers/apiError'
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
  /** Set from `?reset=` on the way in; what the reset screen submits with the new password. */
  resetToken: '',
  /** Set from `?verify=` on the way in; what the confirm screen submits when it is pressed. */
  verifyToken: '',
  /** Whether the strategies have been fetched — settled either way, so a failure still draws. */
  strategiesLoaded: false,
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
const resetPwdForm = ref(null)

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
  try {
    state.strategies = await API_CLIENT.get(`sites/${siteStore.id}/auth/strategies`, {
      searchParams: {
        visibleOnly: !showAll
      }
    }).json()
    // -> The selection drives the form, so it has to be a strategy that has one
    state.selectedStrategyId = formStrategies.value[0]?.id ?? null
  } catch (err) {
    // -> Said out loud rather than left as an unhandled rejection: what the reader is looking at is
    //    a login form with no strategy behind it, and a submit that cannot go anywhere
    notify({
      type: 'negative',
      message: t('auth.genericError'),
      caption: apiErrorMessage(err)
    })
  } finally {
    // -> In a `finally`, so a wiki whose strategies could not be fetched still shows its form rather
    //    than spinning for ever
    state.strategiesLoaded = true
  }
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
    /*
      Registration on a site that confirms addresses. Nothing to continue here: the link in the email
      is what finishes it, and there is no session until the new account signs in for itself.
    */
    case 'verifyEmail': {
      loading.hide()
      notify({
        type: 'positive',
        message: t('auth.registerSuccess'),
        caption: t('auth.registerCheckEmail')
      })
      switchTo('login')
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
      message: localizeError(apiErrorMessage(err), t)
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
      message: localizeError(apiErrorMessage(err), t)
    })
  }
}

/**
 * FORGOT PASSWORD
 */
async function forgotPassword() {
  loading.show({
    message: t('auth.forgotPasswordLoading')
  })
  try {
    const isFormValid = await forgotForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.forgotPassword'))
    }
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/auth/forgotPassword`, {
      json: {
        strategyId: state.selectedStrategyId,
        email: state.username
      },
      throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'ERR_FORGOT_PASSWORD_FAILED')
    }
    loading.hide()
    /*
      The same answer for an address nobody here has, which is what the endpoint gives back and what
      this has to keep: saying "no such account" on a public form is how a wiki's member list gets
      read off it one address at a time.
    */
    notify({
      type: 'positive',
      message: t('auth.forgotPasswordSuccess')
    })
    switchTo('login')
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: localizeError(apiErrorMessage(err), t)
    })
  }
}

/**
 * RESET PASSWORD
 *
 * The other end of the link in a reset email. Nothing signs the user in here — the token stands for
 * the mailbox rather than for a half-finished login — so what follows a successful reset is the login
 * screen, with the new password to type into it.
 */
async function resetPassword() {
  loading.show({
    message: t('auth.changePwd.loading')
  })
  try {
    const isFormValid = await resetPwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.fields'))
    }
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/auth/resetPassword`, {
      json: {
        token: state.resetToken,
        newPassword: state.newPassword
      },
      throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'ERR_CHANGE_PASSWORD_FAILED')
    }
    loading.hide()
    state.resetToken = ''
    state.newPassword = ''
    state.newPasswordVerify = ''
    clearQueryParams(['reset'])
    notify({
      type: 'positive',
      message: t('auth.resetPwd.success')
    })
    switchTo('login')
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: localizeError(apiErrorMessage(err), t)
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
    loading.show({
      message: t('auth.registering')
    })
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/auth/register`, {
      json: {
        strategyId: state.selectedStrategyId,
        name: state.newName,
        email: state.newEmail,
        password: state.newPassword
      },
      throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'ERR_REGISTRATION_FAILED')
    }
    state.password = ''
    state.newName = ''
    state.newEmail = ''
    state.newPassword = ''
    state.newPasswordVerify = ''
    await handleLoginResponse(resp)
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: localizeError(apiErrorMessage(err), t)
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
      message: localizeError(apiErrorMessage(err), t)
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
  const code = apiErrorMessage(err)
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

/**
 * CONFIRM EMAIL
 *
 * The press the confirm screen exists for. Nobody is signed in by it — the browser reading the mail
 * is not necessarily the one that registered — so what follows is the login screen.
 */
async function confirmEmail() {
  loading.show({
    message: t('auth.verifyEmail.loading')
  })
  try {
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/auth/verifyEmail`, {
      json: {
        token: state.verifyToken
      },
      throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'ERR_INVALID_VALIDATION_TOKEN')
    }
    loading.hide()
    notify({
      type: 'positive',
      message: t('auth.verifyEmail.success')
    })
    cancelVerifyEmail()
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: localizeError(apiErrorMessage(err), t)
    })
    // -> Nothing left to press: a token that was refused is not going to be accepted on a second try
    cancelVerifyEmail()
  }
}

/**
 * Leave the confirm screen, spent token or backed-out one alike, and take it out of the address bar:
 * left there, reloading the page would offer a confirmation that cannot succeed.
 */
function cancelVerifyEmail() {
  state.verifyToken = ''
  clearQueryParams(['verify'])
  switchTo('login')
}

/**
 * Leave the reset screen without using the link, and take the token out of the address bar with it:
 * left there, reloading the page would drop the reader straight back into a screen they backed out of.
 */
function cancelReset() {
  state.resetToken = ''
  state.newPassword = ''
  state.newPasswordVerify = ''
  clearQueryParams(['reset'])
  switchTo('login')
}

// MOUNTED

onMounted(async () => {
  /*
    Before the fetch, and therefore before anything is drawn: the panel is held back until the
    strategies arrive, so setting the screen now means the right one is the FIRST to mount. Done
    afterwards it would mount the login form, focus its email field and then take both away again.
  */
  screenFromQuery()
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
  const code = new URLSearchParams(window.location.search).get('error')
  if (!code) {
    return
  }
  notify({
    type: 'negative',
    message: t('auth.errors.loginError'),
    caption: localizeError(code, t)
  })
  clearQueryParams(['error'])
}

/**
 * Which screen a link asked for, and the token it carries.
 *
 * Both are one-way: nothing switches to them afterwards, so unlike `switchTo` this only sets state —
 * the screen's own field focuses itself when it mounts. The token stays in the address bar until it
 * has been used or the screen is left, since it is what the request is made with and a reload before
 * then should land back here rather than on a form with nothing behind it.
 */
function screenFromQuery() {
  const params = new URLSearchParams(window.location.search)
  const verify = params.get('verify')
  if (verify) {
    state.verifyToken = verify
    state.screen = 'verifyEmail'
    return
  }
  const reset = params.get('reset')
  if (reset) {
    state.resetToken = reset
    state.screen = 'resetPwd'
  }
}

/**
 * Take parameters out of the address bar without navigating.
 *
 * Everything this screen is told by URL — a failed provider login, a confirmation token, a reset
 * token — is spent once it has been acted on, and reloading the page must not offer it again.
 */
function clearQueryParams(keys) {
  const params = new URLSearchParams(window.location.search)
  for (const key of keys) {
    params.delete(key)
  }
  const query = params.toString()
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${query ? `?${query}` : ''}`
  )
}
</script>
