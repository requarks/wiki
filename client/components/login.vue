<template lang="pug">
  v-app
    .login
      v-container(grid-list-lg)
        v-layout(row, wrap)
          v-flex(
            xs12
            offset-sm1, sm10
            offset-md2, md8
            offset-lg3, lg6
            offset-xl4, xl4
            )
            transition(name='fadeUp')
              v-card.elevation-5(v-show='isShown', light)
                v-toolbar(color='indigo', flat, dense, dark)
                  v-spacer
                  .subheading(v-if='screen === "tfa"') {{ $t('auth:tfa.subtitle') }}
                  .subheading(v-if='screen === "changePwd"') {{ $t('auth:changePwd.subtitle') }}
                  .subheading(v-else-if='selectedStrategy.key !== "local"') {{ $t('auth:loginUsingStrategy', { strategy: selectedStrategy.title, interpolation: { escapeValue: false } }) }}
                  .subheading(v-else) {{ $t('auth:loginRequired') }}
                  v-spacer
                v-card-text.text-center
                  h1.display-1.indigo--text.py-2 {{ siteTitle }}
                  template(v-if='screen === "login"')
                    v-text-field.mt-3(
                      solo
                      flat
                      prepend-icon='mdi-clipboard-account'
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptEmail'
                      v-model='username'
                      :placeholder='$t("auth:fields.emailUser")'
                      )
                    v-text-field.mt-2(
                      solo
                      flat
                      prepend-icon='mdi-textbox-password'
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptPassword'
                      v-model='password'
                      :append-icon='hidePassword ? "mdi-eye-off" : "mdi-eye"'
                      @click:append='() => (hidePassword = !hidePassword)'
                      :type='hidePassword ? "password" : "text"'
                      :placeholder='$t("auth:fields.password")'
                      @keyup.enter='login'
                    )
                  template(v-else-if='screen === "tfa"')
                    .body-2 Enter the security code generated from your trusted device:
                    v-text-field.centered.mt-2(
                      solo
                      flat
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptTFA'
                      v-model='securityCode'
                      :placeholder='$t("auth:tfa.placeholder")'
                      @keyup.enter='verifySecurityCode'
                    )
                  template(v-else-if='screen === "changePwd"')
                    .body-2 {{$t('auth:changePwd.instructions')}}
                    v-text-field.mt-2(
                      type='password'
                      solo
                      flat
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptNewPassword'
                      v-model='newPassword'
                      :placeholder='$t(`auth:changePwd.newPasswordPlaceholder`)'
                    )
                    v-text-field.mt-2(
                      type='password'
                      solo
                      flat
                      background-color='grey lighten-4'
                      hide-details
                      v-model='newPasswordVerify'
                      :placeholder='$t(`auth:changePwd.newPasswordVerifyPlaceholder`)'
                      @keyup.enter='changePassword'
                    )
                  template(v-else-if='screen === "forgot"')
                    .body-2 {{ $t('auth:forgotPasswordSubtitle') }}
                    v-text-field.mt-3(
                      solo
                      flat
                      prepend-icon='mdi-email'
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptEmailForgot'
                      v-model='username'
                      :placeholder='$t("auth:fields.email")'
                      )
                v-card-actions.pb-4
                  v-spacer
                  v-btn(
                    width='100%'
                    max-width='250px'
                    v-if='screen === "login"'
                    large
                    color='primary'
                    dark
                    @click='login'
                    rounded
                    :loading='isLoading'
                    ) {{ $t('auth:actions.login') }}
                  v-btn(
                    width='100%'
                    max-width='250px'
                    v-else-if='screen === "tfa"'
                    large
                    color='primary'
                    dark
                    @click='verifySecurityCode'
                    rounded
                    :loading='isLoading'
                    ) {{ $t('auth:tfa.verifyToken') }}
                  v-btn(
                    width='100%'
                    max-width='250px'
                    v-else-if='screen === "changePwd"'
                    large
                    color='primary'
                    dark
                    @click='changePassword'
                    rounded
                    :loading='isLoading'
                    ) {{ $t('auth:changePwd.proceed') }}
                  v-btn(
                    width='100%'
                    max-width='250px'
                    v-else-if='screen === "forgot"'
                    large
                    color='primary'
                    dark
                    @click='forgotPasswordSubmit'
                    rounded
                    :loading='isLoading'
                    ) {{ $t('auth:sendResetPassword') }}
                  v-spacer
                v-card-actions.pb-3(v-if='screen === "login" && selectedStrategy.key === "local"')
                  v-spacer
                  a.caption(@click.stop.prevent='forgotPassword', href='#forgot') {{ $t('auth:forgotPasswordLink') }}
                  v-spacer
                v-card-actions.pb-3(v-else-if='screen === "forgot"')
                  v-spacer
                  a.caption(@click.stop.prevent='screen = `login`', href='#cancelforgot') {{ $t('auth:forgotPasswordCancel') }}
                  v-spacer
                template(v-if='screen === "login" && isSocialShown')
                  v-divider
                  v-card-text.grey.lighten-4.text-center
                    .pb-2.body-2.text-xs-center.grey--text.text--darken-2 {{ $t('auth:orLoginUsingStrategy') }}
                    v-btn.mx-1.social-login-btn(
                      v-for='strategy in strategies', :key='strategy.key'
                      large
                      @click='selectStrategy(strategy)'
                      dark
                      :color='strategy.color'
                      :depressed='strategy.key === selectedStrategy.key'
                      )
                      v-avatar.mr-3(tile, :class='strategy.color', size='24', v-html='strategy.icon')
                      span(style='text-transform: none;') {{ strategy.title }}
                template(v-if='screen === "login" && selectedStrategy.key === `local` && selectedStrategy.selfRegistration')
                  v-divider
                  v-card-actions.py-3(:class='isSocialShown ? "" : "grey lighten-4"')
                    v-spacer
                    i18next.caption(path='auth:switchToRegister.text', tag='div')
                      a.caption(href='/register', place='link') {{ $t('auth:switchToRegister.link') }}
                    v-spacer

    loader(v-model='isLoading', :color='loaderColor', :title='loaderTitle', :subtitle='$t(`auth:pleaseWait`)')
    nav-footer(color='grey darken-5')
    notify
</template>

<script>
/* global siteConfig */

import _ from 'lodash'
import Cookies from 'js-cookie'

import strategiesQuery from 'gql/login/login-query-strategies.gql'
import loginMutation from 'gql/login/login-mutation-login.gql'
import tfaMutation from 'gql/login/login-mutation-tfa.gql'
import changePasswordMutation from 'gql/login/login-mutation-changepassword.gql'

export default {
  i18nOptions: { namespaces: 'auth' },
  data () {
    return {
      error: false,
      strategies: [],
      selectedStrategy: { key: 'local' },
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
      newPasswordVerify: ''
    }
  },
  computed: {
    siteTitle () {
      return siteConfig.title
    },
    isSocialShown () {
      return this.strategies.length > 1
    }
  },
  watch: {
    strategies(newValue, oldValue) {
      this.selectedStrategy = _.find(newValue, ['key', 'local'])
    }
  },
  mounted () {
    this.isShown = true
    this.$nextTick(() => {
      this.$refs.iptEmail.focus()
    })
  },
  methods: {
    /**
     * SELECT STRATEGY
     */
    selectStrategy (strategy) {
      this.selectedStrategy = strategy
      this.screen = 'login'
      if (!strategy.useForm) {
        this.isLoading = true
        window.location.assign('/login/' + strategy.key)
      } else {
        this.$nextTick(() => {
          this.$refs.iptEmail.focus()
        })
      }
    },
    /**
     * LOGIN
     */
    async login () {
      if (this.username.length < 2) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: this.$t('auth:invalidEmailUsername'),
          icon: 'alert'
        })
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: this.$t('auth:invalidPassword'),
          icon: 'alert'
        })
        this.$refs.iptPassword.focus()
      } else {
        this.loaderColor = 'grey darken-4'
        this.loaderTitle = this.$t('auth:signingIn')
        this.isLoading = true
        try {
          let resp = await this.$apollo.mutate({
            mutation: loginMutation,
            variables: {
              username: this.username,
              password: this.password,
              strategy: this.selectedStrategy.key
            }
          })
          if (_.has(resp, 'data.authentication.login')) {
            let respObj = _.get(resp, 'data.authentication.login', {})
            if (respObj.responseResult.succeeded === true) {
              this.continuationToken = respObj.continuationToken
              if (respObj.mustChangePwd === true) {
                this.screen = 'changePwd'
                this.$nextTick(() => {
                  this.$refs.iptNewPassword.focus()
                })
                this.isLoading = false
              } else if (respObj.mustProvideTFA === true) {
                this.screen = 'tfa'
                this.securityCode = ''
                this.$nextTick(() => {
                  this.$refs.iptTFA.focus()
                })
                this.isLoading = false
              } else {
                this.loaderColor = 'green darken-1'
                this.loaderTitle = this.$t('auth:loginSuccess')
                Cookies.set('jwt', respObj.jwt, { expires: 365 })
                _.delay(() => {
                  window.location.replace('/') // TEMPORARY - USE RETURNURL
                }, 1000)
              }
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
    verifySecurityCode () {
      if (this.securityCode.length !== 6) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Enter a valid security code.',
          icon: 'warning'
        })
        this.$refs.iptTFA.focus()
      } else {
        this.isLoading = true
        this.$apollo.mutate({
          mutation: tfaMutation,
          variables: {
            continuationToken: this.continuationToken,
            securityCode: this.securityCode
          }
        }).then(resp => {
          if (_.has(resp, 'data.authentication.loginTFA')) {
            let respObj = _.get(resp, 'data.authentication.loginTFA', {})
            if (respObj.responseResult.succeeded === true) {
              this.$store.commit('showNotification', {
                message: 'Login successful!',
                style: 'success',
                icon: 'check'
              })
              _.delay(() => {
                window.location.replace('/') // TEMPORARY - USE RETURNURL
              }, 1000)
              this.isLoading = false
            } else {
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error(this.$t('auth:genericError'))
          }
        }).catch(err => {
          console.error(err)
          this.$store.commit('showNotification', {
            style: 'red',
            message: err.message,
            icon: 'alert'
          })
          this.isLoading = false
        })
      }
    },
    /**
     * CHANGE PASSWORD
     */
    async changePassword () {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = this.$t('auth:changePwd.loading')
      this.isLoading = true
      const resp = await this.$apollo.mutate({
        mutation: changePasswordMutation,
        variables: {
          continuationToken: this.continuationToken,
          newPassword: this.newPassword
        }
      })
      if (_.get(resp, 'data.authentication.loginChangePassword.responseResult.succeeded', false) === true) {
        this.loaderColor = 'green darken-1'
        this.loaderTitle = this.$t('auth:loginSuccess')
        Cookies.set('jwt', _.get(resp, 'data.authentication.loginChangePassword.jwt', ''), { expires: 365 })
        _.delay(() => {
          window.location.replace('/') // TEMPORARY - USE RETURNURL
        }, 1000)
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.authentication.loginChangePassword.responseResult.message', false),
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
        this.$refs.iptEmailForgot.focus()
      })
    },
    /**
     * FORGOT PASSWORD SUBMIT
     */
    async forgotPasswordSubmit () {
      this.$store.commit('showNotification', {
        style: 'pink',
        message: 'Coming soon!',
        icon: 'ferry'
      })
    }
  },
  apollo: {
    strategies: {
      query: strategiesQuery,
      update: (data) => data.authentication.strategies,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'login-strategies-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
  .login {
    background-color: mc('indigo', '900');
    background-image: url('../static/svg/motif-blocks.svg');
    background-repeat: repeat;
    background-size: 200px;
    width: 100%;
    height: 100%;
    animation: loginBgReveal 20s linear infinite;

    @include keyframes(loginBgReveal) {
      0% {
        background-position-y: 0;
      }
      100% {
        background-position-y: 800px;
      }
    }

    &::before {
      content: '';
      position: absolute;
      background-image: url('../static/svg/motif-overlay.svg');
      background-attachment: fixed;
      background-size: cover;
      opacity: .5;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
    }

    > .container {
      height: 100%;
      align-items: center;
      display: flex;
    }

    .social-login-btn {
      cursor: pointer;
      transition: opacity .2s ease;
      &:hover {
        opacity: .8;
      }
      margin: .25rem 0;
      svg {
        width: 24px;
        height: 24px;
        bottom: 0;
        path {
          fill: #FFF;
        }
      }
    }

    .v-text-field.centered input {
      text-align: center;
    }
  }
</style>
