<template lang='pug'>
  v-app
    .onboarding
      .onboarding-content
        img.animated.fadeIn(src='/_assets/svg/logo-wikijs.svg', alt='Wiki.js')
        .headline.animated.fadeInUp {{ $t('welcome.title') }}
        .subtitle-1.mt-3.animated.fadeInUp.wait-p1s {{ $t('welcome.subtitle') }}
        v-btn.mt-5.animated.fadeInUp.wait-p2s(color='primary', :href='`/e/` + locale + `/home`', x-large)
          v-icon(left) mdi-plus
          span {{ $t('welcome.createhome') }}
</template>

<script>

export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
