const { ThreadWorker } = require('poolifier')

module.exports = new ThreadWorker(async (job) => {
  return { ok: true }
}, { async: true })
