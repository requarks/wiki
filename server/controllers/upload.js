const express = require('express')
const router = express.Router()
const _ = require('lodash')
const multer = require('multer')
const path = require('path')
const sanitize = require('sanitize-filename')

/* global WIKI */

/**
 * Upload files
 */
router.post('/u', multer({
  dest: path.join(WIKI.ROOTPATH, 'data/uploads'),
  limits: {
    fileSize: WIKI.config.uploads.maxFileSize,
    files: WIKI.config.uploads.maxFiles
  }
}).array('mediaUpload'), async (req, res, next) => {
  if (!_.some(req.user.permissions, pm => _.includes(['write:assets', 'manage:system'], pm))) {
    return res.status(403).json({
      succeeded: false,
      message: 'You are not authorized to upload files.'
    })
  } else if (req.files.length < 1) {
    return res.status(400).json({
      succeeded: false,
      message: 'Missing upload payload.'
    })
  } else if (req.files.length > 1) {
    return res.status(400).json({
      succeeded: false,
      message: 'You cannot upload multiple files within the same request.'
    })
  }
  const fileMeta = _.get(req, 'files[0]', false)
  if (!fileMeta) {
    return res.status(500).json({
      succeeded: false,
      message: 'Missing upload file metadata.'
    })
  }

  let folderPath = ''
  try {
    const folderRaw = _.get(req, 'body.mediaUpload', false)
    if (folderRaw) {
      folderPath = _.get(JSON.parse(folderRaw), 'path', false)
    }
  } catch (err) {
    return res.status(400).json({
      succeeded: false,
      message: 'Missing upload folder metadata.'
    })
  }

  if (!WIKI.auth.checkAccess(req.user, ['write:assets'], { path: `${folderPath}/${fileMeta.originalname}`})) {
    return res.status(403).json({
      succeeded: false,
      message: 'You are not authorized to upload files to this folder.'
    })
  }

  await WIKI.models.assets.upload({
    ...fileMeta,
    originalname: sanitize(fileMeta.originalname).toLowerCase(),
    folder: folderPath,
    userId: req.user.id
  })
  res.send('ok')
})

router.get('/u', async (req, res, next) => {
  res.json({
    ok: true
  })
})

module.exports = router
