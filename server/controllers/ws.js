'use strict'

/* global appconfig, entries, rights, search, upl */
/* eslint-disable standard/no-callback-literal */

const _ = require('lodash')

module.exports = (socket) => {
  // Check if Guest
  if (!socket.request.user.logged_in) {
    socket.request.user = _.assign(rights.guest, socket.request.user)
  }

  // -----------------------------------------
  // SEARCH
  // -----------------------------------------

  if (appconfig.public || socket.request.user.logged_in) {
    socket.on('search', (data, cb) => {
      cb = cb || _.noop
      search.find(data.terms).then((results) => {
        return cb(results) || true
      })
    })
  }

  // -----------------------------------------
  // TREE VIEW (LIST ALL PAGES)
  // -----------------------------------------

  if (appconfig.public || socket.request.user.logged_in) {
    socket.on('treeFetch', (data, cb) => {
      cb = cb || _.noop
      entries.getFromTree(data.basePath, socket.request.user).then((f) => {
        return cb(f) || true
      })
    })
  }

  // -----------------------------------------
  // UPLOADS
  // -----------------------------------------

  if (socket.request.user.logged_in) {
    socket.on('uploadsGetFolders', (data, cb) => {
      cb = cb || _.noop
      upl.getUploadsFolders().then((f) => {
        return cb(f) || true
      })
    })

    socket.on('uploadsCreateFolder', (data, cb) => {
      cb = cb || _.noop
      upl.createUploadsFolder(data.foldername).then((f) => {
        return cb(f) || true
      })
    })

    socket.on('uploadsGetImages', (data, cb) => {
      cb = cb || _.noop
      upl.getUploadsFiles('image', data.folder).then((f) => {
        return cb(f) || true
      })
    })

    socket.on('uploadsGetFiles', (data, cb) => {
      cb = cb || _.noop
      upl.getUploadsFiles('binary', data.folder).then((f) => {
        return cb(f) || true
      })
    })

    socket.on('uploadsDeleteFile', (data, cb) => {
      cb = cb || _.noop
      upl.deleteUploadsFile(data.uid).then((f) => {
        return cb(f) || true
      })
    })

    socket.on('uploadsFetchFileFromURL', (data, cb) => {
      cb = cb || _.noop
      upl.downloadFromUrl(data.folder, data.fetchUrl).then((f) => {
        return cb({ ok: true }) || true
      }).catch((err) => {
        return cb({
          ok: false,
          msg: err.message
        }) || true
      })
    })

    socket.on('uploadsRenameFile', (data, cb) => {
      cb = cb || _.noop
      upl.moveUploadsFile(data.uid, data.folder, data.filename).then((f) => {
        return cb({ ok: true }) || true
      }).catch((err) => {
        return cb({
          ok: false,
          msg: err.message
        }) || true
      })
    })

    socket.on('uploadsMoveFile', (data, cb) => {
      cb = cb || _.noop
      upl.moveUploadsFile(data.uid, data.folder).then((f) => {
        return cb({ ok: true }) || true
      }).catch((err) => {
        return cb({
          ok: false,
          msg: err.message
        }) || true
      })
    })
  }
}
