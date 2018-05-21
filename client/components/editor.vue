<template lang="pug">
  .editor
    nav-header
      template(slot='actions')
        v-btn(outline, color='green', @click.native.stop='save')
          v-icon(color='green', left) check
          span.white--text Save
        v-btn(icon): v-icon(color='red') close
        v-btn(icon, @click.native.stop='openModal(`properties`)'): v-icon(color='white') sort_by_alpha
        v-btn(icon, @click.native.stop='openModal(`access`)'): v-icon(color='white') vpn_lock
    v-content
      editor-code
      component(:is='currentModal')
      v-dialog(v-model='dialogProgress', persistent, max-width='350')
        v-card(color='blue darken-3', dark)
          v-card-text.text-xs-center.py-4
            v-progress-circular(indeterminate, color='white', :width='1')
            .subheading Processing
            .caption.blue--text.text--lighten-3 Please wait...
</template>

<script>
import _ from 'lodash'

export default {
  components: {
    editorCode: () => import(/* webpackChunkName: "editor-code" */ './editor/editor-code.vue'),
    editorModalAccess: () => import(/* webpackChunkName: "editor" */ './editor/editor-modal-access.vue'),
    editorModalProperties: () => import(/* webpackChunkName: "editor" */ './editor/editor-modal-properties.vue')
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
