const path = require('path')

/* global WIKI */

module.exports = () => {
  WIKI.config.site = {
    path: '',
    title: 'Wiki.js'
  }

  WIKI.system = require('./core/system')

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

  // ----------------------------------------
  // Public Assets
  // ----------------------------------------

  app.use(favicon(path.join(WIKI.ROOTPATH, 'assets', 'favicon.ico')))
  app.use(express.static(path.join(WIKI.ROOTPATH, 'assets')))

  // ----------------------------------------
  // View Engine Setup
  // ----------------------------------------

  app.set('views', path.join(WIKI.SERVERPATH, 'views'))
  app.set('view engine', 'pug')

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({ extended: false }))

  app.locals.config = WIKI.config
  app.locals.data = WIKI.data
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
    let packageObj = await fs.readJson(path.join(WIKI.ROOTPATH, 'package.json'))
    res.render('main/setup', {
      packageObj,
      telemetryClientID: WIKI.telemetry.cid
    })
  })

  /**
   * Perform basic system checks
   */
  app.post('/syscheck', (req, res) => {
    WIKI.telemetry.enabled = (req.body.telemetry === true)
    WIKI.telemetry.sendEvent('setup', 'start')

    Promise.mapSeries([
      () => {
        const semver = require('semver')
        if (!semver.satisfies(semver.clean(process.version), '>=8.9.0')) {
          throw new Error('Node.js version is too old. Minimum is 8.9.0.')
        }
        return {
          title: 'Node.js ' + process.version + ' detected.',
          subtitle: ' Minimum is 8.9.0.'
        }
      },
      () => {
        return Promise.try(() => {
          require('crypto')
        }).catch(err => {
          throw new Error('Crypto Node.js module is not available.')
        }).return({
          title: 'Node.js Crypto module is available.',
          subtitle: 'Crypto module is required.'
        })
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
            resolve({
              title: 'Git ' + gitver + ' detected.',
              subtitle: 'Minimum is 2.7.4.'
            })
          })
        })
      },
      () => {
        const os = require('os')
        if (os.totalmem() < 1000 * 1000 * 768) {
          throw new Error('Not enough memory. Minimum is 768 MB.')
        }
        return {
          title: filesize(os.totalmem()) + ' of system memory available.',
          subtitle: 'Minimum is 768 MB.'
        }
      },
      () => {
        let fs = require('fs')
        return Promise.try(() => {
          fs.accessSync(path.join(WIKI.ROOTPATH, 'config.yml'), (fs.constants || fs).W_OK)
        }).catch(err => {
          throw new Error('config.yml file is not writable by Node.js process or was not created properly.')
        }).return({
          title: 'config.yml is writable by the setup process.',
          subtitle: 'Setup will write to this file.'
        })
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
    WIKI.telemetry.sendEvent('setup', 'gitcheck')

    const exec = require('execa')
    const url = require('url')

    const dataDir = path.resolve(WIKI.ROOTPATH, cfgHelper.parseConfigValue(req.body.pathData))
    const gitDir = path.resolve(WIKI.ROOTPATH, cfgHelper.parseConfigValue(req.body.pathRepo))

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
    WIKI.telemetry.sendEvent('setup', 'finalize')

    try {
      // Upgrade from WIKI.js 1.x?
      if (req.body.upgrade) {
        await WIKI.system.upgradeFromMongo({
          mongoCnStr: cfgHelper.parseConfigValue(req.body.upgMongo)
        })
      }

      // Update config file
      WIKI.logger.info('Writing config file to disk...')
      let confRaw = await fs.readFileAsync(path.join(WIKI.ROOTPATH, 'config.yml'), 'utf8')
      let conf = yaml.safeLoad(confRaw)

      conf.port = req.body.port
      conf.paths.data = req.body.pathData
      conf.paths.content = req.body.pathContent

      confRaw = yaml.safeDump(conf)
      await fs.writeFileAsync(path.join(WIKI.ROOTPATH, 'config.yml'), confRaw)

      // Set config
      _.set(WIKI.config, 'defaultEditor', 'markdown')
      _.set(WIKI.config, 'graphEndpoint', 'https://graph.requarks.io')
      _.set(WIKI.config, 'lang.code', 'en')
      _.set(WIKI.config, 'lang.autoUpdate', true)
      _.set(WIKI.config, 'lang.namespacing', false)
      _.set(WIKI.config, 'lang.namespaces', [])
      _.set(WIKI.config, 'paths.content', req.body.pathContent)
      _.set(WIKI.config, 'paths.data', req.body.pathData)
      _.set(WIKI.config, 'port', req.body.port)
      _.set(WIKI.config, 'public', req.body.public === 'true')
      _.set(WIKI.config, 'sessionSecret', (await crypto.randomBytesAsync(32)).toString('hex'))
      _.set(WIKI.config, 'telemetry.isEnabled', req.body.telemetry === 'true')
      _.set(WIKI.config, 'telemetry.clientId', WIKI.telemetry.cid)
      _.set(WIKI.config, 'theming.theme', 'default')
      _.set(WIKI.config, 'theming.darkMode', false)
      _.set(WIKI.config, 'title', req.body.title)

      // Save config to DB
      WIKI.logger.info('Persisting config to DB...')
      await WIKI.configSvc.saveToDb([
        'defaultEditor',
        'graphEndpoint',
        'lang',
        'public',
        'sessionSecret',
        'telemetry',
        'theming',
        'title'
      ])

      // Create default locale
      WIKI.logger.info('Installing default locale...')
      await WIKI.db.locales.query().insert({
        code: 'en',
        strings: require('./locales/default.json'),
        isRTL: false,
        name: 'English',
        nativeName: 'English'
      })

      // Load authentication strategies + enable local
      await WIKI.db.authentication.refreshStrategiesFromDisk()
      await WIKI.db.authentication.query().patch({ isEnabled: true }).where('key', 'local')

      // Load editors + enable default
      await WIKI.db.editors.refreshEditorsFromDisk()
      await WIKI.db.editors.query().patch({ isEnabled: true }).where('key', 'markdown')

      // Load storage targets
      await WIKI.db.storage.refreshTargetsFromDisk()

      // Create root administrator
      WIKI.logger.info('Creating root administrator...')
      await WIKI.db.users.query().delete().where({
        providerKey: 'local',
        email: req.body.adminEmail
      })
      await WIKI.db.users.query().insert({
        email: req.body.adminEmail,
        provider: 'local',
        password: req.body.adminPassword,
        name: 'Administrator',
        role: 'admin',
        locale: 'en',
        defaultEditor: 'markdown',
        tfaIsActive: false
      })

      // Create Guest account
      WIKI.logger.info('Creating guest account...')
      const guestUsr = await WIKI.db.users.query().findOne({
        providerKey: 'local',
        email: 'guest@example.com'
      })
      if (!guestUsr) {
        await WIKI.db.users.query().insert({
          provider: 'local',
          email: 'guest@example.com',
          name: 'Guest',
          password: '',
          role: 'guest',
          locale: 'en',
          defaultEditor: 'markdown',
          tfaIsActive: false
        })
      }

      WIKI.logger.info('Setup is complete!')
      res.json({
        ok: true,
        redirectPath: WIKI.config.site.path,
        redirectPort: WIKI.config.port
      }).end()

      WIKI.config.setup = false

      WIKI.logger.info('Stopping Setup...')
      WIKI.server.destroy(() => {
        WIKI.logger.info('Setup stopped. Starting Wiki.js...')
        _.delay(() => {
          WIKI.kernel.bootMaster()
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
      error: WIKI.IS_DEBUG ? err : {}
    })
    WIKI.logger.error(err.message)
    WIKI.telemetry.sendError(err)
  })

  // ----------------------------------------
  // Start HTTP server
  // ----------------------------------------

  WIKI.logger.info(`HTTP Server on port: [ ${WIKI.config.port} ]`)

  app.set('port', WIKI.config.port)
  WIKI.server = http.createServer(app)
  WIKI.server.listen(WIKI.config.port)

  var openConnections = []

  WIKI.server.on('connection', (conn) => {
    let key = conn.remoteAddress + ':' + conn.remotePort
    openConnections[key] = conn
    conn.on('close', () => {
      delete openConnections[key]
    })
  })

  WIKI.server.destroy = (cb) => {
    WIKI.server.close(cb)
    for (let key in openConnections) {
      openConnections[key].destroy()
    }
  }

  WIKI.server.on('error', (error) => {
    if (error.syscall !== 'listen') {
      throw error
    }

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

  WIKI.server.on('listening', () => {
    WIKI.logger.info('HTTP Server: [ RUNNING ]')
  })
}
