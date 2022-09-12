<template lang='pug'>
.auth
  .auth-content
    .auth-logo
      img(:src='`/_site/logo`' :alt='siteStore.title')
    h2.auth-site-title(v-if='siteStore.logoText') {{ siteStore.title }}
    p.text-grey-7 Login to continue
    auth-login-panel
  .auth-bg(aria-hidden="true")
    img(:src='`/_site/loginbg`' alt='')
</template>

<script setup>
import gql from 'graphql-tag'
import { find, has, head, reject, sortBy } from 'lodash-es'
import Cookies from 'js-cookie'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive, watch } from 'vue'

import AuthLoginPanel from 'src/components/AuthLoginPanel.vue'

import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('auth.login.title')
})

// DATA

const state = reactive({
  bgUrl: '_assets/bg/login-v3.jpg'
})

// isSocialShown () {
//   return this.strategies.length > 1
// }
// filteredStrategies () {
//   const qParams = new URLSearchParams(!import.meta.env.SSR ? window.location.search : '')
//   if (this.hideLocal && !qParams.has('all')) {
//     return reject(this.strategies, ['key', 'local'])
//   } else {
//     return this.strategies
//   }
// }
// isUsernameEmail () {
//   return this.selectedStrategy.strategy.usernameType === 'email'
// }

// filteredStrategies (newValue, oldValue) {
//   if (head(newValue).strategy.useForm) {
//     this.selectedStrategyKey = head(newValue).key
//   }
// }
// selectedStrategyKey (newValue, oldValue) {
//   this.selectedStrategy = find(this.strategies, ['key', newValue])
//   if (this.screen === 'changePwd') {
//     return
//   }
//   this.screen = 'login'
//   if (!this.selectedStrategy.strategy.useForm) {
//     this.isLoading = true
//     window.location.assign('/login/' + newValue)
//   } else {
//     this.$nextTick(() => {
//       this.$refs.iptEmail.focus()
//     })
//   }
// }

//   mounted () {
//     this.isShown = true
//     if (this.changePwdContinuationToken) {
//       this.screen = 'changePwd'
//       this.continuationToken = this.changePwdContinuationToken
//     }
//   }

// METHODS

/**
 * LOGIN
 */
async function login () {
  this.errorShown = false
  if (this.username.length < 2) {
    this.errorMessage = t('auth.invalidEmailUsername')
    this.errorShown = true
    this.$refs.iptEmail.focus()
  } else if (this.password.length < 2) {
    this.errorMessage = t('auth.invalidPassword')
    this.errorShown = true
    this.$refs.iptPassword.focus()
  } else {
    this.loaderColor = 'grey darken-4'
    this.loaderTitle = t('auth.signingIn')
    this.isLoading = true
    try {
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation($username: String!, $password: String!, $strategy: String!) {
            authentication {
              login(username: $username, password: $password, strategy: $strategy) {
                responseResult {
                  succeeded
                  errorCode
                  slug
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
          }
        `,
        variables: {
          username: this.username,
          password: this.password,
          strategy: this.selectedStrategy.key
        }
      })
      if (has(resp, 'data.authentication.login')) {
        const respObj = resp?.data?.authentication?.login ?? {}
        if (respObj.responseResult.succeeded === true) {
          this.handleLoginResponse(respObj)
        } else {
          throw new Error(respObj.responseResult.message)
        }
      } else {
        throw new Error(t('auth.genericError'))
      }
    } catch (err) {
      console.error(err)
      this.$q.notify({
        type: 'negative',
        message: err.message
      })
      this.isLoading = false
    }
  }
}

/**
 * VERIFY TFA CODE
 */
async function verifySecurityCode (setup = false) {
  if (this.securityCode.length !== 6) {
    this.$store.commit('showNotification', {
      style: 'red',
      message: 'Enter a valid security code.',
      icon: 'alert'
    })
    if (setup) {
      this.$refs.iptTFASetup.focus()
    } else {
      this.$refs.iptTFA.focus()
    }
  } else {
    this.loaderColor = 'grey darken-4'
    this.loaderTitle = t('auth.signingIn')
    this.isLoading = true
    try {
      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation(
            $continuationToken: String!
            $securityCode: String!
            $setup: Boolean
            ) {
            authentication {
              loginTFA(
                continuationToken: $continuationToken
                securityCode: $securityCode
                setup: $setup
                ) {
                responseResult {
                  succeeded
                  errorCode
                  slug
                  message
                }
                jwt
                mustChangePwd
                continuationToken
                redirect
              }
            }
          }
        `,
        variables: {
          continuationToken: this.continuationToken,
          securityCode: this.securityCode,
          setup
        }
      })
      if (has(resp, 'data.authentication.loginTFA')) {
        const respObj = resp?.data?.authentication?.loginTFA ?? {}
        if (respObj.responseResult.succeeded === true) {
          this.handleLoginResponse(respObj)
        } else {
          if (!setup) {
            this.isTFAShown = false
          }
          throw new Error(respObj.responseResult.message)
        }
      } else {
        throw new Error(t('auth.genericError'))
      }
    } catch (err) {
      console.error(err)
      this.$q.notify({
        type: 'negative',
        message: err.message
      })
      this.isLoading = false
    }
  }
}

/**
 * CHANGE PASSWORD
 */
async function changePassword () {
  this.loaderColor = 'grey darken-4'
  this.loaderTitle = t('auth.changePwd.loading')
  this.isLoading = true
  try {
    const resp = await this.$apollo.mutate({
      mutation: gql`
        mutation (
          $continuationToken: String!
          $newPassword: String!
        ) {
          authentication {
            loginChangePassword (
              continuationToken: $continuationToken
              newPassword: $newPassword
            ) {
              responseResult {
                succeeded
                errorCode
                slug
                message
              }
              jwt
              continuationToken
              redirect
            }
          }
        }
      `,
      variables: {
        continuationToken: this.continuationToken,
        newPassword: this.newPassword
      }
    })
    if (has(resp, 'data.authentication.loginChangePassword')) {
      const respObj = resp?.data?.authentication?.loginChangePassword ?? {}
      if (respObj.responseResult.succeeded === true) {
        this.handleLoginResponse(respObj)
      } else {
        throw new Error(respObj.responseResult.message)
      }
    } else {
      throw new Error(t('auth.genericError'))
    }
  } catch (err) {
    console.error(err)
    this.$store.commit('showNotification', {
      style: 'red',
      message: err.message,
      icon: 'alert'
    })
    this.isLoading = false
  }
}

/**
 * SWITCH TO FORGOT PASSWORD SCREEN
 */
function forgotPassword () {
  this.screen = 'forgot'
  this.$nextTick(() => {
    this.$refs.iptForgotPwdEmail.focus()
  })
}

/**
 * FORGOT PASSWORD SUBMIT
 */
async function forgotPasswordSubmit () {
  this.loaderColor = 'grey darken-4'
  this.loaderTitle = t('auth.forgotPasswordLoading')
  this.isLoading = true
  try {
    const resp = await this.$apollo.mutate({
      mutation: gql`
        mutation (
          $email: String!
        ) {
          authentication {
            forgotPassword (
              email: $email
            ) {
              responseResult {
                succeeded
                errorCode
                slug
                message
              }
            }
          }
        }
      `,
      variables: {
        email: this.username
      }
    })
    if (has(resp, 'data.authentication.forgotPassword.responseResult')) {
      const respObj = resp?.data?.authentication?.forgotPassword?.responseResult ?? {}
      if (respObj.succeeded === true) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: t('auth.forgotPasswordSuccess'),
          icon: 'email'
        })
        this.screen = 'login'
      } else {
        throw new Error(respObj.message)
      }
    } else {
      throw new Error(t('auth.genericError'))
    }
  } catch (err) {
    console.error(err)
    this.$store.commit('showNotification', {
      style: 'red',
      message: err.message,
      icon: 'alert'
    })
  }
  this.isLoading = false
}

function handleLoginResponse (respObj) {
  this.continuationToken = respObj.continuationToken
  if (respObj.mustChangePwd === true) {
    this.screen = 'changePwd'
    this.$nextTick(() => {
      this.$refs.iptNewPassword.focus()
    })
    this.isLoading = false
  } else if (respObj.mustProvideTFA === true) {
    this.securityCode = ''
    this.isTFAShown = true
    setTimeout(() => {
      this.$refs.iptTFA.focus()
    }, 500)
    this.isLoading = false
  } else if (respObj.mustSetupTFA === true) {
    this.securityCode = ''
    this.isTFASetupShown = true
    this.tfaQRImage = respObj.tfaQRImage
    setTimeout(() => {
      this.$refs.iptTFASetup.focus()
    }, 500)
    this.isLoading = false
  } else {
    this.loaderColor = 'green darken-1'
    this.loaderTitle = t('auth.loginSuccess')
    Cookies.set('jwt', respObj.jwt, { expires: 365 })
    setTimeout(() => {
      const loginRedirect = Cookies.get('loginRedirect')
      if (loginRedirect === '/' && respObj.redirect) {
        Cookies.remove('loginRedirect')
        window.location.replace(respObj.redirect)
      } else if (loginRedirect) {
        Cookies.remove('loginRedirect')
        window.location.replace(loginRedirect)
      } else if (respObj.redirect) {
        window.location.replace(respObj.redirect)
      } else {
        window.location.replace('/')
      }
    }, 1000)
  }
}

onMounted(() => {
  // fetchStrategies()
})
</script>

<style lang="scss">
 .auth {
    background-color: #FFF;
    display: flex;

    @at-root .body--dark & {
      background-color: $dark-6;
    }

    &-content {
      flex: 1 0 100%;
      width: 100%;
      max-width: 500px;
      padding: 3rem 4rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: stretch;

      @media (max-width: $breakpoint-xs-max) {
        padding: 1rem 2rem;
        max-width: 100vw;
      }
    }

    &-logo {
      margin-bottom: 6px;

      img {
        height: 72px;
      }
    }

    &-site-title {
      font-size: 1.875rem;
      line-height: 2.25rem;
      font-weight: 700;
      margin: 0;
      color: $blue-grey-9;

      @at-root .body--dark & {
        color: $blue-grey-1;
      }
    }

    &-strategies {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(45%, 1fr));
      gap: 10px;
    }

    &-bg {
      flex: 1;
      flex-basis: 0;
      position: relative;
      height: 100vh;
      overflow: hidden;

      img {
        position: relative;
        width: 100%;
        height: 100%;
        object-fit: cover;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        margin: 0;
        padding: 0;
      }
    }
  }
</style>
