<template lang='pug'>
  v-app
    .unauthorized
      .unauthorized-content
        img.animated.fadeIn(:src='withBaseUrl(`/_assets/svg/icon-delete-shield.svg`)', alt='Unauthorized')
        .headline {{$t('unauthorized.title')}}
        .subtitle-1.mt-3 {{$t('unauthorized.action.' + action)}}
        v-btn.mt-5(:href='withBaseUrl(`/login`)', x-large)
          v-icon(left) mdi-login
          span {{$t('unauthorized.login')}}
        v-btn.mt-5(color='red lighten-4', href='javascript:window.history.go(-1);', outlined)
          v-icon(left) mdi-arrow-left
          span {{$t('unauthorized.goback')}}
</template>

<script>

export default {
  props: {
    baseUrl: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      default: 'view'
    }
  },
  methods: {
    withBaseUrl (path) {
      if (!this.baseUrl) {
        return path
      }
      return `${this.baseUrl}${path}`
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
