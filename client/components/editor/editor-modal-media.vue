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
                  v-icon(left) keyboard_arrow_up
                  span Parent Folder
                v-btn.my-0.mr-0.radius-7(outline, large, color='teal')
                  v-icon(left) add
                  span New Folder
              v-list.mt-3(dense, two-line)
                template(v-for='(asset, idx) of assets')
                  v-list-tile(@click='')
                    v-list-tile-avatar
                      v-avatar.radius-7(color='teal')
                        v-icon(dark) image
                    v-list-tile-content
                      v-list-tile-title {{asset.filename}}
                      v-list-tile-sub-title 1024x768
                    v-list-tile-action
                      .caption {{asset.updatedAt | moment('from')}}
                    v-divider.mx-3(vertical)
                    v-list-tile-action(style='flex-basis: 80px;')
                      .caption {{asset.fileSize | prettyBytes}}
                    v-divider.mx-3(vertical)
                    v-list-tile-action(style='flex-basis: 60px;')
                      v-chip.teal--text(label, small, color='teal lighten-5') {{asset.ext.toUpperCase().substring(1)}}
                    v-list-tile-action
                      v-menu(offset-x)
                        v-btn(icon, slot='activator')
                          v-icon(color='grey darken-2') more_horiz
                        v-list.py-0
                          v-list-tile
                            v-list-tile-avatar
                              v-icon(color='teal') short_text
                            v-list-tile-content Properties
                          v-divider
                          v-list-tile
                            v-list-tile-avatar
                              v-icon(color='indigo') crop_rotate
                            v-list-tile-content Edit
                          v-divider
                          v-list-tile
                            v-list-tile-avatar
                              v-icon(color='blue') keyboard
                            v-list-tile-content Rename / Move
                          v-divider
                          v-list-tile
                            v-list-tile-avatar
                              v-icon(color='red') delete
                            v-list-tile-content Delete
                  v-divider(v-if='idx < assets.length - 1')
              .d-flex.mt-3
                v-toolbar.radius-7(flat, color='grey lighten-4', dense, height='44')
                  .body-2 / #[em root]
                  v-spacer
                  .body-1.grey--text.text--darken-1 10 files
                v-btn.ml-3.mr-0.my-0.radius-7(color='teal', large, @click='insert', disabled)
                  v-icon(left) save_alt
                  span Insert

        v-flex(xs3)
          v-card.radius-7.animated.fadeInRight.wait-p3s(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  v-icon.mr-3(color='teal') cloud_upload
                  .body-2.teal--text Upload Images
                v-btn.my-0.ml-3.mr-0.radius-7(outline, large, color='teal', @click='browse')
                  v-icon(left) touch_app
                  span Browse
              file-pond.mt-3(
                name='mediaUpload'
                ref='pond'
                label-idle='Browse or Drop files here...'
                allow-multiple='true'
                :accepted-file-types='[`image/jpeg`, `image/png`, `image/gif`, `image/svg`]'
                :files='files'
                max-files='10'
                server='/u'
                :instant-upload='false'
                :allow-revert='false'
                @processfile='onFileProcessed'
              )
            v-divider
            v-card-actions.pa-3
              .caption.grey--text.text-darken-2 Max 10 files, 5 MB each
              v-spacer
              v-btn(color='teal', dark, @click='upload') Upload

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
import _ from 'lodash'
import { sync } from 'vuex-pathify'
import vueFilePond from 'vue-filepond'
import 'filepond/dist/filepond.min.css'

import FilePondPluginFileValidateType from 'filepond-plugin-file-validate-type'

import listAssetQuery from 'gql/editor/editor-media-query-list.gql'

const FilePond = vueFilePond(FilePondPluginFileValidateType)

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
  filters: {
    prettyBytes(num) {
      if (typeof num !== 'number' || isNaN(num)) {
        throw new TypeError('Expected a number')
      }

      var exponent
      var unit
      var neg = num < 0
      var units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

      if (neg) {
        num = -num
      }

      if (num < 1) {
        return (neg ? '-' : '') + num + ' B'
      }

      exponent = Math.min(Math.floor(Math.log(num) / Math.log(1000)), units.length - 1)
      num = (num / Math.pow(1000, exponent)).toFixed(2) * 1
      unit = units[exponent]

      return (neg ? '-' : '') + num + ' ' + unit
    }
  },
  methods: {
    insert () {
      this.activeModal = ''
    },
    browse () {
      this.$refs.pond.browse()
    },
    async upload () {
      const files = this.$refs.pond.getFiles()
      if (files.length < 1) {
        return this.$store.commit('showNotification', {
          message: 'You must choose a file to upload first!',
          style: 'warning',
          icon: 'warning'
        })
      }
      for (let file of files) {
        file.setMetadata({
          path: 'test'
        })
      }
      await this.$refs.pond.processFiles()
    },
    async onFileProcessed (err, file) {
      if (err) {
        return this.$store.commit('showNotification', {
          message: 'File upload failed.',
          style: 'error',
          icon: 'error'
        })
      }
      _.delay(() => {
        this.$refs.pond.removeFile(file.id)
      }, 5000)

      await this.$apollo.queries.assets.refetch()
    }
  },
  apollo: {
    assets: {
      query: listAssetQuery,
      variables: {
        kind: 'IMAGE'
      },
      throttle: 1000,
      fetchPolicy: 'network-only',
      update: (data) => data.assets.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'editor-media-list-refresh')
      }
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
  overflow: auto;

  .filepond--root {
    margin-bottom: 0;
  }

  .filepond--drop-label {
    cursor: pointer;

    > label {
      cursor: pointer;
    }
  }
}
</style>
