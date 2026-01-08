const express = require('express')
const router = express.Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')
const { execSync } = require('child_process')
const sanitize = require('sanitize-filename')

/* global WIKI */

const REQUIRED_THEME_FILES = [
  'theme.yml',
  path.join('scss', 'app.scss'),
  path.join('js', 'app.js')
]

async function hasRequiredThemeFiles(dirPath) {
  return (await Promise.all(REQUIRED_THEME_FILES.map(rel => fs.pathExists(path.join(dirPath, rel)))))
    .every(Boolean)
}

async function normalizeExtractedThemeDir(targetDir) {
  if (await hasRequiredThemeFiles(targetDir)) return

  const entries = await fs.readdir(targetDir, { withFileTypes: true })
  if (entries.length !== 1 || !entries[0].isDirectory()) return

  const nestedDir = path.join(targetDir, entries[0].name)
  if (!(await hasRequiredThemeFiles(nestedDir))) return

  const nestedEntries = await fs.readdir(nestedDir)
  for (const name of nestedEntries) {
    await fs.move(path.join(nestedDir, name), path.join(targetDir, name), { overwrite: true })
  }
  await fs.remove(nestedDir)
}

/**
 * Upload theme
 */
router.post('/t/upload', (req, res, next) => {
  multer({
    dest: path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads'),
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit for themes
    }
  }).single('theme')(req, res, next)
}, async (req, res, next) => {
  try {
    if (!WIKI.auth.checkAccess(req.user, ['manage:theme', 'manage:system'])) {
      return res.status(403).json({
        succeeded: false,
        message: 'You are not authorized to upload themes.'
      })
    }

    if (!req.file) {
      return res.status(400).json({
        succeeded: false,
        message: 'No file uploaded.'
      })
    }

    const zipPath = req.file.path
    const originalName = req.file.originalname
    const themeName = sanitize(path.parse(originalName).name)
    const themesDir = path.join(WIKI.ROOTPATH, 'client', 'themes')
    const targetDir = path.join(themesDir, themeName)

    // Ensure themes directory exists
    await fs.ensureDir(themesDir)

    // Create target directory
    await fs.ensureDir(targetDir)

    // Unzip using system command
    try {
      execSync(`unzip -o "${zipPath}" -d "${targetDir}"`)
    } catch (err) {
      WIKI.logger.error(`Failed to unzip theme: ${err.message}`)
      throw new Error('Failed to extract theme zip file. Make sure it is a valid zip archive.')
    } finally {
      // Clean up uploaded zip
      await fs.remove(zipPath)
    }

    await normalizeExtractedThemeDir(targetDir)

    if (!(await hasRequiredThemeFiles(targetDir))) {
      await fs.remove(targetDir)
      throw new Error('Invalid theme structure. Expected theme.yml, scss/app.scss and js/app.js at the root of the zip (or within a single top-level folder).')
    }

    res.json({
      succeeded: true,
      message: 'Theme uploaded and extracted successfully.'
    })
  } catch (err) {
    WIKI.logger.error(`Theme upload error: ${err.message}`)
    res.status(500).json({
      succeeded: false,
      message: err.message
    })
  }
})

module.exports = router
