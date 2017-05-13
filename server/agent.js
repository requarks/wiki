// ===========================================
// Wiki.js - Background Agent
// 1.0.0
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const ROOTPATH = process.cwd()
const SERVERPATH = path.join(ROOTPATH, 'server')

global.ROOTPATH = ROOTPATH
global.SERVERPATH = SERVERPATH
const IS_DEBUG = process.env.NODE_ENV === 'development'

let appconf = require('./libs/config')()
global.appconfig = appconf.config
global.appdata = appconf.data

// ----------------------------------------
// Load Winston
// ----------------------------------------

global.winston = require('./libs/logger')(IS_DEBUG, 'AGENT')

// ----------------------------------------
// Load global modules
// ----------------------------------------

global.winston.info('Background Agent is initializing...')

global.db = require('./libs/db').init()
global.upl = require('./libs/uploads-agent').init()
global.git = require('./libs/git').init()
global.entries = require('./libs/entries').init()
global.lang = require('i18next')
global.mark = require('./libs/markdown')

// ----------------------------------------
// Load modules
// ----------------------------------------

const moment = require('moment')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const klaw = require('klaw')
const Cron = require('cron').CronJob
const i18nBackend = require('i18next-node-fs-backend')

const entryHelper = require('./helpers/entry')

// ----------------------------------------
// Localization Engine
// ----------------------------------------

global.lang
  .use(i18nBackend)
  .init({
    load: 'languageOnly',
    ns: ['common', 'admin', 'auth', 'errors', 'git'],
    defaultNS: 'common',
    saveMissing: false,
    preload: [appconfig.lang],
    lng: appconfig.lang,
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(SERVERPATH, 'locales/{{lng}}/{{ns}}.json')
    }
  })

// ----------------------------------------
// Start Cron
// ----------------------------------------

let job
let jobIsBusy = false
let jobUplWatchStarted = false

global.db.onReady.then(() => {
  return global.db.Entry.remove({})
}).then(() => {
  job = new Cron({
    cronTime: '0 */5 * * * *',
    onTick: () => {
      // Make sure we don't start two concurrent jobs

      if (jobIsBusy) {
        global.winston.warn('Previous job has not completed gracefully or is still running! Skipping for now. (This is not normal, you should investigate)')
        return
      }
      global.winston.info('Running all jobs...')
      jobIsBusy = true

      // Prepare async job collector

      let jobs = []
      let repoPath = path.resolve(ROOTPATH, appconfig.paths.repo)
      let dataPath = path.resolve(ROOTPATH, appconfig.paths.data)
      let uploadsTempPath = path.join(dataPath, 'temp-upload')

      // ----------------------------------------
      // REGULAR JOBS
      // ----------------------------------------

      //* ****************************************
      // -> Sync with Git remote
      //* ****************************************

      jobs.push(global.git.resync().then(() => {
        // -> Stream all documents

        let cacheJobs = []
        let jobCbStreamDocsResolve = null
        let jobCbStreamDocs = new Promise((resolve, reject) => {
          jobCbStreamDocsResolve = resolve
        })

        klaw(repoPath).on('data', function (item) {
          if (path.extname(item.path) === '.md' && path.basename(item.path) !== 'README.md') {
            let entryPath = entryHelper.parsePath(entryHelper.getEntryPathFromFullPath(item.path))
            let cachePath = entryHelper.getCachePath(entryPath)

            // -> Purge outdated cache

            cacheJobs.push(
              fs.statAsync(cachePath).then((st) => {
                return moment(st.mtime).isBefore(item.stats.mtime) ? 'expired' : 'active'
              }).catch((err) => {
                return (err.code !== 'EEXIST') ? err : 'new'
              }).then((fileStatus) => {
                // -> Delete expired cache file

                if (fileStatus === 'expired') {
                  return fs.unlinkAsync(cachePath).return(fileStatus)
                }

                return fileStatus
              }).then((fileStatus) => {
                // -> Update cache and search index

                if (fileStatus !== 'active') {
                  return global.entries.updateCache(entryPath).then(entry => {
                    process.send({
                      action: 'searchAdd',
                      content: entry
                    })
                    return true
                  })
                }

                return true
              })
            )
          }
        }).on('end', () => {
          jobCbStreamDocsResolve(Promise.all(cacheJobs))
        })

        return jobCbStreamDocs
      }))

      //* ****************************************
      // -> Clear failed temporary upload files
      //* ****************************************

      jobs.push(
        fs.readdirAsync(uploadsTempPath).then((ls) => {
          let fifteenAgo = moment().subtract(15, 'minutes')

          return Promise.map(ls, (f) => {
            return fs.statAsync(path.join(uploadsTempPath, f)).then((s) => { return { filename: f, stat: s } })
          }).filter((s) => { return s.stat.isFile() }).then((arrFiles) => {
            return Promise.map(arrFiles, (f) => {
              if (moment(f.stat.ctime).isBefore(fifteenAgo, 'minute')) {
                return fs.unlinkAsync(path.join(uploadsTempPath, f.filename))
              } else {
                return true
              }
            })
          })
        })
      )

      // ----------------------------------------
      // Run
      // ----------------------------------------

      Promise.all(jobs).then(() => {
        global.winston.info('All jobs completed successfully! Going to sleep for now.')

        if (!jobUplWatchStarted) {
          jobUplWatchStarted = true
          global.upl.initialScan().then(() => {
            job.start()
          })
        }

        return true
      }).catch((err) => {
        global.winston.error('One or more jobs have failed: ', err)
      }).finally(() => {
        jobIsBusy = false
      })
    },
    start: false,
    timeZone: 'UTC',
    runOnInit: true
  })
})

// ----------------------------------------
// Shutdown gracefully
// ----------------------------------------

process.on('disconnect', () => {
  global.winston.warn('Lost connection to main server. Exiting...')
  job.stop()
  process.exit()
})

process.on('exit', () => {
  job.stop()
})
