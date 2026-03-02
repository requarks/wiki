<template lang='pug'>
  v-app
    .onboarding
      .onboarding-content
        img.animated.fadeIn(:src='withBaseUrl(`/_assets/svg/logo-wikijs.svg`)', alt='Wiki.js')
        .headline.animated.fadeInUp {{ $t('welcome.title') }}
        .subtitle-1.mt-3.animated.fadeInUp.wait-p1s {{ $t('welcome.subtitle') }}
        div
          v-btn.mt-5.mx-3.animated.fadeInUp.wait-p2s(color='primary', :href='withBaseUrl(`/e/` + locale + `/home`)', x-large)
            v-icon(left) mdi-plus
            span {{ $t('welcome.createhome') }}
          v-btn.mt-5.mx-3.animated.fadeInUp.wait-p3s(color='primary', :href='withBaseUrl(`/a`)', x-large)
            v-icon(left) mdi-view-dashboard
            span {{ $t('welcome.goadmin') }}

</template>

<script>

export default {
  props: {
    baseUrl: {
      type: String,
      default: ''
    },
    locale: {
      type: String,
      default: 'en'
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
