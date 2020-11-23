const autoload = require('auto-load')
const bodyParser = require('body-parser')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const cors = require('cors')
const express = require('express')
const session = require('express-session')
const KnexSessionStore = require('connect-session-knex')(session)
const favicon = require('serve-favicon')
const path = require('path')
const _ = require('lodash')

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

  const mw = autoload(path.join(WIKI.SERVERPATH, '/middlewares'))
  const ctrl = autoload(path.join(WIKI.SERVERPATH, '/controllers'))

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
  app.use('/_assets/svg/twemoji', async (req, res, next) => {
    try {
      WIKI.asar.serve('twemoji', req, res, next)
    } catch (err) {
      res.sendStatus(404)
    }
  })
  app.use('/_assets', express.static(path.join(WIKI.ROOTPATH, 'assets'), {
    index: false,
    maxAge: '7d'
  }))

  // ----------------------------------------
  // SSL Handlers
  // ----------------------------------------

  app.use('/', ctrl.ssl)

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
  // GraphQL Server
  // ----------------------------------------

  app.use(bodyParser.json({ limit: '1mb' }))
  await WIKI.servers.startGraphQL()

  // ----------------------------------------
  // SEO
  // ----------------------------------------

  app.use(mw.seo)

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(WIKI.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }))

  // ----------------------------------------
  // Localization
  // ----------------------------------------

  WIKI.lang.attachMiddleware(app)

  // ----------------------------------------
  // View accessible data
  // ----------------------------------------

  app.locals.siteConfig = {}
  app.locals.analyticsCode = {}
  app.locals.basedir = WIKI.ROOTPATH
  app.locals.config = WIKI.config
  app.locals.pageMeta = {
    title: '',
    description: WIKI.config.description,
    image: '',
    url: '/'
  }
  app.locals.devMode = WIKI.devMode

  // ----------------------------------------
  // HMR (Dev Mode Only)
  // ----------------------------------------

  if (global.DEV) {
    app.use(global.WP_DEV.devMiddleware)
    app.use(global.WP_DEV.hotMiddleware)
  }

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
      company: WIKI.config.company,
      contentLicense: WIKI.config.contentLicense,
      logoUrl: WIKI.config.logoUrl
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
    const err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  app.use((err, req, res, next) => {
    if (req.path === '/graphql') {
      res.status(err.status || 500).json({
        data: {},
        errors: [{
          message: err.message,
          path: []
        }]
      })
    } else {
      res.status(err.status || 500)
      _.set(res.locals, 'pageMeta.title', 'Error')
      res.render('error', {
        message: err.message,
        error: WIKI.IS_DEBUG ? err : {}
      })
    }
  })

  // ----------------------------------------
  // Start HTTP Server(s)
  // ----------------------------------------

  await WIKI.servers.startHTTP()

  if (WIKI.config.ssl.enabled === true || WIKI.config.ssl.enabled === 'true' || WIKI.config.ssl.enabled === 1 || WIKI.config.ssl.enabled === '1') {
    await WIKI.servers.startHTTPS()
  }

  return true
}
