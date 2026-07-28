<template>
  <div class="auth-login">
    <!-- ----------------------------------------------------- -->
    <!-- LOGIN SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-if="state.screen === `login`">
      <template v-if="state.strategies?.length > 1">
        <p>{{t('auth.selectAuthProvider')}}</p>
        <div class="auth-strategies mb-4">
          <w-btn
            v-for="str of state.strategies"
            :label="str.activeStrategy.displayName"
            :icon="`img:` + str.activeStrategy.strategy.icon"
            push
            no-caps
            :color="str.id === state.selectedStrategyId ? `primary` : (dark.isActive ? `blue-grey-9` : `grey-1`)"
            :text-color="str.id === state.selectedStrategyId || dark.isActive ? `white` : `blue-grey-9`"
            @click="state.selectedStrategyId = str.id" />
        </div>
      </template>
      <w-form ref="loginForm" @submit="login">
        <w-input
          ref="loginEmailIpt"
          v-model="state.username"
          autofocus
          outlined
          :label="t(`auth.fields.` + (selectedStrategy.activeStrategy?.strategy?.usernameType ?? `email`))"
          :rules="selectedStrategy.activeStrategy?.strategy?.usernameType === `username` ? loginUsernameValidation : userEmailValidation"
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
      <template v-if="canUsePasskeys">
        <w-separator class="my-4" />
        <w-btn
          class="acrylic-btn w-full"
          flat
          color="primary"
          :label="t(`auth.passkeys.signin`)"
          no-caps
          icon="la:key"
          @click="switchTo(`passkey`)" />
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
    <!-- PASSKEY LOGIN SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `passkey`">
      <p>{{t('auth.passkeys.signinHint')}}</p>
      <w-form ref="passkeyForm" @submit="loginWithPasskey">
        <w-input
          ref="passkeyEmailIpt"
          v-model="state.username"
          outlined
          hide-bottom-space
          :label="t(`auth.fields.email`)"
          autocomplete="webauthn">
          <template #prepend><w-icon name="la:envelope" /></template>
        </w-input>
        <w-btn
          class="w-full mt-2"
          type="submit"
          push
          color="primary"
          :label="t(`auth.actions.login`)"
          no-caps
          icon="la:key" />
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
    <!-- FORGOT PASSWORD SCREEN -->
    <!-- ----------------------------------------------------- -->
    <template v-else-if="state.screen === `forgot`">
      <p>{{t('auth.forgotPasswordSubtitle')}}</p>
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
      <p>{{t('auth.registerSubTitle')}}</p>
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
      <p v-if="state.continuationToken">{{t('auth.changePwd.instructions')}}</p>
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
      <p>{{t('auth.tfa.subtitle')}}</p>
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
      <p>{{t('auth.tfaSetupTitle')}}</p>
      <p>{{t('auth.tfaSetupInstrFirst')}}</p>
      <div style="justify-content: center; display: flex;">
        <div v-html="state.tfaQRImage" style="width: 200px;" />
      </div>
      <p class="mt-2">{{t('auth.tfaSetupInstrSecond')}}</p>
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

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import Cookies from 'js-cookie'
import zxcvbn from 'zxcvbn'
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication
} from '@simplewebauthn/browser'
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
const passkeyEmailIpt = ref(null)
const forgotEmailIpt = ref(null)
const registerNameIpt = ref(null)
const changePwdCurrentIpt = ref(null)
const changePwdNewPwdIpt = ref(null)
const loginForm = ref(null)
const forgotForm = ref(null)
const registerForm = ref(null)
const changePwdForm = ref(null)

// COMPUTED

const selectedStrategy = computed(() => {
  return (
    (state.selectedStrategyId &&
      state.strategies.find((s) => s.id === state.selectedStrategyId)) ||
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
    case 'passkey': {
      state.screen = 'passkey'
      nextTick(() => {
        passkeyEmailIpt.value.focus()
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
  state.selectedStrategyId = state.strategies[0].id
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
      throw new Error(resp.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    console.warn(err)
    loading.hide()
    notify({
      type: 'negative',
      message: err.message
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
    const respGen = await APOLLO_CLIENT.mutate({
      mutation: `
        mutation authenticatePasskeyGenerate (
          $email: String!
          $siteId: UUID!
          ) {
          authenticatePasskeyGenerate (
            email: $email
            siteId: $siteId
            ) {
            operation {
              succeeded
              message
            }
            authOptions
          }
        }
      `,
      variables: {
        email: state.username,
        siteId: siteStore.id
      }
    })
    if (respGen.data?.authenticatePasskeyGenerate?.operation?.succeeded) {
      const authResp = await startAuthentication(
        respGen.data.authenticatePasskeyGenerate.authOptions,
        await browserSupportsWebAuthnAutofill()
      )

      const respVerif = await APOLLO_CLIENT.mutate({
        mutation: `
          mutation authenticatePasskeyVerify (
            $authResponse: JSON!
            ) {
            authenticatePasskeyVerify (
              authResponse: $authResponse
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
          authResponse: authResp
        }
      })
      if (respVerif.data?.authenticatePasskeyVerify?.operation?.succeeded) {
        handleLoginResponse(respVerif.data.authenticatePasskeyVerify)
      } else {
        throw new Error(
          respVerif.data?.authenticatePasskeyVerify?.operation?.message ||
            t('auth.errors.loginError')
        )
      }
    } else {
      throw new Error(
        respGen.data?.authenticatePasskeyGenerate?.operation?.message || t('auth.errors.loginError')
      )
    }
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: err.message
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
      throw new Error(resp.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * VERIFY TFA TOKEN
 */
async function verifyTFA() {
  loading.show({
    message: t('auth.signingIn')
  })
  try {
    if (!/^[0-9]{6}$/.test(state.securityCode)) {
      throw new Error(t('auth.errors.tfaMissing'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: `
        mutation(
          $continuationToken: String!
          $securityCode: String!
          $strategyId: UUID!
          $siteId: UUID!
          ) {
          loginTFA(
            continuationToken: $continuationToken
            securityCode: $securityCode
            strategyId: $strategyId
            siteId: $siteId
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
        continuationToken: state.continuationToken,
        securityCode: state.securityCode,
        strategyId: state.selectedStrategyId,
        siteId: siteStore.id
      }
    })
    if (resp.data?.loginTFA?.operation?.succeeded) {
      state.continuationToken = ''
      state.securityCode = ''
      await handleLoginResponse(resp.data.loginTFA)
    } else {
      throw new Error(resp.data?.loginTFA?.operation?.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: err.message
    })
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
    if (!/^[0-9]{6}$/.test(state.securityCode)) {
      throw new Error(t('auth.errors.tfaMissing'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: `
        mutation(
          $continuationToken: String!
          $securityCode: String!
          $strategyId: UUID!
          $siteId: UUID!
          ) {
          loginTFA(
            continuationToken: $continuationToken
            securityCode: $securityCode
            strategyId: $strategyId
            siteId: $siteId
            setup: true
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
        continuationToken: state.continuationToken,
        securityCode: state.securityCode,
        strategyId: state.selectedStrategyId,
        siteId: siteStore.id
      }
    })
    if (resp.data?.loginTFA?.operation?.succeeded) {
      state.continuationToken = ''
      state.securityCode = ''
      notify({
        type: 'positive',
        message: t('auth.tfaSetupSuccess')
      })
      await handleLoginResponse(resp.data.loginTFA)
    } else {
      throw new Error(resp.data?.loginTFA?.operation?.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    loading.hide()
    notify({
      type: 'negative',
      message: err.message
    })
  }
}

// MOUNTED

onMounted(async () => {
  await fetchStrategies()
})
</script>

<style lang="scss">
.auth-login {
  .otp-input {
    width: 100%;
    height: 48px;
    padding: 5px;
    margin: 0 5px;
    font-size: 20px;
    border-radius: 6px;
    text-align: center;

    @at-root .body--light & {
      border: 2px solid rgba(0, 0, 0, 0.2);
    }

    @at-root .body--dark & {
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    &:focus-visible {
      outline-color: $primary;
    }

    /* Background colour of an input field with value */
    &.is-complete {
      border-color: $positive;
      border-width: 2px;
    }

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
}
</style>
