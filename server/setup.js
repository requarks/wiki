const path = require('path')

/* global WIKI */

module.exports = () => {
  WIKI.config.site = {
    path: '',
    title: 'Wiki.js'
  }

  WIKI.system = require('./core/system')

  // ----------------------------------------
  // Load modules
  // ----------------------------------------

  const bodyParser = require('body-parser')
  const compression = require('compression')
  const express = require('express')
  const favicon = require('serve-favicon')
  const http = require('http')
  const Promise = require('bluebird')
  const fs = require('fs-extra')
  const _ = require('lodash')
  const cfgHelper = require('./helpers/config')
  const crypto = Promise.promisifyAll(require('crypto'))

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  let app = express()
  app.use(compression())

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(WIKI.ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(WIKI.ROOTPATH, 'assets')))

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(WIKI.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.locals.config = WIKI.config
  app.locals.data = WIKI.data
  app.locals._ = require('lodash')

  // ----------------------------------------
  // HMR (Dev Mode Only)
  // ----------------------------------------

  if (global.DEV) {
    app.use(global.WP_DEV.devMiddleware)
    app.use(global.WP_DEV.hotMiddleware)
  }

  // ----------------------------------------
  // Controllers
  // ----------------------------------------

  app.get('*', async (req, res) => {
    let packageObj = await fs.readJson(path.join(WIKI.ROOTPATH, 'package.json'))
    res.render('setup', {
      packageObj,
      telemetryClientID: WIKI.telemetry.cid
    })
  })

  /**
   * Finalize
   */
  app.post('/finalize', async (req, res) => {
    WIKI.telemetry.sendEvent('setup', 'finalize')

    try {
      // Upgrade from WIKI.js 1.x?
      if (req.body.upgrade) {
        await WIKI.system.upgradeFromMongo({
          mongoCnStr: cfgHelper.parseConfigValue(req.body.upgMongo)
        })
      }

      // Create directory structure
      const dataPath = path.join(process.cwd(), 'data')
      await fs.ensureDir(dataPath)
      await fs.ensureDir(path.join(dataPath, 'cache'))
      await fs.ensureDir(path.join(dataPath, 'uploads'))

      // Set config
      _.set(WIKI.config, 'defaultEditor', 'markdown')
      _.set(WIKI.config, 'graphEndpoint', 'https://graph.requarks.io')
      _.set(WIKI.config, 'lang.code', 'en')
      _.set(WIKI.config, 'lang.autoUpdate', true)
      _.set(WIKI.config, 'lang.namespacing', false)
      _.set(WIKI.config, 'lang.namespaces', [])
      _.set(WIKI.config, 'public', false)
      _.set(WIKI.config, 'sessionSecret', (await crypto.randomBytesAsync(32)).toString('hex'))
      _.set(WIKI.config, 'telemetry.isEnabled', req.body.telemetry === 'true')
      _.set(WIKI.config, 'telemetry.clientId', WIKI.telemetry.cid)
      _.set(WIKI.config, 'theming.theme', 'default')
      _.set(WIKI.config, 'theming.darkMode', false)
      _.set(WIKI.config, 'title', 'Wiki.js')

      // Save config to DB
      WIKI.logger.info('Persisting config to DB...')
      await WIKI.configSvc.saveToDb([
        'defaultEditor',
        'graphEndpoint',
        'lang',
        'public',
        'sessionSecret',
        'telemetry',
        'theming',
        'title'
      ])

      // Create default locale
      WIKI.logger.info('Installing default locale...')
      await WIKI.models.locales.query().insert({
        code: 'en',
        strings: require('./locales/default.json'),
        isRTL: false,
        name: 'English',
        nativeName: 'English'
      })

      // Create default locale

      WIKI.logger.info('Creating default groups...')
      const adminGroup = await WIKI.models.groups.query().insert({
        name: 'Administrators',
        permissions: JSON.stringify(['manage:system']),
        isSystem: true
      })
      const guestGroup = await WIKI.models.groups.query().insert({
        name: 'Guests',
        permissions: JSON.stringify(['read:page:/']),
        isSystem: true
      })

      // Load authentication strategies + enable local
      await WIKI.models.authentication.refreshStrategiesFromDisk()
      await WIKI.models.authentication.query().patch({ isEnabled: true }).where('key', 'local')

      // Load editors + enable default
      await WIKI.models.editors.refreshEditorsFromDisk()
      await WIKI.models.editors.query().patch({ isEnabled: true }).where('key', 'markdown')

      // Load loggers
      await WIKI.models.loggers.refreshLoggersFromDisk()

      // Load renderers
      await WIKI.models.renderers.refreshRenderersFromDisk()

      // Load search engines + enable default
      await WIKI.models.searchEngines.refreshSearchEnginesFromDisk()
      await WIKI.models.searchEngines.query().patch({ isEnabled: true }).where('key', 'db')

      // Load storage targets
      await WIKI.models.storage.refreshTargetsFromDisk()

      // Create root administrator
      WIKI.logger.info('Creating root administrator...')
      await WIKI.models.users.query().delete().where({
        providerKey: 'local',
        email: req.body.adminEmail
      })
      const adminUser = await WIKI.models.users.query().insert({
        email: req.body.adminEmail,
        provider: 'local',
        password: req.body.adminPassword,
        name: 'Administrator',
        locale: 'en',
        defaultEditor: 'markdown',
        tfaIsActive: false
      })
      await adminUser.$relatedQuery('groups').relate(adminGroup.id)

      // Create Guest account
      WIKI.logger.info('Creating guest account...')
      await WIKI.models.users.query().delete().where({
        providerKey: 'local',
        email: 'guest@example.com'
      })
      const guestUser = await WIKI.models.users.query().insert({
        provider: 'local',
        email: 'guest@example.com',
        name: 'Guest',
        password: '',
        locale: 'en',
        defaultEditor: 'markdown',
        tfaIsActive: false
      })
      await guestUser.$relatedQuery('groups').relate(guestGroup.id)

      WIKI.logger.info('Setup is complete!')
      res.json({
        ok: true,
        redirectPath: '/',
        redirectPort: WIKI.config.port
      }).end()

      WIKI.config.setup = false

      WIKI.logger.info('Stopping Setup...')
      WIKI.server.destroy(() => {
        WIKI.logger.info('Setup stopped. Starting Wiki.js...')
        _.delay(() => {
          WIKI.kernel.bootMaster()
        }, 1000)
      })
    } catch (err) {
      res.json({ ok: false, error: err.message })
    }
  })

  // ----------------------------------------
  // Error handling
  // ----------------------------------------

  app.use(function (req, res, next) {
    var err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  app.use(function (err, req, res, next) {
    res.status(err.status || 500)
    res.send({
      message: err.message,
      error: WIKI.IS_DEBUG ? err : {}
    })
    WIKI.logger.error(err.message)
    WIKI.telemetry.sendError(err)
  })

  // ----------------------------------------
  // Start HTTP server
  // ----------------------------------------

  WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)

  app.set('port', WIKI.config.port)
  WIKI.server = http.createServer(app)
  WIKI.server.listen(WIKI.config.port, WIKI.config.bindIP)

  var openConnections = []

  WIKI.server.on('connection', (conn) => {
    let key = conn.remoteAddress + ':' + conn.remotePort
    openConnections[key] = conn
    conn.on('close', () => {
      delete openConnections[key]
    })
  })

  WIKI.server.destroy = (cb) => {
    WIKI.server.close(cb)
    for (let key in openConnections) {
      openConnections[key].destroy()
    }
  }

  WIKI.server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

    switch (error.code) {
      case 'EACCES':
        WIKI.logger.error('Listening on port ' + WIKI.config.port + ' requires elevated privileges!')
        return process.exit(1)
      case 'EADDRINUSE':
        WIKI.logger.error('Port ' + WIKI.config.port + ' is already in use!')
        return process.exit(1)
      default:
        throw error
    }
  })

  WIKI.server.on('listening', () => {
    WIKI.logger.info('HTTP Server: [ RUNNING ]')
    WIKI.logger.info('========================================')
    WIKI.logger.info(`Browse to http://localhost:${WIKI.config.port}/`)
    WIKI.logger.info('========================================')
  })
}
