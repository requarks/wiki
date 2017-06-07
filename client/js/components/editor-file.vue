<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content.is-expanded(v-show='isShown')
            header.is-green
              span {{ $t('editor.filetitle') }}
              p.modal-notify(:class='{ "is-active": isLoading }')
                span {{ isLoadingText }}
                i
            .modal-toolbar.is-green
              a.button(@click='newFolder')
                i.icon-folder2
                span {{ $t('editor.newfolder') }}
              a.button#btn-editor-file-upload
                i.icon-cloud-upload
                span {{ $t('editor.fileupload') }}
                label
                  input(type='file', multiple, :disabled='isLoading', ref='editorFileUploadInput')
            section.is-gapless
              .columns.is-stretched
                .column.is-one-quarter.modal-sidebar.is-green(style={'max-width':'350px'})
                  .model-sidebar-header {{ $t('editor.folders') }}
                  ul.model-sidebar-list
                    li(v-for='fld in folders')
                      a(@click='selectFolder(fld)', :class='{ "is-active": currentFolder === fld }')
                        i.icon-folder2
                        span / {{ fld }}
                .column.editor-modal-file-choices
                  figure(v-for='fl in files', :class='{ "is-active": currentFile === fl._id }', @click='selectFile(fl._id)', :data-uid='fl._id')
                    i(class='icon-file')
                    span: strong {{ fl.filename }}
                    span {{ fl.mime }}
                    span {{ filesize(fl.filesize) }}
                  em(v-show='files.length < 1')
                    i.icon-marquee-minus
                    | {{ $t('editor.filefolderempty') }}
            footer
              a.button.is-grey.is-outlined(@click='cancel') {{ $t('editor.discard') }}
              a.button.is-green(@click='insertFileLink') {{ $t('editor.fileinsert') }}

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
        folders: [],
        currentFolder: '',
        currentFile: '',
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
      }

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

        let fileText = '[' + selFile.titleGuess + '](/uploads/' + selFile.normalizedPath + ' "' + selFile.titleGuess + '")'

        this.$store.dispatch('editor/insert', fileText)
        this.$store.dispatch('alert', {
          style: 'blue',
          icon: 'paper',
          msg: this.$t('editor.filesuccess')
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
              icon: 'folder2',
              msg: self.$t('modal.newfoldersuccess', { name: self.newFolderName })
            })
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
                icon: 'square-cross',
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
                icon: 'arrow-right2',
                msg: self.$t('editor.filemovesuccess')
              })
            } else {
              self.isLoading = false
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'square-cross',
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
              icon: 'trash2',
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
            socket.emit('uploadsGetFiles', { folder: self.currentFolder }, (data) => {
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
                icon: 'square-cross',
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
            icon: 'icon-folder2',
            callback: (key, opt) => {
              let moveFileId = self._.toString($(opt.$trigger).data('uid'))
              let moveFileDestFolder = self._.nth(self.folders, key)
              self.moveFile(moveFileId, moveFileDestFolder)
            }
          }
        })

        $.contextMenu('destroy', '.editor-modal-file-choices > figure')
        $.contextMenu({
          selector: '.editor-modal-file-choices > figure',
          appendTo: '.editor-modal-file-choices',
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
              icon: 'icon-edit',
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

        $(this.$refs.editorFileUploadInput).simpleUpload('/uploads/file', {

          name: 'binfile',
          data: {
            folder: self.currentFolder
          },
          limit: 20,
          expect: 'json',
          maxFileSize: 0,

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
                    icon: 'square-cross',
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
                  icon: 'cloud-upload',
                  msg: self.$t('editor.fileuploadsuccess')
                })
              }
            } else {
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'square-cross',
                msg: self.$t('editor.fileuploaderror', { err: data.msg })
              })
            }
          },

          error: (error) => {
            self.$store.dispatch('alert', {
              style: 'red',
              icon: 'square-cross',
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
