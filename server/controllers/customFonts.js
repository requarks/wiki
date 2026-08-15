const express = require('express')
const router = express.Router()
const _ = require('lodash')
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const { v4: uuid } = require('uuid')

const customFonts = require('../helpers/customFonts')

/* global WIKI */

const FONT_MAX_SIZE = 10 * 1024 * 1024

function canManageTheme (req) {
  return _.some(req.user.permissions, pm => _.includes(['manage:theme', 'manage:system'], pm))
}

/**
 * Serve uploaded custom fonts
 */
router.get('/_custom/fonts/:filename', async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename)
    if (!filename || filename !== req.params.filename) {
      return res.sendStatus(400)
    }

    const ext = path.extname(filename).toLowerCase()
    if (!customFonts.ALLOWED_EXTENSIONS.includes(ext)) {
      return res.sendStatus(404)
    }

    const filePath = path.join(customFonts.getFontsDir(), filename)
    if (!(await fs.pathExists(filePath))) {
      return res.sendStatus(404)
    }

    res.set('Cache-Control', 'public, max-age=604800')
    res.type(customFonts.getMimeFromExt(ext))
    res.sendFile(filePath)
  } catch (err) {
    next(err)
  }
})

/**
 * Upload a custom font file
 */
router.post('/u/fonts', async (req, res, next) => {
  try {
    await customFonts.ensureFontsDir()
    next()
  } catch (err) {
    next(err)
  }
}, (req, res, next) => {
  multer({
    dest: customFonts.getFontsDir(),
    limits: {
      fileSize: FONT_MAX_SIZE,
      files: 1
    },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      if (!customFonts.ALLOWED_EXTENSIONS.includes(ext)) {
        return cb(new Error('Unsupported font format. Allowed: .ttf, .otf, .woff, .woff2'))
      }
      cb(null, true)
    }
  }).single('fontUpload')(req, res, next)
}, async (req, res, next) => {
  try {
    if (!canManageTheme(req)) {
      return res.status(403).json({
        succeeded: false,
        message: 'You are not authorized to upload fonts.'
      })
    }

    const fileMeta = _.get(req, 'file', false)
    if (!fileMeta) {
      return res.status(400).json({
        succeeded: false,
        message: 'Missing font upload payload.'
      })
    }

    let metadata = {}
    try {
      metadata = JSON.parse(_.get(req, 'body.fontMetadata', '{}'))
    } catch (err) {
      await fs.remove(fileMeta.path)
      return res.status(400).json({
        succeeded: false,
        message: 'Invalid font metadata.'
      })
    }

    const family = _.trim(metadata.family)
    if (!family || !/^[a-zA-Z0-9_-]+$/.test(family)) {
      await fs.remove(fileMeta.path)
      return res.status(400).json({
        succeeded: false,
        message: 'Font family must contain only letters, numbers, underscores, and hyphens.'
      })
    }

    await customFonts.ensureFontsDir()

    const ext = path.extname(fileMeta.originalname).toLowerCase()
    const storedFilename = `${uuid()}${ext}`
    const targetPath = path.join(customFonts.getFontsDir(), storedFilename)
    await fs.move(fileMeta.path, targetPath, { overwrite: true })

    const font = {
      id: uuid(),
      family,
      filename: storedFilename,
      format: customFonts.getFormatFromExt(ext),
      weight: _.toInteger(metadata.weight) || 400,
      style: metadata.style || 'normal',
      unicodeRange: customFonts.normalizeUnicodeRange(metadata.unicodeRange)
    }

    res.json({
      succeeded: true,
      font
    })
  } catch (err) {
    if (req.file && req.file.path) {
      await fs.remove(req.file.path).catch(() => {})
    }
    next(err)
  }
})

/**
 * Delete an uploaded custom font file
 */
router.delete('/u/fonts/:filename', async (req, res, next) => {
  try {
    if (!canManageTheme(req)) {
      return res.status(403).json({
        succeeded: false,
        message: 'You are not authorized to delete fonts.'
      })
    }

    const filename = path.basename(req.params.filename)
    if (!filename || filename !== req.params.filename) {
      return res.status(400).json({
        succeeded: false,
        message: 'Invalid font filename.'
      })
    }

    const ext = path.extname(filename).toLowerCase()
    if (!customFonts.ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(404).json({
        succeeded: false,
        message: 'Font file not found.'
      })
    }

    const filePath = path.join(customFonts.getFontsDir(), filename)
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath)
    }

    res.json({
      succeeded: true
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
