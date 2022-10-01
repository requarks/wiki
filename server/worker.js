const { ThreadWorker } = require('poolifier')

module.exports = new ThreadWorker(async (job) => {
  // TODO: Call external task file
  return { ok: true }
}, { async: true })
