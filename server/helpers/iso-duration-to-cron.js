const iso8601 = require('iso8601-duration')

function isoDurationToCron(duration) {
  const parsed = iso8601.parse(duration)
  const fields = ['years', 'months', 'weeks', 'days', 'hours', 'minutes', 'seconds']
  const nonZero = fields.filter(f => parsed[f])
  if (nonZero.length !== 1) {
    throw new Error('This ISO 8601 duration cannot be represented as a cron expression')
  }
  const n = parsed[nonZero[0]]
  switch (nonZero[0]) {
    case 'years':
      return `0 0 1 1 */${n}` // every N years (approx)
    case 'months':
      return `0 0 1 */${n} *` // every N months
    case 'weeks':
      return `0 0 * * 0/${n}` // every N weeks (Sunday)
    case 'days':
      return `0 0 */${n} * *` // every N days
    case 'hours':
      return `0 */${n} * * *` // every N hours
    case 'minutes':
      return `*/${n} * * * *` // every N minutes
    default:
      throw new Error('This ISO 8601 duration cannot be represented as a cron expression')
  }
}

module.exports = { isoDurationToCron }
