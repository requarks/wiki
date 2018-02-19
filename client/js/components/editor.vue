<template lang="pug">
  .editor
    editor-code
    editorModalAccess(:is-opened='pageAccessDialog')
    editorModalProperties(:is-opened='pagePropertiesDialog')
</template>

<script>
export default {
  components: {
    editorCode: () => import(/* webpackChunkName: "editor-code" */ './editor-code.vue'),
    editorModalAccess: () => import(/* webpackChunkName: "editor-common" */ './editor-modal-access.vue'),
    editorModalProperties: () => import(/* webpackChunkName: "editor-common" */ './editor-modal-properties.vue')
  },
  data() {
    return {
      pageAccessDialog: true,
      pagePropertiesDialog: false
    }
  }
}
</script>

<style lang='scss'>

</style>
