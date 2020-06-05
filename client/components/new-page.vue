<template lang='pug'>
  v-app
    .newpage
      .newpage-content
        img.animated.fadeIn(src='/_assets/svg/icon-delete-file.svg', alt='Not Found')
        .headline {{ $t('newpage.title') }}
        .subtitle-1.mt-3 {{ $t('newpage.subtitle') }}
        v-btn.mt-5(:href='`/e/` + locale + `/` + path', x-large)
          v-icon(left) mdi-plus
          span {{ $t('newpage.create') }}
        v-btn.mt-5(color='purple lighten-3', href='javascript:window.history.go(-1);', outlined)
          v-icon(left) mdi-arrow-left
          span {{ $t('newpage.goback') }}
</template>

<script>

export default {
  props: {
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    }
  },
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
