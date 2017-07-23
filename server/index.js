'use strict'

// ===========================================
// Wiki.js
// 1.0.1
// Licensed under AGPLv3
// ===========================================

const path = require('path')
let wiki = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server')
}
global.wiki = wiki

process.env.VIPS_WARNING = false

// if (wiki.IS_DEBUG) {
//   require('@glimpse/glimpse').init()
// }

let appconf = require('./modules/config')()
wiki.config = appconf.config
wiki.data = appconf.data

// ----------------------------------------
// Load Winston
// ----------------------------------------

wiki.logger = require('./modules/logger')(wiki.IS_DEBUG, 'SERVER')
wiki.logger.info('Wiki.js is initializing...')

// ----------------------------------------
// Load global modules
// ----------------------------------------

wiki.disk = require('./modules/disk').init()
wiki.db = require('./modules/db').init()
wiki.entries = require('./modules/entries').init()
wiki.git = require('./modules/git').init(false)
wiki.lang = require('i18next')
wiki.mark = require('./modules/markdown')
wiki.redis = require('./modules/redis').init()
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
const fork = require('child_process').fork
const http = require('http')
const i18nBackend = require('i18next-node-fs-backend')
const passport = require('passport')
const passportSocketIo = require('passport.socketio')
const session = require('express-session')
const SessionRedisStore = require('connect-redis')(session)
const graceful = require('node-graceful')
const socketio = require('socket.io')

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

require('./modules/auth')(passport)
wiki.rights = require('./modules/rights')
wiki.rights.init()

let sessionStore = new SessionRedisStore({
  client: wiki.redis
})

app.use(cookieParser())
app.use(session({
  name: 'wikijs.sid',
  store: sessionStore,
  secret: wiki.config.sessionSecret,
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
  preload: [wiki.config.lang],
  lng: wiki.config.lang,
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
app.locals.moment.locale(wiki.config.lang)
app.locals.appconfig = wiki.config
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
    error: wiki.IS_DEBUG ? err : {}
  })
})

// ----------------------------------------
// Start HTTP server
// ----------------------------------------

wiki.logger.info('Starting HTTP/WS server on port ' + wiki.config.port + '...')

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
  wiki.logger.info('HTTP/WS server started successfully! [RUNNING]')
})

// ----------------------------------------
// WebSocket
// ----------------------------------------

io.use(passportSocketIo.authorize({
  key: 'wikijs.sid',
  store: sessionStore,
  secret: wiki.config.sessionSecret,
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

let bgAgent = fork(path.join(wiki.SERVERPATH, 'agent.js'))

bgAgent.on('message', m => {
  if (!m.action) {
    return
  }

  switch (m.action) {
    case 'searchAdd':
      wiki.search.add(m.content)
      break
  }
})

// ----------------------------------------
// Graceful shutdown
// ----------------------------------------

graceful.on('exit', () => {
  wiki.logger.info('- SHUTTING DOWN - Terminating Background Agent...')
  bgAgent.kill()
  wiki.logger.info('- SHUTTING DOWN - Performing git sync...')
  return global.git.resync().then(() => {
    wiki.logger.info('- SHUTTING DOWN - Git sync successful. Now safe to exit.')
    process.exit()
  })
})
