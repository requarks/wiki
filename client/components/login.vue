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
              v-card.elevation-5.md2(v-show='isShown')
                v-toolbar(color='primary', flat, dense, dark)
                  v-spacer
                  .subheading(v-if='screen === "tfa"') {{ $t('auth:tfa.subtitle') }}
                  .subheading(v-else-if='selectedStrategy.key !== "local"') {{ $t('auth:loginUsingStrategy', { strategy: selectedStrategy.title }) }}
                  .subheading(v-else) {{ $t('auth:loginRequired') }}
                  v-spacer
                v-card-text.text-xs-center
                  h1.display-1.primary--text.py-2 {{ siteTitle }}
                  template(v-if='screen === "login"')
                    v-text-field.md2.mt-3(
                      solo
                      flat
                      prepend-icon='email'
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptEmail'
                      v-model='username'
                      :placeholder='$t("auth:fields.emailUser")'
                      )
                    v-text-field.md2.mt-2(
                      solo
                      flat
                      prepend-icon='vpn_key'
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptPassword'
                      v-model='password'
                      :append-icon='hidePassword ? "visibility" : "visibility_off"'
                      @click:append='() => (hidePassword = !hidePassword)'
                      :type='hidePassword ? "password" : "text"'
                      :placeholder='$t("auth:fields.password")'
                      @keyup.enter='login'
                    )
                  template(v-else-if='screen === "tfa"')
                    .body-2 Enter the security code generated from your trusted device:
                    v-text-field.md2.centered.mt-2(
                      solo
                      flat
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptTFA'
                      v-model='securityCode'
                      :placeholder='$t("auth:tfa.placeholder")'
                      @keyup.enter='verifySecurityCode'
                    )
                  template(v-else-if='screen === "forgot"')
                    .body-2 {{ $t('auth:forgotPasswordSubtitle') }}
                    v-text-field.md2.mt-3(
                      solo
                      flat
                      prepend-icon='email'
                      background-color='grey lighten-4'
                      hide-details
                      ref='iptEmailForgot'
                      v-model='username'
                      :placeholder='$t("auth:fields.email")'
                      )
                v-card-actions.pb-4
                  v-spacer
                  v-btn.md2(
                    v-if='screen === "login"'
                    block
                    large
                    color='primary'
                    @click='login'
                    round
                    :loading='isLoading'
                    ) {{ $t('auth:actions.login') }}
                  v-btn.md2(
                    v-else-if='screen === "tfa"'
                    block
                    large
                    color='primary'
                    @click='verifySecurityCode'
                    round
                    :loading='isLoading'
                    ) {{ $t('auth:tfa.verifyToken') }}
                  v-btn.md2(
                    v-else-if='screen === "forgot"'
                    block
                    large
                    color='primary'
                    @click='forgotPasswordSubmit'
                    round
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
                  v-card-text.grey.lighten-4.text-xs-center
                    .pb-2.body-2.text-xs-center.grey--text.text--darken-2 {{ $t('auth:orLoginUsingStrategy') }}
                    v-tooltip(top, v-for='strategy in strategies', :key='strategy.key')
                      .social-login-btn.mr-2(
                        slot='activator'
                        v-ripple
                        v-html='strategy.icon'
                        :class='strategy.color + " elevation-" + (strategy.key === selectedStrategy.key ? "0" : "4")'
                        @click='selectStrategy(strategy)'
                        )
                      span {{ strategy.title }}
                template(v-if='screen === "login" && selectedStrategy.selfRegistration')
                  v-divider
                  v-card-actions.py-3(:class='isSocialShown ? "" : "grey lighten-4"')
                    v-spacer
                    i18next.caption(path='auth:switchToRegister.text', tag='div')
                      a.caption(href='/register', place='link') {{ $t('auth:switchToRegister.link') }}
                    v-spacer

    loader(v-model='isLoading', :color='loaderColor', :title='loaderTitle', :subtitle='$t(`auth:pleaseWait`)')
    nav-footer(color='grey darken-4')
</template>

<script>
/* global siteConfig */

import _ from 'lodash'
import Cookies from 'js-cookie'

import strategiesQuery from 'gql/login/login-query-strategies.gql'
import loginMutation from 'gql/login/login-mutation-login.gql'
import tfaMutation from 'gql/login/login-mutation-tfa.gql'

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
      loginToken: '',
      isLoading: false,
      loaderColor: 'grey darken-4',
      loaderTitle: 'Working...',
      isShown: false
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
        window.location.assign(this.$helpers.resolvePath('login/' + strategy.key))
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
          icon: 'warning'
        })
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: this.$t('auth:invalidPassword'),
          icon: 'warning'
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
              if (respObj.tfaRequired === true) {
                this.screen = 'tfa'
                this.securityCode = ''
                this.loginToken = respObj.tfaLoginToken
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
            icon: 'warning'
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
            loginToken: this.loginToken,
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
            icon: 'warning'
          })
          this.isLoading = false
        })
      }
    },
    forgotPassword() {
      this.screen = 'forgot'
      this.$nextTick(() => {
        this.$refs.iptEmailForgot.focus()
      })
    },
    async forgotPasswordSubmit() {
      this.$store.commit('showNotification', {
        style: 'pink',
        message: 'Coming soon!',
        icon: 'free_breakfast'
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
    background-color: mc('grey', '900');
    background-image: url('../static/svg/motif-blocks.svg');
    background-repeat: repeat;
    background-size: 200px;
    width: 100%;
    height: 100%;
    animation: loginBgReveal 20s linear infinite;

    @include keyframes(loginBgReveal) {
      0% {
        background-position-x: 0;
      }
      100% {
        background-position-x: 800px;
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
      display: inline-flex;
      justify-content: center;
      align-items: center;
      border-radius: 50%;
      width: 54px;
      height: 54px;
      cursor: pointer;
      transition: opacity .2s ease;
      &:hover {
        opacity: .8;
      }
      margin: .5rem 0;
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
