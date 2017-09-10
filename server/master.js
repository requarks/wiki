'use strict'

/* global wiki */

const Promise = require('bluebird')

wiki.redis = require('./modules/redis').init()
wiki.queue = require('./modules/queue').init()

module.exports = Promise.join(
  wiki.db.onReady,
  wiki.configSvc.loadFromDb(),
  wiki.queue.clean()
).then(() => {
  // ----------------------------------------
  // Load global modules
  // ----------------------------------------

  wiki.disk = require('./modules/disk').init()
  wiki.docs = require('./modules/documents').init()
  wiki.git = require('./modules/git').init(false)
  wiki.lang = require('i18next')
  wiki.mark = require('./modules/markdown')
  wiki.search = require('./modules/search').init()
  wiki.upl = require('./modules/uploads').init()

  // ----------------------------------------
  // Load modules
  // ----------------------------------------

  const autoload = require('auto-load')
  const bodyParser = require('body-parser')
  const compression = require('compression')
  const cookieParser = require('cookie-parser')
  const express = require('express')
  const favicon = require('serve-favicon')
  const flash = require('connect-flash')
  const http = require('http')
  const i18nBackend = require('i18next-node-fs-backend')
  const path = require('path')
  const passport = require('passport')
  const passportSocketIo = require('passport.socketio')
  const session = require('express-session')
  const SessionRedisStore = require('connect-redis')(session)
  const graceful = require('node-graceful')
  const socketio = require('socket.io')
  const graphqlApollo = require('apollo-server-express')
  const graphqlSchema = require('./modules/graphql')

  var mw = autoload(path.join(wiki.SERVERPATH, '/middlewares'))
  var ctrl = autoload(path.join(wiki.SERVERPATH, '/controllers'))

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  const app = express()
  wiki.app = app
  app.use(compression())

  // ----------------------------------------
  // Security
  // ----------------------------------------

  app.use(mw.security)

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(wiki.ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(wiki.ROOTPATH, 'assets'), {
    index: false,
    maxAge: '7d'
  }))

  // ----------------------------------------
  // Passport Authentication
  // ----------------------------------------

  require('./modules/auth').init(passport)
  wiki.rights = require('./modules/rights')
  // wiki.rights.init()

  let sessionStore = new SessionRedisStore({
    client: wiki.redis
  })

  app.use(cookieParser())
  app.use(session({
    name: 'wikijs.sid',
    store: sessionStore,
    secret: wiki.config.site.sessionSecret,
    resave: false,
    saveUninitialized: false
  }))
  app.use(flash())
  app.use(passport.initialize())
  app.use(passport.session())

  // ----------------------------------------
  // SEO
  // ----------------------------------------

  app.use(mw.seo)

  // ----------------------------------------
  // Localization Engine
  // ----------------------------------------

  wiki.lang.use(i18nBackend).init({
    load: 'languageOnly',
    ns: ['common', 'admin', 'auth', 'errors', 'git'],
    defaultNS: 'common',
    saveMissing: false,
    preload: [wiki.config.site.lang],
    lng: wiki.config.site.lang,
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(wiki.SERVERPATH, 'locales/{{lng}}/{{ns}}.json')
    }
  })

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(wiki.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json({ limit: '1mb' }))
  app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }))

  // ----------------------------------------
  // View accessible data
  // ----------------------------------------

  app.locals._ = require('lodash')
  app.locals.t = wiki.lang.t.bind(wiki.lang)
  app.locals.moment = require('moment')
  app.locals.moment.locale(wiki.config.site.lang)
  app.locals.config = wiki.config
  app.use(mw.flash)

  // ----------------------------------------
  // Controllers
  // ----------------------------------------

  app.use('/', ctrl.auth)

  app.use('/graphql', graphqlApollo.graphqlExpress({ schema: graphqlSchema }))
  app.use('/graphiql', graphqlApollo.graphiqlExpress({ endpointURL: '/graphql' }))
  // app.use('/uploads', mw.auth, ctrl.uploads)
  app.use('/admin', mw.auth, ctrl.admin)
  app.use('/', mw.auth, ctrl.pages)

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
    res.render('error', {
      message: err.message,
      error: wiki.IS_DEBUG ? err : {}
    })
  })

  // ----------------------------------------
  // Start HTTP server
  // ----------------------------------------

  wiki.logger.info(`HTTP/WS Server on port: ${wiki.config.port}`)

  app.set('port', wiki.config.port)
  var server = http.createServer(app)
  var io = socketio(server)

  server.listen(wiki.config.port)
  server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        wiki.logger.error('Listening on port ' + wiki.config.port + ' requires elevated privileges!')
        return process.exit(1)
      case 'EADDRINUSE':
        wiki.logger.error('Port ' + wiki.config.port + ' is already in use!')
        return process.exit(1)
      default:
        throw error
    }
  })

  server.on('listening', () => {
    wiki.logger.info('HTTP/WS Server: RUNNING')
  })

  // ----------------------------------------
  // WebSocket
  // ----------------------------------------

  io.use(passportSocketIo.authorize({
    key: 'wikijs.sid',
    store: sessionStore,
    secret: wiki.config.site.sessionSecret,
    cookieParser,
    success: (data, accept) => {
      accept()
    },
    fail: (data, message, error, accept) => {
      accept()
    }
  }))

  io.on('connection', ctrl.ws)

  // ----------------------------------------
  // Graceful shutdown
  // ----------------------------------------

  graceful.on('exit', () => {
    // wiki.logger.info('- SHUTTING DOWN - Terminating Background Agent...')
    // bgAgent.kill()
    wiki.logger.info('- SHUTTING DOWN - Performing git sync...')
    return global.git.resync().then(() => {
      wiki.logger.info('- SHUTTING DOWN - Git sync successful. Now safe to exit.')
      process.exit()
    })
  })

  return true
}).catch(err => {
  wiki.logger.error(err)
  process.exit(1)
})
