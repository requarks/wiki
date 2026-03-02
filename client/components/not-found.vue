<template lang='pug'>
  v-app
    .notfound
      .notfound-content
        img.animated.fadeIn(:src='withBaseUrl(`/_assets/svg/icon-delete-file.svg`)', alt='Not Found')
        .headline {{$t('notfound.title')}}
        .subheading.mt-3 {{$t('notfound.subtitle')}}
        v-btn.mt-5(color='red lighten-4', :href='withBaseUrl(`/`)', large, outlined)
          v-icon(left) mdi-home
          span {{$t('notfound.gohome')}}
</template>

<script>

export default {
  props: {
    baseUrl: {
      type: String,
      default: ''
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
