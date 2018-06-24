const autoload = require('auto-load')
const bodyParser = require('body-parser')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const express = require('express')
const favicon = require('serve-favicon')
const http = require('http')
const path = require('path')
const session = require('express-session')
const SessionRedisStore = require('connect-redis')(session)
const { ApolloServer } = require('apollo-server-express')
// const oauth2orize = require('oauth2orize')

/* global WIKI */

module.exports = async () => {
  // ----------------------------------------
  // Load core modules
  // ----------------------------------------

  WIKI.auth = require('./core/auth').init()
  WIKI.lang = require('./core/localization').init()

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

  let sessionStore = new SessionRedisStore({
    client: WIKI.redis
  })

  app.use(cookieParser())
  app.use(session({
    name: 'wikijs.sid',
    store: sessionStore,
    secret: WIKI.config.sessionSecret,
    resave: false,
    saveUninitialized: false
  }))
  app.use(WIKI.auth.passport.initialize())
  app.use(WIKI.auth.passport.session())

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
    context: ({ req, res }) => ({ req, res })
  })
  apolloServer.applyMiddleware({ app })

  // ----------------------------------------
  // Routing
  // ----------------------------------------

  app.use('/', ctrl.auth)

  // app.use('/graphql', (req, res, next) => {
  //   graphqlApollo.graphqlExpress({
  //     schema: graphqlSchema,
  //     context: { req, res },
  //     formatError: (err) => {
  //       return {
  //         message: err.message
  //       }
  //     }
  //   })(req, res, next)
  // })
  // app.use('/graphiql', graphqlApollo.graphiqlExpress({ endpointURL: '/graphql' }))

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
      error: WIKI.IS_DEBUG ? err : {}
    })
  })

  // ----------------------------------------
  // HTTP server
  // ----------------------------------------

  let srvConnections = {}

  WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)

  app.set('port', WIKI.config.port)
  WIKI.server = http.createServer(app)

  WIKI.server.listen(WIKI.config.port)
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
    WIKI.logger.info('HTTP Server: [ RUNNING ]')
  })

  WIKI.server.destroy = (cb) => {
    WIKI.server.close(cb)
    for (let key in srvConnections) {
      srvConnections[key].destroy()
    }
  }

  return true
}
