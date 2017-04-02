// ===========================================
// Wiki.js - Background Agent
// 1.0.0
// Licensed under AGPLv3
// ===========================================

global.PROCNAME = 'AGENT'
global.ROOTPATH = __dirname
global.IS_DEBUG = process.env.NODE_ENV === 'development'

let appconf = require('./libs/config')()
global.appconfig = appconf.config
global.appdata = appconf.data

// ----------------------------------------
// Load Winston
// ----------------------------------------

global.winston = require('./libs/logger')(IS_DEBUG)

// ----------------------------------------
// Load global modules
// ----------------------------------------

winston.info('[AGENT] Background Agent is initializing...')

global.db = require('./libs/db').init()
global.upl = require('./libs/uploads-agent').init()
global.git = require('./libs/git').init()
global.entries = require('./libs/entries').init()
global.mark = require('./libs/markdown')

// ----------------------------------------
// Load modules
// ----------------------------------------

var moment = require('moment')
var Promise = require('bluebird')
var fs = Promise.promisifyAll(require('fs-extra'))
var klaw = require('klaw')
var path = require('path')
var Cron = require('cron').CronJob

// ----------------------------------------
// Start Cron
// ----------------------------------------

var job
var jobIsBusy = false
var jobUplWatchStarted = false

db.onReady.then(() => {
  return db.Entry.remove({})
}).then(() => {
  job = new Cron({
    cronTime: '0 */5 * * * *',
    onTick: () => {
      // Make sure we don't start two concurrent jobs

      if (jobIsBusy) {
        winston.warn('[AGENT] Previous job has not completed gracefully or is still running! Skipping for now. (This is not normal, you should investigate)')
        return
      }
      winston.info('[AGENT] Running all jobs...')
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

      jobs.push(git.resync().then(() => {
        // -> Stream all documents

        let cacheJobs = []
        let jobCbStreamDocsResolve = null
        let jobCbStreamDocs = new Promise((resolve, reject) => {
          jobCbStreamDocsResolve = resolve
        })

        klaw(repoPath).on('data', function (item) {
          if (path.extname(item.path) === '.md' && path.basename(item.path) !== 'README.md') {
            let entryPath = entries.parsePath(entries.getEntryPathFromFullPath(item.path))
            let cachePath = entries.getCachePath(entryPath)

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
                  return entries.updateCache(entryPath).then(entry => {
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
        winston.info('[AGENT] All jobs completed successfully! Going to sleep for now.')

        if (!jobUplWatchStarted) {
          jobUplWatchStarted = true
          upl.initialScan().then(() => {
            job.start()
          })
        }

        return true
      }).catch((err) => {
        winston.error('[AGENT] One or more jobs have failed: ', err)
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
  winston.warn('[AGENT] Lost connection to main server. Exiting...')
  job.stop()
  process.exit()
})

process.on('exit', () => {
  job.stop()
})
