<template lang="pug">
  v-app
    .login
      .login-container(:class='{ "is-expanded": strategies.length > 1, "is-loading": isLoading }')
        .login-mascot
          img(src='/svg/henry-reading.svg', alt='Henry')
        .login-providers(v-show='strategies.length > 1')
          button(v-for='strategy in strategies', :class='{ "is-active": strategy.key === selectedStrategy }', @click='selectStrategy(strategy.key, strategy.useForm)', :title='strategy.title')
            em(v-html='strategy.icon')
            span {{ strategy.title }}
          .login-providers-fill
        .login-frame(v-show='screen === "login"')
          h1.text-xs-center.display-1 {{ siteTitle }}
          h2.text-xs-center.subheading {{ $t('auth:loginRequired') }}
          v-text-field(solo, hide-details, ref='iptEmail', v-model='username', :placeholder='$t("auth:fields.emailUser")')
          v-text-field.mt-2(
            solo
            hide-details
            ref='iptPassword'
            v-model='password'
            :append-icon='hidePassword ? "visibility" : "visibility_off"'
            :append-icon-cb='() => (hidePassword = !hidePassword)'
            :type='hidePassword ? "password" : "text"'
            :placeholder='$t("auth:fields.password")'
            @keyup.enter='login'
          )
          v-btn.mt-3(block, large, color='primary', @click='login') {{ $t('auth:actions.login') }}
        .login-frame(v-show='screen === "tfa"')
          .login-frame-icon
            svg.icons.is-48(role='img')
              title {{ $t('auth:tfa.title') }}
              use(xlink:href='#nc-key')
          h2 {{ $t('auth:tfa.subtitle') }}
          input(type='text', ref='iptTFA', v-model='securityCode', :placeholder='$t("auth:tfa.placeholder")', @keyup.enter='verifySecurityCode')
          button.button.is-blue.is-fullwidth(@click='verifySecurityCode')
            span {{ $t('auth:tfa.verifyToken') }}
    nav-footer(altbg)
</template>

<script>
/* global siteConfig */

import _ from 'lodash'
import { mapState } from 'vuex'

import strategiesQuery from 'gql/login/login-query-strategies.gql'
import loginMutation from 'gql/login/login-mutation-login.gql'
import tfaMutation from 'gql/login/login-mutation-tfa.gql'

export default {
  i18nOptions: { namespaces: 'auth' },
  data () {
    return {
      error: false,
      strategies: [],
      selectedStrategy: 'local',
      screen: 'login',
      username: '',
      password: '',
      hidePassword: true,
      securityCode: '',
      loginToken: '',
      isLoading: false
    }
  },
  computed: {
    ...mapState(['notification']),
    notificationState: {
      get() { return this.notification.isActive },
      set(newState) { this.$store.commit('updateNotificationState', newState) }
    },
    siteTitle () {
      return siteConfig.title
    }
  },
  mounted () {
    this.$refs.iptEmail.focus()
  },
  methods: {
    /**
     * SELECT STRATEGY
     */
    selectStrategy (key, useForm) {
      this.selectedStrategy = key
      this.screen = 'login'
      if (!useForm) {
        this.isLoading = true
        window.location.assign(this.$helpers.resolvePath('login/' + key))
      } else {
        this.$refs.iptEmail.focus()
      }
    },
    /**
     * LOGIN
     */
    async login () {
      if (this.username.length < 2) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Enter a valid email / username.',
          icon: 'warning'
        })
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Enter a valid password.',
          icon: 'warning'
        })
        this.$refs.iptPassword.focus()
      } else {
        this.isLoading = true
        try {
          let resp = await this.$apollo.mutate({
            mutation: loginMutation,
            variables: {
              username: this.username,
              password: this.password,
              strategy: this.selectedStrategy
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
              } else {
                this.$store.commit('showNotification', {
                  message: 'Login Successful! Redirecting...',
                  style: 'success',
                  icon: 'check'
                })
                _.delay(() => {
                  window.location.replace('/') // TEMPORARY - USE RETURNURL
                }, 1000)
              }
              this.isLoading = false
            } else {
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error('Authentication is unavailable.')
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
            throw new Error('Authentication is unavailable.')
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
    }
  },
  apollo: {
    strategies: {
      query: strategiesQuery,
      update: (data) => data.authentication.strategies,
      watchLoading (isLoading) {
        this.isLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'login-strategies-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
  .login {
    background-color: mc('blue', '800');
    background-image: url('../static/svg/login-bg-motif.svg');
    background-repeat: repeat;
    background-size: 200px;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: loginBgReveal 20s linear infinite;

    @include keyframes(loginBgReveal) {
      0% {
        background-position-y: 0;
      }
      100% {
        background-position-y: -800px;
      }
    }

    &::before {
      content: '';
      position: absolute;
      background-color: #0d47a1;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%25' height='100%25' viewBox='0 0 1600 800'%3E%3Cg %3E%3Cpath fill='%231356b1' d='M486 705.8c-109.3-21.8-223.4-32.2-335.3-19.4C99.5 692.1 49 703 0 719.8V800h843.8c-115.9-33.2-230.8-68.1-347.6-92.2C492.8 707.1 489.4 706.5 486 705.8z'/%3E%3Cpath fill='%231866c1' d='M1600 0H0v719.8c49-16.8 99.5-27.8 150.7-33.5c111.9-12.7 226-2.4 335.3 19.4c3.4 0.7 6.8 1.4 10.2 2c116.8 24 231.7 59 347.6 92.2H1600V0z'/%3E%3Cpath fill='%231c75d2' d='M478.4 581c3.2 0.8 6.4 1.7 9.5 2.5c196.2 52.5 388.7 133.5 593.5 176.6c174.2 36.6 349.5 29.2 518.6-10.2V0H0v574.9c52.3-17.6 106.5-27.7 161.1-30.9C268.4 537.4 375.7 554.2 478.4 581z'/%3E%3Cpath fill='%231f86e2' d='M0 0v429.4c55.6-18.4 113.5-27.3 171.4-27.7c102.8-0.8 203.2 22.7 299.3 54.5c3 1 5.9 2 8.9 3c183.6 62 365.7 146.1 562.4 192.1c186.7 43.7 376.3 34.4 557.9-12.6V0H0z'/%3E%3Cpath fill='%232196f3' d='M181.8 259.4c98.2 6 191.9 35.2 281.3 72.1c2.8 1.1 5.5 2.3 8.3 3.4c171 71.6 342.7 158.5 531.3 207.7c198.8 51.8 403.4 40.8 597.3-14.8V0H0v283.2C59 263.6 120.6 255.7 181.8 259.4z'/%3E%3Cpath fill='%2355a4f5' d='M1600 0H0v136.3c62.3-20.9 127.7-27.5 192.2-19.2c93.6 12.1 180.5 47.7 263.3 89.6c2.6 1.3 5.1 2.6 7.7 3.9c158.4 81.1 319.7 170.9 500.3 223.2c210.5 61 430.8 49 636.6-16.6V0z'/%3E%3Cpath fill='%2374b2f7' d='M454.9 86.3C600.7 177 751.6 269.3 924.1 325c208.6 67.4 431.3 60.8 637.9-5.3c12.8-4.1 25.4-8.4 38.1-12.9V0H288.1c56 21.3 108.7 50.6 159.7 82C450.2 83.4 452.5 84.9 454.9 86.3z'/%3E%3Cpath fill='%238ec0f8' d='M1600 0H498c118.1 85.8 243.5 164.5 386.8 216.2c191.8 69.2 400 74.7 595 21.1c40.8-11.2 81.1-25.2 120.3-41.7V0z'/%3E%3Cpath fill='%23a5cffa' d='M1397.5 154.8c47.2-10.6 93.6-25.3 138.6-43.8c21.7-8.9 43-18.8 63.9-29.5V0H643.4c62.9 41.7 129.7 78.2 202.1 107.4C1020.4 178.1 1214.2 196.1 1397.5 154.8z'/%3E%3Cpath fill='%23bbdefb' d='M1315.3 72.4c75.3-12.6 148.9-37.1 216.8-72.4h-723C966.8 71 1144.7 101 1315.3 72.4z'/%3E%3C/g%3E%3C/svg%3E");
      background-attachment: fixed;
      background-size: cover;
      /* background by SVGBackgrounds.com */
      opacity: .5;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
    }

    &::after {
      content: '';
      position: absolute;
      background-image: linear-gradient(to bottom, rgba(mc('blue', '800'), .9) 0%, rgba(mc('blue', '800'), 0) 100%);
      top: 0;
      left: 0;
      width: 100vw;
      height: 25vh;
    }

    &-mascot {
      width: 200px;
      height: 200px;
      position: absolute;
      top: -180px;
      left: 50%;
      margin-left: -100px;
      z-index: 10;

      @include until($tablet) {
        display: none;
      }
    }

    &-container {
      position: relative;
      display: flex;
      width: 400px;
      align-items: stretch;
      box-shadow: 0 14px 28px rgba(0,0,0,0.2);
      border-radius: 6px;
      animation: zoomIn .5s ease;

      &::after {
        position: absolute;
        top: 1rem;
        right: 1rem;
        content: " ";
        @include spinner(mc('blue', '500'),0.5s,16px);
        display: none;
      }

      &.is-expanded {
        width: 650px;

        .login-frame {
          border-radius: 0 6px 6px 0;
          border-left: none;

          @include until($tablet) {
            border-radius: 0;
          }
        }
      }

      &.is-loading::after {
        display: block;
      }

      @include until($tablet) {
        width: 95vw;
        border-radius: 0;

        &.is-expanded {
          width: 95vw;
        }
      }
    }

    &-providers {
      display: flex;
      flex-direction: column;
      width: 250px;

      border-right: none;
      border-radius: 6px 0 0 6px;
      z-index: 1;
      overflow: hidden;

      @include until($tablet) {
        width: 50px;
        border-radius: 0;
      }

      button {
        flex: 0 1 50px;
        padding: 5px 15px;
        border: none;
        color: #FFF;
        // background: linear-gradient(to right, rgba(mc('light-blue', '800'), .7), rgba(mc('light-blue', '800'), 1));
        // border-top: 1px solid rgba(mc('light-blue', '900'), .5);
        background: linear-gradient(to right, rgba(0,0,0, .5), rgba(0,0,0, .7));
        border-top: 1px solid rgba(0,0,0, .2);
        font-weight: 600;
        text-align: left;
        min-height: 40px;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        transition: all .4s ease;

        &:focus {
          outline: none;
        }

        @include until($tablet) {
          justify-content: center;
        }

        &:hover {
          background-color: rgba(0,0,0, .4);
        }

        &:first-child {
          border-top: none;

          &.is-active {
            border-top: 1px solid rgba(255,255,255, .5);
          }
        }

        &.is-active {
          background-image: linear-gradient(to right, rgba(255,255,255,1) 0%,rgba(255,255,255,.77) 100%);
          color: mc('grey', '800');
          cursor: default;

          &:hover {
            background-color: transparent;
          }

          svg path {
            fill: mc('grey', '800');
          }
        }

        i {
          margin-right: 10px;
          font-size: 16px;

          @include until($tablet) {
            margin-right: 0;
            font-size: 20px;
          }
        }

        svg {
          margin-right: 10px;
          width: auto;
          height: 20px;
          max-width: 18px;
          max-height: 20px;

          path {
            fill: #FFF;
          }

          @include until($tablet) {
            margin-right: 0;
            font-size: 20px;
          }
        }

        em {
          height: 20px;
        }

        span {
          font-weight: 600;

          @include until($tablet) {
            display: none;
          }
        }
      }

      &-fill {
        flex: 1 1 0;
        background: linear-gradient(to right, rgba(mc('light-blue', '800'), .7), rgba(mc('light-blue', '800'), 1));
      }
    }

    &-frame {
      background-image: radial-gradient(circle at top center, rgba(255,255,255,1) 5%,rgba(255,255,255,.6) 100%);
      border: 1px solid rgba(255,255,255, .5);
      border-radius: 6px;
      width: 400px;
      padding: 1rem;
      color: mc('grey', '700');
      display: block;

      @include until($tablet) {
        width: 100%;
        border-radius: 0;
        border: none;
      }

      h1 {
        font-size: 2rem;
        font-weight: 400;
        color: mc('light-blue', '700');
        text-shadow: 1px 1px 0 #FFF;
        padding: 1rem 0 0 0;
        margin: 0;
      }

      h2 {
        font-size: 1.5rem;
        font-weight: 300;
        color: mc('grey', '700');
        text-shadow: 1px 1px 0 #FFF;
        padding: 0;
        margin: 0 0 25px 0;
      }
    }

    &-tfa {
      position: relative;
      display: flex;
      width: 400px;
      align-items: stretch;
      box-shadow: 0 14px 28px rgba(0,0,0,0.2);
      border-radius: 6px;
      animation: zoomIn .5s ease;
    }

    &-copyright {
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      left: 0;
      bottom: 10vh;
      width: 100%;
      z-index: 2;
      color: mc('grey', '500');
      font-weight: 400;

      a {
        font-weight: 600;
        color: mc('blue', '500');
        margin-left: .25rem;

        @include until($tablet) {
          color: mc('blue', '200');
        }
      }

      @include until($tablet) {
        color: mc('blue', '50');
      }

    }
  }
</style>
