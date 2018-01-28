/* global wiki */

module.exports = async () => {
  // ----------------------------------------
  // Load global modules
  // ----------------------------------------

  wiki.auth = require('./modules/auth').init()
  wiki.disk = require('./modules/disk').init()
  wiki.docs = require('./modules/documents').init()
  wiki.git = require('./modules/git').init(false)
  wiki.lang = require('./modules/localization').init()
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
  const cors = require('cors')
  const express = require('express')
  const favicon = require('serve-favicon')
  const flash = require('connect-flash')
  const http = require('http')
  const path = require('path')
  const session = require('express-session')
  const SessionRedisStore = require('connect-redis')(session)
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
  app.use(cors(wiki.config.cors))
  app.options('*', cors(wiki.config.cors))
  app.enable('trust proxy')

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
  app.use(wiki.auth.passport.initialize())
  app.use(wiki.auth.passport.session())

  // ----------------------------------------
  // SEO
  // ----------------------------------------

  app.use(mw.seo)

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

  app.locals.basedir = wiki.ROOTPATH
  app.locals._ = require('lodash')
  app.locals.t = wiki.lang.engine.t.bind(wiki.lang)
  app.locals.moment = require('moment')
  app.locals.moment.locale(wiki.config.site.lang)
  app.locals.config = wiki.config

  // ----------------------------------------
  // HMR (Dev Mode Only)
  // ----------------------------------------

  if (global.DEV) {
    const webpackDevMiddleware = require('webpack-dev-middleware')
    const webpackHotMiddleware = require('webpack-hot-middleware')
    app.use(webpackDevMiddleware(global.WP, {
      publicPath: global.WPCONFIG.output.publicPath,
      logger: wiki.logger
    }))
    app.use(webpackHotMiddleware(global.WP))
  }

  // ----------------------------------------
  // Controllers
  // ----------------------------------------

  app.use('/', ctrl.auth)

  app.use('/graphql', (req, res, next) => {
    graphqlApollo.graphqlExpress({
      schema: graphqlSchema,
      context: { req, res },
      formatError: (err) => {
        return {
          message: err.message
        }
      }
    })(req, res, next)
  })
  app.use('/graphiql', graphqlApollo.graphiqlExpress({ endpointURL: '/graphql' }))

  app.use('/', mw.auth, ctrl.common)

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
    res.render('error', {
      message: err.message,
      error: wiki.IS_DEBUG ? err : {}
    })
  })

  // ----------------------------------------
  // Start HTTP server
  // ----------------------------------------

  let srvConnections = {}

  wiki.logger.info(`HTTP Server on port: [ ${wiki.config.port} ]`)

  app.set('port', wiki.config.port)
  wiki.server = http.createServer(app)

  wiki.server.listen(wiki.config.port)
  wiki.server.on('error', (error) => {
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

  wiki.server.on('connection', conn => {
    let key = `${conn.remoteAddress}:${conn.remotePort}`
    srvConnections[key] = conn
    conn.on('close', function() {
      delete srvConnections[key]
    })
  })

  wiki.server.on('listening', () => {
    wiki.logger.info('HTTP Server: [ RUNNING ]')
  })

  wiki.server.destroy = (cb) => {
    wiki.server.close(cb)
    for (let key in srvConnections) {
      srvConnections[key].destroy()
    }
  }

  return true
}
