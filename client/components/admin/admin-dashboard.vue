<template lang='pug'>
  v-container(fluid, fill-height)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text {{ $t('admin:dashboard.title') }}
        .subheading.grey--text {{ $t('admin:dashboard.subtitle') }}
</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>

<style lang='scss'>

</style>
