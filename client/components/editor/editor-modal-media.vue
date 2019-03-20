<template lang='pug'>
  v-card.editor-modal-media.animated.fadeInLeft(flat, tile)
    v-container.pa-3(grid-list-lg, fluid)
      v-layout(row, wrap)
        v-flex(xs3)
          v-card.radius-7.animated.fadeInLeft.wait-p1s(light)
            v-card-text
              file-pond(
                name='mediaUpload'
                ref='pond'
                label-idle='Drop files here...'
                allow-multiple='true'
                accepted-file-types='image/jpeg, image/png'
                :files='files'
              )
        v-flex(xs9)
          v-card.radius-7.animated.fadeInLeft.wait-p3s(light)
            v-card-text Beep boop
</template>

<script>
// import _ from 'lodash'
// import { sync } from 'vuex-pathify'
import vueFilePond from 'vue-filepond'
import 'filepond/dist/filepond.min.css'

import 'filepond-plugin-image-preview/dist/filepond-plugin-image-preview.min.css'
import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'
import FilePondPluginImagePreview from 'filepond-plugin-image-preview'

const FilePond = vueFilePond(FilePondPluginFileValidateType, FilePondPluginImagePreview)

export default {
  components: {
    FilePond
  },
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      files: []
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  methods: {
  }
}
</script>

<style lang='scss'>
.editor-modal-media {
    position: fixed;
    top: 112px;
    left: 64px;
    z-index: 10;
    width: calc(100vw - 64px - 17px);
    height: calc(100vh - 112px - 24px);
    background-color: rgba(darken(mc('grey', '900'), 3%), .9) !important;
}
</style>
