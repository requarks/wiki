import bodyParser from 'body-parser'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import session from 'express-session'
import KnexSessionStore from 'connect-session-knex'
import favicon from 'serve-favicon'
import path from 'node:path'
import { set } from 'lodash-es'

import auth from './core/auth.mjs'
import mail from './core/mail.mjs'
import system from './core/system.mjs'

import ctrlAuth from './controllers/auth.mjs'
import ctrlCommon from './controllers/common.mjs'
import ctrlSsl from './controllers/ssl.mjs'
import ctrlWs from './controllers/ws.mjs'

export async function init () {
  // ----------------------------------------
  // Load core modules
  // ----------------------------------------

  WIKI.auth = auth.init()
  WIKI.mail = mail.init()
  WIKI.system = system.init()

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  const app = express()
  WIKI.app = app
  app.use(compression())

  // ----------------------------------------
  // Initialize HTTP/HTTPS Server
  // ----------------------------------------

  const useHTTPS = WIKI.config.ssl.enabled === true || WIKI.config.ssl.enabled === 'true' || WIKI.config.ssl.enabled === 1 || WIKI.config.ssl.enabled === '1'

  await WIKI.servers.initHTTP()
  if (useHTTPS) {
    await WIKI.servers.initHTTPS()
  }
  await WIKI.servers.initWebSocket()

  // ----------------------------------------
  // Attach WebSocket Server
  // ----------------------------------------

  ctrlWs()

  // ----------------------------------------
  // Security
  // ----------------------------------------

  app.use((req, res, next) => {
    // -> Disable X-Powered-By
    req.app.disable('x-powered-by')

    // -> Disable Frame Embedding
    if (WIKI.config.security.securityIframe) {
      res.set('X-Frame-Options', 'deny')
    }

    // -> Re-enable XSS Fitler if disabled
    res.set('X-XSS-Protection', '1; mode=block')

    // -> Disable MIME-sniffing
    res.set('X-Content-Type-Options', 'nosniff')

    // -> Disable IE Compatibility Mode
    res.set('X-UA-Compatible', 'IE=edge')

    // -> Disables referrer header when navigating to a different origin
    if (WIKI.config.security.securityReferrerPolicy) {
      res.set('Referrer-Policy', 'same-origin')
    }

    // -> Enforce HSTS
    if (WIKI.config.security.securityHSTS) {
      res.set('Strict-Transport-Security', `max-age=${WIKI.config.security.securityHSTSDuration}; includeSubDomains`)
    }

    // -> Prevent Open Redirect from user provided URL
    if (WIKI.config.security.securityOpenRedirect) {
      // Strips out all repeating / character in the provided URL
      req.url = req.url.replace(/(\/)(?=\/*\1)/g, '')
    }

    next()
  })
  app.use(cors({ origin: false }))
  app.options('*', cors({ origin: false }))
  if (WIKI.config.security.securityTrustProxy) {
    app.enable('trust proxy')
  }

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(WIKI.ROOTPATH, 'assets', 'favicon.ico')))
  app.use('/_assets', express.static(path.join(WIKI.ROOTPATH, 'assets/_assets'), {
    index: false,
    maxAge: '7d'
  }))
  app.use('/_assets/svg/twemoji', async (req, res, next) => {
    try {
      WIKI.asar.serve('twemoji', req, res, next)
    } catch (err) {
      res.sendStatus(404)
    }
  })

  // ----------------------------------------
  // SSL Handlers
  // ----------------------------------------

  app.use('/', ctrlSsl())

  // ----------------------------------------
  // Passport Authentication
  // ----------------------------------------

  app.use(cookieParser())
  app.use(session({
    secret: WIKI.config.auth.secret,
    resave: false,
    saveUninitialized: false,
    store: new KnexSessionStore(session)({
      knex: WIKI.db.knex
    })
  }))
  app.use(WIKI.auth.passport.initialize())
  app.use(WIKI.auth.authenticate)

  // ----------------------------------------
  // GraphQL Server
  // ----------------------------------------

  app.use(bodyParser.json({ limit: WIKI.config.bodyParserLimit || '1mb' }))
  await WIKI.servers.startGraphQL()

  // ----------------------------------------
  // SEO
  // ----------------------------------------

  app.use((req, res, next) => {
    if (req.path.length > 1 && req.path.endsWith('/')) {
      let query = req.url.slice(req.path.length) || ''
      res.redirect(301, req.path.slice(0, -1) + query)
    } else {
      set(res.locals, 'pageMeta.url', `${WIKI.config.host}${req.path}`)
      next()
    }
  })

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(WIKI.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.urlencoded({ extended: false, limit: '1mb' }))

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
    const currentSite = await WIKI.db.sites.getSiteByHostname({ hostname: req.hostname })
    if (!currentSite) {
      return res.status(404).send('Site Not Found')
    }

    res.locals.siteConfig = {
      id: currentSite.id,
      title: currentSite.config.title,
      darkMode: currentSite.config.theme.dark,
      lang: currentSite.config.locales.primary,
      rtl: false, // TODO: handle RTL
      company: currentSite.config.company,
      contentLicense: currentSite.config.contentLicense
    }
    res.locals.theming = {

    }
    res.locals.langs = await WIKI.db.locales.getNavLocales({ cache: true })
    res.locals.analyticsCode = await WIKI.db.analytics.getCode({ cache: true })
    next()
  })

  app.use('/', ctrlAuth())
  app.use('/', ctrlCommon())

  // ----------------------------------------
  // Error handling
  // ----------------------------------------

  app.use((req, res, next) => {
    const err = new Error('Not Found')
    err.status = 404
    next(err)
  })

  app.use((err, req, res, next) => {
    if (req.path === '/_graphql') {
      res.status(err.status || 500).json({
        data: {},
        errors: [{
          message: err.message,
          path: []
        }]
      })
    } else {
      res.status(err.status || 500)
      set(res.locals, 'pageMeta.title', 'Error')
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

  if (useHTTPS) {
    await WIKI.servers.startHTTPS()
  }

  return true
}
