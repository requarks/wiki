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
  const Promise = require('bluebird')
  const fs = require('fs-extra')
  const yaml = require('js-yaml')
  const _ = require('lodash')


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
    let langs = []
    try {
      langs = yaml.safeLoad(fs.readFileSync('./app/data.yml', 'utf8')).langs
    } catch (err) {
      console.error(err)
    }
    res.render('configure/index', {
      langs
    })
  })

  /**
   * Perform basic system checks
   */
  app.post('/syscheck', (req, res) => {
    Promise.mapSeries([
      () => {
        const semver = require('semver')
        if (!semver.satisfies(semver.clean(process.version), '>=4.6.0')) {
          throw new Error('Node.js version is too old. Minimum is v4.6.0.')
        }
        return 'Node.js ' + process.version + ' detected. Minimum is v4.6.0.'
      },
      () => {
        return Promise.try(() => {
          require('crypto')
        }).catch(err => { // eslint-disable-line handle-callback-err
          throw new Error('Crypto Node.js module is not available.')
        }).return('Node.js Crypto module is available.')
      },
      () => {
        const exec = require('child_process').exec
        const semver = require('semver')
        return new Promise((resolve, reject) => {
          exec('git --version', (err, stdout, stderr) => {
            if (err || stdout.length < 3) {
              reject(new Error('Git is not installed or not reachable from PATH.'))
            }
            let gitver = _.chain(stdout.replace(/[^\d.]/g, '')).split('.').take(3).join('.').value()
            if (!semver.satisfies(semver.clean(gitver), '>=2.11.0')) {
              reject(new Error('Git version is too old. Minimum is v2.11.0.'))
            }
            resolve('Git v' + gitver + ' detected. Minimum is v2.11.0.')
          })
        })
      },
      () => {
        const os = require('os')
        if (os.totalmem() < 1024 * 1024 * 768) {
          throw new Error('Not enough memory. Minimum is 768 MB.')
        }
        return _.round(os.totalmem() / (1024 * 1024)) + ' MB of system memory available. Minimum is 768 MB.'
      },
      () => {
        let fs = require('fs')
        return Promise.try(() => {
          fs.accessSync(path.join(ROOTPATH, 'config.yml'), (fs.constants || fs).W_OK)
        }).catch(err => { // eslint-disable-line handle-callback-err
          throw new Error('config.yml file is not writable by Node.js process or was not created properly.')
        }).return('config.yml is writable by the setup process.')
      }
    ], test => { return test() }).then(results => {
      res.json({ ok: true, results })
    }).catch(err => {
      res.json({ ok: false, error: err.message })
    })
  })

  /**
   * Check the DB connection
   */
  app.post('/dbcheck', (req, res) => {
    let mongo = require('mongodb').MongoClient
    mongo.connect(req.body.db, {
      autoReconnect: false,
      reconnectTries: 2,
      reconnectInterval: 1000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000
    }, (err, db) => {
      if (err === null) {
        // Try to create a test collection
        db.createCollection('test', (err, results) => {
          if (err === null) {
            // Try to drop test collection
            db.dropCollection('test', (err, results) => {
              if (err === null) {
                res.json({ ok: true })
              } else {
                res.json({ ok: false, error: 'Unable to delete test collection. Verify permissions. ' + err.message })
              }
              db.close()
            })
          } else {
            res.json({ ok: false, error: 'Unable to create test collection. Verify permissions. ' + err.message })
            db.close()
          }
        })
      } else {
        res.json({ ok: false, error: err.message })
      }
    })
  })

  /**
   * Check the Git connection
   */
  app.post('/gitcheck', (req, res) => {
    const exec = require('execa')

    const dataDir = path.resolve(ROOTPATH, req.body.pathData)
    const gitDir = path.resolve(ROOTPATH, req.body.pathRepo)
    let results = []

    fs.ensureDir(dataDir).then(() => {
      results.push('Data directory path is valid.')
      return fs.ensureDir(gitDir).then(() => {
        results.push('Git directory path is valid.')
        return true
      })
    }).then(() => {
      return exec.stdout('git', ['init'], { cwd: gitDir }).then(result => {
        results.push('Git local repository initialized.')
        return true
      })
    }).then(() => {
      return res.json({ ok: true, results })
    }).catch(err => {
      res.json({ ok: false, error: err.message })
    })
  })

  /**
   * Check the DB connection
   */
  app.post('/finalize', (req, res) => {
    let mongo = require('mongodb').MongoClient
    mongo.connect(req.body.db, {
      autoReconnect: false,
      reconnectTries: 2,
      reconnectInterval: 1000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 5000
    }, (err, db) => {
      if (err === null) {
        // Try to create a test collection
        db.createCollection('test', (err, results) => {
          if (err === null) {
            // Try to drop test collection
            db.dropCollection('test', (err, results) => {
              if (err === null) {
                res.json({ ok: true })
              } else {
                res.json({ ok: false, error: 'Unable to delete test collection. Verify permissions. ' + err.message })
              }
              db.close()
            })
          } else {
            res.json({ ok: false, error: 'Unable to create test collection. Verify permissions. ' + err.message })
            db.close()
          }
        })
      } else {
        res.json({ ok: false, error: err.message })
      }
    })
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
