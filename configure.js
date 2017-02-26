'use strict'

module.exports = (port, spinner) => {
  const ROOTPATH = __dirname
  const IS_DEBUG = process.env.NODE_ENV === 'development'

  // ----------------------------------------
  // Load modules
  // ----------------------------------------

  const bodyParser = require('body-parser')
  const compression = require('compression')
  const express = require('express')
  const favicon = require('serve-favicon')
  const http = require('http')
  const path = require('path')

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  var app = express()
  app.use(compression())

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(ROOTPATH, 'assets')))

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(ROOTPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.locals._ = require('lodash')

  // ----------------------------------------
  // Controllers
  // ----------------------------------------

  app.get('*', (req, res) => {
    res.render('configure/index')
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
      error: IS_DEBUG ? err : {}
    })
    spinner.fail(err.message)
    process.exit(1)
  })

  // ----------------------------------------
  // Start HTTP server
  // ----------------------------------------

  spinner.text = 'Starting HTTP server...'

  app.set('port', port)
  var server = http.createServer(app)
  server.listen(port)
  server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

    switch (error.code) {
      case 'EACCES':
        spinner.fail('Listening on port ' + port + ' requires elevated privileges!')
        process.exit(1)
        break
      case 'EADDRINUSE':
        spinner.fail('Port ' + port + ' is already in use!')
        process.exit(1)
        break
      default:
        throw error
    }
  })

  server.on('listening', () => {
    spinner.text = 'Browse to http://localhost:' + port + ' to configure Wiki.js!'
  })
}
