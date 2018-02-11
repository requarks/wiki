<template lang="pug">
  editor-code
</template>

<script>
export default {
  components: {
    editorCode: () => import(/* webpackChunkName: "editor" */ './editor-code.vue')
  }
}
</script>

<style lang='scss'>

</style>
