<template lang="pug">
  v-app
    .login-modern(:style='`background-image: url(` + bgUrl + `);`')
      //- Centered login card
      .login-container
        v-card.login-card.elevation-3
          v-card-text.pa-6
            //- Logo centered at top
            .login-card-header.mb-3
              v-avatar.mb-3(tile, size='48')
                v-img(:src='logoUrl')
              .text-subtitle-1.font-weight-medium(:style='`color: ${colors.neutral[800]}`') {{ siteTitle }}
            
            //-------------------------------------------------
            //- LOGIN HEADING
            //-------------------------------------------------
            template(v-if='screen === `login`')
              .login-heading
                .font-weight-light(:style='`color: ${colors.neutral[800]}; font-size: 1.9rem; line-height: 1.2;`') Log In
            
            //-------------------------------------------------
            //- PROVIDERS LIST
            //-------------------------------------------------
            template(v-if='screen === `login` && strategies.length > 1')
              .text-subtitle-1.mb-4.text-center.font-weight-light(:style='`color: ${colors.neutral[700]}`') {{$t('auth:selectAuthProvider')}}
              .providers-container.mb-4
                button.provider-button(
                  v-for='(stg, idx) of filteredStrategies'
                  :key='stg.key'
                  @click='selectedStrategyKey = stg.key; providerSelected = true'
                  :class='{ active: selectedStrategyKey === stg.key }'
                  :style='`color: #23364B; border-color: #6B7A90;`'
                  )
                  .provider-icon(:style='`color: #23364B;`', v-html='stg.strategy.icon')
                  .provider-text {{stg.displayName}}
            
            //-------------------------------------------------
            //- LOGIN FORM
            //-------------------------------------------------
            template(v-if='screen === `login` && selectedStrategy.strategy.useForm && (strategies.length === 1 || providerSelected)')
              //- Create account link at top (if enabled)
              .text-center.mb-4(v-if='selectedStrategyKey === `local` && selectedStrategy.selfRegistration')
                span.text-caption(:style='`color: ${colors.neutral[600]}`') {{ $t('auth:switchToRegister.text') }}
                a.text-caption.ml-1.font-weight-medium(
                  :style='`color: ${colors.blue[700]}; text-decoration: none;`'
                  href='/register'
                  ) {{ $t('auth:switchToRegister.link') }}
              
              //- Title - always show for form-based auth
              .text-subtitle-1.mb-3.text-center.font-weight-medium(:style='`color: ${colors.neutral[700]}`') {{$t('auth:enterCredentials')}}
              
              //- Error alert - positioned above inputs (closer to inputs)
              v-alert.login-error-alert.mb-4(
                v-model='errorShown'
                :style='`background-color: ${colors.surfaceLight.negative} !important;`'
                dense
                colored-border
                transition='slide-y-reverse-transition'
                )
                .d-flex.align-center
                  v-icon.mr-2(:style='`color: ${colors.red[600]} !important;`') mdi-alert-circle
                  span(:style='`color: ${colors.neutral[900]} !important;`') {{errorMessage}}
              v-text-field.login-input(
                outlined
                dense
                prepend-inner-icon='mdi-account'
                hide-details='auto'
                ref='iptEmail'
                v-model='username'
                :label='isUsernameEmail ? $t(`auth:fields.email`) : $t(`auth:fields.username`)'
                :type='isUsernameEmail ? `email` : `text`'
                :autocomplete='isUsernameEmail ? `email` : `username`'
                :background-color='colors.surfaceLight.white'
                :color='colors.surfaceLight.primaryBlueHeavy'
                :style='`margin-bottom: 24px;`'
                )
              v-text-field.login-input(
                outlined
                dense
                prepend-inner-icon='mdi-lock'
                hide-details='auto'
                ref='iptPassword'
                v-model='password'
                :append-icon='hidePassword ? "mdi-eye-off" : "mdi-eye"'
                @click:append='() => (hidePassword = !hidePassword)'
                :type='hidePassword ? "password" : "text"'
                :label='$t("auth:fields.password")'
                autocomplete='current-password'
                @keyup.enter='login'
                :background-color='colors.surfaceLight.white'
                :color='colors.surfaceLight.primaryBlueHeavy'
              )
              
              //- Forgot password link - left aligned
              .text-left.mt-2(v-if='selectedStrategyKey === `local`')
                a.text-caption(
                  :style='`color: ${colors.blue[700]}; text-decoration: none;`'
                  @click.stop.prevent='forgotPassword'
                  href='#forgot'
                  ) {{ $t('auth:forgotPasswordLink') }}
              
              v-btn.mt-6.text-none(
                block
                large
                depressed
                :color='colors.surfaceLight.buttonPrimary'
                dark
                @click='login'
                :loading='isLoading'
                :style='`border-radius: 20px; text-transform: none; letter-spacing: 0;`'
                ) {{ $t('auth:actions.login') }}
            
            //-------------------------------------------------
            //- FORGOT PASSWORD FORM
            //-------------------------------------------------
            template(v-if='screen === `forgot`')
              .text-subtitle-2.mb-1.grey--text.text--darken-2 {{$t('auth:forgotPasswordTitle')}}
              .body-2.mb-4.grey--text {{ $t('auth:forgotPasswordSubtitle') }}
              v-text-field.login-input(
                outlined
                dense
                prepend-inner-icon='mdi-email'
                hide-details='auto'
                ref='iptForgotPwdEmail'
                v-model='username'
                :label='$t(`auth:fields.email`)'
                type='email'
                autocomplete='email'
                :background-color='colors.surfaceLight.white'
                :color='colors.surfaceLight.primaryBlueHeavy'
                )
              v-btn.mt-6.text-none(
                block
                large
                depressed
                :color='colors.surfaceLight.buttonPrimary'
                dark
                @click='forgotPasswordSubmit'
                :loading='isLoading'
                :style='`border-radius: 20px; text-transform: none; letter-spacing: 0;`'
                ) {{ $t('auth:sendResetPassword') }}
              .text-center.mt-4
                v-btn.text-none(
                  text
                  small
                  :color='colors.blue[700]'
                  @click.stop.prevent='screen = `login`'
                  href='#forgot'
                  ): span {{ $t('auth:forgotPasswordCancel') }}
            
            //-------------------------------------------------
            //- CHANGE PASSWORD FORM
            //-------------------------------------------------
            template(v-if='screen === `changePwd`')
              .text-subtitle-2.mb-4.grey--text.text--darken-2 {{ $t('auth:changePwd.subtitle') }}
              v-text-field.login-input(
                type='password'
                outlined
                dense
                prepend-inner-icon='mdi-lock-reset'
                hide-details='auto'
                ref='iptNewPassword'
                v-model='newPassword'
                :label='$t(`auth:changePwd.newPasswordPlaceholder`)'
                autocomplete='new-password'
                :background-color='colors.surfaceLight.white'
                :color='colors.surfaceLight.primaryBlueHeavy'
                )
                password-strength(slot='progress', v-model='newPassword')
              v-text-field.login-input.mt-5(
                type='password'
                outlined
                dense
                prepend-inner-icon='mdi-lock-check'
                hide-details='auto'
                v-model='newPasswordVerify'
                :label='$t(`auth:changePwd.newPasswordVerifyPlaceholder`)'
                autocomplete='new-password'
                @keyup.enter='changePassword'
                :background-color='colors.surfaceLight.white'
                :color='colors.surfaceLight.primaryBlueHeavy'
              )
              v-btn.mt-6.text-none(
                block
                large
                depressed
                :color='colors.surfaceLight.buttonPrimary'
                dark
                @click='changePassword'
                :loading='isLoading'
                :style='`border-radius: 20px; text-transform: none; letter-spacing: 0;`'
                ) {{ $t('auth:changePwd.proceed') }}

    //-------------------------------------------------
    //- TFA FORM
    //-------------------------------------------------
    v-dialog(v-model='isTFAShown', max-width='450', persistent)
      v-card.rounded-lg
        v-card-text.pa-8.text-center
          img(src='_assets/svg/icon-pin-pad.svg', style='max-width: 80px; margin: 0 auto;')
          .text-h6.mt-4.mb-2 {{$t('auth:tfaFormTitle')}}
          v-text-field.login-input.mt-4(
            outlined
            dense
            hide-details='auto'
            ref='iptTFA'
            v-model='securityCode'
            label='Security Code'
            placeholder='Enter 6-digit code'
            autocomplete='one-time-code'
            @keyup.enter='verifySecurityCode(false)'
            :background-color='colors.surfaceLight.white'
            :color='colors.surfaceLight.primaryBlueHeavy'
          )
          v-btn.mt-6.text-none(
            block
            large
            depressed
            :color='colors.surfaceLight.buttonPrimary'
            dark
            @click='verifySecurityCode(false)'
            :loading='isLoading'
            :style='`border-radius: 20px; text-transform: none; letter-spacing: 0;`'
            ) {{ $t('auth:tfa.verifyToken') }}

    //-------------------------------------------------
    //- SETUP TFA FORM
    //-------------------------------------------------
    v-dialog(v-model='isTFASetupShown', max-width='550', persistent)
      v-card.rounded-lg
        v-card-text.pa-8.text-center
          .text-h6.primary--text.mb-2 {{$t('auth:tfaSetupTitle')}}
          v-divider.my-4
          .body-2.mb-2 {{$t('auth:tfaSetupInstrFirst')}}
          .caption.grey--text (#[a(href='https://authy.com/', target='_blank', noopener) Authy], #[a(href='https://support.google.com/accounts/answer/1066447', target='_blank', noopener) Google Authenticator], #[a(href='https://www.microsoft.com/en-us/account/authenticator', target='_blank', noopener) Microsoft Authenticator], etc.)
          .login-tfa-qr.mt-4.mx-auto(v-if='isTFASetupShown', v-html='tfaQRImage', style='width: 200px;')
          .body-2.mt-4.mb-2 {{$t('auth:tfaSetupInstrSecond')}}
          v-text-field.login-input.mt-4(
            outlined
            dense
            hide-details='auto'
            ref='iptTFASetup'
            v-model='securityCode'
            label='Security Code'
            placeholder='Enter 6-digit code'
            autocomplete='one-time-code'
            @keyup.enter='verifySecurityCode(true)'
            :background-color='colors.surfaceLight.white'
            :color='colors.surfaceLight.primaryBlueHeavy'
          )
          v-btn.mt-6.text-none(
            block
            large
            depressed
            :color='colors.surfaceLight.buttonPrimary'
            dark
            @click='verifySecurityCode(true)'
            :loading='isLoading'
            :style='`border-radius: 20px; text-transform: none; letter-spacing: 0;`'
            ) {{ $t('auth:tfa.verifyToken') }}

    login-loader(
      v-model='isLoading'
      :mode='loaderMode'
      :title='loaderTitle'
      :subtitle='loaderSubtitle'
    )
    notify(style='padding-top: 64px;')
</template>

<script>
/* global siteConfig */

// <span>Photo by <a href="https://unsplash.com/@isaacquesada?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Isaac Quesada</a> on <a href="/t/textures-patterns?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Unsplash</a></span>

import _ from 'lodash'
import Cookies from 'js-cookie'
import gql from 'graphql-tag'
import { sync } from 'vuex-pathify'
import colors from '@/themes/default/js/color-scheme'
import LoginLoader from './login/login-loader.vue'

export default {
  components: {
    LoginLoader
  },
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
      colors,
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
      loaderMode: 'loading',
      loaderTitle: 'Working...',
      loaderSubtitle: 'Please wait',
      isShown: false,
      newPassword: '',
      newPasswordVerify: '',
      isTFAShown: false,
      isTFASetupShown: false,
      tfaQRImage: '',
      errorShown: false,
      errorMessage: '',
      providerSelected: false // Track if user has selected a provider
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
      if (newValue.length === 1 && _.head(newValue).strategy.useForm) {
        this.selectedStrategyKey = _.head(newValue).key
        this.providerSelected = true
      } else {
        this.providerSelected = false
      }
    },
    selectedStrategyKey (newValue, oldValue) {
      this.selectedStrategy = _.find(this.strategies, ['key', newValue])
      if (this.screen === 'changePwd') {
        return
      }
      this.screen = 'login'
      
      // For multiple providers: mark as selected when user actually clicks (not on initial auto-select)
      // We know it's a user click if we already have strategies loaded and it's not the first assignment
      if (this.strategies.length > 1 && oldValue && oldValue !== 'unselected') {
        this.providerSelected = true
      }
      
      if (!this.selectedStrategy.strategy.useForm) {
        this.isLoading = true
        window.location.assign('/login/' + newValue)
      } else {
        this.$nextTick(() => {
          if (this.$refs.iptEmail) {
            this.$refs.iptEmail.focus()
          }
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
        this.loaderMode = 'loading'
        this.loaderTitle = this.$t('auth:signingIn')
        this.loaderSubtitle = this.$t('auth:pleaseWait')
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
          this.errorMessage = err.message
          this.errorShown = true
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
        this.loaderMode = 'success'
        this.loaderTitle = this.$t('auth:loginSuccess')
        this.loaderSubtitle = ''
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
        }, 1500)
      }
    }
  },
  apollo: {
    strategies: {
      query: gql`
        {
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
      `,
      update: (data) => _.sortBy(data.activeStrategies, ['order']),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'login-strategies-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
  .login-modern {
    background-color: mc('neutral', '900');
    background-size: cover;
    background-position: center center;
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 24px;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 0;
    }
  }

  .login-container {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
  }

  .login-card {
    border-radius: 12px !important;
    background: #ffffff !important;
    box-shadow: 0 4px 16px rgba(16, 24, 40, 0.08) !important;
    
    @include until($tablet) {
      max-width: 100%;
    }

    .v-text-field--outlined fieldset {
      border-color: #CBD5E1;
      border-width: 1px;
      border-radius: 4px;
    }
    
    .v-text-field--outlined:hover fieldset {
      border-color: #a8b0bc;
    }
    
    .v-input--is-focused fieldset {
      border-width: 2px;
      border-color: #2E5A88 !important;
    }
    
    .login-input {
      .v-input__prepend-inner .v-icon,
      .v-input__append-inner .v-icon {
        color: #9a9ba1 !important;
      }
      
      &.v-input--is-focused {
        .v-input__prepend-inner .v-icon {
          color: #2E5A88 !important;
        }
        .v-input__append-inner .v-icon {
          color: #9a9ba1 !important;
        }
      }
      
      .v-label {
        color: #757575 !important;
        font-size: 14px;
      }
      
      &.v-input--is-focused .v-label {
        color: #002b49 !important;
      }
      
      input {
        color: #272936 !important;
        font-size: 14px;
      }
    }
  }

  .login-card-header {
    text-align: center;
    padding-bottom: 20px;
    border-bottom: 1px solid #e7e7e8;
  }
  
  .v-list {
    background: transparent !important;
    
    .v-list-item {
      border-radius: 4px;
      margin-bottom: 8px;
      
      &:hover {
        background-color: rgba(0, 0, 0, 0.02);
      }
      
      &--active {
        background-color: rgba(0, 112, 173, 0.08) !important;
      }
    }
    
    .v-list-item__title {
      color: #272936 !important;
      font-size: 14px;
    }
    
    .v-list-item__avatar {
      svg {
        color: #6b6d76 !important;
        fill: #6b6d76 !important;
      }
      
      ::v-deep svg {
        color: #6b6d76 !important;
        fill: #6b6d76 !important;
        
        path {
          fill: #6b6d76 !important;
        }
      }
    }
  }

  .login-error-alert {
    border-left: 4px solid #D92D20 !important;
    
    ::v-deep .v-alert__wrapper {
      padding: 0;
    }
    
    ::v-deep .v-alert__content {
      width: 100%;
    }
    
    .v-icon {
      color: #D92D20 !important;
    }
  }

  .login-tfa-qr {
    background-color: #FFF;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    
    svg, img {
      display: block;
      width: 100%;
      height: auto;
    }
  }
  
  .v-dialog {
    .login-input {
      .v-label {
        color: #757575 !important;
        font-size: 14px;
      }
      
      &.v-input--is-focused .v-label {
        color: #002b49 !important;
      }
      
      input {
        color: #272936 !important;
        font-size: 14px;
      }
      
      &.v-text-field--outlined fieldset {
        border-color: #CBD5E1;
        border-width: 1px;
        border-radius: 4px;
      }
      
      &.v-text-field--outlined:hover fieldset {
        border-color: #a8b0bc;
      }
      
      &.v-input--is-focused fieldset {
        border-width: 2px;
        border-color: #2E5A88 !important;
        outline: 2px solid #2E5A88;
        outline-offset: 2px;
      }
    }
  }
  
  .providers-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .provider-button {
    width: 100%;
    padding: 10px 12px;
    border: 2px solid #6B7A90;
    border-radius: 20px;
    background-color: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #23364B;
    transition: all 0.2s ease;
    
    &:hover {
      background-color: rgba(107, 122, 144, 0.05);
      border-color: #546B7F;
    }
    
    &.active {
      background-color: rgba(46, 90, 136, 0.1);
      border-color: #2E5A88;
      color: #1A2D3A;
    }
    
    &:active {
      transform: scale(0.98);
    }
  }
  
  .provider-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    
    svg {
      width: 100%;
      height: 100%;
      color: inherit;
      fill: currentColor;
    }
    
    i {
      color: inherit;
      font-size: 18px;
    }
  }
  
  .provider-text {
    text-align: center;
  }
  
  .login-heading {
    text-align: center;
    margin-bottom: 12px;
  }
</style>
