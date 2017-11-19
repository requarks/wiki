const path = require('path')

/* global wiki */

module.exports = () => {
  wiki.config.site = {
    path: '',
    title: 'Wiki.js'
  }

  wiki.system = require('./modules/system')

  // ----------------------------------------
  // Load modules
  // ----------------------------------------

  const bodyParser = require('body-parser')
  const compression = require('compression')
  const express = require('express')
  const favicon = require('serve-favicon')
  const http = require('http')
  const Promise = require('bluebird')
  const fs = require('fs-extra')
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
  // Controllers
  // ----------------------------------------

  app.get('*', async (req, res) => {
    let packageObj = await fs.readJson(path.join(wiki.ROOTPATH, 'package.json'))
    res.render('configure/index', {
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

      // Load configuration file
      let confRaw = await fs.readFile(path.join(wiki.ROOTPATH, 'config.yml'), 'utf8')
      let conf = yaml.safeLoad(confRaw)

      // Update config
      conf.host = req.body.host
      conf.port = req.body.port
      conf.paths.repo = req.body.pathRepo

      // Generate session secret
      let sessionSecret = (await crypto.randomBytesAsync(32)).toString('hex')
      console.info(sessionSecret)

      // Save updated config to file
      confRaw = yaml.safeDump(conf)
      await fs.writeFile(path.join(wiki.ROOTPATH, 'config.yml'), confRaw)

      res.json({ ok: true })
    } catch (err) {
      res.json({ ok: false, error: err.message })
    }
  })

  /**
   * Restart in normal mode
   */
  app.post('/restart', (req, res) => {
    res.status(204).end()
    /* server.destroy(() => {
      spinner.text = 'Setup wizard terminated. Restarting in normal mode...'
      _.delay(() => {
        const exec = require('execa')
        exec.stdout('node', ['wiki', 'start']).then(result => {
          spinner.succeed('Wiki.js is now running in normal mode!')
          process.exit(0)
        })
      }, 1000)
    }) */
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
  server = http.createServer(app)
  server.listen(wiki.config.port)

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
    wiki.logger.info('HTTP Server: RUNNING')
  })
}
