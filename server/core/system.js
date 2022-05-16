const _ = require('lodash')
const cfgHelper = require('../helpers/config')
const Promise = require('bluebird')
const fs = require('fs-extra')
const path = require('path')
const zlib = require('zlib')
const stream = require('stream')
const pipeline = Promise.promisify(stream.pipeline)

/* global WIKI */

module.exports = {
  updates: {
    channel: 'BETA',
    version: WIKI.version,
    releaseDate: WIKI.releaseDate,
    minimumVersionRequired: '2.0.0-beta.0',
    minimumNodeRequired: '10.12.0'
  },
  exportStatus: {
    status: 'notrunning',
    progress: 0,
    message: '',
    updatedAt: null
  },
  init() {
    // Clear content cache
    fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache'))

    return this
  },
  /**
   * Upgrade from WIKI.js 1.x - MongoDB database
   *
   * @param {Object} opts Options object
   */
  async upgradeFromMongo (opts) {
    WIKI.logger.info('Upgrading from MongoDB...')

    let mongo = require('mongodb').MongoClient
    let parsedMongoConStr = cfgHelper.parseConfigValue(opts.mongoCnStr)

    return new Promise((resolve, reject) => {
      // Connect to MongoDB

      mongo.connect(parsedMongoConStr, {
        autoReconnect: false,
        reconnectTries: 2,
        reconnectInterval: 1000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 5000
      }, async (err, db) => {
        try {
          if (err !== null) { throw err }

          let users = db.collection('users')

          // Check if users table is populated
          let userCount = await users.count()
          if (userCount < 2) {
            throw new Error('MongoDB Upgrade: Users table is empty!')
          }

          // Import all users
          let userData = await users.find({
            email: {
              $not: 'guest'
            }
          }).toArray()
          await WIKI.models.User.bulkCreate(_.map(userData, usr => {
            return {
              email: usr.email,
              name: usr.name || 'Imported User',
              password: usr.password || '',
              provider: usr.provider || 'local',
              providerId: usr.providerId || '',
              role: 'user',
              createdAt: usr.createdAt
            }
          }))

          resolve(true)
        } catch (errc) {
          reject(errc)
        }
        db.close()
      })
    })
  },
  /**
   * Export Wiki to Disk
   */
  async export (opts) {
    this.exportStatus.status = 'running'
    this.exportStatus.progress = 0
    this.exportStatus.message = ''
    this.exportStatus.startedAt = new Date()

    WIKI.logger.info(`Export started to path ${opts.path}`)
    WIKI.logger.info(`Entities to export: ${opts.entities.join(', ')}`)

    const progressMultiplier = 1 / opts.entities.length

    try {
      for (const entity of opts.entities) {
        switch (entity) {
          // -----------------------------------------
          // ASSETS
          // -----------------------------------------
          case 'assets': {
            WIKI.logger.info('Exporting assets...')
            const assetFolders = await WIKI.models.assetFolders.getAllPaths()
            const assetsCountRaw = await WIKI.models.assets.query().count('* as total').first()
            const assetsCount = parseInt(assetsCountRaw.total)
            if (assetsCount < 1) {
              WIKI.logger.warn('There are no assets to export! Skipping...')
              break
            }
            const assetsProgressMultiplier = progressMultiplier / Math.ceil(assetsCount / 50)
            WIKI.logger.info(`Found ${assetsCount} assets to export. Streaming to disk...`)

            await pipeline(
              WIKI.models.knex.select('filename', 'folderId', 'data').from('assets').join('assetData', 'assets.id', '=', 'assetData.id').stream(),
              new stream.Transform({
                objectMode: true,
                transform: async (asset, enc, cb) => {
                  const filename = (asset.folderId && asset.folderId > 0) ? `${_.get(assetFolders, asset.folderId)}/${asset.filename}` : asset.filename
                  WIKI.logger.info(`Exporting asset ${filename}...`)
                  await fs.outputFile(path.join(opts.path, 'assets', filename), asset.data)
                  this.exportStatus.progress += assetsProgressMultiplier * 100
                  cb()
                }
              })
            )
            WIKI.logger.info('Export: assets saved to disk successfully.')
            break
          }
          // -----------------------------------------
          // COMMENTS
          // -----------------------------------------
          case 'comments': {
            WIKI.logger.info('Exporting comments...')
            const outputPath = path.join(opts.path, 'comments.json.gz')
            const commentsCountRaw = await WIKI.models.comments.query().count('* as total').first()
            const commentsCount = parseInt(commentsCountRaw.total)
            if (commentsCount < 1) {
              WIKI.logger.warn('There are no comments to export! Skipping...')
              break
            }
            const commentsProgressMultiplier = progressMultiplier / Math.ceil(commentsCount / 50)
            WIKI.logger.info(`Found ${commentsCount} comments to export. Streaming to file...`)

            const rs = stream.Readable({ objectMode: true })
            rs._read = () => {}

            const fetchCommentsBatch = async (offset) => {
              const comments = await WIKI.models.comments.query().offset(offset).limit(50).withGraphJoined({
                author: true,
                page: true
              }).modifyGraph('author', builder => {
                builder.select('users.id', 'users.name', 'users.email', 'users.providerKey')
              }).modifyGraph('page', builder => {
                builder.select('pages.id', 'pages.path', 'pages.localeCode', 'pages.title')
              })
              if (comments.length > 0) {
                for (const cmt of comments) {
                  rs.push(cmt)
                }
                fetchCommentsBatch(offset + 50)
              } else {
                rs.push(null)
              }
              this.exportStatus.progress += commentsProgressMultiplier * 100
            }
            fetchCommentsBatch(0)

            let marker = 0
            await pipeline(
              rs,
              new stream.Transform({
                objectMode: true,
                transform (chunk, encoding, callback) {
                  marker++
                  let outputStr = marker === 1 ? '[\n' : ''
                  outputStr += JSON.stringify(chunk, null, 2)
                  if (marker < commentsCount) {
                    outputStr += ',\n'
                  }
                  callback(null, outputStr)
                },
                flush (callback) {
                  callback(null, '\n]')
                }
              }),
              zlib.createGzip(),
              fs.createWriteStream(outputPath)
            )
            WIKI.logger.info('Export: comments.json.gz created successfully.')
            break
          }
          // -----------------------------------------
          // GROUPS
          // -----------------------------------------
          case 'groups': {
            WIKI.logger.info('Exporting groups...')
            const outputPath = path.join(opts.path, 'groups.json')
            const groups = await WIKI.models.groups.query()
            await fs.outputJSON(outputPath, groups, { spaces: 2 })
            WIKI.logger.info('Export: groups.json created successfully.')
            this.exportStatus.progress += progressMultiplier * 100
            break
          }
          // -----------------------------------------
          // HISTORY
          // -----------------------------------------
          case 'history': {
            WIKI.logger.info('Exporting pages history...')
            const outputPath = path.join(opts.path, 'pages-history.json.gz')
            const pagesCountRaw = await WIKI.models.pageHistory.query().count('* as total').first()
            const pagesCount = parseInt(pagesCountRaw.total)
            if (pagesCount < 1) {
              WIKI.logger.warn('There are no pages history to export! Skipping...')
              break
            }
            const pagesProgressMultiplier = progressMultiplier / Math.ceil(pagesCount / 10)
            WIKI.logger.info(`Found ${pagesCount} pages history to export. Streaming to file...`)

            const rs = stream.Readable({ objectMode: true })
            rs._read = () => {}

            const fetchPagesBatch = async (offset) => {
              const pages = await WIKI.models.pageHistory.query().offset(offset).limit(10).withGraphJoined({
                author: true,
                page: true,
                tags: true
              }).modifyGraph('author', builder => {
                builder.select('users.id', 'users.name', 'users.email', 'users.providerKey')
              }).modifyGraph('page', builder => {
                builder.select('pages.id', 'pages.title', 'pages.path', 'pages.localeCode')
              }).modifyGraph('tags', builder => {
                builder.select('tags.tag', 'tags.title')
              })
              if (pages.length > 0) {
                for (const page of pages) {
                  rs.push(page)
                }
                fetchPagesBatch(offset + 10)
              } else {
                rs.push(null)
              }
              this.exportStatus.progress += pagesProgressMultiplier * 100
            }
            fetchPagesBatch(0)

            let marker = 0
            await pipeline(
              rs,
              new stream.Transform({
                objectMode: true,
                transform (chunk, encoding, callback) {
                  marker++
                  let outputStr = marker === 1 ? '[\n' : ''
                  outputStr += JSON.stringify(chunk, null, 2)
                  if (marker < pagesCount) {
                    outputStr += ',\n'
                  }
                  callback(null, outputStr)
                },
                flush (callback) {
                  callback(null, '\n]')
                }
              }),
              zlib.createGzip(),
              fs.createWriteStream(outputPath)
            )
            WIKI.logger.info('Export: pages-history.json.gz created successfully.')
            break
          }
          // -----------------------------------------
          // NAVIGATION
          // -----------------------------------------
          case 'navigation': {
            WIKI.logger.info('Exporting navigation...')
            const outputPath = path.join(opts.path, 'navigation.json')
            const navigationRaw = await WIKI.models.navigation.query()
            const navigation = navigationRaw.reduce((obj, cur) => {
              obj[cur.key] = cur.config
              return obj
            }, {})
            await fs.outputJSON(outputPath, navigation, { spaces: 2 })
            WIKI.logger.info('Export: navigation.json created successfully.')
            this.exportStatus.progress += progressMultiplier * 100
            break
          }
          // -----------------------------------------
          // PAGES
          // -----------------------------------------
          case 'pages': {
            WIKI.logger.info('Exporting pages...')
            const outputPath = path.join(opts.path, 'pages.json.gz')
            const pagesCountRaw = await WIKI.models.pages.query().count('* as total').first()
            const pagesCount = parseInt(pagesCountRaw.total)
            if (pagesCount < 1) {
              WIKI.logger.warn('There are no pages to export! Skipping...')
              break
            }
            const pagesProgressMultiplier = progressMultiplier / Math.ceil(pagesCount / 10)
            WIKI.logger.info(`Found ${pagesCount} pages to export. Streaming to file...`)

            const rs = stream.Readable({ objectMode: true })
            rs._read = () => {}

            const fetchPagesBatch = async (offset) => {
              const pages = await WIKI.models.pages.query().offset(offset).limit(10).withGraphJoined({
                author: true,
                creator: true,
                tags: true
              }).modifyGraph('author', builder => {
                builder.select('users.id', 'users.name', 'users.email', 'users.providerKey')
              }).modifyGraph('creator', builder => {
                builder.select('users.id', 'users.name', 'users.email', 'users.providerKey')
              }).modifyGraph('tags', builder => {
                builder.select('tags.tag', 'tags.title')
              })
              if (pages.length > 0) {
                for (const page of pages) {
                  rs.push(page)
                }
                fetchPagesBatch(offset + 10)
              } else {
                rs.push(null)
              }
              this.exportStatus.progress += pagesProgressMultiplier * 100
            }
            fetchPagesBatch(0)

            let marker = 0
            await pipeline(
              rs,
              new stream.Transform({
                objectMode: true,
                transform (chunk, encoding, callback) {
                  marker++
                  let outputStr = marker === 1 ? '[\n' : ''
                  outputStr += JSON.stringify(chunk, null, 2)
                  if (marker < pagesCount) {
                    outputStr += ',\n'
                  }
                  callback(null, outputStr)
                },
                flush (callback) {
                  callback(null, '\n]')
                }
              }),
              zlib.createGzip(),
              fs.createWriteStream(outputPath)
            )
            WIKI.logger.info('Export: pages.json.gz created successfully.')
            break
          }
          // -----------------------------------------
          // SETTINGS
          // -----------------------------------------
          case 'settings': {
            WIKI.logger.info('Exporting settings...')
            const outputPath = path.join(opts.path, 'settings.json')
            const config = {
              ...WIKI.config,
              modules: {
                analytics: await WIKI.models.analytics.query(),
                authentication: (await WIKI.models.authentication.query()).map(a => ({
                  ...a,
                  domainWhitelist: _.get(a, 'domainWhitelist.v', []),
                  autoEnrollGroups: _.get(a, 'autoEnrollGroups.v', [])
                })),
                commentProviders: await WIKI.models.commentProviders.query(),
                renderers: await WIKI.models.renderers.query(),
                searchEngines: await WIKI.models.searchEngines.query(),
                storage: await WIKI.models.storage.query()
              },
              apiKeys: await WIKI.models.apiKeys.query().where('isRevoked', false)
            }
            await fs.outputJSON(outputPath, config, { spaces: 2 })
            WIKI.logger.info('Export: settings.json created successfully.')
            this.exportStatus.progress += progressMultiplier * 100
            break
          }
          // -----------------------------------------
          // USERS
          // -----------------------------------------
          case 'users': {
            WIKI.logger.info('Exporting users...')
            const outputPath = path.join(opts.path, 'users.json.gz')
            const usersCountRaw = await WIKI.models.users.query().count('* as total').first()
            const usersCount = parseInt(usersCountRaw.total)
            if (usersCount < 1) {
              WIKI.logger.warn('There are no users to export! Skipping...')
              break
            }
            const usersProgressMultiplier = progressMultiplier / Math.ceil(usersCount / 50)
            WIKI.logger.info(`Found ${usersCount} users to export. Streaming to file...`)

            const rs = stream.Readable({ objectMode: true })
            rs._read = () => {}

            const fetchUsersBatch = async (offset) => {
              const users = await WIKI.models.users.query().offset(offset).limit(50).withGraphJoined({
                groups: true,
                provider: true
              }).modifyGraph('groups', builder => {
                builder.select('groups.id', 'groups.name')
              }).modifyGraph('provider', builder => {
                builder.select('authentication.key', 'authentication.strategyKey', 'authentication.displayName')
              })
              if (users.length > 0) {
                for (const usr of users) {
                  rs.push(usr)
                }
                fetchUsersBatch(offset + 50)
              } else {
                rs.push(null)
              }
              this.exportStatus.progress += usersProgressMultiplier * 100
            }
            fetchUsersBatch(0)

            let marker = 0
            await pipeline(
              rs,
              new stream.Transform({
                objectMode: true,
                transform (chunk, encoding, callback) {
                  marker++
                  let outputStr = marker === 1 ? '[\n' : ''
                  outputStr += JSON.stringify(chunk, null, 2)
                  if (marker < usersCount) {
                    outputStr += ',\n'
                  }
                  callback(null, outputStr)
                },
                flush (callback) {
                  callback(null, '\n]')
                }
              }),
              zlib.createGzip(),
              fs.createWriteStream(outputPath)
            )

            WIKI.logger.info('Export: users.json.gz created successfully.')
            break
          }
        }
      }
      this.exportStatus.status = 'success'
      this.exportStatus.progress = 100
    } catch (err) {
      this.exportStatus.status = 'error'
      this.exportStatus.message = err.message
    }
  }
}
