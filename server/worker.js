'use strict'

/* global wiki */

const path = require('path')

// ----------------------------------------
// Load global modules
// ----------------------------------------

wiki.db = require('./modules/db').init()
wiki.upl = require('./modules/uploads-agent').init()
wiki.git = require('./modules/git').init()
wiki.entries = require('./modules/entries').init()
wiki.lang = require('i18next')
wiki.mark = require('./modules/markdown')

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

wiki.lang.use(i18nBackend).init({
  load: 'languageOnly',
  ns: ['common', 'admin', 'auth', 'errors', 'git'],
  defaultNS: 'common',
  saveMissing: false,
  preload: [wiki.config.lang],
  lng: wiki.config.lang,
  fallbackLng: 'en',
  backend: {
    loadPath: path.join(wiki.SERVERPATH, 'locales/{{lng}}/{{ns}}.json')
  }
})

// ----------------------------------------
// Start Cron
// ----------------------------------------

let job
let jobIsBusy = false
let jobUplWatchStarted = false

wiki.db.onReady.then(() => {
  return wiki.db.Entry.remove({})
}).then(() => {
  job = new Cron({
    cronTime: '0 */5 * * * *',
    onTick: () => {
      // Make sure we don't start two concurrent jobs

      if (jobIsBusy) {
        wiki.logger.warn('Previous job has not completed gracefully or is still running! Skipping for now. (This is not normal, you should investigate)')
        return
      }
      wiki.logger.info('Running all jobs...')
      jobIsBusy = true

      // Prepare async job collector

      let jobs = []
      let repoPath = path.resolve(wiki.ROOTPATH, wiki.config.paths.repo)
      let dataPath = path.resolve(wiki.ROOTPATH, wiki.config.paths.data)
      let uploadsTempPath = path.join(dataPath, 'temp-upload')

      // ----------------------------------------
      // REGULAR JOBS
      // ----------------------------------------

      //* ****************************************
      // -> Sync with Git remote
      //* ****************************************

      jobs.push(wiki.git.resync().then(() => {
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
        wiki.logger.info('All jobs completed successfully! Going to sleep for now.')

        if (!jobUplWatchStarted) {
          jobUplWatchStarted = true
          wiki.upl.initialScan().then(() => {
            job.start()
          })
        }

        return true
      }).catch((err) => {
        wiki.logger.error('One or more jobs have failed: ', err)
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
  wiki.logger.warn('Lost connection to main server. Exiting...')
  job.stop()
  process.exit()
})

process.on('exit', () => {
  job.stop()
})
