<template lang='pug'>
  v-app
    .unauthorized
      .unauthorized-content
        img.animated.fadeIn(src='/svg/icon-delete-shield.svg', alt='Unauthorized')
        .headline {{$t('unauthorized.title')}}
        .subtitle-1.mt-3 {{$t('unauthorized.action.' + action)}}
        v-btn.mt-5(href='/login', x-large)
          v-icon(left) mdi-login
          span {{$t('unauthorized.login')}}
        v-btn.mt-5(color='red lighten-4', href='javascript:window.history.go(-1);', outlined)
          v-icon(left) mdi-arrow-left
          span {{$t('unauthorized.goback')}}
</template>

<script>

export default {
  props: {
    action: {
      type: String,
      default: 'view'
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
