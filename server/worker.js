const Promise = require('bluebird')

/* global WIKI */

module.exports = Promise.join(
  WIKI.db.onReady,
  WIKI.configSvc.loadFromDb(['features', 'git', 'logging', 'site', 'uploads'])
).then(() => {
  const path = require('path')

  WIKI.REPOPATH = path.resolve(WIKI.ROOTPATH, WIKI.config.paths.repo)
  WIKI.DATAPATH = path.resolve(WIKI.ROOTPATH, WIKI.config.paths.data)
  WIKI.UPLTEMPPATH = path.join(WIKI.DATAPATH, 'temp-upload')

  // ----------------------------------------
  // Load global modules
  // ----------------------------------------

  WIKI.lang = require('i18next')

  // ----------------------------------------
  // Localization Engine
  // ----------------------------------------

  const i18nBackend = require('i18next-node-fs-backend')
  WIKI.lang.use(i18nBackend).init({
    load: 'languageOnly',
    ns: ['common', 'admin', 'auth', 'errors', 'git'],
    defaultNS: 'common',
    saveMissing: false,
    preload: [WIKI.config.lang],
    lng: WIKI.config.lang,
    fallbackLng: 'en',
    backend: {
      loadPath: path.join(WIKI.SERVERPATH, 'locales/{{lng}}/{{ns}}.yml')
    }
  })

  // ----------------------------------------
  // Start Queues
  // ----------------------------------------

  const Bull = require('bull')
  const autoload = require('auto-load')

  let queues = autoload(path.join(WIKI.SERVERPATH, 'queues'))

  for (let queueName in queues) {
    new Bull(queueName, {
      prefix: `q-${WIKI.config.ha.nodeuid}`,
      redis: WIKI.config.redis
    }).process(queues[queueName])
  }

  // ----------------------------------------
  // Shutdown gracefully
  // ----------------------------------------

  process.on('disconnect', () => {
    process.exit()
  })
})
