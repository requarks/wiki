const path = require('path')

/* global wiki */

module.exports = () => {
  wiki.config.site = {
    path: '',
    title: 'Wiki.js'
  }

  wiki.system = require('./core/system')

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
  const filesize = require('filesize.js')
  const crypto = Promise.promisifyAll(require('crypto'))

  // ----------------------------------------
  // Define Express App
  // ----------------------------------------

  let app = express()
  app.use(compression())

  let server

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(wiki.ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(wiki.ROOTPATH, 'assets')))

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(wiki.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.locals.config = wiki.config
  app.locals.data = wiki.data
  app.locals._ = require('lodash')

  // ----------------------------------------
  // HMR (Dev Mode Only)
  // ----------------------------------------

  if (global.DEV) {
    app.use(global.WP_DEV.devMiddleware)
    app.use(global.WP_DEV.hotMiddleware)
  }

  // ----------------------------------------
  // Controllers
  // ----------------------------------------

  app.get('*', async (req, res) => {
    let packageObj = await fs.readJson(path.join(wiki.ROOTPATH, 'package.json'))
    res.render('main/setup', {
      packageObj,
      telemetryClientID: wiki.telemetry.cid
    })
  })

  /**
   * Perform basic system checks
   */
  app.post('/syscheck', (req, res) => {
    wiki.telemetry.enabled = (req.body.telemetry === true)
    wiki.telemetry.sendEvent('setup', 'start')

    Promise.mapSeries([
      () => {
        const semver = require('semver')
        if (!semver.satisfies(semver.clean(process.version), '>=8.9.0')) {
          throw new Error('Node.js version is too old. Minimum is 8.9.0.')
        }
        return 'Node.js ' + process.version + ' detected. Minimum is 8.9.0.'
      },
      () => {
        return Promise.try(() => {
          require('crypto')
        }).catch(err => {
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
              reject(new Error('Git version is too old. Minimum is 2.7.4.'))
            }
            resolve('Git ' + gitver + ' detected. Minimum is 2.7.4.')
          })
        })
      },
      () => {
        const os = require('os')
        if (os.totalmem() < 1000 * 1000 * 512) {
          throw new Error('Not enough memory. Minimum is 512 MB.')
        }
        return filesize(os.totalmem()) + ' of system memory available. Minimum is 512 MB.'
      },
      () => {
        let fs = require('fs')
        return Promise.try(() => {
          fs.accessSync(path.join(wiki.ROOTPATH, 'config.yml'), (fs.constants || fs).W_OK)
        }).catch(err => {
          throw new Error('config.yml file is not writable by Node.js process or was not created properly.')
        }).return('config.yml is writable by the setup process.')
      }
    ], test => test()).then(results => {
      res.json({ ok: true, results })
    }).catch(err => {
      res.json({ ok: false, error: err.message })
    })
  })

  /**
   * Check the Git connection
   */
  app.post('/gitcheck', (req, res) => {
    wiki.telemetry.sendEvent('setup', 'gitcheck')

    const exec = require('execa')
    const url = require('url')

    const dataDir = path.resolve(wiki.ROOTPATH, cfgHelper.parseConfigValue(req.body.pathData))
    const gitDir = path.resolve(wiki.ROOTPATH, cfgHelper.parseConfigValue(req.body.pathRepo))

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
        return fs.ensureDir(dataDir).then(() => 'Data directory path is valid.')
      },
      () => {
        return fs.ensureDir(gitDir).then(() => 'Git directory path is valid.')
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
        if (_.includes(['sshenv', 'sshdb'], req.body.gitAuthType)) {
          req.body.gitAuthSSHKey = path.join(dataDir, 'ssh/key.pem')
        }
        if (_.startsWith(req.body.gitAuthType, 'ssh')) {
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
  app.post('/finalize', async (req, res) => {
    wiki.telemetry.sendEvent('setup', 'finalize')

    try {
      // Upgrade from Wiki.js 1.x?
      if (req.body.upgrade) {
        await wiki.system.upgradeFromMongo({
          mongoCnStr: cfgHelper.parseConfigValue(req.body.upgMongo)
        })
      }

      // Update config file
      wiki.logger.info('Writing config file to disk...')
      let confRaw = await fs.readFileAsync(path.join(wiki.ROOTPATH, 'config.yml'), 'utf8')
      let conf = yaml.safeLoad(confRaw)

      conf.port = req.body.port
      conf.paths.repo = req.body.pathRepo

      confRaw = yaml.safeDump(conf)
      await fs.writeFileAsync(path.join(wiki.ROOTPATH, 'config.yml'), confRaw)

      _.set(wiki.config, 'port', req.body.port)
      _.set(wiki.config, 'paths.repo', req.body.pathRepo)

      // Populate config namespaces
      wiki.config.auth = wiki.config.auth || {}
      wiki.config.features = wiki.config.features || {}
      wiki.config.git = wiki.config.git || {}
      wiki.config.logging = wiki.config.logging || {}
      wiki.config.site = wiki.config.site || {}
      wiki.config.theme = wiki.config.theme || {}
      wiki.config.uploads = wiki.config.uploads || {}

      // Site namespace
      _.set(wiki.config.site, 'title', req.body.title)
      _.set(wiki.config.site, 'path', req.body.path)
      _.set(wiki.config.site, 'lang', req.body.lang)
      _.set(wiki.config.site, 'rtl', _.includes(wiki.data.rtlLangs, req.body.lang))
      _.set(wiki.config.site, 'sessionSecret', (await crypto.randomBytesAsync(32)).toString('hex'))

      // Auth namespace
      _.set(wiki.config.auth, 'public', req.body.public === 'true')
      _.set(wiki.config.auth, 'strategies.local.enabled', true)
      _.set(wiki.config.auth, 'strategies.local.allowSelfRegister', req.body.selfRegister === 'true')

      // Git namespace
      _.set(wiki.config.git, 'enabled', req.body.gitUseRemote === 'true')
      if (wiki.config.git.enabled) {
        _.set(wiki.config.git, 'url', req.body.gitUrl)
        _.set(wiki.config.git, 'branch', req.body.gitBranch)
        _.set(wiki.config.git, 'author.defaultEmail', req.body.gitServerEmail)
        _.set(wiki.config.git, 'author.useUserEmail', req.body.gitShowUserEmail)
        _.set(wiki.config.git, 'sslVerify', req.body.gitAuthSSL === 'true')
        _.set(wiki.config.git, 'auth.type', req.body.gitAuthType)
        switch (wiki.config.git.auth.type) {
          case 'basic':
            _.set(wiki.config.git, 'auth.user', req.body.gitAuthUser)
            _.set(wiki.config.git, 'auth.pass', req.body.gitAuthPass)
            break
          case 'ssh':
            _.set(wiki.config.git, 'auth.keyPath', req.body.gitAuthSSHKey)
            break
          case 'sshenv':
            _.set(wiki.config.git, 'auth.keyEnv', req.body.gitAuthSSHKeyEnv)
            break
          case 'sshdb':
            _.set(wiki.config.git, 'auth.keyContents', req.body.gitAuthSSHKeyDB)
            break
        }
      }

      // Logging namespace
      wiki.config.logging.telemetry = (req.body.telemetry === 'true')

      // Save config to DB
      wiki.logger.info('Persisting config to DB...')
      await wiki.configSvc.saveToDb()

      // Create root administrator
      wiki.logger.info('Creating root administrator...')
      await wiki.db.User.upsert({
        email: req.body.adminEmail,
        provider: 'local',
        password: await wiki.db.User.hashPassword(req.body.adminPassword),
        name: 'Administrator',
        role: 'admin',
        tfaIsActive: false
      })

      wiki.logger.info('Setup is complete!')
      res.json({
        ok: true,
        redirectPath: wiki.config.site.path,
        redirectPort: wiki.config.port
      }).end()

      wiki.logger.info('Stopping Setup...')
      server.destroy(() => {
        wiki.logger.info('Setup stopped. Starting Wiki.js...')
        _.delay(() => {
          wiki.kernel.bootMaster()
        }, 1000)
      })
    } catch (err) {
      res.json({ ok: false, error: err.message })
    }
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
      error: wiki.IS_DEBUG ? err : {}
    })
    wiki.logger.error(err.message)
    wiki.telemetry.sendError(err)
  })

  // ----------------------------------------
  // Start HTTP server
  // ----------------------------------------

  wiki.logger.info(`HTTP Server on port: ${wiki.config.port}`)

  app.set('port', wiki.config.port)
  wiki.server = http.createServer(app)
  wiki.server.listen(wiki.config.port)

  var openConnections = []

  wiki.server.on('connection', (conn) => {
    let key = conn.remoteAddress + ':' + conn.remotePort
    openConnections[key] = conn
    conn.on('close', () => {
      delete openConnections[key]
    })
  })

  wiki.server.destroy = (cb) => {
    wiki.server.close(cb)
    for (let key in openConnections) {
      openConnections[key].destroy()
    }
  }

  wiki.server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

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

  wiki.server.on('listening', () => {
    wiki.logger.info('HTTP Server: RUNNING')
  })
}
