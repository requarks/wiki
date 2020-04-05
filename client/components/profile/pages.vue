<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/svg/icon-file.svg', alt='Users', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('profile:pages.title')}}
            .subheading.grey--text.animated.fadeInLeft {{$t('profile:pages.subtitle')}}
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
