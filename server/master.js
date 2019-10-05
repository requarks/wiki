const autoload = require('auto-load')
const bodyParser = require('body-parser')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const express = require('express')
const session = require('express-session')
const KnexSessionStore = require('connect-session-knex')(session)
const favicon = require('serve-favicon')
const fs = require('fs-extra')
const http = require('http')
const https = require('https')
const path = require('path')
const _ = require('lodash')
const { ApolloServer } = require('apollo-server-express')

/* global WIKI */

module.exports = async () => {
  // ----------------------------------------
  // Load core modules
  // ----------------------------------------

  WIKI.auth = require('./core/auth').init()
  WIKI.lang = require('./core/localization').init()
  WIKI.mail = require('./core/mail').init()
  WIKI.system = require('./core/system').init()

  // ----------------------------------------
  // Load middlewares
  // ----------------------------------------

  var mw = autoload(path.join(WIKI.SERVERPATH, '/middlewares'))
  var ctrl = autoload(path.join(WIKI.SERVERPATH, '/controllers'))

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  const app = express()
  WIKI.app = app
  app.use(compression())

  // ----------------------------------------
  // Security
  // ----------------------------------------

  app.use(mw.security)
  app.use(cors(WIKI.config.cors))
  app.options('*', cors(WIKI.config.cors))
  if (WIKI.config.security.securityTrustProxy) {
    app.enable('trust proxy')
  }

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(WIKI.ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(WIKI.ROOTPATH, 'assets'), {
    index: false,
    maxAge: '7d'
  }))

  // ----------------------------------------
  // Passport Authentication
  // ----------------------------------------

  app.use(cookieParser())
  app.use(session({
    secret: WIKI.config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: new KnexSessionStore({
      knex: WIKI.models.knex
    })
  }))
  app.use(WIKI.auth.passport.initialize())
  app.use(WIKI.auth.authenticate)

  // ----------------------------------------
  // SEO
  // ----------------------------------------

  app.use(mw.seo)

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(WIKI.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json({ limit: '1mb' }))
  app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }))

  // ----------------------------------------
  // Localization
  // ----------------------------------------

  WIKI.lang.attachMiddleware(app)

  // ----------------------------------------
  // View accessible data
  // ----------------------------------------

  app.locals.analyticsCode = {}
  app.locals.basedir = WIKI.ROOTPATH
  app.locals.config = WIKI.config
  app.locals.pageMeta = {
    title: '',
    description: WIKI.config.description,
    image: '',
    url: '/'
  }

  // ----------------------------------------
  // HMR (Dev Mode Only)
  // ----------------------------------------

  if (global.DEV) {
    app.use(global.WP_DEV.devMiddleware)
    app.use(global.WP_DEV.hotMiddleware)
  }

  // ----------------------------------------
  // Apollo Server (GraphQL)
  // ----------------------------------------

  const graphqlSchema = require('./graph')
  const apolloServer = new ApolloServer({
    ...graphqlSchema,
    context: ({ req, res }) => ({ req, res }),
    subscriptions: {
      onConnect: (connectionParams, webSocket) => {

      },
      path: '/graphql-subscriptions'
    }
  })
  apolloServer.applyMiddleware({ app })

  // ----------------------------------------
  // Routing
  // ----------------------------------------

  app.use(async (req, res, next) => {
    res.locals.siteConfig = {
      title: WIKI.config.title,
      theme: WIKI.config.theming.theme,
      darkMode: WIKI.config.theming.darkMode,
      lang: WIKI.config.lang.code,
      rtl: WIKI.config.lang.rtl,
      company: WIKI.config.company
    }
    res.locals.langs = await WIKI.models.locales.getNavLocales({ cache: true })
    res.locals.analyticsCode = await WIKI.models.analytics.getCode({ cache: true })
    next()
  })

  app.use('/', ctrl.auth)
  app.use('/', ctrl.upload)
  app.use('/', ctrl.common)

  // ----------------------------------------
  // Error handling
  // ----------------------------------------

  app.use((req, res, next) => {
    var err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  app.use((err, req, res, next) => {
    res.status(err.status || 500)
    _.set(res.locals, 'pageMeta.title', 'Error')
    res.render('error', {
      message: err.message,
      error: WIKI.IS_DEBUG ? err : {}
    })
  })

  // ----------------------------------------
  // HTTP/S server
  // ----------------------------------------

  let srvConnections = {}

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

    // HTTP Redirect Server
    if (WIKI.config.ssl.redirectNonSSLPort) {
      WIKI.serverAlt = http.createServer((req, res) => {
        res.writeHead(301, { 'Location': 'https://' + req.headers['host'] + req.url })
        res.end()
      })
    }
  } else {
    WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)
    WIKI.server = http.createServer(app)
  }
  apolloServer.installSubscriptionHandlers(WIKI.server)

  WIKI.server.listen(WIKI.config.port, WIKI.config.bindIP)
  WIKI.server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

    // handle specific listen errors with friendly messages
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

  WIKI.server.on('connection', conn => {
    let key = `${conn.remoteAddress}:${conn.remotePort}`
    srvConnections[key] = conn
    conn.on('close', function() {
      delete srvConnections[key]
    })
  })

  WIKI.server.on('listening', () => {
    if (WIKI.config.ssl.enabled) {
      WIKI.logger.info('HTTPS Server: [ RUNNING ]')

      // Start HTTP Redirect Server
      if (WIKI.config.ssl.redirectNonSSLPort) {
        WIKI.serverAlt.listen(WIKI.config.ssl.redirectNonSSLPort, WIKI.config.bindIP)

        WIKI.serverAlt.on('error', (error) => {
          if (error.syscall !== 'listen') {
            throw error
          }

          switch (error.code) {
            case 'EACCES':
              WIKI.logger.error('(HTTP Redirect) Listening on port ' + WIKI.config.port + ' requires elevated privileges!')
              return process.exit(1)
            case 'EADDRINUSE':
              WIKI.logger.error('(HTTP Redirect) Port ' + WIKI.config.port + ' is already in use!')
              return process.exit(1)
            default:
              throw error
          }
        })

        WIKI.serverAlt.on('listening', () => {
          WIKI.logger.info('HTTP Server: [ RUNNING in redirect mode ]')
        })
      }
    } else {
      WIKI.logger.info('HTTP Server: [ RUNNING ]')
    }
  })

  WIKI.server.destroy = (cb) => {
    WIKI.server.close(cb)
    for (let key in srvConnections) {
      srvConnections[key].destroy()
    }

    if (WIKI.config.ssl.enabled && WIKI.config.ssl.redirectNonSSLPort) {
      WIKI.serverAlt.close(cb)
    }
  }

  return true
}
