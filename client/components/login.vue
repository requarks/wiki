<template lang="pug">
  .login(:class='{ "is-error": error }')
    .login-container(:class='{ "is-expanded": strategies.length > 1, "is-loading": isLoading }')
      .login-providers(v-show='strategies.length > 1')
        button(v-for='strategy in strategies', :class='{ "is-active": strategy.key === selectedStrategy }', @click='selectStrategy(strategy.key, strategy.useForm)', :title='strategy.title')
          em(v-html='strategy.icon')
          span {{ strategy.title }}
        .login-providers-fill
      .login-frame(v-show='screen === "login"')
        h1 {{ siteTitle }}
        h2 {{ $t('auth:loginRequired') }}
        input(type='text', ref='iptEmail', v-model='username', :placeholder='$t("auth:fields.emailUser")')
        input(type='password', ref='iptPassword', v-model='password', :placeholder='$t("auth:fields.password")', @keyup.enter='login')
        button.button.is-blue.is-fullwidth(@click='login')
          span {{ $t('auth:actions.login') }}
      .login-frame(v-show='screen === "tfa"')
        .login-frame-icon
          svg.icons.is-48(role='img')
            title {{ $t('auth:tfa.title') }}
            use(xlink:href='#nc-key')
        h2 {{ $t('auth:tfa.subtitle') }}
        input(type='text', ref='iptTFA', v-model='securityCode', :placeholder='$t("auth:tfa.placeholder")', @keyup.enter='verifySecurityCode')
        button.button.is-blue.is-fullwidth(@click='verifySecurityCode')
          span {{ $t('auth:tfa.verifyToken') }}
    .login-copyright
      span {{ $t('footer.poweredBy') }}
      a(href='https://wiki.js.org', rel='external', title='Wiki.js') Wiki.js
</template>

<script>
/* global CONSTANTS, graphQL, siteConfig */

export default {
  data () {
    return {
      error: false,
      strategies: [],
      selectedStrategy: 'local',
      screen: 'login',
      username: '',
      password: '',
      securityCode: '',
      loginToken: '',
      isLoading: false
    }
  },
  computed: {
    siteTitle () {
      return siteConfig.title
    }
  },
  mounted () {
    this.$store.commit('navigator/subtitleStatic', 'Login')
    this.refreshStrategies()
    this.$refs.iptEmail.focus()
  },
  methods: {
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
    refreshStrategies () {
      this.isLoading = true
      graphQL.query({
        query: CONSTANTS.GRAPHQL.GQL_QUERY_AUTHENTICATION,
        variables: {
          mode: 'active'
        }
      }).then(resp => {
        if (resp.data.authentication) {
          this.strategies = resp.data.authentication
        } else {
          throw new Error('No authentication providers available!')
        }
        this.isLoading = false
      }).catch(err => {
        console.error(err)
        this.$store.dispatch('alert', {
          style: 'error',
          icon: 'gg-warning',
          msg: err.message
        })
        this.isLoading = false
      })
    },
    login () {
      if (this.username.length < 2) {
        this.$store.dispatch('alert', {
          style: 'error',
          icon: 'gg-warning',
          msg: 'Enter a valid email / username.'
        })
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.$store.dispatch('alert', {
          style: 'error',
          icon: 'gg-warning',
          msg: 'Enter a valid password.'
        })
        this.$refs.iptPassword.focus()
      } else {
        this.isLoading = true
        graphQL.mutate({
          mutation: CONSTANTS.GRAPHQL.GQL_MUTATION_LOGIN,
          variables: {
            username: this.username,
            password: this.password,
            provider: this.selectedStrategy
          }
        }).then(resp => {
          if (resp.data.login) {
            let respObj = resp.data.login
            if (respObj.succeeded === true) {
              if (respObj.tfaRequired === true) {
                this.screen = 'tfa'
                this.securityCode = ''
                this.loginToken = respObj.tfaLoginToken
                this.$nextTick(() => {
                  this.$refs.iptTFA.focus()
                })
              } else {
                this.$store.dispatch('alert', {
                  style: 'success',
                  icon: 'gg-check',
                  msg: 'Login successful!'
                })
              }
              this.isLoading = false
            } else {
              throw new Error(respObj.message)
            }
          } else {
            throw new Error('Authentication is unavailable.')
          }
        }).catch(err => {
          console.error(err)
          this.$store.dispatch('alert', {
            style: 'error',
            icon: 'gg-warning',
            msg: err.message
          })
          this.isLoading = false
        })
      }
    },
    verifySecurityCode () {
      if (this.securityCode.length !== 6) {
        this.$store.dispatch('alert', {
          style: 'error',
          icon: 'gg-warning',
          msg: 'Enter a valid security code.'
        })
        this.$refs.iptTFA.focus()
      } else {
        this.isLoading = true
        graphQL.mutate({
          mutation: CONSTANTS.GRAPHQL.GQL_MUTATION_LOGINTFA,
          variables: {
            loginToken: this.loginToken,
            securityCode: this.securityCode
          }
        }).then(resp => {
          if (resp.data.loginTFA) {
            let respObj = resp.data.loginTFA
            if (respObj.succeeded === true) {
              this.$store.dispatch('alert', {
                style: 'success',
                icon: 'gg-check',
                msg: 'Login successful!'
              })
              this.isLoading = false
            } else {
              throw new Error(respObj.message)
            }
          } else {
            throw new Error('Authentication is unavailable.')
          }
        }).catch(err => {
          console.error(err)
          this.$store.dispatch('alert', {
            style: 'error',
            icon: 'gg-warning',
            msg: err.message
          })
          this.isLoading = false
        })
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
      background-image: url('../static/svg/login-bg.svg');
      background-position: center bottom;
      background-size: cover;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;

      @include until($tablet) {
        display: none;
      }
    }

    &::after {
      content: '';
      position: absolute;
      background-image: linear-gradient(to bottom, rgba(mc('blue', '800'), 1) 0%, rgba(mc('blue', '800'), 0) 100%);
      top: 0;
      left: 0;
      width: 100vw;
      height: 25vh;
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
        width: 100%;
        border-radius: 0;

        &.is-expanded {
          width: 100%;
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
        font-family: $core-font-standard;
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
      display: flex;
      justify-content: center;
      flex-direction: column;
      text-align: center;

      @include until($tablet) {
        width: 100%;
        border-radius: 0;
        border: none;
      }

      h1 {
        font-size: 2rem;
        font-weight: 600;
        color: mc('light-blue', '700');
        text-shadow: 1px 1px 0 #FFF;
        padding: 0;
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

      form {
        display: flex;
        flex-direction: column;
      }

      input[type=text], input[type=password] {
        width: 100%;
        border: 1px solid rgba(mc('blue-grey','500'), .5);
        border-radius: 3px;
        background-color: rgba(255,255,255,.9);
        box-shadow: inset 0 0 0 3px rgba(255,255,255, .25);
        padding: 0 15px;
        height: 40px;
        margin: 0 0 10px 0;
        color: mc('grey', '700');
        font-weight: 600;
        font-size: .8rem;
        transition: all 0.4s ease;
        text-align: center;

        &:focus {
          outline: none;
          border-color: mc('light-blue','500');
          background-color: rgba(255,255,255,1);
          box-shadow: inset 0 0 8px rgba(mc('light-blue','500'), .5);
          color: mc('light-blue', '800');
        }

      }

      .button {
        background-image: linear-gradient(to bottom, mc('blue', '400') 0%, mc('blue', '600') 50%, mc('blue', '700') 100%);
        background-repeat: no-repeat;
        background-size: 100% 200%;

        &:hover {
          background-position-y: 100%;
        }
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
