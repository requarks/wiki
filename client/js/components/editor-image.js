'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import 'jquery-contextmenu'
import 'jquery-simple-upload'

module.exports = (alerts, mde, mdeModalOpenState, socket) => {
  let vueImage = new Vue({
    el: '#modal-editor-image',
    data: {
      isLoading: false,
      isLoadingText: '',
      newFolderName: '',
      newFolderShow: false,
      newFolderError: false,
      fetchFromUrlURL: '',
      fetchFromUrlShow: false,
      folders: [],
      currentFolder: '',
      currentImage: '',
      currentAlign: 'left',
      images: [],
      uploadSucceeded: false,
      postUploadChecks: 0,
      renameImageShow: false,
      renameImageId: '',
      renameImageFilename: '',
      deleteImageShow: false,
      deleteImageId: '',
      deleteImageFilename: ''
    },
    methods: {

      open: () => {
        mdeModalOpenState = true
        $('#modal-editor-image').addClass('is-active')
        vueImage.refreshFolders()
      },
      cancel: (ev) => {
        mdeModalOpenState = false
        $('#modal-editor-image').removeClass('is-active')
      },

      // -------------------------------------------
      // INSERT IMAGE
      // -------------------------------------------

      selectImage: (imageId) => {
        vueImage.currentImage = imageId
      },
      insertImage: (ev) => {
        console.log(mde)
        if (mde.codemirror.doc.somethingSelected()) {
          mde.codemirror.execCommand('singleSelection')
        }

        let selImage = _.find(vueImage.images, ['_id', vueImage.currentImage])
        selImage.normalizedPath = (selImage.folder === 'f:') ? selImage.filename : selImage.folder.slice(2) + '/' + selImage.filename
        selImage.titleGuess = _.startCase(selImage.basename)

        let imageText = '![' + selImage.titleGuess + '](/uploads/' + selImage.normalizedPath + ' "' + selImage.titleGuess + '")'
        switch (vueImage.currentAlign) {
          case 'center':
            imageText += '{.align-center}'
            break
          case 'right':
            imageText += '{.align-right}'
            break
          case 'logo':
            imageText += '{.pagelogo}'
            break
        }

        mde.codemirror.doc.replaceSelection(imageText)
        vueImage.cancel()
      },

      // -------------------------------------------
      // NEW FOLDER
      // -------------------------------------------

      newFolder: (ev) => {
        vueImage.newFolderName = ''
        vueImage.newFolderError = false
        vueImage.newFolderShow = true
        _.delay(() => { $('#txt-editor-image-newfoldername').focus() }, 400)
      },
      newFolderDiscard: (ev) => {
        vueImage.newFolderShow = false
      },
      newFolderCreate: (ev) => {
        let regFolderName = new RegExp('^[a-z0-9][a-z0-9-]*[a-z0-9]$')
        vueImage.newFolderName = _.kebabCase(_.trim(vueImage.newFolderName))

        if (_.isEmpty(vueImage.newFolderName) || !regFolderName.test(vueImage.newFolderName)) {
          vueImage.newFolderError = true
          return
        }

        vueImage.newFolderDiscard()
        vueImage.isLoadingText = 'Creating new folder...'
        vueImage.isLoading = true

        Vue.nextTick(() => {
          socket.emit('uploadsCreateFolder', { foldername: vueImage.newFolderName }, (data) => {
            vueImage.folders = data
            vueImage.currentFolder = vueImage.newFolderName
            vueImage.images = []
            vueImage.isLoading = false
          })
        })
      },

      // -------------------------------------------
      // FETCH FROM URL
      // -------------------------------------------

      fetchFromUrl: (ev) => {
        vueImage.fetchFromUrlURL = ''
        vueImage.fetchFromUrlShow = true
        _.delay(() => { $('#txt-editor-image-fetchurl').focus() }, 400)
      },
      fetchFromUrlDiscard: (ev) => {
        vueImage.fetchFromUrlShow = false
      },
      fetchFromUrlGo: (ev) => {
        vueImage.fetchFromUrlDiscard()
        vueImage.isLoadingText = 'Fetching image...'
        vueImage.isLoading = true

        Vue.nextTick(() => {
          socket.emit('uploadsFetchFileFromURL', { folder: vueImage.currentFolder, fetchUrl: vueImage.fetchFromUrlURL }, (data) => {
            if (data.ok) {
              vueImage.waitChangeComplete(vueImage.images.length, true)
            } else {
              vueImage.isLoading = false
              alerts.pushError('Upload error', data.msg)
            }
          })
        })
      },

      // -------------------------------------------
      // RENAME IMAGE
      // -------------------------------------------

      renameImage: () => {
        let c = _.find(vueImage.images, [ '_id', vueImage.renameImageId ])
        vueImage.renameImageFilename = c.basename || ''
        vueImage.renameImageShow = true
        _.delay(() => {
          $('#txt-editor-image-rename').focus()
          _.defer(() => { $('#txt-editor-image-rename').select() })
        }, 400)
      },
      renameImageDiscard: () => {
        vueImage.renameImageShow = false
      },
      renameImageGo: () => {
        vueImage.renameImageDiscard()
        vueImage.isLoadingText = 'Renaming image...'
        vueImage.isLoading = true

        Vue.nextTick(() => {
          socket.emit('uploadsRenameFile', { uid: vueImage.renameImageId, folder: vueImage.currentFolder, filename: vueImage.renameImageFilename }, (data) => {
            if (data.ok) {
              vueImage.waitChangeComplete(vueImage.images.length, false)
            } else {
              vueImage.isLoading = false
              alerts.pushError('Rename error', data.msg)
            }
          })
        })
      },

      // -------------------------------------------
      // MOVE IMAGE
      // -------------------------------------------

      moveImage: (uid, fld) => {
        vueImage.isLoadingText = 'Moving image...'
        vueImage.isLoading = true
        Vue.nextTick(() => {
          socket.emit('uploadsMoveFile', { uid, folder: fld }, (data) => {
            if (data.ok) {
              vueImage.loadImages()
            } else {
              vueImage.isLoading = false
              alerts.pushError('Rename error', data.msg)
            }
          })
        })
      },

      // -------------------------------------------
      // DELETE IMAGE
      // -------------------------------------------

      deleteImageWarn: (show) => {
        if (show) {
          let c = _.find(vueImage.images, [ '_id', vueImage.deleteImageId ])
          vueImage.deleteImageFilename = c.filename || 'this image'
        }
        vueImage.deleteImageShow = show
      },
      deleteImageGo: () => {
        vueImage.deleteImageWarn(false)
        vueImage.isLoadingText = 'Deleting image...'
        vueImage.isLoading = true
        Vue.nextTick(() => {
          socket.emit('uploadsDeleteFile', { uid: vueImage.deleteImageId }, (data) => {
            vueImage.loadImages()
          })
        })
      },

      // -------------------------------------------
      // LOAD FROM REMOTE
      // -------------------------------------------

      selectFolder: (fldName) => {
        vueImage.currentFolder = fldName
        vueImage.loadImages()
      },

      refreshFolders: () => {
        vueImage.isLoadingText = 'Fetching folders list...'
        vueImage.isLoading = true
        vueImage.currentFolder = ''
        vueImage.currentImage = ''
        Vue.nextTick(() => {
          socket.emit('uploadsGetFolders', { }, (data) => {
            vueImage.folders = data
            vueImage.loadImages()
          })
        })
      },

      loadImages: (silent) => {
        if (!silent) {
          vueImage.isLoadingText = 'Fetching images...'
          vueImage.isLoading = true
        }
        return new Promise((resolve, reject) => {
          Vue.nextTick(() => {
            socket.emit('uploadsGetImages', { folder: vueImage.currentFolder }, (data) => {
              vueImage.images = data
              if (!silent) {
                vueImage.isLoading = false
              }
              vueImage.attachContextMenus()
              resolve(true)
            })
          })
        })
      },

      waitChangeComplete: (oldAmount, expectChange) => {
        expectChange = (_.isBoolean(expectChange)) ? expectChange : true

        vueImage.postUploadChecks++
        vueImage.isLoadingText = 'Processing...'

        Vue.nextTick(() => {
          vueImage.loadImages(true).then(() => {
            if ((vueImage.images.length !== oldAmount) === expectChange) {
              vueImage.postUploadChecks = 0
              vueImage.isLoading = false
            } else if (vueImage.postUploadChecks > 5) {
              vueImage.postUploadChecks = 0
              vueImage.isLoading = false
              alerts.pushError('Unable to fetch updated listing', 'Try again later')
            } else {
              _.delay(() => {
                vueImage.waitChangeComplete(oldAmount, expectChange)
              }, 1500)
            }
          })
        })
      },

      // -------------------------------------------
      // IMAGE CONTEXT MENU
      // -------------------------------------------

      attachContextMenus: () => {
        let moveFolders = _.map(vueImage.folders, (f) => {
          return {
            name: (f !== '') ? f : '/ (root)',
            icon: 'fa-folder',
            callback: (key, opt) => {
              let moveImageId = _.toString($(opt.$trigger).data('uid'))
              let moveImageDestFolder = _.nth(vueImage.folders, key)
              vueImage.moveImage(moveImageId, moveImageDestFolder)
            }
          }
        })

        $.contextMenu('destroy', '.editor-modal-image-choices > figure')
        $.contextMenu({
          selector: '.editor-modal-image-choices > figure',
          appendTo: '.editor-modal-image-choices',
          position: (opt, x, y) => {
            $(opt.$trigger).addClass('is-contextopen')
            let trigPos = $(opt.$trigger).position()
            let trigDim = { w: $(opt.$trigger).width() / 2, h: $(opt.$trigger).height() / 2 }
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
                vueImage.renameImageId = _.toString(opt.$trigger[0].dataset.uid)
                vueImage.renameImage()
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
                vueImage.deleteImageId = _.toString(opt.$trigger[0].dataset.uid)
                vueImage.deleteImageWarn(true)
              }
            }
          }
        })
      }

    }
  })

  $('#btn-editor-image-upload input').on('change', (ev) => {
    let curImageAmount = vueImage.images.length

    $(ev.currentTarget).simpleUpload('/uploads/img', {

      name: 'imgfile',
      data: {
        folder: vueImage.currentFolder
      },
      limit: 20,
      expect: 'json',
      allowedExts: ['jpg', 'jpeg', 'gif', 'png', 'webp'],
      allowedTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      maxFileSize: 3145728, // max 3 MB

      init: (totalUploads) => {
        vueImage.uploadSucceeded = false
        vueImage.isLoadingText = 'Preparing to upload...'
        vueImage.isLoading = true
      },

      progress: (progress) => {
        vueImage.isLoadingText = 'Uploading...' + Math.round(progress) + '%'
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
              vueImage.uploadSucceeded = true
            }
          } else {
            vueImage.uploadSucceeded = true
          }
        } else {
          alerts.pushError('Upload error', data.msg)
        }
      },

      error: (error) => {
        alerts.pushError(error.message, this.upload.file.name)
      },

      finish: () => {
        if (vueImage.uploadSucceeded) {
          vueImage.waitChangeComplete(curImageAmount, true)
        } else {
          vueImage.isLoading = false
        }
      }

    })
  })
  return vueImage
}
