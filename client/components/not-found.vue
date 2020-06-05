<template lang='pug'>
  v-app
    .notfound
      .notfound-content
        img.animated.fadeIn(src='/_assets/svg/icon-delete-file.svg', alt='Not Found')
        .headline {{$t('notfound.title')}}
        .subheading.mt-3 {{$t('notfound.subtitle')}}
        v-btn.mt-5(color='red lighten-4', href='/', large, outlined)
          v-icon(left) mdi-home
          span {{$t('notfound.gohome')}}
</template>

<script>

export default {
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
