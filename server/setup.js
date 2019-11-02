const path = require('path')
const uuid = require('uuid/v4')
const bodyParser = require('body-parser')
const compression = require('compression')
const express = require('express')
const favicon = require('serve-favicon')
const http = require('http')
const https = require('https')
const Promise = require('bluebird')
const fs = require('fs-extra')
const _ = require('lodash')
const crypto = Promise.promisifyAll(require('crypto'))
const pem2jwk = require('pem-jwk').pem2jwk
const semver = require('semver')

/* global WIKI */

module.exports = () => {
  WIKI.config.site = {
    path: '',
    title: 'Wiki.js'
  }

  WIKI.system = require('./core/system')

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
    res.render('setup', { packageObj })
  })

  /**
   * Finalize
   */
  app.post('/finalize', async (req, res) => {
    try {
      // Set config
      _.set(WIKI.config, 'auth', {
        audience: 'urn:wiki.js',
        tokenExpiration: '30m',
        tokenRenewal: '14d'
      })
      _.set(WIKI.config, 'company', '')
      _.set(WIKI.config, 'features', {
        featurePageRatings: true,
        featurePageComments: true,
        featurePersonalWikis: true
      })
      _.set(WIKI.config, 'graphEndpoint', 'https://graph.requarks.io')
      _.set(WIKI.config, 'host', req.body.siteUrl)
      _.set(WIKI.config, 'lang', {
        code: 'en',
        autoUpdate: true,
        namespacing: false,
        namespaces: []
      })
      _.set(WIKI.config, 'logo', {
        hasLogo: false,
        logoIsSquare: false
      })
      _.set(WIKI.config, 'mail', {
        senderName: '',
        senderEmail: '',
        host: '',
        port: 465,
        secure: true,
        user: '',
        pass: '',
        useDKIM: false,
        dkimDomainName: '',
        dkimKeySelector: '',
        dkimPrivateKey: ''
      })
      _.set(WIKI.config, 'seo', {
        description: '',
        robots: ['index', 'follow'],
        analyticsService: '',
        analyticsId: ''
      })
      _.set(WIKI.config, 'sessionSecret', (await crypto.randomBytesAsync(32)).toString('hex'))
      _.set(WIKI.config, 'telemetry', {
        isEnabled: req.body.telemetry === true,
        clientId: uuid()
      })
      _.set(WIKI.config, 'theming', {
        theme: 'default',
        darkMode: false,
        iconset: 'mdi',
        injectCSS: '',
        injectHead: '',
        injectBody: ''
      })
      _.set(WIKI.config, 'title', 'Wiki.js')

      // Init Telemetry
      WIKI.kernel.initTelemetry()
      WIKI.telemetry.sendEvent('setup', 'install-start')

      // Basic checks
      if (!semver.satisfies(process.version, '>=10.12')) {
        throw new Error('Node.js 10.12.x or later required!')
      }

      // Create directory structure
      WIKI.logger.info('Creating data directories...')
      await fs.ensureDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath))
      await fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache'))
      await fs.ensureDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads'))

      // Generate certificates
      WIKI.logger.info('Generating certificates...')
      const certs = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'pkcs1',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs1',
          format: 'pem',
          cipher: 'aes-256-cbc',
          passphrase: WIKI.config.sessionSecret
        }
      })

      _.set(WIKI.config, 'certs', {
        jwk: pem2jwk(certs.publicKey),
        public: certs.publicKey,
        private: certs.privateKey
      })

      // Save config to DB
      WIKI.logger.info('Persisting config to DB...')
      await WIKI.configSvc.saveToDb([
        'auth',
        'certs',
        'company',
        'features',
        'graphEndpoint',
        'host',
        'lang',
        'logo',
        'mail',
        'seo',
        'sessionSecret',
        'telemetry',
        'theming',
        'title'
      ])

      // Truncate tables (reset from previous failed install)
      await WIKI.models.locales.query().where('code', '!=', 'x').del()
      await WIKI.models.navigation.query().truncate()
      switch (WIKI.config.db.type) {
        case 'postgres':
          await WIKI.models.knex.raw('TRUNCATE groups, users CASCADE')
          break
        case 'mysql':
        case 'mariadb':
          await WIKI.models.groups.query().where('id', '>', 0).del()
          await WIKI.models.users.query().where('id', '>', 0).del()
          await WIKI.models.knex.raw('ALTER TABLE `groups` AUTO_INCREMENT = 1')
          await WIKI.models.knex.raw('ALTER TABLE `users` AUTO_INCREMENT = 1')
          break
        case 'mssql':
          await WIKI.models.groups.query().del()
          await WIKI.models.users.query().del()
          await WIKI.models.knex.raw(`
            IF EXISTS (SELECT * FROM sys.identity_columns WHERE OBJECT_NAME(OBJECT_ID) = 'groups' AND last_value IS NOT NULL)
              DBCC CHECKIDENT ([groups], RESEED, 0)
          `)
          await WIKI.models.knex.raw(`
            IF EXISTS (SELECT * FROM sys.identity_columns WHERE OBJECT_NAME(OBJECT_ID) = 'users' AND last_value IS NOT NULL)
              DBCC CHECKIDENT ([users], RESEED, 0)
          `)
          break
        case 'sqlite':
          await WIKI.models.groups.query().truncate()
          await WIKI.models.users.query().truncate()
          break
      }

      // Create default locale
      WIKI.logger.info('Installing default locale...')
      await WIKI.models.locales.query().insert({
        code: 'en',
        strings: {},
        isRTL: false,
        name: 'English',
        nativeName: 'English'
      })

      // Create default groups

      WIKI.logger.info('Creating default groups...')
      const adminGroup = await WIKI.models.groups.query().insert({
        name: 'Administrators',
        permissions: JSON.stringify(['manage:system']),
        pageRules: JSON.stringify([]),
        isSystem: true
      })
      const guestGroup = await WIKI.models.groups.query().insert({
        name: 'Guests',
        permissions: JSON.stringify(['read:pages', 'read:assets', 'read:comments']),
        pageRules: JSON.stringify([
          { id: 'guest', roles: ['read:pages', 'read:assets', 'read:comments'], match: 'START', deny: false, path: '', locales: [] }
        ]),
        isSystem: true
      })
      if (adminGroup.id !== 1 || guestGroup.id !== 2) {
        throw new Error('Incorrect groups auto-increment configuration! Should start at 0 and increment by 1. Contact your database administrator.')
      }

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

      WIKI.telemetry.sendEvent('setup', 'install-loadedmodules')

      // Load storage targets
      await WIKI.models.storage.refreshTargetsFromDisk()

      // Create root administrator
      WIKI.logger.info('Creating root administrator...')
      const adminUser = await WIKI.models.users.query().insert({
        email: req.body.adminEmail,
        provider: 'local',
        password: req.body.adminPassword,
        name: 'Administrator',
        locale: 'en',
        defaultEditor: 'markdown',
        tfaIsActive: false,
        isActive: true,
        isVerified: true
      })
      await adminUser.$relatedQuery('groups').relate(adminGroup.id)

      // Create Guest account
      WIKI.logger.info('Creating guest account...')
      const guestUser = await WIKI.models.users.query().insert({
        provider: 'local',
        email: 'guest@example.com',
        name: 'Guest',
        password: '',
        locale: 'en',
        defaultEditor: 'markdown',
        tfaIsActive: false,
        isSystem: true,
        isActive: true,
        isVerified: true
      })
      await guestUser.$relatedQuery('groups').relate(guestGroup.id)
      if (adminUser.id !== 1 || guestUser.id !== 2) {
        throw new Error('Incorrect users auto-increment configuration! Should start at 0 and increment by 1. Contact your database administrator.')
      }

      // Create site nav

      WIKI.logger.info('Creating default site navigation')
      await WIKI.models.navigation.query().insert({
        key: 'site',
        config: [
          {
            id: uuid(),
            icon: 'mdi-home',
            kind: 'link',
            label: 'Home',
            target: '/',
            targetType: 'home'
          }
        ]
      })

      WIKI.logger.info('Setup is complete!')
      WIKI.telemetry.sendEvent('setup', 'install-completed')
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
      try {
        await WIKI.models.knex('settings').truncate()
      } catch (err) {}
      WIKI.telemetry.sendError(err)
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

  WIKI.logger.info(`Starting HTTP server on port ${WIKI.config.port}...`)

  app.set('port', WIKI.config.port)

  if (WIKI.config.ssl.enabled) {
    WIKI.logger.info(`HTTPS Server on port: [ ${WIKI.config.port} ]`)
    const tlsOpts = {}
    try {
      if (WIKI.config.ssl.format === 'pem') {
        tlsOpts.key = fs.readFileSync(WIKI.config.ssl.key)
        tlsOpts.cert = fs.readFileSync(WIKI.config.ssl.cert)
      } else {
        tlsOpts.pfx = fs.readFileSync(WIKI.config.ssl.pfx)
      }
      if (!_.isEmpty(WIKI.config.ssl.passphrase)) {
        tlsOpts.passphrase = WIKI.config.ssl.passphrase
      }
      if (!_.isEmpty(WIKI.config.ssl.dhparam)) {
        tlsOpts.dhparam = WIKI.config.ssl.dhparam
      }
    } catch (err) {
      WIKI.logger.error('Failed to setup HTTPS server parameters:')
      WIKI.logger.error(err)
      return process.exit(1)
    }
    WIKI.server = https.createServer(tlsOpts, app)
  } else {
    WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)
    WIKI.server = http.createServer(app)
  }
  WIKI.server.listen(WIKI.config.port, WIKI.config.bindIP)

  var openConnections = []

  WIKI.server.on('connection', (conn) => {
    let key = conn.remoteAddress + ':' + conn.remotePort
    openConnections[key] = conn
    conn.on('close', () => {
      openConnections.splice(key, 1)
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
    WIKI.logger.info('🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻🔻')
    WIKI.logger.info('')
    WIKI.logger.info(`Browse to http://localhost:${WIKI.config.port}/ to complete setup!`)
    WIKI.logger.info('')
    WIKI.logger.info('🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺🔺')
  })
}
