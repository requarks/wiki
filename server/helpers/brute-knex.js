const AbstractClientStore = require('express-brute/lib/AbstractClientStore')

const KnexStore = module.exports = function (options) {
  options = options || Object.create(null)

  AbstractClientStore.apply(this, arguments)
  this.options = Object.assign(Object.create(null), KnexStore.defaults, options)

  if (this.options.knex) {
    this.knex = this.options.knex
  } else {
    this.knex = require('knex')(KnexStore.defaultsKnex)
  }

  if (options.createTable === false) {
    this.ready = Promise.resolve()
  } else {
    this.ready = this.knex.schema.hasTable(this.options.tablename)
      .then((exists) => {
        if (exists) {
          return
        }

        return this.knex.schema.createTable(this.options.tablename, (table) => {
          table.string('key')
          table.bigInteger('firstRequest').nullable()
          table.bigInteger('lastRequest').nullable()
          table.bigInteger('lifetime').nullable()
          table.integer('count')
        })
      })
  }
}
KnexStore.prototype = Object.create(AbstractClientStore.prototype)
KnexStore.prototype.set = async function (key, value, lifetime, callback) {
  try {
    lifetime = lifetime || 0

    await this.ready
    const resp = await this.knex.transaction((trx) => {
      return trx
        .select('*')
        .forUpdate()
        .from(this.options.tablename)
        .where('key', '=', key)
        .then((foundKeys) => {
          if (foundKeys.length === 0) {
            return trx.from(this.options.tablename)
              .insert({
                key: key,
                lifetime: new Date(Date.now() + lifetime * 1000).getTime(),
                lastRequest: new Date(value.lastRequest).getTime(),
                firstRequest: new Date(value.firstRequest).getTime(),
                count: value.count
              })
          } else {
            return trx(this.options.tablename)
              .where('key', '=', key)
              .update({
                lifetime: new Date(Date.now() + lifetime * 1000).getTime(),
                count: value.count,
                lastRequest: new Date(value.lastRequest).getTime()
              })
          }
        })
    })
    callback(null, resp)
  } catch (err) {
    callback(err, null)
  }
}

KnexStore.prototype.get = async function (key, callback) {
  try {
    await this.ready
    await this.clearExpired()
    const resp = await this.knex.select('*')
      .from(this.options.tablename)
      .where('key', '=', key)
    let o = null

    if (resp[0]) {
      o = {}
      o.lastRequest = new Date(resp[0].lastRequest)
      o.firstRequest = new Date(resp[0].firstRequest)
      o.count = resp[0].count
    }

    callback(null, o)
  } catch (err) {
    callback(err, null)
  }
}
KnexStore.prototype.reset = async function (key, callback) {
  try {
    await this.ready
    const resp = await this.knex(this.options.tablename)
      .where('key', '=', key)
      .del()
    callback(null, resp)
  } catch (err) {
    callback(err, null)
  }
}

KnexStore.prototype.increment = async function (key, lifetime, callback) {
  try {
    const result = await this.get(key)
    let resp = null
    if (result) {
      resp = await this.knex(this.options.tablename)
        .increment('count', 1)
        .where('key', '=', key)
    } else {
      resp = await this.knex(this.options.tablename)
        .insert({
          key: key,
          firstRequest: new Date().getTime(),
          lastRequest: new Date().getTime(),
          lifetime: new Date(Date.now() + lifetime * 1000).getTime(),
          count: 1
        })
    }
    callback(null, resp)
  } catch (err) {
    callback(err, null)
  }
}

KnexStore.prototype.clearExpired = async function (callback) {
  await this.ready
  return this.knex(this.options.tablename)
    .del()
    .where('lifetime', '<', new Date().getTime())
}

KnexStore.defaults = {
  tablename: 'brute',
  createTable: true
}

KnexStore.defaultsKnex = {
  client: 'sqlite3',
  // debug: true,
  connection: {
    filename: './brute-knex.sqlite'
  }
}
