'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import 'jquery-contextmenu'
import 'jquery-simple-upload'

module.exports = (alerts, mde, mdeModalOpenState, socket) => {
  let vueFile = new Vue({
    el: '#modal-editor-file',
    data: {
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
    },
    methods: {

      open: () => {
        mdeModalOpenState = true // eslint-disable-line no-undef
        $('#modal-editor-file').addClass('is-active')
        vueFile.refreshFolders()
      },
      cancel: (ev) => {
        mdeModalOpenState = false // eslint-disable-line no-undef
        $('#modal-editor-file').removeClass('is-active')
      },

      // -------------------------------------------
      // INSERT LINK TO FILE
      // -------------------------------------------

      selectFile: (fileId) => {
        vueFile.currentFile = fileId
      },
      insertFileLink: (ev) => {
        if (mde.codemirror.doc.somethingSelected()) {
          mde.codemirror.execCommand('singleSelection')
        }

        let selFile = _.find(vueFile.files, ['_id', vueFile.currentFile])
        selFile.normalizedPath = (selFile.folder === 'f:') ? selFile.filename : selFile.folder.slice(2) + '/' + selFile.filename
        selFile.titleGuess = _.startCase(selFile.basename)

        let fileText = '[' + selFile.titleGuess + '](/uploads/' + selFile.normalizedPath + ' "' + selFile.titleGuess + '")'

        mde.codemirror.doc.replaceSelection(fileText)
        vueFile.cancel()
      },

      // -------------------------------------------
      // NEW FOLDER
      // -------------------------------------------

      newFolder: (ev) => {
        vueFile.newFolderName = ''
        vueFile.newFolderError = false
        vueFile.newFolderShow = true
        _.delay(() => { $('#txt-editor-file-newfoldername').focus() }, 400)
      },
      newFolderDiscard: (ev) => {
        vueFile.newFolderShow = false
      },
      newFolderCreate: (ev) => {
        let regFolderName = new RegExp('^[a-z0-9][a-z0-9-]*[a-z0-9]$')
        vueFile.newFolderName = _.kebabCase(_.trim(vueFile.newFolderName))

        if (_.isEmpty(vueFile.newFolderName) || !regFolderName.test(vueFile.newFolderName)) {
          vueFile.newFolderError = true
          return
        }

        vueFile.newFolderDiscard()
        vueFile.isLoadingText = 'Creating new folder...'
        vueFile.isLoading = true

        Vue.nextTick(() => {
          socket.emit('uploadsCreateFolder', { foldername: vueFile.newFolderName }, (data) => {
            vueFile.folders = data
            vueFile.currentFolder = vueFile.newFolderName
            vueFile.files = []
            vueFile.isLoading = false
          })
        })
      },

      // -------------------------------------------
      // RENAME FILE
      // -------------------------------------------

      renameFile: () => {
        let c = _.find(vueFile.files, [ '_id', vueFile.renameFileId ])
        vueFile.renameFileFilename = c.basename || ''
        vueFile.renameFileShow = true
        _.delay(() => {
          $('#txt-editor-renamefile').focus()
          _.defer(() => { $('#txt-editor-file-rename').select() })
        }, 400)
      },
      renameFileDiscard: () => {
        vueFile.renameFileShow = false
      },
      renameFileGo: () => {
        vueFile.renameFileDiscard()
        vueFile.isLoadingText = 'Renaming file...'
        vueFile.isLoading = true

        Vue.nextTick(() => {
          socket.emit('uploadsRenameFile', { uid: vueFile.renameFileId, folder: vueFile.currentFolder, filename: vueFile.renameFileFilename }, (data) => {
            if (data.ok) {
              vueFile.waitChangeComplete(vueFile.files.length, false)
            } else {
              vueFile.isLoading = false
              alerts.pushError('Rename error', data.msg)
            }
          })
        })
      },

      // -------------------------------------------
      // MOVE FILE
      // -------------------------------------------

      moveFile: (uid, fld) => {
        vueFile.isLoadingText = 'Moving file...'
        vueFile.isLoading = true
        Vue.nextTick(() => {
          socket.emit('uploadsMoveFile', { uid, folder: fld }, (data) => {
            if (data.ok) {
              vueFile.loadFiles()
            } else {
              vueFile.isLoading = false
              alerts.pushError('Rename error', data.msg)
            }
          })
        })
      },

      // -------------------------------------------
      // DELETE FILE
      // -------------------------------------------

      deleteFileWarn: (show) => {
        if (show) {
          let c = _.find(vueFile.files, [ '_id', vueFile.deleteFileId ])
          vueFile.deleteFileFilename = c.filename || 'this file'
        }
        vueFile.deleteFileShow = show
      },
      deleteFileGo: () => {
        vueFile.deleteFileWarn(false)
        vueFile.isLoadingText = 'Deleting file...'
        vueFile.isLoading = true
        Vue.nextTick(() => {
          socket.emit('uploadsDeleteFile', { uid: vueFile.deleteFileId }, (data) => {
            vueFile.loadFiles()
          })
        })
      },

      // -------------------------------------------
      // LOAD FROM REMOTE
      // -------------------------------------------

      selectFolder: (fldName) => {
        vueFile.currentFolder = fldName
        vueFile.loadFiles()
      },

      refreshFolders: () => {
        vueFile.isLoadingText = 'Fetching folders list...'
        vueFile.isLoading = true
        vueFile.currentFolder = ''
        vueFile.currentImage = ''
        Vue.nextTick(() => {
          socket.emit('uploadsGetFolders', { }, (data) => {
            vueFile.folders = data
            vueFile.loadFiles()
          })
        })
      },

      loadFiles: (silent) => {
        if (!silent) {
          vueFile.isLoadingText = 'Fetching files...'
          vueFile.isLoading = true
        }
        return new Promise((resolve, reject) => {
          Vue.nextTick(() => {
            socket.emit('uploadsGetFiles', { folder: vueFile.currentFolder }, (data) => {
              vueFile.files = data
              if (!silent) {
                vueFile.isLoading = false
              }
              vueFile.attachContextMenus()
              resolve(true)
            })
          })
        })
      },

      waitChangeComplete: (oldAmount, expectChange) => {
        expectChange = (_.isBoolean(expectChange)) ? expectChange : true

        vueFile.postUploadChecks++
        vueFile.isLoadingText = 'Processing...'

        Vue.nextTick(() => {
          vueFile.loadFiles(true).then(() => {
            if ((vueFile.files.length !== oldAmount) === expectChange) {
              vueFile.postUploadChecks = 0
              vueFile.isLoading = false
            } else if (vueFile.postUploadChecks > 5) {
              vueFile.postUploadChecks = 0
              vueFile.isLoading = false
              alerts.pushError('Unable to fetch updated listing', 'Try again later')
            } else {
              _.delay(() => {
                vueFile.waitChangeComplete(oldAmount, expectChange)
              }, 1500)
            }
          })
        })
      },

      // -------------------------------------------
      // IMAGE CONTEXT MENU
      // -------------------------------------------

      attachContextMenus: () => {
        let moveFolders = _.map(vueFile.folders, (f) => {
          return {
            name: (f !== '') ? f : '/ (root)',
            icon: 'fa-folder',
            callback: (key, opt) => {
              let moveFileId = _.toString($(opt.$trigger).data('uid'))
              let moveFileDestFolder = _.nth(vueFile.folders, key)
              vueFile.moveFile(moveFileId, moveFileDestFolder)
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
              name: 'Rename',
              icon: 'fa-edit',
              callback: (key, opt) => {
                vueFile.renameFileId = _.toString(opt.$trigger[0].dataset.uid)
                vueFile.renameFile()
              }
            },
            move: {
              name: 'Move to...',
              icon: 'fa-folder-open-o',
              items: moveFolders
            },
            delete: {
              name: 'Delete',
              icon: 'fa-trash',
              callback: (key, opt) => {
                vueFile.deleteFileId = _.toString(opt.$trigger[0].dataset.uid)
                vueFile.deleteFileWarn(true)
              }
            }
          }
        })
      }

    }
  })

  $('#btn-editor-file-upload input').on('change', (ev) => {
    let curFileAmount = vueFile.files.length

    $(ev.currentTarget).simpleUpload('/uploads/file', {

      name: 'binfile',
      data: {
        folder: vueFile.currentFolder
      },
      limit: 20,
      expect: 'json',
      maxFileSize: 0,

      init: (totalUploads) => {
        vueFile.uploadSucceeded = false
        vueFile.isLoadingText = 'Preparing to upload...'
        vueFile.isLoading = true
      },

      progress: (progress) => {
        vueFile.isLoadingText = 'Uploading...' + Math.round(progress) + '%'
      },

      success: (data) => {
        if (data.ok) {
          let failedUpls = _.filter(data.results, ['ok', false])
          if (failedUpls.length) {
            _.forEach(failedUpls, (u) => {
              alerts.pushError('Upload error', u.msg)
            })
            if (failedUpls.length < data.results.length) {
              alerts.push({
                title: 'Some uploads succeeded',
                message: 'Files that are not mentionned in the errors above were uploaded successfully.'
              })
              vueFile.uploadSucceeded = true
            }
          } else {
            vueFile.uploadSucceeded = true
          }
        } else {
          alerts.pushError('Upload error', data.msg)
        }
      },

      error: (error) => {
        alerts.pushError('Upload error', error.message)
      },

      finish: () => {
        if (vueFile.uploadSucceeded) {
          vueFile.waitChangeComplete(curFileAmount, true)
        } else {
          vueFile.isLoading = false
        }
      }

    })
  })
  return vueFile
}
