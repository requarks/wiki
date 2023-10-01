<template lang="pug">
.auth-login
  //- -----------------------------------------------------
  //- LOGIN SCREEN
  //- -----------------------------------------------------
  template(v-if='state.screen === `login`')
    template(v-if='state.strategies?.length > 1')
      p {{t('auth.selectAuthProvider')}}
      .auth-strategies.q-mb-md
        q-btn(
          v-for='str of state.strategies'
          :label='str.activeStrategy.displayName'
          :icon='`img:` + str.activeStrategy.strategy.icon'
          push
          no-caps
          :color='str.id === state.selectedStrategyId ? `primary` : ($q.dark.isActive ? `blue-grey-9` : `grey-1`)'
          :text-color='str.id === state.selectedStrategyId || $q.dark.isActive ? `white` : `blue-grey-9`'
          @click='state.selectedStrategyId = str.id'
          )
    q-form(ref='loginForm', @submit='login')
      q-input(
        ref='loginEmailIpt'
        v-model='state.username'
        autofocus
        outlined
        :label='t(`auth.fields.` + (selectedStrategy.activeStrategy?.strategy?.usernameType ?? `email`))'
        :rules='selectedStrategy.activeStrategy?.strategy?.usernameType === `username` ? loginUsernameValidation : userEmailValidation'
        lazy-rules='ondemand'
        hide-bottom-space
        :autocomplete='selectedStrategy.activeStrategy?.strategy?.usernameType ?? `email`'
        )
        template(#prepend)
          i.las.la-user
      q-input.q-mt-sm(
        v-model='state.password'
        outlined
        :label='t(`auth.fields.password`)'
        :rules='loginPasswordValidation'
        lazy-rules='ondemand'
        hide-bottom-space
        type='password'
        autocomplete='current-password'
        )
        template(#prepend)
          i.las.la-key
      q-btn.full-width.q-mt-sm(
        type='submit'
        push
        color='primary'
        :label='t(`auth.actions.login`)'
        no-caps
        icon='las la-sign-in-alt'
      )
    template(v-if='selectedStrategy.activeStrategy?.strategy?.key === `local`')
      q-separator.q-my-md
      q-btn.acrylic-btn.full-width.q-mb-sm(
        v-if='selectedStrategy.activeStrategy.registration'
        flat
        color='primary'
        :label='t(`auth.switchToRegister.link`)'
        no-caps
        icon='las la-user-plus'
        @click='switchTo(`register`)'
      )
      q-btn.acrylic-btn.full-width(
        flat
        color='primary'
        :label='t(`auth.forgotPasswordLink`)'
        no-caps
        icon='las la-life-ring'
        @click='switchTo(`forgot`)'
      )

  //- -----------------------------------------------------
  //- FORGOT PASSWORD SCREEN
  //- -----------------------------------------------------
  template(v-else-if='state.screen === `forgot`')
    p {{t('auth.forgotPasswordSubtitle')}}
    q-form(ref='forgotForm', @submit='forgotPassword')
      q-input(
        ref='forgotEmailIpt'
        v-model='state.username'
        outlined
        :rules='userEmailValidation'
        lazy-rules='ondemand'
        hide-bottom-space
        :label='t(`auth.fields.email`)'
        autocomplete='email'
        )
        template(#prepend)
          i.las.la-envelope
      q-btn.full-width.q-mt-sm(
        type='submit'
        push
        color='primary'
        :label='t(`auth.sendResetPassword`)'
        no-caps
        icon='las la-life-ring'
      )
    q-separator.q-my-md
    q-btn.acrylic-btn.full-width(
      flat
      color='primary'
      :label='t(`auth.forgotPasswordCancel`)'
      no-caps
      icon='las la-arrow-circle-left'
      @click='switchTo(`login`)'
    )

  //- -----------------------------------------------------
  //- REGISTER SCREEN
  //- -----------------------------------------------------
  template(v-else-if='state.screen === `register`')
    p {{t('auth.registerSubTitle')}}
    q-form(ref='registerForm', @submit='register')
      q-input(
        ref='registerNameIpt'
        v-model='state.newName'
        outlined
        :rules='userNameValidation'
        lazy-rules='ondemand'
        hide-bottom-space
        :label='t(`auth.fields.name`)'
        autocomplete='name'
        )
        template(#prepend)
          i.las.la-user-circle
      q-input.q-mt-sm(
        type='email'
        v-model='state.newEmail'
        outlined
        :rules='userEmailValidation'
        lazy-rules='ondemand'
        hide-bottom-space
        :label='t(`auth.fields.email`)'
        autocomplete='email'
        )
        template(#prepend)
          i.las.la-envelope
      q-input.q-mt-sm(
        v-model='state.newPassword'
        outlined
        :label='t(`auth.fields.password`)'
        type='password'
        autocomplete='new-password'
        :rules='userPasswordValidation'
        hide-bottom-space
        lazy-rules='ondemand'
        )
        template(#append)
          q-badge(
            v-show='state.newPassword'
            :color='passwordStrength.color'
            :label='passwordStrength.label'
          )
        template(#prepend)
          i.las.la-key
      q-input.q-mt-sm(
        v-model='state.newPasswordVerify'
        outlined
        :label='t(`auth.fields.verifyPassword`)'
        type='password'
        autocomplete='new-password'
        :rules='userPasswordVerifyValidation'
        hide-bottom-space
        lazy-rules='ondemand'
        )
        template(#prepend)
          i.las.la-key
      q-btn.full-width.q-mt-sm(
        type='submit'
        push
        color='primary'
        :label='t(`auth.actions.register`)'
        no-caps
        icon='las la-user-plus'
      )
    q-separator.q-my-md
    q-btn.acrylic-btn.full-width(
      flat
      color='primary'
      :label='t(`auth.switchToLogin.link`)'
      no-caps
      icon='las la-arrow-circle-left'
      @click='switchTo(`login`)'
    )

  //- -----------------------------------------------------
  //- CHANGE PASSWORD SCREEN
  //- -----------------------------------------------------
  template(v-else-if='state.screen === `changePwd`')
    p(v-if='state.continuationToken') {{t('auth.changePwd.instructions')}}
    q-form(ref='changePwdForm', @submit='changePwd')
      q-input(
        v-if='!state.continuationToken'
        ref='changePwdCurrentIpt'
        v-model='state.password'
        outlined
        type='password'
        :rules='loginPasswordValidation'
        lazy-rules='ondemand'
        hide-bottom-space
        :label='t(`auth.changePwd.currentPassword`)'
        autocomplete='password'
        )
        template(#prepend)
          i.las.la-key
      q-input.q-mt-sm(
        ref='changePwdNewPwdIpt'
        v-model='state.newPassword'
        outlined
        :label='t(`auth.changePwd.newPassword`)'
        type='password'
        autocomplete='new-password'
        :rules='userPasswordValidation'
        hide-bottom-space
        lazy-rules='ondemand'
        )
        template(#append)
          q-badge(
            v-show='state.newPassword'
            :color='passwordStrength.color'
            :label='passwordStrength.label'
          )
        template(#prepend)
          i.las.la-key
      q-input.q-mt-sm(
        v-model='state.newPasswordVerify'
        outlined
        :label='t(`auth.changePwd.newPasswordVerify`)'
        type='password'
        autocomplete='new-password'
        :rules='userPasswordVerifyValidation'
        hide-bottom-space
        lazy-rules='ondemand'
        )
        template(#prepend)
          i.las.la-key
      q-btn.full-width.q-mt-sm(
        type='submit'
        push
        color='primary'
        :label='t(`auth.changePwd.proceed`)'
        no-caps
        icon='las la-sync-alt'
      )
  //- -----------------------------------------------------
  //- TFA SCREEN
  //- -----------------------------------------------------
  template(v-else-if='state.screen === `tfa`')
    p {{t('auth.tfa.subtitle')}}
    v-otp-input(
      v-model:value='state.securityCode'
      :num-inputs='6'
      :should-auto-focus='true'
      input-classes='otp-input'
      input-type='number'
      separator=''
      @on-complete='verifyTFA'
      )
    q-btn.full-width.q-mt-md(
      push
      color='primary'
      :label='t(`auth.tfa.verifyToken`)'
      no-caps
      icon='las la-sign-in-alt'
      @click='verifyTFA'
    )
  //- -----------------------------------------------------
  //- TFA SETUP SCREEN
  //- -----------------------------------------------------
  template(v-else-if='state.screen === `tfasetup`')
    p {{t('auth.tfaSetupTitle')}}
    p {{t('auth.tfaSetupInstrFirst')}}
    div(style='justify-content: center; display: flex;')
      div(v-html='state.tfaQRImage', style='width: 200px;')
    p.q-mt-sm {{t('auth.tfaSetupInstrSecond')}}
    v-otp-input(
      v-model:value='state.securityCode'
      :num-inputs='6'
      :should-auto-focus='true'
      input-classes='otp-input'
      input-type='number'
      separator=''
    )
    q-btn.full-width.q-mt-md(
      push
      color='primary'
      :label='t(`auth.tfa.verifyToken`)'
      no-caps
      icon='las la-sign-in-alt'
      @click='finishSetupTFA'
    )
</template>

<script setup>
import gql from 'graphql-tag'
import { find } from 'lodash-es'
import Cookies from 'js-cookie'
import zxcvbn from 'zxcvbn'

import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

import VOtpInput from 'vue3-otp-input'

// QUASAR

const $q = useQuasar()

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

const selectedStrategy = computed(() => {
  return (state.selectedStrategyId && find(state.strategies, ['id', state.selectedStrategyId])) || {}
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

// VALIDATION RULES

const loginUsernameValidation = [
  val => val.length > 0 || t('auth.errors.missingUsername')
]

const loginPasswordValidation = [
  val => val.length > 0 || t('auth.errors.missingPassword')
]

const userNameValidation = [
  val => val.length > 0 || t('auth.errors.missingName'),
  val => /^[^<>"]+$/.test(val) || t('auth.errors.invalidName')
]

const userEmailValidation = [
  val => val.length > 0 || t('auth.errors.missingEmail'),
  val => /^.+@.+\..+$/.test(val) || t('auth.errors.invalidEmail')
]

const userPasswordValidation = [
  val => val.length > 0 || t('auth.errors.missingPassword'),
  val => val.length >= 8 || t('auth.errors.passwordTooShort')
]

const userPasswordVerifyValidation = [
  val => val.length > 0 || t('auth.errors.missingVerifyPassword'),
  val => val === state.newPassword || t('auth.errors.passwordsNotMatch')
]

// METHODS

function switchTo (screen) {
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

async function fetchStrategies (showAll = false) {
  const resp = await APOLLO_CLIENT.query({
    query: gql`
      query loginFetchSiteStrategies(
        $siteId: UUID!
        $visibleOnly: Boolean
      ) {
        authSiteStrategies(
          siteId: $siteId
          visibleOnly: $visibleOnly
          ) {
          id
          activeStrategy {
            id
            displayName
            strategy {
              key
              color
              icon
              useForm
              usernameType
            }
            registration
          }
        }
      }
    `,
    variables: {
      siteId: siteStore.id,
      visibleOnly: !showAll
    }
  })
  state.strategies = resp.data?.authSiteStrategies ?? []
  state.selectedStrategyId = state.strategies[0].id
}

async function handleLoginResponse (resp) {
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
      $q.loading.hide()
      break
    }
    case 'provideTfa': {
      state.securityCode = ''
      state.screen = 'tfa'
      $q.loading.hide()
      break
    }
    case 'setupTfa': {
      state.securityCode = ''
      state.screen = 'tfasetup'
      state.tfaQRImage = resp.tfaQRImage
      $q.loading.hide()
      break
    }
    case 'redirect': {
      $q.loading.show({
        message: t('auth.loginSuccess')
      })
      Cookies.set('jwt', resp.jwt, { expires: 365, path: '/', sameSite: 'Lax' })
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
      $q.loading.hide()
      $q.notify({
        type: 'negative',
        message: 'Unexpected Authentication Response'
      })
    }
  }
}

/**
 * LOGIN
 */
async function login () {
  $q.loading.show({
    message: t('auth.signingIn')
  })
  try {
    const isFormValid = await loginForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.login'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation(
          $username: String!
          $password: String!
          $strategyId: UUID!
          $siteId: UUID!
          ) {
          login(
            username: $username
            password: $password
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
        username: state.username,
        password: state.password,
        strategyId: state.selectedStrategyId,
        siteId: siteStore.id
      }
    })
    if (resp.data?.login?.operation?.succeeded) {
      state.password = ''
      await handleLoginResponse(resp.data.login)
    } else {
      throw new Error(resp.data?.login?.operation?.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    $q.loading.hide()
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * FORGOT PASSWORD
 */
async function forgotPassword () {
  try {
    const isFormValid = await forgotForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.forgotPassword'))
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * REGISTER
 */
async function register () {
  try {
    const isFormValid = await registerForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.register'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
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
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * CHANGE PASSWORD
 */
async function changePwd () {
  try {
    const isFormValid = await changePwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.register'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation (
          $userId: UUID!
          $continuationToken: String
          $currentPassword: String
          $newPassword: String!
          $strategyId: UUID!
          $siteId: UUID
        ) {
          changePassword (
            userId: $userId
            continuationToken: $continuationToken
            currentPassword: $currentPassword
            newPassword: $newPassword
            strategyId: $strategyId
            siteId: $siteId
          ) {
            operation {
              succeeded
              message
            }
            jwt
            mustChangePwd
            mustProvideTFA
            mustSetupTFA
            continuationToken
            redirect
            tfaQRImage
          }
        }
      `,
      variables: {
        userId: userStore.id,
        continuationToken: state.continuationToken,
        currentPassword: state.password,
        newPassword: state.newPassword,
        strategyId: state.selectedStrategyId,
        siteId: siteStore.id
      }
    })
    if (resp.data?.login?.operation?.succeeded) {
      state.password = ''
      await handleLoginResponse(resp.data.login)
    } else {
      throw new Error(resp.data?.login?.operation?.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * VERIFY TFA TOKEN
 */
async function verifyTFA () {
  $q.loading.show({
    message: t('auth.signingIn')
  })
  try {
    if (!/^[0-9]{6}$/.test(state.securityCode)) {
      throw new Error(t('auth.errors.tfaMissing'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
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
    $q.loading.hide()
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
}

/**
 * FINISH TFA SETUP
 */
async function finishSetupTFA () {
  $q.loading.show({
    message: t('auth.tfaSetupVerifying')
  })
  try {
    if (!/^[0-9]{6}$/.test(state.securityCode)) {
      throw new Error(t('auth.errors.tfaMissing'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
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
      await handleLoginResponse(resp.data.loginTFA)
    } else {
      throw new Error(resp.data?.loginTFA?.operation?.message || t('auth.errors.loginError'))
    }
  } catch (err) {
    $q.loading.hide()
    $q.notify({
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
