<template lang="pug">
  .editor
    nav-header
      template(slot='actions')
        v-btn(outline, color='green', @click.native.stop='save')
          v-icon(color='green', left) check
          span.white--text Save
        v-btn(icon): v-icon(color='red') close
        v-btn(icon, @click.native.stop='openModal(`properties`)'): v-icon(color='white') sort_by_alpha
    v-content
      editor-code
      component(:is='currentModal')
      v-dialog(v-model='dialogProgress', persistent, max-width='350')
        v-card(color='blue darken-3', dark)
          v-card-text.text-xs-center.py-4
            atom-spinner.is-inline(
              :animation-duration='1000'
              :size='60'
              color='#FFF'
              )
            .subheading Processing
            .caption.blue--text.text--lighten-3 Please wait...
</template>

<script>
import _ from 'lodash'
import { AtomSpinner } from 'epic-spinners'

import savePageMutation from 'gql/editor/save.gql'

import editorStore from '@/store/editor'

/* global WIKI */

WIKI.$store.registerModule('editor', editorStore)

export default {
  components: {
    AtomSpinner,
    editorCode: () => import(/* webpackChunkName: "editor-code" */ './editor/editor-code.vue'),
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
    async save() {
      this.showProgressDialog('saving')
      // const resp = await this.$apollo.mutate({
      //   mutation: savePageMutation,
      //   variables: {

      //   }
      // })
    }
  }
}
</script>

<style lang='scss'>

  .atom-spinner.is-inline {
    display: inline-block;
  }

</style>
