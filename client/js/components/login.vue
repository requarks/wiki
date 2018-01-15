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
  name: 'login',
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
  },
  mounted () {
    this.$store.commit('navigator/subtitleStatic', 'Login')
    this.refreshStrategies()
    this.$refs.iptEmail.focus()
  }
}
</script>
