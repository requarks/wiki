'use strict'

// ===========================================
// Wiki.js
// 1.0.0
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const ROOTPATH = process.cwd()
const SERVERPATH = path.join(ROOTPATH, 'server')

global.ROOTPATH = ROOTPATH
global.SERVERPATH = SERVERPATH
const IS_DEBUG = process.env.NODE_ENV === 'development'

process.env.VIPS_WARNING = false

// if (IS_DEBUG) {
//   require('@glimpse/glimpse').init()
// }

let appconf = require('./libs/config')()
global.appconfig = appconf.config
global.appdata = appconf.data

// ----------------------------------------
// Load Winston
// ----------------------------------------

global.winston = require('./libs/logger')(IS_DEBUG, 'SERVER')
global.winston.info('Wiki.js is initializing...')

// ----------------------------------------
// Load global modules
// ----------------------------------------

global.lcdata = require('./libs/local').init()
global.db = require('./libs/db').init()
global.entries = require('./libs/entries').init()
global.git = require('./libs/git').init(false)
global.lang = require('i18next')
global.mark = require('./libs/markdown')
global.search = require('./libs/search').init()
global.upl = require('./libs/uploads').init()

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
const fork = require('child_process').fork
const http = require('http')
const i18nBackend = require('i18next-node-fs-backend')
const passport = require('passport')
const passportSocketIo = require('passport.socketio')
const session = require('express-session')
const SessionMongoStore = require('connect-mongo')(session)
const graceful = require('node-graceful')
const socketio = require('socket.io')

var mw = autoload(path.join(SERVERPATH, '/middlewares'))
var ctrl = autoload(path.join(SERVERPATH, '/controllers'))

// ----------------------------------------
// Define Express App
// ----------------------------------------

const app = express()
global.app = app
app.use(compression())

// ----------------------------------------
// Security
// ----------------------------------------

app.use(mw.security)

// ----------------------------------------
// Public Assets
// ----------------------------------------

app.use(favicon(path.join(ROOTPATH, 'assets', 'favicon.ico')))
app.use(express.static(path.join(ROOTPATH, 'assets'), {
  index: false,
  maxAge: '7d'
}))

// ----------------------------------------
// Passport Authentication
// ----------------------------------------

require('./libs/auth')(passport)
global.rights = require('./libs/rights')
global.rights.init()

let sessionStore = new SessionMongoStore({
  mongooseConnection: global.db.connection,
  touchAfter: 15
})

app.use(cookieParser())
app.use(session({
  name: 'wikijs.sid',
  store: sessionStore,
  secret: appconfig.sessionSecret,
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

global.lang
  .use(i18nBackend)
  .init({
    load: 'languageOnly',
    ns: ['common', 'admin', 'auth', 'errors', 'git'],
    defaultNS: 'common',
    saveMissing: false,
    preload: [appconfig.lang],
    lng: appconfig.lang,
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(SERVERPATH, 'locales/{{lng}}/{{ns}}.json')
    }
  })

// ----------------------------------------
// View Engine Setup
// ----------------------------------------

app.set('views', path.join(SERVERPATH, 'views'))
app.set('view engine', 'pug')

app.use(bodyParser.json({ limit: '1mb' }))
app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }))

// ----------------------------------------
// View accessible data
// ----------------------------------------

app.locals._ = require('lodash')
app.locals.t = global.lang.t.bind(global.lang)
app.locals.moment = require('moment')
app.locals.moment.locale(appconfig.lang)
app.locals.appconfig = appconfig
app.use(mw.flash)

// ----------------------------------------
// Controllers
// ----------------------------------------

app.use('/', ctrl.auth)

app.use('/uploads', mw.auth, ctrl.uploads)
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
    error: IS_DEBUG ? err : {}
  })
})

// ----------------------------------------
// Start HTTP server
// ----------------------------------------

global.winston.info('Starting HTTP/WS server on port ' + appconfig.port + '...')

app.set('port', appconfig.port)
var server = http.createServer(app)
var io = socketio(server)

server.listen(appconfig.port, appconfig.listenAddress)
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error
  }

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      global.winston.error('Listening on port ' + appconfig.port + ' requires elevated privileges!')
      return process.exit(1)
    case 'EADDRINUSE':
      global.winston.error('Port ' + appconfig.port + ' is already in use!')
      return process.exit(1)
    default:
      throw error
  }
})

server.on('listening', () => {
  global.winston.info('HTTP/WS server started successfully! [RUNNING]')
})

// ----------------------------------------
// WebSocket
// ----------------------------------------

io.use(passportSocketIo.authorize({
  key: 'wikijs.sid',
  store: sessionStore,
  secret: appconfig.sessionSecret,
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
// Start child processes
// ----------------------------------------

let bgAgent = fork(path.join(SERVERPATH, 'agent.js'))

bgAgent.on('message', m => {
  if (!m.action) {
    return
  }

  switch (m.action) {
    case 'searchAdd':
      global.search.add(m.content)
      break
  }
})

// ----------------------------------------
// Graceful shutdown
// ----------------------------------------

graceful.on('exit', () => {
  global.winston.info('- SHUTTING DOWN - Terminating Background Agent...')
  bgAgent.kill()
  global.winston.info('- SHUTTING DOWN - Performing git sync...')
  return global.git.resync().then(() => {
    global.winston.info('- SHUTTING DOWN - Git sync successful. Now safe to exit.')
    process.exit()
  })
})
