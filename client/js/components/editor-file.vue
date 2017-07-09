<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content.is-expanded(v-show='isShown')
            header.is-green
              span {{ (mode === 'file') ? $t('editor.filetitle') : $t('editor.imagetitle') }}
              p.modal-notify(:class='{ "is-active": isLoading }')
                span {{ isLoadingText }}
                i
            .modal-toolbar.is-green
              a.button(@click='newFolder')
                i.nc-icon-outline.files_folder-14
                span {{ $t('editor.newfolder') }}
              a.button#btn-editor-file-upload
                i.nc-icon-outline.arrows-1_cloud-upload-94
                span {{ (mode === 'file') ? $t('editor.fileupload') : $t('editor.imageupload') }}
                label
                  input(type='file', multiple, :disabled='isLoading', ref='editorFileUploadInput')
              a.button(v-if='mode === "image"', @click='fetchFromUrl')
                i.nc-icon-outline.arrows-1_cloud-download-93
                span Fetch from URL
            section.is-gapless
              .columns.is-stretched
                .column.is-one-quarter.modal-sidebar.is-green(style={'max-width':'350px'})
                  .model-sidebar-header {{ $t('editor.folders') }}
                  ul.model-sidebar-list
                    li(v-for='fld in folders')
                      a(@click='selectFolder(fld)', :class='{ "is-active": currentFolder === fld }')
                        i.nc-icon-outline.files_folder-17
                        span / {{ fld }}
                  .model-sidebar-header(v-if='mode === "image"') Alignment
                  .model-sidebar-content(v-if='mode === "image"')
                    p.control.is-fullwidth
                      select(v-model='currentAlign')
                        option(value='left') {{ $t('editor.imagealignleft') }}
                        option(value='center') {{ $t('editor.imagealigncenter') }}
                        option(value='right') {{ $t('editor.imagealignright') }}
                        option(value='logo') {{ $t('editor.imagealignlogo') }}
                .column.editor-modal-choices.editor-modal-file-choices(v-if='mode === "file"')
                  figure(v-for='fl in files', :class='{ "is-active": currentFile === fl._id }', @click='selectFile(fl._id)', :data-uid='fl._id')
                    i(class='icon-file')
                    span: strong {{ fl.filename }}
                    span {{ fl.mime }}
                    span {{ filesize(fl.filesize) }}
                  em(v-show='files.length < 1')
                    i.icon-marquee-minus
                    | {{ $t('editor.filefolderempty') }}
                .column.editor-modal-choices.editor-modal-image-choices(v-if='mode === "image"')
                  figure(v-for='img in files', v-bind:class='{ "is-active": currentFile === img._id }', v-on:click='selectFile(img._id)', v-bind:data-uid='img._id')
                    img(v-bind:src='"/uploads/t/" + img._id + ".png"')
                    span: strong {{ img.basename }}
                    span {{ filesize(img.filesize) }}
                  em(v-show='files.length < 1')
                    i.icon-marquee-minus
                    | {{ $t('editor.filefolderempty') }}
            footer
              a.button.is-grey.is-outlined(@click='cancel') {{ $t('editor.discard') }}
              a.button.is-green(@click='insertFileLink') {{ (mode === 'file') ? $t('editor.fileinsert') : $t('editor.imageinsert') }}

      transition(:duration="400")
        .modal.is-superimposed(v-show='newFolderShow')
          transition(name='modal-background')
            .modal-background(v-show='newFolderShow')
          .modal-container
            transition(name='modal-content')
              .modal-content(v-show='newFolderShow')
                header.is-light-blue {{ $t('modal.newfoldertitle') }}
                section
                  label.label {{ $t('modal.newfoldername') }}
                  p.control.is-fullwidth
                    input.input(type='text', :placeholder='$t("modal.newfoldernameplaceholder")', v-model='newFolderName', ref='editorFileNewFolderInput', @keyup.enter='newFolderCreate', @keyup.esc='newFolderDiscard')
                    span.help.is-danger(v-show='newFolderError') {{ $t('modal.newfolderinvalid') }}
                footer
                  a.button.is-grey.is-outlined(@click='newFolderDiscard') {{ $t('modal.discard') }}
                  a.button.is-light-blue(@click='newFolderCreate') {{ $t('modal.create') }}

      transition(:duration="400")
        .modal.is-superimposed(v-show='fetchFromUrlShow')
          transition(name='modal-background')
            .modal-background(v-show='fetchFromUrlShow')
          .modal-container
            transition(name='modal-content')
              .modal-content(v-show='fetchFromUrlShow')
                header.is-light-blue Fetch Image from URL
                section
                  label.label Enter full URL path to the image:
                  p.control.is-fullwidth
                    input.input(type='text', placeholder='http://www.example.com/some-image.png', v-model='fetchFromUrlURL', ref='editorFileFetchInput', @keyup.enter='fetchFromUrlGo', @keyup.esc='fetchFromUrlDiscard')
                    span.help.is-danger.is-hidden This URL path is invalid!
                footer
                  a.button.is-grey.is-outlined(v-on:click='fetchFromUrlDiscard') Discard
                  a.button.is-light-blue(v-on:click='fetchFromUrlGo') Fetch

      transition(:duration="400")
        .modal.is-superimposed(v-show='renameFileShow')
          transition(name='modal-background')
            .modal-background(v-show='renameFileShow')
          .modal-container
            transition(name='modal-content')
              .modal-content(v-show='renameFileShow')
                header.is-indigo {{ $t('modal.renamefiletitle') }}
                section
                  label.label {{ $t('modal.renamefilename') }}
                  p.control.is-fullwidth
                    input.input#txt-editor-file-rename(type='text', :placeholder='$t("modal.renamefilenameplaceholder")', v-model='renameFileFilename', ref='editorFileRenameInput', @keyup.enter='renameFileGo', @keyup.esc='renameFileDiscard')
                    span.help.is-danger.is-hidden {{ $t('modal.renamefileinvalid') }}
                footer
                  a.button.is-grey.is-outlined(@click='renameFileDiscard') {{ $t('modal.discard') }}
                  a.button.is-light-blue(@click='renameFileGo') {{ $t('modal.renamefile') }}

      transition(:duration="400")
        .modal.is-superimposed(v-show='deleteFileShow')
          transition(name='modal-background')
            .modal-background(v-show='deleteFileShow')
          .modal-container
            transition(name='modal-content')
              .modal-content(v-show='deleteFileShow')
                header.is-red {{ $t('modal.deletefiletitle') }}
                section
                  span {{ $t('modal.deletefilewarn') }} #[strong {{deleteFileFilename}}]?
                footer
                  a.button.is-grey.is-outlined(@click='deleteFileWarn(false)') {{ $t('modal.discard') }}
                  a.button.is-red(@click='deleteFileGo')  {{ $t('modal.delete') }}
</template>

<script>
  export default {
    name: 'editor-file',
    data () {
      return {
        isLoading: false,
        isLoadingText: '',
        newFolderName: '',
        newFolderShow: false,
        newFolderError: false,
        fetchFromUrlURL: '',
        fetchFromUrlShow: false,
        folders: [],
        currentFolder: '',
        currentFile: '',
        currentAlign: 'left',
        files: [],
        uploadSucceeded: false,
        postUploadChecks: 0,
        renameFileShow: false,
        renameFileId: '',
        renameFileFilename: '',
        deleteFileShow: false,
        deleteFileId: '',
        deleteFileFilename: ''
      }
    },
    computed: {
      isShown () {
        return this.$store.state.editorFile.shown
      },
      mode () {
        return this.$store.state.editorFile.mode
      }
    },
    methods: {
      init () {
        $(this.$refs.editorFileUploadInput).on('change', this.upload)
        this.refreshFolders()
      },
      cancel () {
        $(this.$refs.editorFileUploadInput).off('change', this.upload)
        this.$store.dispatch('editorFile/close')
      },
      filesize (rawSize) {
        return this.$helpers.common.filesize(rawSize)
      },

      // -------------------------------------------
      // INSERT LINK TO FILE
      // -------------------------------------------

      selectFile(fileId) {
        this.currentFile = fileId
      },
      insertFileLink() {
        let selFile = this._.find(this.files, ['_id', this.currentFile])
        selFile.normalizedPath = (selFile.folder === 'f:') ? selFile.filename : selFile.folder.slice(2) + '/' + selFile.filename
        selFile.titleGuess = this._.startCase(selFile.basename)

        let textToInsert = ''

        if (this.mode === 'image') {
          textToInsert = '![' + selFile.titleGuess + '](/uploads/' + selFile.normalizedPath + ' "' + selFile.titleGuess + '")'
          switch (this.currentAlign) {
            case 'center':
              textToInsert += '{.align-center}'
              break
            case 'right':
              textToInsert += '{.align-right}'
              break
            case 'logo':
              textToInsert += '{.pagelogo}'
              break
          }
        } else {
          textToInsert = '[' + selFile.titleGuess + '](/uploads/' + selFile.normalizedPath + ' "' + selFile.titleGuess + '")'
        }

        this.$store.dispatch('editor/insert', textToInsert)
        this.$store.dispatch('alert', {
          style: 'blue',
          icon: 'ui-1_check-square-09',
          msg: (this.mode === 'file') ? this.$t('editor.filesuccess') : this.$t('editor.imagesuccess')
        })
        this.cancel()
      },

      // -------------------------------------------
      // NEW FOLDER
      // -------------------------------------------

      newFolder() {
        let self = this
        this.newFolderName = ''
        this.newFolderError = false
        this.newFolderShow = true
        this._.delay(() => { self.$refs.editorFileNewFolderInput.focus() }, 400)
      },
      newFolderDiscard() {
        this.newFolderShow = false
      },
      newFolderCreate() {
        let self = this
        let regFolderName = new RegExp('^[a-z0-9][a-z0-9-]*[a-z0-9]$')
        this.newFolderName = this._.kebabCase(this._.trim(this.newFolderName))

        if (this._.isEmpty(this.newFolderName) || !regFolderName.test(this.newFolderName)) {
          this.newFolderError = true
          return
        }

        this.newFolderDiscard()
        this.isLoadingText = this.$t('modal.newfolderloading')
        this.isLoading = true

        this.$nextTick(() => {
          socket.emit('uploadsCreateFolder', { foldername: self.newFolderName }, (data) => {
            self.folders = data
            self.currentFolder = self.newFolderName
            self.files = []
            self.isLoading = false
            self.$store.dispatch('alert', {
              style: 'blue',
              icon: 'files_folder-check',
              msg: self.$t('modal.newfoldersuccess', { name: self.newFolderName })
            })
          })
        })
      },

      // -------------------------------------------
      // FETCH FROM URL
      // -------------------------------------------

      fetchFromUrl() {
        let self = this
        this.fetchFromUrlURL = ''
        this.fetchFromUrlShow = true
        this._.delay(() => { self.$refs.editorFileFetchInput.focus() }, 400)
      },
      fetchFromUrlDiscard() {
        this.fetchFromUrlShow = false
      },
      fetchFromUrlGo() {
        let self = this
        this.fetchFromUrlDiscard()
        this.isLoadingText = 'Fetching image...'
        this.isLoading = true

        this.$nextTick(() => {
          socket.emit('uploadsFetchFileFromURL', { folder: self.currentFolder, fetchUrl: self.fetchFromUrlURL }, (data) => {
            if (data.ok) {
              self.waitChangeComplete(self.files.length, true)
            } else {
              self.isLoading = false
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'ui-2_square-remove-09',
                msg: self.$t('editor.fileuploaderror', { err: data.msg })
              })
            }
          })
        })
      },

      // -------------------------------------------
      // RENAME FILE
      // -------------------------------------------

      renameFile() {
        let self = this
        let c = this._.find(this.files, [ '_id', this.renameFileId ])
        this.renameFileFilename = c.basename || ''
        this.renameFileShow = true
        this._.delay(() => {
          self.$refs.editorFileRenameInput.select()
        }, 100)
      },
      renameFileDiscard() {
        this.renameFileShow = false
      },
      renameFileGo() {
        let self = this
        this.renameFileDiscard()
        this.isLoadingText = this.$t('modal.renamefileloading')
        this.isLoading = true

        this.$nextTick(() => {
          socket.emit('uploadsRenameFile', { uid: self.renameFileId, folder: self.currentFolder, filename: self.renameFileFilename }, (data) => {
            if (data.ok) {
              self.waitChangeComplete(self.files.length, false)
            } else {
              self.isLoading = false
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'ui-2_square-remove-09',
                msg: self.$t('modal.renamefileerror', { err: data.msg })
              })
            }
          })
        })
      },

      // -------------------------------------------
      // MOVE FILE
      // -------------------------------------------

      moveFile(uid, fld) {
        let self = this
        this.isLoadingText = this.$t('editor.filemoveloading')
        this.isLoading = true
        this.$nextTick(() => {
          socket.emit('uploadsMoveFile', { uid, folder: fld }, (data) => {
            if (data.ok) {
              self.loadFiles()
              self.$store.dispatch('alert', {
                style: 'blue',
                icon: 'files_check',
                msg: self.$t('editor.filemovesuccess')
              })
            } else {
              self.isLoading = false
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'ui-2_square-remove-09',
                msg: self.$t('editor.filemoveerror', { err: data.msg })
              })
            }
          })
        })
      },

      // -------------------------------------------
      // DELETE FILE
      // -------------------------------------------

      deleteFileWarn(show) {
        if (show) {
          let c = this._.find(this.files, [ '_id', this.deleteFileId ])
          this.deleteFileFilename = c.filename || this.$t('editor.filedeletedefault')
        }
        this.deleteFileShow = show
      },
      deleteFileGo() {
        let self = this
        this.deleteFileWarn(false)
        this.isLoadingText = this.$t('editor.filedeleteloading')
        this.isLoading = true
        this.$nextTick(() => {
          socket.emit('uploadsDeleteFile', { uid: this.deleteFileId }, (data) => {
            self.loadFiles()
            self.$store.dispatch('alert', {
              style: 'blue',
              icon: 'ui-1_trash',
              msg: self.$t('editor.filedeletesuccess')
            })
          })
        })
      },

      // -------------------------------------------
      // LOAD FROM REMOTE
      // -------------------------------------------

      selectFolder(fldName) {
        this.currentFolder = fldName
        this.loadFiles()
      },

      refreshFolders() {
        let self = this
        this.isLoadingText = this.$t('editor.foldersloading')
        this.isLoading = true
        this.currentFolder = ''
        this.currentImage = ''
        this.$nextTick(() => {
          socket.emit('uploadsGetFolders', { }, (data) => {
            self.folders = data
            self.loadFiles()
          })
        })
      },

      loadFiles(silent) {
        let self = this
        if (!silent) {
          this.isLoadingText = this.$t('editor.fileloading')
          this.isLoading = true
        }
        return new Promise((resolve, reject) => {
          self.$nextTick(() => {
            let loadAction = (self.mode === 'image') ? 'uploadsGetImages' : 'uploadsGetFiles'
            socket.emit(loadAction, { folder: self.currentFolder }, (data) => {
              self.files = data
              if (!silent) {
                self.isLoading = false
              }
              self.attachContextMenus()
              resolve(true)
            })
          })
        })
      },

      waitChangeComplete(oldAmount, expectChange) {
        let self = this
        expectChange = (this._.isBoolean(expectChange)) ? expectChange : true

        this.postUploadChecks++
        this.isLoadingText = this.$t('editor.fileprocessing')

        this.$nextTick(() => {
          self.loadFiles(true).then(() => {
            if ((self.files.length !== oldAmount) === expectChange) {
              self.postUploadChecks = 0
              self.isLoading = false
            } else if (self.postUploadChecks > 5) {
              self.postUploadChecks = 0
              self.isLoading = false
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'ui-2_square-remove-09',
                msg: self.$t('editor.fileerror')
              })
            } else {
              self._.delay(() => {
                self.waitChangeComplete(oldAmount, expectChange)
              }, 1500)
            }
          })
        })
      },

      // -------------------------------------------
      // IMAGE CONTEXT MENU
      // -------------------------------------------

      attachContextMenus() {
        let self = this
        let moveFolders = this._.map(this.folders, (f) => {
          return {
            name: (f !== '') ? f : '/ (root)',
            icon: 'nc-icon-outline files_folder-15',
            callback: (key, opt) => {
              let moveFileId = self._.toString($(opt.$trigger).data('uid'))
              let moveFileDestFolder = self._.nth(self.folders, key)
              self.moveFile(moveFileId, moveFileDestFolder)
            }
          }
        })

        $.contextMenu('destroy', '.editor-modal-choices > figure')
        $.contextMenu({
          selector: '.editor-modal-choices > figure',
          appendTo: '.editor-modal-choices',
          position: (opt, x, y) => {
            $(opt.$trigger).addClass('is-contextopen')
            let trigPos = $(opt.$trigger).position()
            let trigDim = { w: $(opt.$trigger).width() / 5, h: $(opt.$trigger).height() / 2 }
            opt.$menu.css({ top: trigPos.top + trigDim.h, left: trigPos.left + trigDim.w })
          },
          events: {
            hide: (opt) => {
              $(opt.$trigger).removeClass('is-contextopen')
            }
          },
          items: {
            rename: {
              name: self.$t('editor.filerenameaction'),
              icon: 'nc-icon-outline files_vector',
              callback: (key, opt) => {
                self.renameFileId = self._.toString(opt.$trigger[0].dataset.uid)
                self.renameFile()
              }
            },
            move: {
              name: self.$t('editor.filemoveaction'),
              icon: 'fa-folder-open-o',
              items: moveFolders
            },
            delete: {
              name: self.$t('editor.filedeleteaction'),
              icon: 'icon-trash2',
              callback: (key, opt) => {
                self.deleteFileId = self._.toString(opt.$trigger[0].dataset.uid)
                self.deleteFileWarn(true)
              }
            }
          }
        })
      },
      upload() {
        let self = this
        let curFileAmount = this.files.length
        let uplUrl = (self.mode === 'image') ? '/uploads/img' : '/uploads/file'

        $(this.$refs.editorFileUploadInput).simpleUpload(uplUrl, {

          name: (self.mode === 'image') ? 'imgfile' : 'binfile',
          data: {
            folder: self.currentFolder
          },
          limit: 20,
          expect: 'json',
          allowedExts: (self.mode === 'image') ? ['jpg', 'jpeg', 'gif', 'png', 'webp'] : undefined,
          allowedTypes: (self.mode === 'image') ? ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] : undefined,
          maxFileSize: (self.mode === 'image') ? 3145728 : 0, // max 3 MB

          init: (totalUploads) => {
            self.uploadSucceeded = false
            self.isLoadingText = 'Preparing to upload...'
            self.isLoading = true
          },

          progress: (progress) => {
            self.isLoadingText = 'Uploading...' + Math.round(progress) + '%'
          },

          success: (data) => {
            if (data.ok) {
              let failedUpls = self._.filter(data.results, ['ok', false])
              if (failedUpls.length) {
                self._.forEach(failedUpls, (u) => {
                  self.$store.dispatch('alert', {
                    style: 'red',
                    icon: 'ui-2_square-remove-09',
                    msg: self.$t('editor.fileuploaderror', { err: u.msg })
                  })
                })
                if (failedUpls.length < data.results.length) {
                  self.uploadSucceeded = true
                }
              } else {
                self.uploadSucceeded = true
                self.$store.dispatch('alert', {
                  style: 'blue',
                  icon: 'arrows-1_cloud-upload-96',
                  msg: self.$t('editor.fileuploadsuccess')
                })
              }
            } else {
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'ui-2_square-remove-09',
                msg: self.$t('editor.fileuploaderror', { err: data.msg })
              })
            }
          },

          error: (error) => {
            self.$store.dispatch('alert', {
              style: 'red',
              icon: 'ui-2_square-remove-09',
              msg: self.$t('editor.fileuploaderror', { err: error.message })
            })
          },

          finish: () => {
            if (self.uploadSucceeded) {
              self.waitChangeComplete(curFileAmount, true)
            } else {
              self.isLoading = false
            }
          }

        })
      }
    },
    mounted() {
      this.$root.$on('editorFile/init', this.init)
    }
  }
</script>
