const { Client } = require('pg')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

let config = {}

try {
  conf = yaml.safeLoad(
    cfgHelper.parseConfigValue(
      fs.readFileSync(path.join(process.cwd(), 'dev/docker/config.yml'), 'utf8')
    )
  )
} catch (err) {
  console.error(err.message)
  process.exit(1)
}

const client = new Client({
  user: config.db.username,
  host: config.db.host,
  database: config.db.database,
  password: config.db.password,
  port: config.db.port,
})

async function main () {
  await client.connect()
  await client.query('DROP SCHEMA public CASCADE;')
  await client.query('CREATE SCHEMA public;')
  await client.end()
  console.info('Success.')
}

main()
