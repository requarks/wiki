<template lang='pug'>
.auth(:style='`background-image: url(` + bgUrl + `);`')
  .auth-box
    .flex.mb-5
      .auth-login-logo
        q-avatar(square, size='34px')
          q-img(:src='logoUrl')
      .auth-login-title
        .text-h6.text-grey-9 {{ siteTitle }}

    q-banner.bg-red-7.text-white.q-mt-md(
      v-if='errorShown'
      transition='slide-y-reverse-transition'
      dense
      )
      template(v-slot:avatar)
        q-icon.q-pl-sm(name='las la-exclamation-triangle', size='sm')
      span {{errorMessage}}
    //-------------------------------------------------
    //- PROVIDERS LIST
    //-------------------------------------------------
    template(v-if='screen === `login` && strategies.length > 1')
      .auth-login-subtitle
        .text-subtitle1 {{$t('auth.selectAuthProvider')}}
      .auth-login-list
        q-list.bg-white.shadow-2.rounded-borders.q-pa-sm(separator)
          q-item.rounded-borders(
            clickable
            v-ripple
            v-for='(stg, idx) of filteredStrategies'
            :key='stg.key'
            @click='selectedStrategyKey = stg.key'
            :class='stg.key === selectedStrategyKey ? `bg-primary text-white` : ``'
            )
            q-item-section(avatar)
              q-avatar.mr-3(:color='stg.strategy.color', rounded, size='32px')
                div(v-html='stg.strategy.icon')
            q-item-section
              span.text-none {{stg.displayName}}
    //-------------------------------------------------
    //- LOGIN FORM
    //-------------------------------------------------
    template(v-if='screen === `login` && selectedStrategy.strategy.useForm')
      .auth-login-subtitle
        .text-subtitle1 {{$t('auth.enterCredentials')}}
      .auth-login-form
        q-input.text-black(
          outlined
          bg-color='white'
          ref='iptEmail'
          v-model='username'
          :label='isUsernameEmail ? $t(`auth.fields.email`) : $t(`auth.fields.username`)'
          :type='isUsernameEmail ? `email` : `text`'
          :autocomplete='isUsernameEmail ? `email` : `username`'
          )
          template(v-slot:prepend)
            q-icon(name='las la-user-circle', color='primary')
        q-input.q-mt-sm(
          outlined
          bg-color='white'
          ref='iptPassword'
          v-model='password'
          :type='hidePassword ? "password" : "text"'
          :label='$t("auth:fields.password")'
          autocomplete='current-password'
          @keyup.enter='login'
          )
          template(v-slot:prepend)
            q-icon(name='las la-key', color='primary')
          template(v-slot:append)
            q-icon.cursor-pointer(
              :name='hidePassword ? "las la-eye-slash" : "las la-eye"'
              @click='() => (hidePassword = !hidePassword)'
              )
        q-btn.q-mt-sm.q-py-xs.full-width(
          no-caps
          color='blue-7'
          push
          @click='login'
          :loading='isLoading'
          :label='$t(`auth.actions.login`)'
          icon='las la-arrow-right'
          )
        .text-center.q-mt-lg
          q-btn(
            flat
            no-caps
            rounded
            color='grey-8'
            @click.stop.prevent='forgotPassword'
            href='#forgot'
            ): .text-caption {{ $t('auth.forgotPasswordLink') }}
          q-btn(
            v-if='selectedStrategyKey === `local` && selectedStrategy.selfRegistration'
            color='indigo darken-2'
            flat
            no-caps
            rounded
            href='/register'
            ): .text-caption {{ $t('auth.switchToRegister.link') }}
</template>

<script>
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import find from 'lodash/find'
import _get from 'lodash/get'
import has from 'lodash/has'
import head from 'lodash/head'
import reject from 'lodash/reject'
import sortBy from 'lodash/sortBy'
import Cookies from 'js-cookie'

export default {
  name: 'PageLogin',
  i18nOptions: { namespaces: 'auth' },
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
      errorMessage: '',
      bgUrl: '_assets/bg/login-v3.jpg'
    }
  },
  computed: {
    logoUrl: get('site/logoUrl', false),
    siteTitle: get('site/title', false),
    isSocialShown () {
      return this.strategies.length > 1
    },
    filteredStrategies () {
      const qParams = new URLSearchParams(!import.meta.env.SSR ? window.location.search : '')
      if (this.hideLocal && !qParams.has('all')) {
        return reject(this.strategies, ['key', 'local'])
      } else {
        return this.strategies
      }
    },
    isUsernameEmail () {
      return this.selectedStrategy.strategy.usernameType === 'email'
    }
  },
  watch: {
    filteredStrategies (newValue, oldValue) {
      if (head(newValue).strategy.useForm) {
        this.selectedStrategyKey = head(newValue).key
      }
    },
    selectedStrategyKey (newValue, oldValue) {
      this.selectedStrategy = find(this.strategies, ['key', newValue])
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
        this.errorMessage = this.$t('auth.invalidEmailUsername')
        this.errorShown = true
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.errorMessage = this.$t('auth.invalidPassword')
        this.errorShown = true
        this.$refs.iptPassword.focus()
      } else {
        this.loaderColor = 'grey darken-4'
        this.loaderTitle = this.$t('auth.signingIn')
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
            const respObj = _get(resp, 'data.authentication.login', {})
            if (respObj.responseResult.succeeded === true) {
              this.handleLoginResponse(respObj)
            } else {
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error(this.$t('auth.genericError'))
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
        this.loaderTitle = this.$t('auth.signingIn')
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
            const respObj = _get(resp, 'data.authentication.loginTFA', {})
            if (respObj.responseResult.succeeded === true) {
              this.handleLoginResponse(respObj)
            } else {
              if (!setup) {
                this.isTFAShown = false
              }
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error(this.$t('auth.genericError'))
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
    },
    /**
     * CHANGE PASSWORD
     */
    async changePassword () {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = this.$t('auth.changePwd.loading')
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
          const respObj = _get(resp, 'data.authentication.loginChangePassword', {})
          if (respObj.responseResult.succeeded === true) {
            this.handleLoginResponse(respObj)
          } else {
            throw new Error(respObj.responseResult.message)
          }
        } else {
          throw new Error(this.$t('auth.genericError'))
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
      this.loaderTitle = this.$t('auth.forgotPasswordLoading')
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
          const respObj = _get(resp, 'data.authentication.forgotPassword.responseResult', {})
          if (respObj.succeeded === true) {
            this.$store.commit('showNotification', {
              style: 'success',
              message: this.$t('auth.forgotPasswordSuccess'),
              icon: 'email'
            })
            this.screen = 'login'
          } else {
            throw new Error(respObj.message)
          }
        } else {
          throw new Error(this.$t('auth.genericError'))
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
        this.loaderTitle = this.$t('auth.loginSuccess')
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
  },
  apollo: {
    strategies: {
      prefetch: false,
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
      update: (data) => sortBy(data.authentication.activeStrategies, ['order']),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'login-strategies-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
  .auth-login {
    &-logo {
      padding: 12px 0 0 12px;
      width: 58px;
      height: 58px;
      background-color: #000;
      margin-left: 12px;
      border-radius: 7px;
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
