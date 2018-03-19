<template lang="pug">
  .editor
    nav-header
      template(slot='actions')
        v-btn(outline, color='green', @click.native.stop='save')
          v-icon(color='green', left) save
          span.white--text Save
        v-btn(icon): v-icon(color='red') close
        v-btn(icon, @click.native.stop='openModal(`properties`)'): v-icon(color='white') sort_by_alpha
        v-btn(icon, @click.native.stop='openModal(`access`)'): v-icon(color='white') vpn_lock
    v-content
      editor-code
      component(:is='currentModal')
      v-dialog(v-model='dialogProgress', persistent, max-width='300')
        v-card
          v-progress-linear.my-0(indeterminate, color='primary', height='5')
          v-card-text.text-xs-center
            .headline Saving
            .caption Please wait...
</template>

<script>
import _ from 'lodash'

export default {
  components: {
    editorCode: () => import(/* webpackChunkName: "editor-code" */ './editor-code.vue'),
    editorModalAccess: () => import(/* webpackChunkName: "editor" */ './editor-modal-access.vue'),
    editorModalProperties: () => import(/* webpackChunkName: "editor" */ './editor-modal-properties.vue')
  },
  data() {
    return {
      currentModal: '',
      dialogProgress: false
    }
  },
  methods: {
    openModal(name) {
      this.currentModal = `editorModal${_.startCase(name)}`
    },
    closeModal() {
      _.delay(() => {
        this.currentModal = ``
      }, 500)
    },
    showProgressDialog(textKey) {
      this.dialogProgress = true
    },
    hideProgressDialog() {
      this.dialogProgress = false
    },
    save() {
      this.showProgressDialog('saving')
    }
  }
}
</script>

<style lang='scss'>

</style>
