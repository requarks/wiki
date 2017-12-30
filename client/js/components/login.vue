<template lang="pug">
  .login(:class='{ "is-error": error }')
    .login-container(:class='{ "is-expanded": strategies.length > 1 }')
      .login-providers(v-show='strategies.length > 1')
        button(v-for='strategy in strategies', :class='{ "is-active": strategy.key === selectedStrategy }', @click='selectStrategy(strategy.key, strategy.useForm)', :title='strategy.title')
          em(v-html='strategy.icon')
          span {{ strategy.title }}
        .login-providers-fill
      .login-frame
        h1 {{ siteTitle }}
        h2 {{ $t('auth:loginrequired') }}
        input(type='text', name='email', :placeholder='$t("auth:fields.emailuser")')
        input(type='password', name='password', :placeholder='$t("auth:fields.password")')
        button.button.is-orange.is-fullwidth(@click='login')
          span {{ $t('auth:actions.login') }}
    .login-copyright
      span {{ $t('footer.poweredby') }}
      a(href='https://wiki.js.org', rel='external', title='Wiki.js') Wiki.js
</template>

<script>
/* global CONSTANTS, graphQL, siteConfig */

export default {
  name: 'login',
  data() {
    return {
      error: false,
      strategies: [],
      selectedStrategy: 'local'
    }
  },
  computed: {
    siteTitle() {
      return siteConfig.title
    }
  },
  methods: {
    selectStrategy(key, useForm) {
      this.selectedStrategy = key
      if (!useForm) {
        window.location.assign(siteConfig.path + '/login/' + key)
      }
    },
    refreshStrategies() {
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
      }).catch(err => {
        console.error(err)
      })
    },
    login() {
      this.$store.dispatch('alert', {
        style: 'error',
        icon: 'gg-warning',
        msg: 'Email or password is invalid'
      })
    }
  },
  mounted() {
    this.$store.commit('navigator/subtitleStatic', 'Login')
    this.refreshStrategies()
  }
}
</script>
