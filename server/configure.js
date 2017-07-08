'use strict'

module.exports = (port, spinner) => {
  const path = require('path')

  const ROOTPATH = process.cwd()
  const SERVERPATH = path.join(ROOTPATH, 'server')
  const IS_DEBUG = process.env.NODE_ENV === 'development'

  // ----------------------------------------
  // Load modules
  // ----------------------------------------

  const bodyParser = require('body-parser')
  const compression = require('compression')
  const express = require('express')
  const favicon = require('serve-favicon')
  const http = require('http')
  const Promise = require('bluebird')
  const fs = Promise.promisifyAll(require('fs-extra'))
  const yaml = require('js-yaml')
  const _ = require('lodash')
  const cfgHelper = require('./helpers/config')

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  var app = express()
  app.use(compression())

  var server

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(ROOTPATH, 'assets')))

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.locals._ = require('lodash')

  // ----------------------------------------
  // Controllers
  // ----------------------------------------

  app.get('*', (req, res) => {
    let langs = []
    let conf = {}
    try {
      langs = yaml.safeLoad(fs.readFileSync(path.join(SERVERPATH, 'app/data.yml'), 'utf8')).langs
      conf = yaml.safeLoad(fs.readFileSync(path.join(ROOTPATH, 'config.yml'), 'utf8'))
    } catch (err) {
      console.error(err)
    }
    res.render('configure/index', {
      langs,
      conf,
      runmode: {
        staticPort: (process.env.WIKI_JS_HEROKU || process.env.WIKI_JS_DOCKER),
        staticMongo: (!_.isNil(process.env.WIKI_JS_HEROKU))
      }
    })
  })

  /**
   * Perform basic system checks
   */
  app.post('/syscheck', (req, res) => {
    Promise.mapSeries([
      () => {
        const semver = require('semver')
        if (!semver.satisfies(semver.clean(process.version), '>=6.9.0')) {
          throw new Error('Node.js version is too old. Minimum is v6.6.0.')
        }
        return 'Node.js ' + process.version + ' detected. Minimum is v6.9.0.'
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
            let gitver = _.head(stdout.match(/[\d]+\.[\d]+(\.[\d]+)?/gi))
            if (!gitver || !semver.satisfies(semver.clean(gitver), '>=2.7.4')) {
              reject(new Error('Git version is too old. Minimum is v2.7.4.'))
            }
            resolve('Git v' + gitver + ' detected. Minimum is v2.7.4.')
          })
        })
      },
      () => {
        const os = require('os')
        if (os.totalmem() < 1000 * 1000 * 768) {
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
    let mongoURI = cfgHelper.parseConfigValue(req.body.db)
    mongo.connect(mongoURI, {
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
    const url = require('url')

    const dataDir = path.resolve(ROOTPATH, cfgHelper.parseConfigValue(req.body.pathData))
    const gitDir = path.resolve(ROOTPATH, cfgHelper.parseConfigValue(req.body.pathRepo))

    let gitRemoteUrl = ''

    if (req.body.gitUseRemote === true) {
      let urlObj = url.parse(cfgHelper.parseConfigValue(req.body.gitUrl))
      if (req.body.gitAuthType === 'basic') {
        urlObj.auth = req.body.gitAuthUser + ':' + req.body.gitAuthPass
      }
      gitRemoteUrl = url.format(urlObj)
    }

    Promise.mapSeries([
      () => {
        return fs.ensureDirAsync(dataDir).return('Data directory path is valid.')
      },
      () => {
        return fs.ensureDirAsync(gitDir).return('Git directory path is valid.')
      },
      () => {
        return exec.stdout('git', ['init'], { cwd: gitDir }).then(result => {
          return 'Local git repository has been initialized.'
        })
      },
      () => {
        if (req.body.gitUseRemote === false) { return false }
        return exec.stdout('git', ['config', '--local', 'user.name', 'Wiki'], { cwd: gitDir }).then(result => {
          return 'Git Signature Name has been set successfully.'
        })
      },
      () => {
        if (req.body.gitUseRemote === false) { return false }
        return exec.stdout('git', ['config', '--local', 'user.email', req.body.gitServerEmail], { cwd: gitDir }).then(result => {
          return 'Git Signature Name has been set successfully.'
        })
      },
      () => {
        if (req.body.gitUseRemote === false) { return false }
        return exec.stdout('git', ['config', '--local', '--bool', 'http.sslVerify', req.body.gitAuthSSL], { cwd: gitDir }).then(result => {
          return 'Git SSL Verify flag has been set successfully.'
        })
      },
      () => {
        if (req.body.gitUseRemote === false) { return false }
        if (req.body.gitAuthType === 'ssh') {
          return exec.stdout('git', ['config', '--local', 'core.sshCommand', 'ssh -i "' + req.body.gitAuthSSHKey + '" -o StrictHostKeyChecking=no'], { cwd: gitDir }).then(result => {
            return 'Git SSH Private Key path has been set successfully.'
          })
        } else {
          return false
        }
      },
      () => {
        if (req.body.gitUseRemote === false) { return false }
        return exec.stdout('git', ['remote', 'rm', 'origin'], { cwd: gitDir }).catch(err => {
          if (_.includes(err.message, 'No such remote') || _.includes(err.message, 'Could not remove')) {
            return true
          } else {
            throw err
          }
        }).then(() => {
          return exec.stdout('git', ['remote', 'add', 'origin', gitRemoteUrl], { cwd: gitDir }).then(result => {
            return 'Git Remote was added successfully.'
          })
        })
      },
      () => {
        if (req.body.gitUseRemote === false) { return false }
        return exec.stdout('git', ['pull', 'origin', req.body.gitBranch], { cwd: gitDir }).then(result => {
          return 'Git Pull operation successful.'
        })
      }
    ], step => { return step() }).then(results => {
      return res.json({ ok: true, results: _.without(results, false) })
    }).catch(err => {
      let errMsg = (err.stderr) ? err.stderr.replace(/(error:|warning:|fatal:)/gi, '').replace(/ \s+/g, ' ') : err.message
      res.json({ ok: false, error: errMsg })
    })
  })

  /**
   * Finalize
   */
  app.post('/finalize', (req, res) => {
    const bcrypt = require('bcryptjs-then')
    const crypto = Promise.promisifyAll(require('crypto'))
    let mongo = require('mongodb').MongoClient
    let parsedMongoConStr = cfgHelper.parseConfigValue(req.body.db)

    Promise.join(
      new Promise((resolve, reject) => {
        mongo.connect(parsedMongoConStr, {
          autoReconnect: false,
          reconnectTries: 2,
          reconnectInterval: 1000,
          connectTimeoutMS: 5000,
          socketTimeoutMS: 5000
        }, (err, db) => {
          if (err === null) {
            db.createCollection('users', { strict: false }, (err, results) => {
              if (err === null) {
                bcrypt.hash(req.body.adminPassword).then(adminPwdHash => {
                  db.collection('users').findOneAndUpdate({
                    provider: 'local',
                    email: req.body.adminEmail
                  }, {
                    provider: 'local',
                    email: req.body.adminEmail,
                    name: 'Administrator',
                    password: adminPwdHash,
                    rights: [{
                      role: 'admin',
                      path: '/',
                      exact: false,
                      deny: false
                    }],
                    updatedAt: new Date(),
                    createdAt: new Date()
                  }, {
                    upsert: true,
                    returnOriginal: false
                  }, (err, results) => {
                    if (err === null) {
                      resolve(true)
                    } else {
                      reject(err)
                    }
                    db.close()
                  })
                })
              } else {
                reject(err)
                db.close()
              }
            })
          } else {
            reject(err)
          }
        })
      }),
      fs.readFileAsync(path.join(ROOTPATH, 'config.yml'), 'utf8').then(confRaw => {
        let conf = yaml.safeLoad(confRaw)
        conf.title = req.body.title
        conf.host = req.body.host
        conf.port = req.body.port
        conf.paths = {
          repo: req.body.pathRepo,
          data: req.body.pathData
        }
        conf.uploads = {
          maxImageFileSize: (conf.uploads && _.isNumber(conf.uploads.maxImageFileSize)) ? conf.uploads.maxImageFileSize : 3,
          maxOtherFileSize: (conf.uploads && _.isNumber(conf.uploads.maxOtherFileSize)) ? conf.uploads.maxOtherFileSize : 100
        }
        conf.lang = req.body.lang
        conf.public = (req.body.public === true)
        if (conf.auth && conf.auth.local) {
          conf.auth.local = { enabled: true }
        } else {
          conf.auth = { local: { enabled: true } }
        }
        conf.db = req.body.db
        if (req.body.gitUseRemote === false) {
          conf.git = false
        } else {
          conf.git = {
            url: req.body.gitUrl,
            branch: req.body.gitBranch,
            auth: {
              type: req.body.gitAuthType,
              username: req.body.gitAuthUser,
              password: req.body.gitAuthPass,
              privateKey: req.body.gitAuthSSHKey,
              sslVerify: (req.body.gitAuthSSL === true)
            },
            showUserEmail: (req.body.gitShowUserEmail === true),
            serverEmail: req.body.gitServerEmail
          }
        }
        return crypto.randomBytesAsync(32).then(buf => {
          conf.sessionSecret = buf.toString('hex')
          confRaw = yaml.safeDump(conf)
          return fs.writeFileAsync(path.join(ROOTPATH, 'config.yml'), confRaw)
        })
      })
    ).then(() => {
      if (process.env.IS_HEROKU) {
        return fs.outputJsonAsync(path.join(SERVERPATH, 'app/heroku.json'), { configured: true })
      } else {
        return true
      }
    }).then(() => {
      res.json({ ok: true })
    }).catch(err => {
      res.json({ ok: false, error: err.message })
    })
  })

  /**
   * Restart in normal mode
   */
  app.post('/restart', (req, res) => {
    res.status(204).end()
    server.destroy(() => {
      spinner.text = 'Setup wizard terminated. Restarting in normal mode...'
      _.delay(() => {
        const exec = require('execa')
        exec.stdout('node', ['wiki', 'start']).then(result => {
          spinner.succeed('Wiki.js is now running in normal mode!')
          process.exit(0)
        })
      }, 1000)
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
  server = http.createServer(app)
  server.listen(port)

  var openConnections = []

  server.on('connection', (conn) => {
    let key = conn.remoteAddress + ':' + conn.remotePort
    openConnections[key] = conn
    conn.on('close', () => {
      delete openConnections[key]
    })
  })

  server.destroy = (cb) => {
    server.close(cb)
    for (let key in openConnections) {
      openConnections[key].destroy()
    }
  }

  server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

    switch (error.code) {
      case 'EACCES':
        spinner.fail('Listening on port ' + port + ' requires elevated privileges!')
        return process.exit(1)
      case 'EADDRINUSE':
        spinner.fail('Port ' + port + ' is already in use!')
        return process.exit(1)
      default:
        throw error
    }
  })

  server.on('listening', () => {
    spinner.text = 'Browse to http://localhost:' + port + ' to configure Wiki.js!'
  })
}
