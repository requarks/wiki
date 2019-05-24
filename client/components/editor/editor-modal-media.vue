<template lang='pug'>
  v-card.editor-modal-media.animated.fadeInLeft(flat, tile)
    v-container.pa-3(grid-list-lg, fluid)
      v-layout(row, wrap)
        v-flex(xs12, xl9)
          v-card.radius-7.animated.fadeInLeft.wait-p1s(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  .body-2.teal--text Assets
                v-btn.ml-3.my-0.radius-7(outline, large, color='teal', icon, @click='refresh')
                  v-icon cached
                v-dialog(v-model='newFolderDialog', max-width='550')
                  v-btn.my-0.mr-0.radius-7(outline, large, color='teal', :icon='$vuetify.breakpoint.xsOnly', slot='activator')
                    v-icon(:left='$vuetify.breakpoint.mdAndUp') add
                    span.hidden-sm-and-down New Folder
                  v-card.wiki-form
                    .dialog-header.is-short New Folder
                    v-card-text
                      v-text-field.md2(
                        outline
                        background-color='grey lighten-3'
                        prepend-icon='folder'
                        v-model='newFolderName'
                        label='Folder Name'
                        counter='255'
                        @keyup.enter='createFolder'
                        @keyup.esc='newFolderDialog = false'
                        ref='folderNameIpt'
                        )
                      .caption.grey--text.text--darken-1.pl-5 Must follow the asset folder #[a(href='https://docs-beta.requarks.io/guide/assets#naming-restrictions', target='_blank') naming rules].
                    v-card-chin
                      v-spacer
                      v-btn(flat, @click='newFolderDialog = false') Cancel
                      v-btn(color='primary', @click='createFolder', :disabled='!isFolderNameValid', :loading='newFolderLoading') Create
              template(v-if='folders.length > 0 || currentFolderId > 0')
                .pt-2
                  v-btn.is-icon.mx-1(color='grey darken-2', outline, :dark='currentFolderId > 0', @click='upFolder()', :disabled='currentFolderId === 0')
                    v-icon keyboard_arrow_up
                  v-btn.btn-normalcase.mx-1(v-for='folder of folders', :key='folder.id', depressed,  color='grey darken-2', dark, @click='downFolder(folder)')
                    v-icon(left) folder
                    span {{ folder.name }}
                v-divider.mt-2
              v-data-table(
                :items='assets'
                :headers='headers'
                :pagination.sync='pagination'
                :rows-per-page-items='[15]'
                :loading='loading'
                must-sort,
                hide-actions
              )
                template(slot='items', slot-scope='props')
                  tr.is-clickable(
                    @click.left='currentFileId = props.item.id'
                    @click.right.prevent=''
                    :class='currentFileId === props.item.id ? `teal lighten-5` : ``'
                    )
                    td.text-xs-right(v-if='$vuetify.breakpoint.smAndUp') {{ props.item.id }}
                    td
                      .body-2(:class='currentFileId === props.item.id ? `teal--text` : ``') {{ props.item.filename }}
                      .caption.grey--text {{ props.item.description }}
                    td.text-xs-center(v-if='$vuetify.breakpoint.lgAndUp')
                      v-chip.ma-0(small, :color='$vuetify.dark ? `grey darken-4` : `grey lighten-4`')
                        .caption {{props.item.ext.toUpperCase().substring(1)}}
                    td(v-if='$vuetify.breakpoint.mdAndUp') {{ props.item.fileSize | prettyBytes }}
                    td(v-if='$vuetify.breakpoint.mdAndUp') {{ props.item.createdAt | moment('from') }}
                    td(v-if='$vuetify.breakpoint.smAndUp')
                      v-menu(offset-x)
                        v-btn.ma-0(icon, slot='activator')
                          v-icon(color='grey darken-2') more_horiz
                        v-list.py-0(style='border-top: 5px solid #444;')
                          v-list-tile(@click='')
                            v-list-tile-avatar
                              v-icon(color='teal') short_text
                            v-list-tile-content Properties
                          v-divider
                          template(v-if='props.item.kind === `IMAGE`')
                            v-list-tile(@click='')
                              v-list-tile-avatar
                                v-icon(color='green') image_search
                              v-list-tile-content Preview
                            v-divider
                            v-list-tile(@click='')
                              v-list-tile-avatar
                                v-icon(color='indigo') crop_rotate
                              v-list-tile-content Edit
                            v-divider
                            v-list-tile(@click='')
                              v-list-tile-avatar
                                v-icon(color='purple') offline_bolt
                              v-list-tile-content Optimize
                            v-divider
                          v-list-tile(@click='')
                            v-list-tile-avatar
                              v-icon(color='orange') keyboard
                            v-list-tile-content Rename
                          v-divider
                          v-list-tile(@click='')
                            v-list-tile-avatar
                              v-icon(color='blue') forward
                            v-list-tile-content Move
                          v-divider
                          v-list-tile(@click='')
                            v-list-tile-avatar
                              v-icon(color='red') delete
                            v-list-tile-content Delete
                template(slot='no-data')
                  v-alert.mt-3.radius-7(icon='folder_open', :value='true', outline, color='teal') This asset folder is empty.
              .text-xs-center.py-2(v-if='this.pageTotal > 1')
                v-pagination(v-model='pagination.page', :length='pageTotal')
              .d-flex.mt-3
                v-toolbar.radius-7(flat, color='grey lighten-4', dense, height='44')
                  template(v-if='folderTree.length > 0')
                    .body-2
                      span.mr-1 /
                      template(v-for='folder of folderTree')
                        span(:key='folder.id') {{folder.name}}
                        span.mx-1 /
                  .body-2(v-else) / #[em root]
                  template(v-if='$vuetify.breakpoint.smAndUp')
                    v-spacer
                    .body-1.grey--text.text--darken-1 {{assets.length}} files
                v-btn.ml-3.mr-0.my-0.radius-7(color='teal', large, @click='insert', :disabled='!currentFileId', :dark='currentFileId !== null')
                  v-icon(left) save_alt
                  span Insert

        v-flex(xs12, xl3)
          v-card.radius-7.animated.fadeInRight.wait-p3s(light)
            v-card-text
              .d-flex
                v-toolbar.radius-7(color='teal lighten-5', dense, flat, height='44')
                  v-icon.mr-3(color='teal') cloud_upload
                  .body-2.teal--text Upload Assets
                v-btn.my-0.ml-3.mr-0.radius-7(outline, large, color='teal', @click='browse', v-if='$vuetify.breakpoint.mdAndUp')
                  v-icon(left) touch_app
                  span Browse
              file-pond.mt-3(
                name='mediaUpload'
                ref='pond'
                label-idle='Browse or Drop files here...'
                allow-multiple='true'
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
                v-spacer
                v-chip(label, color='white', small).teal--text coming soon
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
              v-btn(color='teal', disabled) Fetch

          v-card.mt-3.radius-7.animated.fadeInRight.wait-p4s(light)
            v-card-text.pb-0
              v-toolbar.radius-7(color='teal lighten-5', dense, flat)
                v-icon.mr-3(color='teal') format_align_left
                .body-2.teal--text Image Alignment
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

import listAssetQuery from 'gql/editor/editor-media-query-list.gql'
import listFolderAssetQuery from 'gql/editor/editor-media-query-folder-list.gql'
import createAssetFolderMutation from 'gql/editor/editor-media-mutation-folder-create.gql'

const FilePond = vueFilePond()
const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i
const disallowedFolderChars = /[A-Z()=.!@#$%?&*+`~<>,;:\\/[\]¬{| ]/

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
      folders: [],
      folderTree: [],
      files: [],
      assets: [],
      pagination: {},
      remoteImageUrl: '',
      imageAlignments: [
        { text: 'None', value: '' },
        { text: 'Left', value: 'left' },
        { text: 'Centered', value: 'center' },
        { text: 'Right', value: 'right' },
        { text: 'Absolute Top Right', value: 'abstopright' }
      ],
      imageAlignment: '',
      currentFolderId: 0,
      currentFileId: null,
      previousFolderId: 0,
      loading: false,
      newFolderDialog: false,
      newFolderName: '',
      newFolderLoading: false
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    activeModal: sync('editor/activeModal'),
    pageTotal () {
      if (this.pagination.rowsPerPage == null || this.pagination.totalItems == null) {
        return 0
      }

      return Math.ceil(this.assets.length / this.pagination.rowsPerPage)
    },
    headers() {
      return _.compact([
        this.$vuetify.breakpoint.smAndUp && { text: 'ID', value: 'id', width: 50, align: 'right' },
        { text: 'Filename', value: 'filename' },
        this.$vuetify.breakpoint.lgAndUp && { text: 'Type', value: 'ext', width: 50 },
        this.$vuetify.breakpoint.mdAndUp && { text: 'File Size', value: 'fileSize', width: 110 },
        this.$vuetify.breakpoint.mdAndUp && { text: 'Added', value: 'createdAt', width: 175 },
        this.$vuetify.breakpoint.smAndUp && { text: 'Actions', value: '', width: 40, sortable: false, align:'right' }
      ])
    },
    isFolderNameValid() {
      return this.newFolderName.length > 1 && !localeSegmentRegex.test(this.newFolderName) && !disallowedFolderChars.test(this.newFolderName)
    }
  },
  watch: {
    newFolderDialog(newValue, oldValue) {
      if (newValue) {
        this.$nextTick(() => {
          this.$refs.folderNameIpt.focus()
        })
      }
    }
  },
  filters: {
    prettyBytes(num) {
      if (typeof num !== 'number' || isNaN(num)) {
        throw new TypeError('Expected a number')
      }

      let exponent
      let unit
      let neg = num < 0
      let units = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

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
    async refresh() {
      await this.$apollo.queries.assets.refetch()
      this.$store.commit('showNotification', {
          message: 'List of assets refreshed successfully.',
          style: 'success',
          icon: 'check'
        })
    },
    insert () {
      const asset = _.find(this.assets, ['id', this.currentFileId])
      const assetPath = this.folderTree.map(f => f.slug).join('/')
      this.$root.$emit('editorInsert', {
        kind: asset.kind,
        path: this.currentFolderId > 0 ? `/${assetPath}/${asset.filename}` : `/${asset.filename}`,
        text: asset.filename,
        align: this.imageAlignment
      })
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
          folderId: this.currentFolderId
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
    },
    downFolder(folder) {
      this.folderTree.push(folder)
      this.currentFolderId = folder.id
      this.currentFileId = null
    },
    upFolder() {
      this.folderTree.pop()
      const parentFolder = _.last(this.folderTree)
      this.currentFolderId = parentFolder ? parentFolder.id : 0
      this.currentFileId = null
    },
    async createFolder() {
      this.$store.commit(`loadingStart`, 'editor-media-createfolder')
      this.newFolderLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: createAssetFolderMutation,
          variables: {
            parentFolderId: this.currentFolderId,
            slug: this.newFolderName
          }
        })
        if (_.get(resp, 'data.assets.createFolder.responseResult.succeeded', false)) {
          await this.$apollo.queries.folders.refetch()
          this.$store.commit('showNotification', {
            message: 'Asset folder created successfully.',
            style: 'success',
            icon: 'check'
          })
          this.newFolderDialog = false
          this.newFolderName = ''
        } else {
          this.$store.commit('pushGraphError', new Error(_.get(resp, 'data.assets.createFolder.responseResult.message')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.newFolderLoading = false
      this.$store.commit(`loadingStop`, 'editor-media-createfolder')
    }
  },
  apollo: {
    folders: {
      query: listFolderAssetQuery,
      variables() {
        return {
          parentFolderId: this.currentFolderId
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.assets.folders,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'editor-media-folders-list-refresh')
      }
    },
    assets: {
      query: listAssetQuery,
      variables() {
        return {
          folderId: this.currentFolderId,
          kind: 'ALL'
        }
      },
      throttle: 1000,
      fetchPolicy: 'network-only',
      update: (data) => data.assets.list,
      watchLoading (isLoading) {
        this.loading = isLoading
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

  @include until($tablet) {
    left: 40px;
    width: calc(100vw - 40px);
    height: calc(100vh - 112px - 24px);
  }

  .filepond--root {
    margin-bottom: 0;
  }

  .filepond--drop-label {
    cursor: pointer;

    > label {
      cursor: pointer;
    }
  }

  .v-btn--icon {
    padding: 0 20px;
  }
}
</style>
