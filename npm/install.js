'use strict'

// =====================================================
// Wiki.js
// Installation Script
// =====================================================

const Promise = require('bluebird')
const _ = require('lodash')
const colors = require('colors/safe')
const exec = require('execa')
const fs = Promise.promisifyAll(require('fs-extra'))
const https = require('follow-redirects').https
const inquirer = require('inquirer')
const os = require('os')
const path = require('path')
const pm2 = Promise.promisifyAll(require('pm2'))
const tar = require('tar')
const zlib = require('zlib')

const installDir = path.resolve(__dirname, '../..')

// =====================================================
// INSTALLATION TASKS
// =====================================================

const tasks = {
  /**
   * Stop and delete existing instances
   */
  stopAndDeleteInstances () {
    ora.text = 'Looking for running instances...'
    return pm2.connectAsync().then(() => {
      return pm2.describeAsync('wiki').then(() => {
        ora.text = 'Stopping and deleting process from pm2...'
        return pm2.deleteAsync('wiki')
      }).catch(err => { // eslint-disable-line handle-callback-err
        return true
      }).finally(() => {
        pm2.disconnect()
      })
    })
  },
  /**
   * Check for sufficient memory
   */
  checkRequirements () {
    ora.text = 'Checking system requirements...'
    if (os.totalmem() < 1024 * 1024 * 768) {
      return Promise.reject(new Error('Not enough memory to install dependencies. Minimum is 768 MB.'))
    } else {
      return Promise.resolve(true)
    }
  },
  /**
   * Install via local tarball if present
   */
  installFromLocal () {
    let hasTarball = true
    let tbPath = path.join(installDir, 'wiki-js.tar.gz')
    return fs.accessAsync(tbPath)
      .catch(err => { // eslint-disable-line handle-callback-err
        hasTarball = false
      }).then(() => {
        if (hasTarball) {
          ora.text = 'Local tarball found. Extracting...'

          return new Promise((resolve, reject) => {
            fs.createReadStream(tbPath).pipe(zlib.createGunzip())
              .pipe(tar.Extract({ path: installDir }))
              .on('error', err => reject(err))
              .on('end', () => {
                ora.text = 'Tarball extracted successfully.'
                resolve(true)
              })
          })
        } else {
          return false
        }
      })
  },
  /**
   * Install from GitHub release download
   */
  installFromRemote () {
    // Fetch version from npm package
    return fs.readJsonAsync('package.json').then((packageObj) => {
      let versionGet = _.chain(packageObj.version).split('.').take(4).join('.')
      let remoteURL = _.replace('https://github.com/Requarks/wiki/releases/download/v{0}/wiki-js.tar.gz', '{0}', versionGet)

      return new Promise((resolve, reject) => {
        // Fetch tarball
        ora.text = 'Looking for latest release...'
        https.get(remoteURL, resp => {
          if (resp.statusCode !== 200) {
            return reject(new Error('Remote file not found'))
          }
          ora.text = 'Remote wiki.js tarball found. Downloading...'

          // Extract tarball
          resp.pipe(zlib.createGunzip())
          .pipe(tar.Extract({ path: installDir }))
          .on('error', err => reject(err))
          .on('end', () => {
            ora.text = 'Tarball extracted successfully.'
            resolve(true)
          })
        })
      })
    })
  },
  /**
   * Install npm dependencies
   */
  installDependencies () {
    ora.text = 'Installing Wiki.js npm dependencies...'
    return exec.stdout('npm', ['install', '--only=production', '--no-optional'], {
      cwd: installDir
    }).then(results => {
      ora.text = 'Wiki.js npm dependencies installed successfully.'
      return true
    })
  },
  /**
   * Create default config.yml file if new installation
   */
  ensureConfigFile () {
    return fs.accessAsync(path.join(installDir, 'config.yml')).then(() => {
      // Is Upgrade
      ora.succeed('Upgrade completed.')
      console.info(colors.yellow('\n!!! IMPORTANT !!!'))
      console.info(colors.yellow('Running the configuration wizard is optional but recommended after an upgrade to ensure your config file is using the latest available settings.'))
      console.info(colors.yellow('Note that the contents of your config file will be displayed during the configuration wizard. It is therefor highly recommended to run the wizard on a non-publicly accessible port or skip this step completely.\n'))
      return true
    }).catch(err => {
      // Is New Install
      if (err.code === 'ENOENT') {
        ora.text = 'First-time install, creating a new config.yml...'
        return fs.copyAsync(path.join(installDir, 'config.sample.yml'), path.join(installDir, 'config.yml')).then(() => {
          ora.succeed('Installation succeeded.')
          return true
        })
      } else {
        return err
      }
    })
  },
  startConfigurationWizard () {
    if (process.stdout.isTTY) {
      inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Continue with configuration wizard?',
        default: 'default',
        choices: [
          { name: 'Yes, run configuration wizard on port 3000 (recommended)', value: 'default', short: 'Yes' },
          { name: 'Yes, run configuration wizard on a custom port...', value: 'custom', short: 'Yes' },
          { name: 'No, I\'ll configure the config file manually', value: 'exit', short: 'No' }
        ]
      }, {
        type: 'input',
        name: 'customport',
        message: 'Custom port to use:',
        default: 3000,
        validate: (val) => {
          val = _.toNumber(val)
          return (_.isNumber(val) && val > 0) ? true : 'Invalid Port!'
        },
        when: (ans) => {
          return ans.action === 'custom'
        }
      }]).then((ans) => {
        switch (ans.action) {
          case 'default':
            console.info(colors.bold.cyan('> Browse to http://your-server:3000/ to configure your wiki! (Replaced your-server with the hostname or IP of your server!)'))
            ora = require('ora')({ text: 'I\'ll wait until you\'re done ;)', color: 'yellow', spinner: 'pong' }).start()
            return exec.stdout('node', ['wiki', 'configure'], {
              cwd: installDir
            })
          case 'custom':
            console.info(colors.bold.cyan('> Browse to http://your-server:' + ans.customport + '/ to configure your wiki! (Replaced your-server with the hostname or IP of your server!)'))
            ora = require('ora')({ text: 'I\'ll wait until you\'re done ;)', color: 'yellow', spinner: 'pong' }).start()
            return exec.stdout('node', ['wiki', 'configure', ans.customport], {
              cwd: installDir
            })
          default:
            console.info(colors.bold.cyan('\n> You can run the configuration wizard using command:') + colors.bold.white(' node wiki configure') + colors.bold.cyan('.\n> Then start Wiki.js using command: ') + colors.bold.white('node wiki start'))
            return Promise.delay(7000).then(() => {
              process.exit(0)
            })
        }
      }).then(() => {
        ora.succeed(colors.bold.green('Wiki.js has been configured successfully. It is now starting up and should be accessible very soon!'))
        return Promise.delay(3000).then(() => {
          console.info('npm is finishing... please wait...')
        })
      })
    } else {
      console.info(colors.cyan('[WARNING] Non-interactive terminal detected. You must manually start the configuration wizard using the command: node wiki configure'))
    }
  }
}

// =====================================================
// INSTALL SEQUENCE
// =====================================================

if (!process.env.IS_HEROKU) {
  console.info(colors.yellow(
    ' __    __ _ _    _    _     \n' +
    '/ / /\\ \\ (_) | _(_)  (_)___ \n' +
    '\\ \\/  \\/ / | |/ / |  | / __| \n' +
    ' \\  /\\  /| |   <| |_ | \\__ \\ \n' +
    '  \\/  \\/ |_|_|\\_\\_(_)/ |___/ \n' +
    '                   |__/\n'))
}

let ora = require('ora')({ text: 'Initializing...', spinner: 'dots12' }).start()

Promise.join(
  tasks.stopAndDeleteInstances(),
  tasks.checkRequirements()
).then(() => {
  return tasks.installFromLocal().then(succeeded => {
    return (!succeeded) ? tasks.installFromRemote() : true
  })
}).then(() => {
  return tasks.installDependencies()
}).then(() => {
  return tasks.ensureConfigFile()
}).then(() => {
  return tasks.startConfigurationWizard()
}).catch(err => {
  ora.fail(err)
})
