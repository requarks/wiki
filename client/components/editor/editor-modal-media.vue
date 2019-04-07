<template lang='pug'>
  v-card.editor-modal-media.animated.fadeInLeft(flat, tile)
    v-container.pa-3(grid-list-lg, fluid)
      v-layout(row, wrap)
        v-flex(xs9)
          v-card.radius-7.animated.fadeInLeft.wait-p1s(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  .body-2.teal--text Images
                v-btn.ml-3.my-0.radius-7(outline, large, color='teal', disabled)
                  v-icon(left) keyboard_backspace
                  span Parent Folder
                v-btn.my-0.radius-7(outline, large, color='teal')
                  v-icon(left) add
                  span New Folder
              v-list.mt-3(dense, two-line)
                template(v-for='(item, idx) of [1,2,3,4,5,6,7,8,9,10]')
                  v-list-tile(@click='')
                    v-list-tile-avatar
                      v-avatar.radius-7(color='teal', tile)
                        v-icon(dark) image
                    v-list-tile-content
                      v-list-tile-title Image {{item}}
                      v-list-tile-sub-title 1024x768, 10 KBs
                    v-list-tile-action
                      .caption.pr-3 2019-04-07
                    v-list-tile-action
                      v-chip.teal--text(label, small, color='teal lighten-5') JPG
                  v-divider(v-if='idx < 10 - 1')
              .d-flex.mt-3
                v-toolbar.radius-7(flat, color='grey lighten-4', dense, height='44')
                  .body-2 / universe
                  v-spacer
                  .body-1.grey--text.text--darken-1 10 files
                v-btn.ml-3.my-0.radius-7(color='teal', large, @click='insert', disabled)
                  v-icon(left) save_alt
                  span Insert

        v-flex(xs3)
          v-card.radius-7.animated.fadeInRight.wait-p3s(light)
            v-card-text
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') cloud_upload
                .body-2.teal--text Upload Images
              file-pond.mt-3(
                name='mediaUpload'
                ref='pond'
                label-idle='Browse or Drop files here...'
                allow-multiple='true'
                accepted-file-types='image/jpeg, image/png'
                :files='files'
              )
            v-divider
            v-card-actions.pa-3
              .caption.grey--text.text-darken-2 Max 20 files, 5 MB each
              v-spacer
              v-btn(color='teal', dark) Upload

          v-card.mt-3.radius-7.animated.fadeInRight.wait-p4s(light)
            v-card-text.pb-0
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') cloud_download
                .body-2.teal--text Fetch Remote Image
              v-text-field.mt-3(
                v-model='remoteImageUrl'
                outline
                single-line
                background-color='grey lighten-2'
                placeholder='https://example.com/image.jpg'
              )
            v-divider
            v-card-actions.pa-3
              .caption.grey--text.text-darken-2 Max 5 MB
              v-spacer
              v-btn(color='teal', dark) Fetch

          v-card.mt-3.radius-7.animated.fadeInRight.wait-p4s(light)
            v-card-text.pb-0
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') format_align_left
                .body-2.teal--text Alignment
              v-select.mt-3(
                v-model='imageAlignment'
                :items='imageAlignments'
                outline
                single-line
                background-color='grey lighten-2'
                placeholder='None'
              )
</template>

<script>
// import _ from 'lodash'
import { sync } from 'vuex-pathify'
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
      files: [],
      remoteImageUrl: '',
      imageAlignments: [
        { text: 'None', value: '' },
        { text: 'Centered', value: 'center' },
        { text: 'Right', value: 'right' },
        { text: 'Absolute Top Right', value: 'abstopright' }
      ],
      imageAlignment: ''
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    activeModal: sync('editor/activeModal')
  },
  methods: {
    insert () {
      this.activeModal = ''
    }
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
