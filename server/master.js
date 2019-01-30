const autoload = require('auto-load')
const bodyParser = require('body-parser')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const express = require('express')
const favicon = require('serve-favicon')
const http = require('http')
const https = require('https')
const path = require('path')
const { ApolloServer } = require('apollo-server-express')
// const oauth2orize = require('oauth2orize')

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
  app.enable('trust proxy')

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(WIKI.ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(WIKI.ROOTPATH, 'assets'), {
    index: false,
    maxAge: '7d'
  }))

  // ----------------------------------------
  // OAuth2 Server
  // ----------------------------------------

  // const OAuth2Server = oauth2orize.createServer()

  // ----------------------------------------
  // Passport Authentication
  // ----------------------------------------

  app.use(cookieParser())
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

  app.locals.basedir = WIKI.ROOTPATH
  app.locals._ = require('lodash')
  app.locals.moment = require('moment')
  app.locals.moment.locale(WIKI.config.lang.code)
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

  app.use('/', ctrl.auth)
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
  // HTTP server
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
    } else {
      WIKI.logger.info('HTTP Server: [ RUNNING ]')
    }
  })

  WIKI.server.destroy = (cb) => {
    WIKI.server.close(cb)
    for (let key in srvConnections) {
      srvConnections[key].destroy()
    }
  }

  return true
}
