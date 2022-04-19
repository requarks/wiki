<template lang="pug">
  v-app
    .login(:style='`background-image: url(` + bgUrl + `);`')
      .login-sd
        .d-flex.mb-5
          .login-logo
            v-avatar(tile, size='34')
              v-img(:src='logoUrl')
          .login-title
            .text-h6.grey--text.text--darken-4 {{ siteTitle }}
        v-alert.mb-0(
          v-model='errorShown'
          transition='slide-y-reverse-transition'
          color='red darken-2'
          tile
          dark
          dense
          icon='mdi-alert'
          )
          .body-2 {{errorMessage}}
        //-------------------------------------------------
        //- PROVIDERS LIST
        //-------------------------------------------------
        template(v-if='screen === `login` && strategies.length > 1')
          .login-subtitle
            .text-subtitle-1 {{$t('auth:selectAuthProvider')}}
          .login-list
            v-list.elevation-1.radius-7(nav, light)
              v-list-item-group(v-model='selectedStrategyKey')
                v-list-item(
                  v-for='(stg, idx) of filteredStrategies'
                  :key='stg.key'
                  :value='stg.key'
                  :color='stg.strategy.color'
                  )
                  v-avatar.mr-3(tile, size='24', v-html='stg.strategy.icon')
                  span.text-none {{stg.displayName}}
        //-------------------------------------------------
        //- LOGIN FORM
        //-------------------------------------------------
        template(v-if='screen === `login` && selectedStrategy.strategy.useForm')
          .login-subtitle
            .text-subtitle-1 {{$t('auth:enterCredentials')}}
          .login-form
            v-text-field(
              solo
              flat
              prepend-inner-icon='mdi-clipboard-account'
              background-color='white'
              color='blue darken-2'
              hide-details
              ref='iptEmail'
              v-model='username'
              :placeholder='isUsernameEmail ? $t(`auth:fields.email`) : $t(`auth:fields.username`)'
              :type='isUsernameEmail ? `email` : `text`'
              :autocomplete='isUsernameEmail ? `email` : `username`'
              light
              )
            v-text-field.mt-2(
              solo
              flat
              prepend-inner-icon='mdi-form-textbox-password'
              background-color='white'
              color='blue darken-2'
              hide-details
              ref='iptPassword'
              v-model='password'
              :append-icon='hidePassword ? "mdi-eye-off" : "mdi-eye"'
              @click:append='() => (hidePassword = !hidePassword)'
              :type='hidePassword ? "password" : "text"'
              :placeholder='$t("auth:fields.password")'
              autocomplete='current-password'
              @keyup.enter='login'
              light
            )
            v-btn.mt-2.text-none(
              width='100%'
              large
              color='blue darken-2'
              dark
              @click='login'
              :loading='isLoading'
              ) {{ $t('auth:actions.login') }}
            .text-center.mt-5
              v-btn.text-none(
                text
                rounded
                color='grey darken-3'
                @click.stop.prevent='forgotPassword'
                href='#forgot'
                ): .caption {{ $t('auth:forgotPasswordLink') }}
              v-btn.text-none(
                v-if='selectedStrategyKey === `local` && selectedStrategy.selfRegistration'
                color='indigo darken-2'
                text
                rounded
                href='/register'
                ): .caption {{ $t('auth:switchToRegister.link') }}
        //-------------------------------------------------
        //- FORGOT PASSWORD FORM
        //-------------------------------------------------
        template(v-if='screen === `forgot`')
          .login-subtitle
            .text-subtitle-1 {{$t('auth:forgotPasswordTitle')}}
          .login-info {{ $t('auth:forgotPasswordSubtitle') }}
          .login-form
            v-text-field(
              solo
              flat
              prepend-inner-icon='mdi-clipboard-account'
              background-color='white'
              color='blue darken-2'
              hide-details
              ref='iptForgotPwdEmail'
              v-model='username'
              :placeholder='$t(`auth:fields.email`)'
              type='email'
              autocomplete='email'
              light
              )
            v-btn.mt-2.text-none(
              width='100%'
              large
              color='blue darken-2'
              dark
              @click='forgotPasswordSubmit'
              :loading='isLoading'
              ) {{ $t('auth:sendResetPassword') }}
            .text-center.mt-5
              v-btn.text-none(
                text
                rounded
                color='grey darken-3'
                @click.stop.prevent='screen = `login`'
                href='#forgot'
                ): .caption {{ $t('auth:forgotPasswordCancel') }}
        //-------------------------------------------------
        //- CHANGE PASSWORD FORM
        //-------------------------------------------------
        template(v-if='screen === `changePwd`')
          .login-subtitle
            .text-subtitle-1 {{ $t('auth:changePwd.subtitle') }}
          .login-form
            v-text-field.mt-2(
              type='password'
              solo
              flat
              prepend-inner-icon='mdi-form-textbox-password'
              background-color='white'
              color='blue darken-2'
              hide-details
              ref='iptNewPassword'
              v-model='newPassword'
              :placeholder='$t(`auth:changePwd.newPasswordPlaceholder`)'
              autocomplete='new-password'
              light
              )
              password-strength(slot='progress', v-model='newPassword')
            v-text-field.mt-2(
              type='password'
              solo
              flat
              prepend-inner-icon='mdi-form-textbox-password'
              background-color='white'
              color='blue darken-2'
              hide-details
              v-model='newPasswordVerify'
              :placeholder='$t(`auth:changePwd.newPasswordVerifyPlaceholder`)'
              autocomplete='new-password'
              @keyup.enter='changePassword'
              light
            )
            v-btn.mt-2.text-none(
              width='100%'
              large
              color='blue darken-2'
              dark
              @click='changePassword'
              :loading='isLoading'
              ) {{ $t('auth:changePwd.proceed') }}

    //-------------------------------------------------
    //- TFA FORM
    //-------------------------------------------------
    v-dialog(v-model='isTFAShown', max-width='500', persistent)
      v-card
        .login-tfa.text-center.pa-5.grey--text.text--darken-3
          img(src='_assets/svg/icon-pin-pad.svg')
          .subtitle-2 {{$t('auth:tfaFormTitle')}}
          v-text-field.login-tfa-field.mt-2(
            solo
            flat
            background-color='white'
            color='blue darken-2'
            hide-details
            ref='iptTFA'
            v-model='securityCode'
            :placeholder='$t("auth:tfa.placeholder")'
            autocomplete='one-time-code'
            @keyup.enter='verifySecurityCode(false)'
            light
          )
          v-btn.mt-2.text-none(
            width='100%'
            large
            color='blue darken-2'
            dark
            @click='verifySecurityCode(false)'
            :loading='isLoading'
            ) {{ $t('auth:tfa.verifyToken') }}

    //-------------------------------------------------
    //- SETUP TFA FORM
    //-------------------------------------------------
    v-dialog(v-model='isTFASetupShown', max-width='600', persistent)
      v-card
        .login-tfa.text-center.pa-5.grey--text.text--darken-3
          .subtitle-1.primary--text {{$t('auth:tfaSetupTitle')}}
          v-divider.my-5
          .subtitle-2 {{$t('auth:tfaSetupInstrFirst')}}
          .caption (#[a(href='https://authy.com/', target='_blank', noopener) Authy], #[a(href='https://support.google.com/accounts/answer/1066447', target='_blank', noopener) Google Authenticator], #[a(href='https://www.microsoft.com/en-us/account/authenticator', target='_blank', noopener) Microsoft Authenticator], etc.)
          .login-tfa-qr.mt-5(v-if='isTFASetupShown', v-html='tfaQRImage')
          .subtitle-2.mt-5 {{$t('auth:tfaSetupInstrSecond')}}
          v-text-field.login-tfa-field.mt-2(
            solo
            flat
            background-color='white'
            color='blue darken-2'
            hide-details
            ref='iptTFASetup'
            v-model='securityCode'
            :placeholder='$t("auth:tfa.placeholder")'
            autocomplete='one-time-code'
            @keyup.enter='verifySecurityCode(true)'
            light
          )
          v-btn.mt-2.text-none(
            width='100%'
            large
            color='blue darken-2'
            dark
            @click='verifySecurityCode(true)'
            :loading='isLoading'
            ) {{ $t('auth:tfa.verifyToken') }}

    loader(v-model='isLoading', :color='loaderColor', :title='loaderTitle', :subtitle='$t(`auth:pleaseWait`)')
    notify(style='padding-top: 64px;')
</template>

<script>
/* global siteConfig */

// <span>Photo by <a href="https://unsplash.com/@isaacquesada?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Isaac Quesada</a> on <a href="/t/textures-patterns?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Unsplash</a></span>

import _ from 'lodash'
import Cookies from 'js-cookie'
import crypto from 'crypto-browserify'
import gql from 'graphql-tag'
import { sync } from 'vuex-pathify'

export default {
  i18nOptions: { namespaces: 'auth' },
  props: {
    bgUrl: {
      type: String,
      default: ''
    },
    hideLocal: {
      type: Boolean,
      default: false
    },
    changePwdContinuationToken: {
      type: String,
      default: null
    }
  },
  data () {
    return {
      error: false,
      strategies: [],
      selectedStrategyKey: 'unselected',
      selectedStrategy: { key: 'unselected', strategy: { useForm: false, usernameType: 'email' } },
      screen: 'login',
      username: '',
      password: '',
      hidePassword: true,
      securityCode: '',
      continuationToken: '',
      isLoading: false,
      loaderColor: 'grey darken-4',
      loaderTitle: 'Working...',
      isShown: false,
      newPassword: '',
      newPasswordVerify: '',
      isTFAShown: false,
      isTFASetupShown: false,
      tfaQRImage: '',
      errorShown: false,
      errorMessage: ''
    }
  },
  computed: {
    activeModal: sync('editor/activeModal'),
    siteTitle () {
      return siteConfig.title
    },
    isSocialShown () {
      return this.strategies.length > 1
    },
    logoUrl () { return siteConfig.logoUrl },
    filteredStrategies () {
      const qParams = new URLSearchParams(window.location.search)
      if (this.hideLocal && !qParams.has('all')) {
        return _.reject(this.strategies, ['key', 'local'])
      } else {
        return this.strategies
      }
    },
    isUsernameEmail () {
      return this.selectedStrategy.strategy.usernameType === `email`
    }
  },
  watch: {
    filteredStrategies (newValue, oldValue) {
      if (_.head(newValue).strategy.useForm) {
        this.selectedStrategyKey = _.head(newValue).key
      }
    },
    selectedStrategyKey (newValue, oldValue) {
      this.selectedStrategy = _.find(this.strategies, ['key', newValue])
      if (this.screen === 'changePwd') {
        return
      }
      this.screen = 'login'
      if (!this.selectedStrategy.strategy.useForm) {
        this.isLoading = true
        window.location.assign('/login/' + newValue)
      } else {
        this.$nextTick(() => {
          this.$refs.iptEmail.focus()
        })
      }
    }
  },
  mounted () {
    this.isShown = true
    if (this.changePwdContinuationToken) {
      this.screen = 'changePwd'
      this.continuationToken = this.changePwdContinuationToken
    }
  },
  methods: {
    /**
     * LOGIN
     */
    async login () {
      this.errorShown = false
      if (this.username.length < 2) {
        this.errorMessage = this.$t('auth:invalidEmailUsername')
        this.errorShown = true
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.errorMessage = this.$t('auth:invalidPassword')
        this.errorShown = true
        this.$refs.iptPassword.focus()
      } else {
        this.loaderColor = 'grey darken-4'
        this.loaderTitle = this.$t('auth:signingIn')
        this.isLoading = true
        try {
          let password = this.password
          const publicKey = await fetch("/.well-known/jwk.pem").then(resp=> resp.text() )
          password = crypto.publicEncrypt(publicKey, Buffer.from(password)).toString("hex")
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
              password: password,
              strategy: this.selectedStrategy.key
            }
          })
          if (_.has(resp, 'data.authentication.login')) {
            const respObj = _.get(resp, 'data.authentication.login', {})
            if (respObj.responseResult.succeeded === true) {
              this.handleLoginResponse(respObj)
            } else {
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error(this.$t('auth:genericError'))
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
    },
    /**
     * VERIFY TFA CODE
     */
    async verifySecurityCode (setup = false) {
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
        this.loaderTitle = this.$t('auth:signingIn')
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
          if (_.has(resp, 'data.authentication.loginTFA')) {
            let respObj = _.get(resp, 'data.authentication.loginTFA', {})
            if (respObj.responseResult.succeeded === true) {
              this.handleLoginResponse(respObj)
            } else {
              if (!setup) {
                this.isTFAShown = false
              }
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error(this.$t('auth:genericError'))
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
    },
    /**
     * CHANGE PASSWORD
     */
    async changePassword () {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = this.$t('auth:changePwd.loading')
      this.isLoading = true
      try {
        let newPassword = this.newPassword
        if (newPassword) {
          const publicKey = await fetch("/.well-known/jwk.pem").then(resp => resp.text())
          newPassword = crypto.publicEncrypt(publicKey, Buffer.from(newPassword)).toString("hex")
        }
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
            newPassword: newPassword
          }
        })
        if (_.has(resp, 'data.authentication.loginChangePassword')) {
          let respObj = _.get(resp, 'data.authentication.loginChangePassword', {})
          if (respObj.responseResult.succeeded === true) {
            this.handleLoginResponse(respObj)
          } else {
            throw new Error(respObj.responseResult.message)
          }
        } else {
          throw new Error(this.$t('auth:genericError'))
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
    },
    /**
     * SWITCH TO FORGOT PASSWORD SCREEN
     */
    forgotPassword () {
      this.screen = 'forgot'
      this.$nextTick(() => {
        this.$refs.iptForgotPwdEmail.focus()
      })
    },
    /**
     * FORGOT PASSWORD SUBMIT
     */
    async forgotPasswordSubmit () {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = this.$t('auth:forgotPasswordLoading')
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
        if (_.has(resp, 'data.authentication.forgotPassword.responseResult')) {
          let respObj = _.get(resp, 'data.authentication.forgotPassword.responseResult', {})
          if (respObj.succeeded === true) {
            this.$store.commit('showNotification', {
              style: 'success',
              message: this.$t('auth:forgotPasswordSuccess'),
              icon: 'email'
            })
            this.screen = 'login'
          } else {
            throw new Error(respObj.message)
          }
        } else {
          throw new Error(this.$t('auth:genericError'))
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
    },
    handleLoginResponse (respObj) {
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
        this.loaderTitle = this.$t('auth:loginSuccess')
        Cookies.set('jwt', respObj.jwt, { expires: 365 })
        _.delay(() => {
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
  },
  apollo: {
    strategies: {
      query: gql`
        {
          authentication {
            activeStrategies(enabledOnly: true) {
              key
              strategy {
                key
                logo
                color
                icon
                useForm
                usernameType
              }
              displayName
              order
              selfRegistration
            }
          }
        }
      `,
      update: (data) => _.sortBy(data.authentication.activeStrategies, ['order']),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'login-strategies-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
  .login {
    // background-image: url('/_assets/img/splash/1.jpg');
    background-color: mc('grey', '900');
    background-size: cover;
    background-position: center center;
    width: 100%;
    height: 100%;

    &-sd {
      background-color: rgba(255,255,255,.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-left: 1px solid rgba(255,255,255,.85);
      border-right: 1px solid rgba(255,255,255,.85);
      width: 450px;
      height: 100%;
      margin-left: 5vw;

      @at-root .no-backdropfilter & {
        background-color: rgba(255,255,255,.95);
      }

      @include until($tablet) {
        margin-left: 0;
        width: 100%;
      }
    }

    &-logo {
      padding: 12px 0 0 12px;
      width: 58px;
      height: 58px;
      background-color: #222;
      margin-left: 12px;
      border-bottom-left-radius: 7px;
      border-bottom-right-radius: 7px;
    }

    &-title {
      height: 58px;
      padding-left: 12px;
      display: flex;
      align-items: center;
      text-shadow: .5px .5px #FFF;
    }

    &-subtitle {
      padding: 24px 12px 12px 12px;
      color: #111;
      font-weight: 500;
      text-shadow: 1px 1px rgba(255,255,255,.5);
      background-image: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,.15));
      text-align: center;
      border-bottom: 1px solid rgba(0,0,0,.3);
    }

    &-info {
      border-top: 1px solid rgba(255,255,255,.85);
      background-color: rgba(255,255,255,.15);
      border-bottom: 1px solid rgba(0,0,0,.15);
      padding: 12px;
      font-size: 13px;
      text-align: center;
      color: mc('grey', '900');
    }

    &-list {
      border-top: 1px solid rgba(255,255,255,.85);
      padding: 12px;
    }

    &-form {
      padding: 12px;
      border-top: 1px solid rgba(255,255,255,.85);
    }

    &-main {
      flex: 1 0 100vw;
      height: 100vh;
    }

    &-tfa {
      background-color: #EEE;
      border: 7px solid #FFF;

      &-field input {
        text-align: center;
      }

      &-qr {
        background-color: #FFF;
        padding: 5px;
        border-radius: 5px;
        width: 200px;
        height: 200px;
        margin: 0 auto;
      }
    }
  }
</style>
