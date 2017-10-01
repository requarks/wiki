<template lang="pug">
  .login(:class='{ "is-error": error }')
    .login-container(:class='{ "is-expanded": strategies.length > 1 }')
      .login-error(v-if='error')
        strong
          i.icon-warning-outline
          | {{ error.title }}
        span {{ error.message }}
      .login-providers(v-show='strategies.length > 1')
        button(v-for='strategy in strategies', :class='{ "is-active": strategy.key === selectedStrategy }', @click='selectStrategy(strategy.key, strategy.useForm)', :title='strategy.title')
          em(v-html='strategy.icon')
          span {{ strategy.title }}
      .login-frame
        h1 {{ siteTitle }}
        h2 {{ $t('auth:loginrequired') }}
        form(method='post', action='/login')
          input#login-user(type='text', name='email', :placeholder='$t("auth:fields.emailuser")')
          input#login-pass(type='password', name='password', :placeholder='$t("auth:fields.password")')
          button.button.is-light-blue.is-fullwidth(type='submit')
            span {{ $t('auth:actions.login') }}
    .login-copyright
      span {{ $t('footer.poweredby') }}
      a(href='https://wiki.js.org', rel='external', title='Wiki.js') Wiki.js
</template>

<script>
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
    }
  },
  mounted() {
    this.refreshStrategies()
  }
}
</script>

